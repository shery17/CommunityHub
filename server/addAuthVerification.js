import pool from "./db.js";

try {
  await pool.query(`ALTER TABLE users
    ALTER COLUMN password_hash DROP NOT NULL,
    ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS verification_hash TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS verification_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS verification_sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS google_subject TEXT UNIQUE`);
  console.log("Email verification and Google account columns are ready.");
} catch (error) {
  console.error("Unable to update the authentication schema:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
