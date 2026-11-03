import pool from "./db.js";
import { getEventReadModel } from "./eventReadModel.js";

try {
  if (!(await getEventReadModel(pool)).multiDay) throw new Error("Install the multi-day event schema first.");
  await pool.query("ALTER TABLE events ADD COLUMN IF NOT EXISTS capacity INTEGER CHECK (capacity > 0)");
  console.log("Optional event capacity is ready.");
} catch (error) {
  console.error("Unable to add event capacity:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
