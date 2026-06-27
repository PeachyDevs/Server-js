const express = require("express");
const router = express.Router();

const {
  getMentors,
  getMentorProfile
} = require("../controllers/mentor.controller.js");

router.get("/", getMentors);
router.get("/:id", getMentorProfile);

module.exports = router;