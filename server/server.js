import express from "express";
import cors from "cors";

const app = express();

app.use(cors()); // allows frontend to talk with server
app.use(express.json()); // parses incoming json in req object -> server can accept json data

app.get("/", (req, res) => {
  res.send("CommunityHub API is running!");
});

const PORT = 5001;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});