require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");

const app = express();

const corsOptions = require("./config/corsOptions");
const { logger } = require("./middlewares/logger");

const PORT = process.env.PORT || 3500;

// =========================
// MIDDLEWARES
// =========================
app.use(logger);
app.use(cors(corsOptions));
app.use(express.json());

// =========================
// ROUTES
// =========================

// Root route
app.use("/", require("./routes/root"));

// AUTH ROUTES (IMPORTANT - ADD THIS)
app.use("/auth", require("./routes/authRoutes"));

//) PROTECTED USER ROUTES
app.use("/students", require("./routes/studentRoutes"));
app.use("/mentors", require("./routes/mentorRoutes"));

// Test route
app.get("/api/test", (req, res) => {
  res.json({ message: "API is working" });
});

// =========================
// 404 HANDLER
// =========================
app.all(/.*/, (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
});

// =========================
// SERVER START
// =========================
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// rate limiting the password tries for login attempts
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // max 10 requests per IP
  message: { error: 'Too many attempts, please try again later.' }
});

app.use('/auth', authLimiter);