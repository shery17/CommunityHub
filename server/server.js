import express from "express";
import cors from "cors";
import pool from "./db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import requireAuth from "./middleware/requireAuth.js";

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

app.put("/api/events/:id", requireAuth, async (req, res) => {
  try {
    const eventId = req.params.id;

    if (!/^[1-9]\d*$/.test(eventId)) {
      return res.status(400).json({
        message: "Invalid event ID.",
      });
    }

    const { title, description, date, time, location } = req.body;

    if (
      typeof title !== "string" ||
      !title.trim() ||
      typeof description !== "string" ||
      !description.trim() ||
      !date ||
      !time ||
      typeof location !== "string" ||
      !location.trim()
    ) {
      return res.status(400).json({
        message: "Please provide all required event fields.",
      });
    }

    const result = await pool.query(
      `UPDATE events
       SET title = $1,
           description = $2,
           date = $3,
           time = $4,
           location = $5
       WHERE id = $6 AND created_by = $7
       RETURNING *`,
      [
        title.trim(),
        description.trim(),
        date,
        time,
        location.trim(),
        eventId,
        req.user.userId,
      ]
    );

    if (result.rowCount === 0) {
      const event = await pool.query(
        "SELECT id FROM events WHERE id = $1",
        [eventId]
      );

      if (event.rowCount === 0) {
        return res.status(404).json({
          message: "Event not found.",
        });
      }

      return res.status(403).json({
        message: "You can only edit events you created.",
      });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating event:", error);

    return res.status(500).json({
      message: "Failed to update event.",
    });
  }
});

app.delete("/api/events/:id", requireAuth, async (req, res) => {
  try {
    const eventId = req.params.id;

    if (!/^[1-9]\d*$/.test(eventId)) {
      return res.status(400).json({
        message: "Invalid event ID.",
      });
    }

    const result = await pool.query(
      `DELETE FROM events
       WHERE id = $1 AND created_by = $2
       RETURNING id`,
      [eventId, req.user.userId]
    );

    if (result.rowCount === 0) {
      const event = await pool.query(
        "SELECT id FROM events WHERE id = $1",
        [eventId]
      );

      if (event.rowCount === 0) {
        return res.status(404).json({
          message: "Event not found.",
        });
      }

      return res.status(403).json({
        message: "You can only delete events you created.",
      });
    }

    return res.json({
      message: "Event deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting event:", error);

    return res.status(500).json({
      message: "Failed to delete event.",
    });
  }
});

app.post("/api/events", requireAuth, async (req, res) => {
  try {
    const { title, description, date, time, location } = req.body;

    if (
      !title?.trim() ||
      !description?.trim() ||
      !date ||
      !time ||
      !location?.trim()
    ) {
      return res.status(400).json({
        message: "Please provide all required event fields.",
      });
    }

    const result = await pool.query(
      `INSERT INTO events
        (title, description, date, time, location, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        title.trim(),
        description.trim(),
        date,
        time,
        location.trim(),
        req.user.userId,
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating event:", error);

    return res.status(500).json({
      message: "Failed to create event.",
    });
  }
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check required fields.
    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      !name.trim() ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: "Name, email and password are required.",
      });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanName.length > 100 || cleanEmail.length > 255) {
      return res.status(400).json({
        message: "Name or email is too long.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters long.",
      });
    }

    // Check whether the email is already registered.
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [cleanEmail]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    // Hash the password before storing it.
    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, created_at`,
      [cleanName, cleanEmail, passwordHash]
    );

    res.status(201).json({
      message: "Account created successfully.",
      user: result.rows[0],
    });
  } catch (error) {
    // Handle a duplicate email if two requests arrive together.
    if (error.code === "23505") {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    console.error("Error registering user:", error);

    res.status(500).json({
      message: "Failed to create account.",
    });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not configured.");

      return res.status(500).json({
        message: "Authentication is not configured.",
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    const result = await pool.query(
      `SELECT id, name, email, password_hash
       FROM users
       WHERE email = $1`,
      [cleanEmail]
    );

    const user = result.rows[0];

    // Use the same message for unknown emails and incorrect passwords.
    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    const token = jwt.sign(
      {
        userId: user.id,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1h",
      }
    );

    res.json({
      message: "Login successful.",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Error logging in:", error);

    res.status(500).json({
      message: "Failed to log in.",
    });
  }
});

app.post("/api/events/:id/register", requireAuth, async (req, res) => {
  try {
    const eventId = req.params.id;

    if (!/^[1-9]\d*$/.test(eventId)) {
      return res.status(400).json({
        message: "Invalid event ID.",
      });
    }

    const userId = req.user.userId;

    const event = await pool.query(
      "SELECT id FROM events WHERE id = $1",
      [eventId]
    );

    if (event.rows.length === 0) {
      return res.status(404).json({
        message: "Event not found.",
      });
    }

    const result = await pool.query(
      `INSERT INTO event_attendees (user_id, event_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, event_id) DO NOTHING
       RETURNING id`,
      [userId, eventId]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({
        message: "You are already registered for this event.",
      });
    }

    return res.status(201).json({
      message: "Successfully registered for the event.",
    });
  } catch (error) {
    console.error("Error registering for event:", error);

    return res.status(500).json({
      message: "Failed to register for the event.",
    });
  }
});

app.get("/api/users/me/events", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         e.id,
         e.title,
         e.description,
         e.date,
         e.time,
         e.location,
         ea.created_at AS registered_at
       FROM event_attendees ea
       JOIN events e ON e.id = ea.event_id
       WHERE ea.user_id = $1
       ORDER BY e.date ASC, e.time ASC`,
      [req.user.userId]
    );

    return res.json(result.rows);
  } catch (error) {
    console.error("Error fetching registered events:", error);

    return res.status(500).json({
      message: "Failed to load your registered events.",
    });
  }
});

app.delete("/api/events/:id/register", requireAuth, async (req, res) => {
  try {
    const eventId = req.params.id;

    if (!/^[1-9]\d*$/.test(eventId)) {
      return res.status(400).json({
        message: "Invalid event ID.",
      });
    }

    const result = await pool.query(
      `DELETE FROM event_attendees
       WHERE user_id = $1 AND event_id = $2
       RETURNING id`,
      [req.user.userId, eventId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "You are not registered for this event.",
      });
    }

    return res.json({
      message: "Registration cancelled successfully.",
    });
  } catch (error) {
    console.error("Error cancelling registration:", error);

    return res.status(500).json({
      message: "Failed to cancel registration.",
    });
  }
});

const PORT = 5001;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});