import pool from "./db.js";
import { coverPhotoTable } from "./eventCoverPhoto.js";

try {
  await pool.query(coverPhotoTable);
  console.log("Event cover photo storage is ready.");
} catch (error) {
  console.error("Unable to create cover photo storage:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
