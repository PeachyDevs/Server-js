// routes/StudentRoutes.js

const express = require("express");
const router = express.Router();
const {
  getStudents,
  createStudent,
  updateStudent,
  deleteStudent
} = require("../controllers/student.controller.js");

router.get("/", getStudents);
router.post("/", createStudent);
router.put("/:id", updateStudent);
router.delete("/:id", deleteStudent);

module.exports = router;