import sharp from "sharp";

const maxBytes = 4 * 1024 * 1024;

export async function prepareCoverPhoto(value) {
  // Omitted means keep the current photo. Null means remove it.
  if (value === undefined || value === null) return value;
  if (typeof value !== "string" || value.length > Math.ceil(maxBytes / 3) * 4 ||
      value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error("Choose a JPEG, PNG or WebP photo up to 4 MB.");
  }
  const input = Buffer.from(value, "base64");
  if (input.length > maxBytes) throw new Error("Cover photos must be 4 MB or smaller.");
  try {
    const photo = sharp(input, { limitInputPixels: 32_000_000 });
    const { format, pages } = await photo.metadata();
    if (!["jpeg", "png", "webp"].includes(format) || (pages ?? 1) > 1) throw new Error();
    return await photo.rotate().resize(1400, 1400, { fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  } catch {
    throw new Error("Choose a still JPEG, PNG or WebP photo under 32 megapixels.");
  }
}

export const coverPhotoTable = `CREATE TABLE IF NOT EXISTS event_cover_photos (
  event_id INTEGER PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  image BYTEA NOT NULL
)`;
