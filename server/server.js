import express from "express";
import cors from "cors";
import pool from "./db.js";

const app = express();

app.use(cors()); // allows frontend to talk with server
app.use(express.json()); // parses incoming json in req object -> server can accept json data

app.get("/", (req, res) => {
  res.send("CommunityHub API is running!");
});

app.get("/api/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");

    res.json({
      message: "Database connection works!",
      time: result.rows[0].now,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Database connection failed",
    });
  }
});

app.get("/api/events", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM events
      ORDER BY date, time;
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching events:", error);

    res.status(500).json({
      message: "Failed to fetch events",
    });
  }
});

app.get("/api/events/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Check that the ID is a valid positive integer.
    if (!/^[1-9]\d*$/.test(id)) {
      return res.status(400).json({
        message: "Invalid event ID",
      });
    }

    const result = await pool.query(
      "SELECT * FROM events WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Event not found",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching event:", error);

    res.status(500).json({
      message: "Failed to fetch event",
    });
  }
});

const PORT = 5001;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});