import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import pool from "./db.js";
import { categoryCheckSql } from "./eventCategories.js";
import { getEventReadModel } from "./eventReadModel.js";
import { buildSeedEvents } from "./seedEvents.js";

export async function addEventCategories(db = pool) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(742018, 2)");
    if (!(await getEventReadModel(client)).multiDay) throw new Error("The multi-day schema must be installed first.");
    await client.query("ALTER TABLE events ADD COLUMN IF NOT EXISTS category VARCHAR(50)");
    const constraint = await client.query(`SELECT 1 FROM pg_constraint
      WHERE conrelid = 'events'::regclass AND conname = 'events_category_allowed'`);
    if (!constraint.rowCount) {
      await client.query(`ALTER TABLE events ADD CONSTRAINT events_category_allowed CHECK (${categoryCheckSql})`);
    }
    let backfilled = 0;
    for (const sample of buildSeedEvents()) {
      const result = await client.query(`UPDATE events SET category = $1
        WHERE category IS NULL AND created_by IS NULL AND title = $2
          AND description = $3 AND location = $4`,
      [sample.category, sample.title, sample.description, sample.location]);
      backfilled += result.rowCount;
    }
    await client.query("COMMIT");
    return { backfilled };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const result = await addEventCategories();
    console.log(`Event categories ready; ${result.backfilled} sample events categorised. Existing schedules and registrations preserved.`);
  } catch (error) {
    console.error("Error adding event categories:", error.message);
    process.exitCode = 1;
  } finally { await pool.end(); }
}
