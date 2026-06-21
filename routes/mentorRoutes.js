const express = require("express");
const router = express.Router();
const {
  getMentors,
  getMentorProfile,
  updateMentor,
  deleteMentor
} = require("../controllers/mentor.controller.js");

router.get("/", getMentors);
router.get("/:id", getMentorProfile);
router.put("/:id", updateMentor);
router.delete("/:id", deleteMentor);

module.exports = router;