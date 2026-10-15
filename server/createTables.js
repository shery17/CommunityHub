import pool from "./db.js";

async function createTables() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Reset development tables in dependency order.
    await client.query(`
      DROP TABLE IF EXISTS event_attendees CASCADE;
      DROP TABLE IF EXISTS events CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);

    // Create users first because events and registrations reference users.
    await client.query(`
      CREATE TABLE users (
        id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Every event can record its creator.
    await client.query(`
      CREATE TABLE events (
        id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        description TEXT NOT NULL,
        date DATE NOT NULL,
        time TIME NOT NULL,
        location VARCHAR(255) NOT NULL,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Prevent the same user registering for an event more than once.
    await client.query(`
      CREATE TABLE event_attendees (
        id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        user_id INTEGER NOT NULL
          REFERENCES users(id) ON DELETE CASCADE,
        event_id INTEGER NOT NULL
          REFERENCES events(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, event_id)
      );
    `);

    await client.query("COMMIT");
    console.log("Development tables recreated successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error recreating tables:", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

createTables();

