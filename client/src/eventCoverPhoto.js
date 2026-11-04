export const coverPhotoUrl = id => `http://localhost:5001/api/events/${id}/cover-photo`;

export function encodeCoverPhoto(file) {
  if (file == null) return file;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = () => reject(new Error("Unable to read this cover photo."));
    reader.readAsDataURL(file);
  });
}
