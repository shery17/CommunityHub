import pool from "./db.js";
import { buildSeedEvents, ensureSeedOrganiser } from "./seedEvents.js";

const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(742018, 1)");
  await client.query("LOCK TABLE events IN ACCESS EXCLUSIVE MODE");
  const unowned = await client.query("SELECT 1 FROM events WHERE created_by IS NULL LIMIT 1");
  if (unowned.rowCount) {
    const organiserId = await ensureSeedOrganiser(client);
    for (const { title, description, location } of buildSeedEvents()) {
      await client.query(
        `UPDATE events SET created_by = $1
         WHERE created_by IS NULL AND title = $2 AND description = $3 AND location = $4`,
        [organiserId, title, description, location]
      );
    }
  }
  const remaining = await client.query("SELECT 1 FROM events WHERE created_by IS NULL LIMIT 1");
  if (remaining.rowCount) throw new Error("Assign an organiser to unowned events before running this migration.");
  await client.query(`ALTER TABLE events
    ALTER COLUMN created_by SET NOT NULL,
    DROP CONSTRAINT events_created_by_fkey,
    ADD CONSTRAINT events_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT`);
  await client.query("COMMIT");
  console.log("All events now require an organiser.");
} catch (error) {
  await client.query("ROLLBACK");
  console.error(error.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
