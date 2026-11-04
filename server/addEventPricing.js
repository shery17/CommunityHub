import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import pool from "./db.js";
import { priceCheckSql, priceCurrencyCheckSql } from "./eventPricing.js";
import { getEventReadModel } from "./eventReadModel.js";
import { buildSeedEvents, seedOrganiserEmail } from "./seedEvents.js";

export async function addEventPricing(db = pool) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(742018, 3)");
    if (!(await getEventReadModel(client)).multiDay) throw new Error("The multi-day schema must be installed first.");
    await client.query("ALTER TABLE events ADD COLUMN IF NOT EXISTS price NUMERIC(10,2), ADD COLUMN IF NOT EXISTS currency VARCHAR(3)");
    for (const [name, sql] of [["events_price_valid", priceCheckSql], ["events_price_currency_pair", priceCurrencyCheckSql]]) {
      const found = await client.query("SELECT 1 FROM pg_constraint WHERE conrelid = 'events'::regclass AND conname = $1", [name]);
      if (!found.rowCount) await client.query(`ALTER TABLE events ADD CONSTRAINT ${name} CHECK (${sql})`);
    }
    let backfilled = 0;
    for (const sample of buildSeedEvents()) {
      const result = await client.query(`UPDATE events SET price = $1, currency = $2
        WHERE price IS NULL AND currency IS NULL AND (created_by IS NULL OR created_by = (SELECT id FROM users WHERE email = $6))
          AND title = $3 AND description = $4 AND location = $5`,
      [sample.price, sample.currency, sample.title, sample.description, sample.location, seedOrganiserEmail]);
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
    const result = await addEventPricing();
    console.log(`Event pricing ready; ${result.backfilled} sample events priced. Existing schedules and registrations preserved.`);
  } catch (error) {
    console.error("Error adding event pricing:", error.message);
    process.exitCode = 1;
  } finally { await pool.end(); }
}
