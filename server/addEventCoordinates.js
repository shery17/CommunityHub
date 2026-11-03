import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import pool from "./db.js";
import { getEventReadModel } from "./eventReadModel.js";
import { coordinatesCheckSql } from "./eventCoordinates.js";

export async function addEventCoordinates(db=pool) {
  const client=await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(742018,5)");
    if (!(await getEventReadModel(client)).hasStructuredLocation) throw new Error("Install structured event locations first.");
    await client.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION, ADD COLUMN IF NOT EXISTS place_label VARCHAR(500)`);
    const found=await client.query("SELECT 1 FROM pg_constraint WHERE conrelid='events'::regclass AND conname='events_coordinates_valid'");
    if (!found.rowCount) await client.query(`ALTER TABLE events ADD CONSTRAINT events_coordinates_valid CHECK (${coordinatesCheckSql})`);
    await client.query("COMMIT");
  } catch(error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href===import.meta.url) {
  try { await addEventCoordinates(); console.log("Event coordinates ready. Existing data preserved; no positions inferred."); }
  catch(error) { console.error("Error adding coordinates:",error.message); process.exitCode=1; }
  finally { await pool.end(); }
}
