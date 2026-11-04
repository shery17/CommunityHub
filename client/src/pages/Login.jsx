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

      <main className="bg-gray-50 py-16">
        <div className="mx-auto max-w-md px-6">
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900">
              Welcome Back
            </h1>

            <p className="mt-3 text-gray-600">
              Log in to your CommunityHub account.
            </p>
          </div>

          {state?.accountCreated && <p role="status" className="mb-4 text-center text-sm text-green-800">
            Account created. You can now sign in.
          </p>}

          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm"
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
                  className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
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
                  className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
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
              className="mt-8 w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Logging In..." : "Log In"}
            </button>

            <p className="mt-6 text-center text-sm text-gray-600">
              Don't have an account?{" "}
              <Link
                to="/register" state={state}
                className="font-semibold text-blue-600 hover:text-blue-700"
              >
                Create an account
              </Link>
            </p>
          </form>
          {needsVerification && <div className="mt-4 text-center">
            <Link to="/verify-email" state={{ email: formData.email, returnTo: state?.returnTo }} className="text-sm font-semibold text-blue-700">
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
