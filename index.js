require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");

const app = express();
const corsOptions = require("./config/corsOptions");
const { logger } = require("./middlewares/logger");

const PORT = process.env.PORT || 3500;

app.use(logger);
app.use(cors(corsOptions));
app.use(express.json());

// ROUTES
app.use("/", require("./routes/root"));
app.use("/students", require("./routes/studentRoutes"));
app.use("/mentors", require("./routes/mentorRoutes"));

app.get("/api/test", (req, res) => {
  res.json({ message: "API is working" });
});

// 404 HANDLER
app.all(/.*/, (req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// SERVER
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});