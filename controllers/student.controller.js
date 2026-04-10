// controllers/StudentController.js

const pool = require("../config/dbConnex.js");
const bcrypt = require("bcrypt")

// const fullName = `${student.firstname} ${student.lastname}`;

exports.getStudents = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, firstname, lastname, email, created_at
       FROM students
       ORDER BY created_at DESC`
    );

    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });

  } catch (error) {
    console.error("FULL ERROR:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


exports.createStudent = async (req, res) => {
  const { firstname, lastname, email, password } = req.body;

  try {
    if (!firstname || !lastname || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO students (firstname, lastname, email, password)
       VALUES ($1, $2, $3, $4)
       RETURNING id, firstname, lastname, email`,
      [firstname, lastname, email, hashedPassword]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    if (error.code === "23505") {
      return res.status(400).json({
        success: false,
        message: "Email already exists"
      });
    }

    console.error(error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};



exports.updateStudent = async (req, res) => {
  const { id } = req.params;
  const { firstname, lastname, email, password } = req.body;

  try {
    let hashedPassword = null;

    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const result = await pool.query(
      `UPDATE students
       SET firstname = COALESCE($1, firstname),
           lastname = COALESCE($2, lastname),
           email = COALESCE($3, email),
           password = COALESCE($4, password)
       WHERE id = $5
       RETURNING id, firstname, lastname, email`,
      [firstname, lastname, email, hashedPassword, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

    res.status(200).json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};



exports.deleteStudent = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM students WHERE id = $1 RETURNING id",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Student deleted"
    });

  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};