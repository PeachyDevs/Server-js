const express = require("express");
const router = express.Router();

const {
  getStudents,
  getStudentById,
  updateStudent,
  deleteStudent
} = require("../controllers/student.controller.js");

router.get("/", getStudents);
router.get("/:id", getStudentById);
router.put("/:id", updateStudent);
router.delete("/:id", deleteStudent);

module.exports = router;