import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import GoogleSignIn from "../components/GoogleSignIn";
import { useAuth } from "../context/AuthContext";

function Login() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    email: state?.email ?? "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [error, setError] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((previousData) => ({
      ...previousData,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setNeedsVerification(false);

    try {
      const response = await fetch(
        "http://localhost:5001/api/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setNeedsVerification(data.code === "EMAIL_UNVERIFIED");
        throw new Error(data.message || "Unable to log in.");
      }

      login(data.user, data.token);

      navigate(state?.returnTo === "/create-event" ? "/create-event" : "/", { replace: true });
    } catch (error) {
      console.error("Login error:", error);
      setError(error.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Header />

      <main className="bg-white px-5 py-10 sm:py-16">
        <div className="mx-auto max-w-sm">
          <div className="mb-7">
            <h1 className="text-3xl font-semibold tracking-tight text-stone-950">
              Log in
            </h1>

          </div>

          {state?.accountCreated && <p role="status" className="mb-4 text-center text-sm text-green-800">
            Account created. You can now sign in.
          </p>}

          <form
            onSubmit={handleSubmit}
            className="border-t border-stone-200 pt-6"
          >
            <div className="space-y-5">
              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-semibold text-gray-900"
                >
                  Email
                </label>

                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  className="form-control"
                />
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-semibold text-gray-900"
                >
                  Password
                </label>

                <input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  className="form-control"
                />
              </div>
            </div>

            {error && (
              <p className="mt-5 text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="primary-action mt-7 w-full"
            >
              {loading ? "Logging In..." : "Log In"}
            </button>

            <p className="mt-6 text-center text-sm text-gray-600">
              Don't have an account?{" "}
              <Link
                to="/register" state={state}
                className="font-semibold text-brand-600 hover:text-brand-700"
              >
                Create an account
              </Link>
            </p>
          </form>
          {needsVerification && <div className="mt-4 text-center">
            <Link to="/verify-email" state={{ email: formData.email, returnTo: state?.returnTo }} className="text-sm font-semibold text-brand-700">
              Resend verification email
            </Link>
          </div>}
          <div className="mt-4"><GoogleSignIn onSuccess={data => {
            login(data.user, data.token);
            navigate(state?.returnTo === "/create-event" ? "/create-event" : "/", { replace: true });
          }} /></div>
        </div>
      </main>

      <Footer />
    </>
  );
}

export default Login;
