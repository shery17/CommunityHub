import pool from "./db.js";
import { getEventReadModel } from "./eventReadModel.js";

try {
  if (!(await getEventReadModel(pool)).multiDay) throw new Error("Install the multi-day event schema first.");
  await pool.query("ALTER TABLE events ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ");
  console.log("Event cancellation is ready.");
} catch (error) {
  console.error("Unable to add event cancellation:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}

