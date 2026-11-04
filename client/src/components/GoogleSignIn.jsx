import { useEffect, useRef, useState } from "react";

let scriptPromise;
function loadGoogle() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve(window.google.accounts.id);
    script.onerror = () => {
      script.remove();
      scriptPromise = undefined;
      reject(new Error("Unable to load Google sign-in."));
    };
    document.head.append(script);
  });
  return scriptPromise;
}

export default function GoogleSignIn({ onSuccess, linking = false }) {
  const container = useRef(null);
  const success = useRef(onSuccess);
  const [error, setError] = useState("");

  useEffect(() => { success.current = onSuccess; }, [onSuccess]);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    async function render() {
      try {
        const config = await fetch("http://localhost:5001/api/auth/config", { signal });
        if (!config.ok) throw new Error("Unable to load sign-in options.");
        const { googleClientId } = await config.json();
        if (!googleClientId || signal.aborted) return;
        const google = await loadGoogle();
        if (signal.aborted) return;
        google.initialize({
          client_id: googleClientId,
          callback: async ({ credential }) => {
            if (signal.aborted) return;
            setError("");
            try {
              const response = await fetch(`http://localhost:5001/api/auth/google${linking ? "/link" : ""}`, {
                method: "POST", signal,
                headers: {
                  "Content-Type": "application/json",
                  ...(linking ? { Authorization: `Bearer ${sessionStorage.getItem("token")}` } : {}),
                },
                body: JSON.stringify({ credential }),
              });
              const data = await response.json();
              if (!response.ok) throw new Error(data.message || "Unable to continue with Google.");
              if (!signal.aborted) success.current(data);
            } catch (error) {
              if (!signal.aborted) setError(error.message);
            }
          },
        });
        container.current.replaceChildren();
        google.renderButton(container.current, { type: "standard", theme: "outline", size: "large", text: "continue_with" });
      } catch (error) {
        if (!signal.aborted) setError(error.message);
      }
    }
    render();
    return () => controller.abort();
  }, [linking]);

  return <div>
    <div ref={container} className="flex justify-center empty:hidden" />
    {error && <p className="mt-2 text-sm text-red-600" role="alert">{error}</p>}
  </div>;
}
