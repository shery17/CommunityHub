import pool from "./db.js";

const events = [
  {
    title: "Community Clean-Up",
    description:
      "Join local residents to help clean up our neighbourhood and make our community a better place.",
    date: "2027-05-10",
    time: "10:00",
    location: "Leeds City Centre",
  },
  {
    title: "Local Football Meetup",
    description:
      "Meet local football enthusiasts for a friendly and welcoming game. All abilities are welcome.",
    date: "2027-05-11",
    time: "14:00",
    location: "Roundhay Park, Leeds",
  },
  {
    title: "Community Food Market",
    description:
      "Discover local produce, meet independent traders and support businesses in our community.",
    date: "2027-05-11",
    time: "11:00",
    location: "Leeds Kirkgate Market",
  },
];

async function seedEvents() {
  try {
    for (const event of events) {
      await pool.query(
        `INSERT INTO events (title, description, date, time, location)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          event.title,
          event.description,
          event.date,
          event.time,
          event.location,
        ]
      );
    }

    console.log("Sample events inserted successfully.");
  } catch (error) {
    console.error("Error inserting sample events:", error);
  } finally {
    await pool.end();
  }
}

seedEvents();
