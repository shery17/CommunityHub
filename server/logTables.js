import pool from "./db.js";

async function logTables() {
  try {
    const result = await pool.query(`
      SELECT
        table_name,
        column_name,
        data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position;
    `);

    console.table(result.rows);
  } catch (error) {
    console.error("Error reading database tables:", error);
  } finally {
    await pool.end();
  }
}

logTables();
