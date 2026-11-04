import { createHash, randomBytes } from "node:crypto";
import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import pool from "./db.js";
import { seedOrganiserEmail } from "./seedEvents.js";
import requireAuth from "./middleware/requireAuth.js";

const auth = express.Router();
const google = new OAuth2Client();
const digest = token => createHash("sha256").update(token).digest("hex");
const cleanEmail = value => typeof value === "string" ? value.trim().toLowerCase() : "";
const validEmail = email => email.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validPassword = password => typeof password === "string" && password.length >= 8 && Buffer.byteLength(password) <= 72;
const inboxMessage = "If this address needs verification, check your inbox for a link.";
const requiresEmailVerification = () => process.env.REQUIRE_EMAIL_VERIFICATION === "true";

function mailSettings() {
  const { RESEND_API_KEY, VERIFICATION_FROM, CLIENT_ORIGIN } = process.env;
  if (!RESEND_API_KEY || !VERIFICATION_FROM || !CLIENT_ORIGIN) return null;
  const origin = new URL(CLIENT_ORIGIN);
  if (origin.protocol !== "https:" && !(origin.protocol === "http:" && ["localhost", "127.0.0.1"].includes(origin.hostname))) return null;
  return { key: RESEND_API_KEY, from: VERIFICATION_FROM, origin: origin.origin };
}

// Bound both requests per IP and verification sends per recipient.
const attempts = new Map();
auth.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (req.method !== "POST") return next();
  const now = Date.now();
  const key = req.ip;
  let entry = attempts.get(key);
  if (!entry || entry.until <= now) {
    if (attempts.size >= 10000) {
      for (const [ip, value] of attempts) if (value.until <= now) attempts.delete(ip);
      if (attempts.size >= 10000 && !attempts.has(key)) return res.status(429).json({ message: "Please try again shortly." });
    }
    entry = { count: 0, until: now + 60_000 };
    attempts.set(key, entry);
  }
  if (++entry.count > 20) {
    res.set("Retry-After", String(Math.ceil((entry.until - now) / 1000)));
    return res.status(429).json({ message: "Too many attempts. Please try again shortly." });
  }
  next();
});

async function sendVerification(email, settings) {
  if (email === seedOrganiserEmail) return;
  const token = randomBytes(32).toString("hex");
  const hash = digest(token);
  const result = await pool.query(
    `UPDATE users SET verification_hash = $2, verification_expires_at = now() + interval '30 minutes',
       verification_sent_at = now()
     WHERE email = $1 AND email_verified_at IS NULL
       AND (verification_sent_at IS NULL OR verification_sent_at <= now() - interval '2 minutes')
     RETURNING id, password_hash IS NULL AS needs_password`,
    [email, hash]
  );
  if (!result.rowCount) return;
  const { id, needs_password } = result.rows[0];
  const link = new URL("/verify-email", settings.origin);
  link.hash = new URLSearchParams({ token, ...(needs_password ? { setup: "1" } : {}) }).toString();
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${settings.key}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        from: settings.from, to: [email], subject: "Verify your CommunityHub email",
        text: `Open this link to verify your email address: ${link.href}\n\nIt expires in 30 minutes. If you did not request this, you can ignore this email.`,
      }),
    });
    if (!response.ok) throw new Error("Mail provider rejected the request");
  } catch {
    // A failed send can be retried without deleting the pending account.
    await pool.query("UPDATE users SET verification_sent_at = NULL WHERE id = $1 AND verification_hash = $2", [id, hash]);
    console.error("Unable to deliver a CommunityHub verification email.");
  }
}

auth.get("/config", (req, res) => res.json({
  googleClientId: process.env.GOOGLE_CLIENT_ID || null,
  emailVerificationRequired: requiresEmailVerification(),
}));

auth.post("/register", async (req, res) => {
  const email = cleanEmail(req.body?.email);
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name || name.length > 100 || !validEmail(email)) {
    return res.status(400).json({ message: "Enter a name and a valid email address." });
  }
  const password = req.body?.password;
  if (!validPassword(password)) {
    return res.status(400).json({ message: "Choose a password with at least 8 characters and at most 72 bytes." });
  }
  const verificationRequired = requiresEmailVerification();
  const settings = verificationRequired ? mailSettings() : null;
  if (verificationRequired && !settings) return res.status(503).json({ message: "Email registration is temporarily unavailable." });
  if (email === seedOrganiserEmail) return res.status(409).json({ message: "This email address is unavailable." });
  const passwordHash = await bcrypt.hash(password, 12);
  const created = await pool.query(
    `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO NOTHING`, [name, email, passwordHash]
  );
  if (verificationRequired) {
    await sendVerification(email, settings);
    return res.status(202).json({ message: inboxMessage, verificationRequired });
  }
  if (!created.rowCount) return res.status(409).json({ message: "An account with this email already exists." });
  return res.status(201).json({ message: "Account created. You can now sign in.", verificationRequired });
});

auth.post("/resend-verification", async (req, res) => {
  if (!requiresEmailVerification()) return res.status(404).json({ message: "Email verification is disabled." });
  const email = cleanEmail(req.body?.email);
  if (!validEmail(email)) return res.status(400).json({ message: "Enter a valid email address." });
  const settings = mailSettings();
  if (!settings) return res.status(503).json({ message: "Verification email is temporarily unavailable." });
  await sendVerification(email, settings);
  res.status(202).json({ message: inboxMessage });
});

auth.post("/verify-email", async (req, res) => {
  if (!requiresEmailVerification()) return res.status(404).json({ message: "Email verification is disabled." });
  const { token, password } = req.body ?? {};
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) {
    return res.status(400).json({ message: "This verification link is invalid or expired." });
  }
  const hash = digest(token);
  const pending = await pool.query(
    `SELECT id, password_hash FROM users WHERE verification_hash = $1
     AND verification_expires_at > now() AND email_verified_at IS NULL`, [hash]
  );
  const user = pending.rows[0];
  if (!user) return res.status(400).json({ message: "This verification link is invalid or expired." });
  // Require the registration password so an unsolicited link cannot activate
  // an account whose password was chosen by someone else.
  if (user.password_hash && (typeof password !== "string" || !await bcrypt.compare(password, user.password_hash))) {
    return res.status(400).json({ message: "Enter the password for this CommunityHub account." });
  }
  if (!user.password_hash && !validPassword(password)) {
    return res.status(400).json({ message: "Choose a password with at least 8 characters and at most 72 bytes." });
  }
  const passwordHash = user.password_hash ? null : await bcrypt.hash(password, 12);
  const verified = await pool.query(
    `UPDATE users SET email_verified_at = now(), password_hash = COALESCE(password_hash, $3),
       verification_hash = NULL, verification_expires_at = NULL, verification_sent_at = NULL
     WHERE id = $1 AND verification_hash = $2 AND verification_expires_at > now()
       AND email_verified_at IS NULL AND password_hash IS NOT DISTINCT FROM $4`,
    [user.id, hash, passwordHash, user.password_hash]
  );
  if (!verified.rowCount) return res.status(400).json({ message: "This verification link is invalid or expired." });
  res.json({ message: "Email verified. You can now sign in." });
});

function startSession(res, { id, name, email, google_subject, email_verified_at }) {
  const token = jwt.sign({ userId: id, verified: true, emailVerified: Boolean(email_verified_at) },
    process.env.JWT_SECRET, { expiresIn: "1h" });
  return res.json({ token, user: { id, name, email, googleLinked: Boolean(google_subject) } });
}

auth.post("/login", async (req, res) => {
  const email = cleanEmail(req.body?.email);
  const password = req.body?.password;
  if (!validEmail(email) || !validPassword(password)) return res.status(401).json({ message: "Invalid email or password." });
  const result = await pool.query(
    "SELECT id, name, email, password_hash, email_verified_at, google_subject FROM users WHERE email = $1", [email]
  );
  const user = result.rows[0];
  if (!user?.password_hash || !await bcrypt.compare(password, user.password_hash)) {
    return res.status(401).json({ message: "Invalid email or password." });
  }
  if (requiresEmailVerification() && !user.email_verified_at) return res.status(403).json({
    code: "EMAIL_UNVERIFIED", message: "Verify your email address before signing in.",
  });
  return startSession(res, user);
});

async function googleIdentity(req, res, next) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return res.status(503).json({ message: "Google sign-in is unavailable." });
  const credential = req.body?.credential;
  if (typeof credential !== "string" || credential.length > 8192) {
    return res.status(400).json({ message: "A Google credential is required." });
  }
  try {
    const ticket = await google.verifyIdToken({ idToken: credential, audience: clientId });
    const claims = ticket.getPayload();
    const email = cleanEmail(claims.email);
    if (!claims.sub || claims.email_verified !== true || !validEmail(email)) {
      return res.status(400).json({ message: "Google did not provide a verified email address." });
    }
    req.googleIdentity = { email, subject: claims.sub, name: claims.name?.trim().slice(0, 100) || email.slice(0, 100),
      authoritative: email.endsWith("@gmail.com") || Boolean(claims.hd) };
    next();
  } catch {
    return res.status(401).json({ message: "Could not verify Google sign-in. Please try again." });
  }
}

auth.post("/google", googleIdentity, async (req, res) => {
  const { email, subject, name, authoritative } = req.googleIdentity;
  const linked = await pool.query("SELECT id, name, email, google_subject, email_verified_at FROM users WHERE google_subject = $1 AND email_verified_at IS NOT NULL", [subject]);
  if (linked.rowCount) return startSession(res, linked.rows[0]);
  if (!authoritative) return res.status(409).json({
    message: "Verify this address through email registration, then link Google from your CommunityHub profile.",
  });
  const created = await pool.query(
    `INSERT INTO users (name, email, google_subject, email_verified_at) VALUES ($1, $2, $3, now())
     ON CONFLICT DO NOTHING RETURNING id, name, email, google_subject, email_verified_at`, [name, email, subject]
  );
  if (created.rowCount) return startSession(res, created.rows[0]);
  // A concurrent first sign-in may have just created the linked account.
  const concurrent = await pool.query("SELECT id, name, email, google_subject, email_verified_at FROM users WHERE google_subject = $1 AND email_verified_at IS NOT NULL", [subject]);
  if (concurrent.rowCount) return startSession(res, concurrent.rows[0]);
  return res.status(409).json({ message: "Sign in to your existing CommunityHub account, then link Google from your profile." });
});

auth.post("/google/link", requireAuth, googleIdentity, async (req, res) => {
  const { email, subject } = req.googleIdentity;
  try {
    const linked = await pool.query(
      `UPDATE users SET google_subject = $3 WHERE id = $1 AND email = $2
       AND email_verified_at IS NOT NULL AND (google_subject IS NULL OR google_subject = $3)
       RETURNING id, name, email, google_subject, email_verified_at`, [req.user.userId, email, subject]
    );
    if (linked.rowCount) return startSession(res, linked.rows[0]);
  } catch (error) {
    if (error.code !== "23505") throw error;
  }
  return res.status(409).json({ message: "Choose an unlinked Google account with the same email as your CommunityHub account." });
});

auth.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error("CommunityHub authentication request failed.", error.code ?? error.name);
  res.status(500).json({ message: "Unable to complete this request. Please try again." });
});

export default auth;
