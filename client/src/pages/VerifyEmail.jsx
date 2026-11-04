import { useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";

export default function VerifyEmail() {
  const { hash, state } = useLocation();
  const params = new URLSearchParams(hash.slice(1));
  const token = params.get("token");
  const setup = params.get("setup") === "1";
  const [email, setEmail] = useState(state?.email ?? "");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [verified, setVerified] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [verificationRequired, setVerificationRequired] = useState(null);
  const [configError, setConfigError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function loadConfig() {
      try {
        const response = await fetch("http://localhost:5001/api/auth/config", { signal: controller.signal });
        if (!response.ok) throw new Error("Unable to load authentication settings.");
        const config = await response.json();
        if (!controller.signal.aborted) setVerificationRequired(Boolean(config.emailVerificationRequired));
      } catch {
        if (!controller.signal.aborted) setConfigError(true);
      }
    }
    loadConfig();
    return () => controller.abort();
  }, []);

  async function submit(event, verify) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (verify && setup && password !== confirmation) {
      setError("Your passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`http://localhost:5001/api/auth/${verify ? "verify-email" : "resend-verification"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(verify ? { token, password } : { email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setMessage(data.message);
      if (verify) setVerified(true);
    } catch (error) {
      setError(error.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (verificationRequired === false) return <Navigate to="/login" replace state={state} />;
  if (verificationRequired === null) return <main className="mx-auto max-w-md p-6">
    {configError ? <p role="alert">Unable to load verification settings. Please reload and try again.</p>
      : <p role="status">Loading…</p>}
  </main>;

  return <>
    <Header />
    <main className="bg-gray-50 px-6 py-16">
      <div className="mx-auto max-w-md space-y-5 rounded-xl border border-gray-200 bg-white p-6">
        <h1 className="text-3xl font-bold">{verified ? "Email verified" : token ? "Verify your email" : "Check your inbox"}</h1>
        {!verified && token && <form className="space-y-4" onSubmit={event => submit(event, true)}>
          <p>{setup ? "Set a password to finish creating your account." : "Confirm your account password to verify your email."}</p>
          <label className="block">Password
            <input type="password" required autoComplete={setup ? "new-password" : "current-password"}
              className="mt-1 block w-full rounded border px-3 py-2" value={password} onChange={event => setPassword(event.target.value)} />
          </label>
          {setup && (
            <label className="block">Confirm password
              <input type="password" required autoComplete="new-password"
                className="mt-1 block w-full rounded border px-3 py-2" value={confirmation} onChange={event => setConfirmation(event.target.value)} />
            </label>
          )}
          <button type="submit" disabled={busy} className="rounded bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-60">Verify email</button>
        </form>}
        {!verified && <form className="space-y-3" onSubmit={event => submit(event, false)}>
          {!token && <p>Open the link in your verification email to continue.</p>}
          <label className="block">Need a new verification link?
            <input type="email" required autoComplete="email" maxLength={255}
              className="mt-1 block w-full rounded border px-3 py-2" value={email} onChange={event => setEmail(event.target.value)} />
          </label>
          <button type="submit" disabled={busy} className="rounded border px-4 py-2 font-semibold disabled:opacity-60">Resend verification email</button>
        </form>}
        {error && <p role="alert" className="text-red-600">{error}</p>}
        {message && <p role="status">{message}</p>}
        <Link to="/login" state={state} className="inline-block font-semibold text-blue-700">Sign in</Link>
      </div>
    </main>
    <Footer />
  </>;
}
