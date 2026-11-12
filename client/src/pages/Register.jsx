import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import GoogleSignIn from "../components/GoogleSignIn";
import { useAuth } from "../context/AuthContext";

function Register() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(false);
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

    const firstName = formData.firstName.trim();
    const lastName = formData.lastName.trim();
    const name = firstName + " " + lastName;
    if (!firstName || !lastName || name.length > 100) {
      setError("Enter a first and last name, up to 100 characters combined.");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Your passwords do not match.");
      return;
    }

    setError("");

    setLoading(true);

    try {
      const response = await fetch(
        "http://localhost:5001/api/auth/register",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            email: formData.email,
            password: formData.password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to create your account.");
      }

      navigate(data.verificationRequired ? "/verify-email" : "/login", {
        state: { email: formData.email, returnTo: state?.returnTo, accountCreated: !data.verificationRequired },
      });
    } catch (error) {
      console.error("Registration error:", error);
      setError(
        error.message || "Something went wrong. Please try again."
      );
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
              Create an account
            </h1>

          </div>

          <form
            onSubmit={handleSubmit}
            className="border-t border-stone-200 pt-6"
          >
            <div className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                {[
                  ["firstName", "First name", "given-name"],
                  ["lastName", "Last name", "family-name"],
                ].map(([field, label, autoComplete]) => (
                  <div key={field}>
                    <label htmlFor={field} className="block text-sm font-semibold text-gray-900">{label}</label>
                    <input id={field} name={field} type="text" value={formData[field]} onChange={handleChange}
                      autoComplete={autoComplete} maxLength={100} required
                      className="form-control" />
                  </div>
                ))}
              </div>

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
                  maxLength={255}
                  required
                  className="form-control"
                />
              </div>

              {[
                ["password", "Password"],
                ["confirmPassword", "Confirm password"],
              ].map(([field, label]) => (
                <div key={field}>
                  <label htmlFor={field} className="block text-sm font-semibold text-gray-900">{label}</label>
                  <input id={field} name={field} type="password" value={formData[field]} onChange={handleChange}
                    autoComplete="new-password" minLength={8} maxLength={72} required
                    className="form-control" />
                </div>
              ))}
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
              {loading ? "Creating Account..." : "Create Account"}
            </button>

            <p className="mt-6 text-center text-sm text-gray-600">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-semibold text-brand-600 hover:text-brand-700"
              >
                Log in
              </Link>
            </p>
          </form>
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

export default Register;
