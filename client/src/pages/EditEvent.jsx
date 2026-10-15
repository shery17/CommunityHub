
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { useAuth } from "../context/AuthContext";

function EditEvent() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    date: "",
    time: "",
    location: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchEvent() {
      try {
        const response = await fetch(
          `http://localhost:5001/api/events/${id}`
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Unable to load event.");
        }

        if (!cancelled) {
          if (Number(data.created_by) !== Number(user?.id)) {
            setError("You can only edit events you created.");
            return;
          }

          setFormData({
            title: data.title ?? "",
            description: data.description ?? "",
            date: data.date ? String(data.date).slice(0, 10) : "",
            time: data.time ? String(data.time).slice(0, 5) : "",
            location: data.location ?? "",
          });
        }
      } catch (error) {
        if (!cancelled) {
          setError(error.message || "Unable to load this event.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchEvent();

    return () => {
      cancelled = true;
    };
  }, [id, user]);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const token = sessionStorage.getItem("token");

    if (!token) {
      setError("Your session has expired. Please log in again.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        `http://localhost:5001/api/events/${id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(formData),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to update event.");
      }

      navigate(`/events/${id}`);
    } catch (error) {
      setError(error.message || "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Header />

      <main className="min-h-screen bg-gray-50 px-6 py-12 sm:py-16">
        <div className="mx-auto max-w-3xl">
          <Link
            to={`/events/${id}`}
            className="font-semibold text-blue-600 hover:text-blue-800"
          >
            ← Back to Event
          </Link>

          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Edit Event
            </h1>

            <p className="mt-2 text-gray-600">
              Update the details of your community event.
            </p>

            {loading ? (
              <p className="mt-6 text-gray-600" role="status">
                Loading event details...
              </p>
            ) : error && !formData.title ? (
              <div className="mt-6">
                <p className="text-red-600" role="alert">
                  {error}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <div>
                  <label
                    htmlFor="title"
                    className="mb-2 block text-sm font-semibold text-gray-700"
                  >
                    Event Title
                  </label>
                  <input
                    id="title"
                    name="title"
                    type="text"
                    required
                    maxLength={200}
                    value={formData.title}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="description"
                    className="mb-2 block text-sm font-semibold text-gray-700"
                  >
                    Description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    required
                    rows={5}
                    value={formData.description}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="date"
                      className="mb-2 block text-sm font-semibold text-gray-700"
                    >
                      Date
                    </label>
                    <input
                      id="date"
                      name="date"
                      type="date"
                      required
                      value={formData.date}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="time"
                      className="mb-2 block text-sm font-semibold text-gray-700"
                    >
                      Time
                    </label>
                    <input
                      id="time"
                      name="time"
                      type="time"
                      required
                      value={formData.time}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="location"
                    className="mb-2 block text-sm font-semibold text-gray-700"
                  >
                    Location
                  </label>
                  <input
                    id="location"
                    name="location"
                    type="text"
                    required
                    maxLength={255}
                    value={formData.location}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-600" role="alert">
                    {error}
                  </p>
                )}

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "Saving Changes..." : "Save Changes"}
                  </button>

                  <Link
                    to={`/events/${id}`}
                    className="rounded-lg border border-gray-300 px-6 py-3 font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}

export default EditEvent;
