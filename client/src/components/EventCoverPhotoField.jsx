import { useEffect, useRef, useState } from "react";

export default function EventCoverPhotoField({ file, onChange, existingUrl, disabled }) {
  const fileInput = useRef(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const source = file ? preview : file === undefined ? existingUrl : "";

  function selectPhoto(event) {
    const selected = event.target.files[0];
    event.target.value = "";
    if (!selected) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type) || selected.size > 4 * 1024 * 1024) {
      setError("Choose a JPEG, PNG or WebP photo up to 4 MB.");
      return;
    }
    setError("");
    setPreview(URL.createObjectURL(selected));
    onChange(selected);
  }

  return (
    <fieldset disabled={disabled} className="space-y-2">
      <legend className="text-sm font-semibold text-gray-900">Cover photo (optional)</legend>
      <p id="cover-photo-help" className="text-sm text-gray-600">JPEG, PNG or WebP, up to 4 MB. A landscape photo works best.</p>
      {source && <img src={source} alt="Cover photo preview" className="aspect-video w-full max-w-sm rounded-lg object-cover" />}
      <button type="button" onClick={() => fileInput.current.click()} aria-describedby="cover-photo-help"
        className="block rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-60">
        {source ? "Replace photo" : "Choose a photo"}
      </button>
      <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={selectPhoto} hidden />
      {source && <button type="button" onClick={() => { setError(""); setPreview(""); onChange(null); }}
        className="text-sm font-semibold text-red-700 underline">Remove photo</button>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </fieldset>
  );
}
