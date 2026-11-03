import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import pool from "./db.js";
import { getEventReadModel } from "./eventReadModel.js";

export async function addEventLocations(db = pool) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(742018, 4)");
    if (!(await getEventReadModel(client)).multiDay) throw new Error("The multi-day schema must be installed first.");
    await client.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS address VARCHAR(255),
      ADD COLUMN IF NOT EXISTS city VARCHAR(100), ADD COLUMN IF NOT EXISTS postcode VARCHAR(32),
      ADD COLUMN IF NOT EXISTS country VARCHAR(100)`);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    await addEventLocations();
    console.log("Structured event locations ready. Existing event data preserved.");
  } catch (error) {
    console.error("Error adding event locations:", error.message);
    process.exitCode = 1;
  } finally { await pool.end(); }
}
