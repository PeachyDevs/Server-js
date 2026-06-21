const pool = require("../config/dbConnex.js");
const bcrypt = require("bcryptjs");

/**
 * GET ALL STUDENTS
 */
exports.getStudents = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        u.id,
        u.firstname,
        u.lastname,
        u.email,
        u.role,
        s.school,
        s.grade_level,
        s.interests,
        u.created_at
       FROM users u
       JOIN students s ON u.id = s.user_id
       WHERE u.role = 'student'
       ORDER BY u.created_at DESC`
    );

    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * GET STUDENT BY ID
 */
exports.getStudentById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT 
        u.id,
        u.firstname,
        u.lastname,
        u.email,
        u.role,
        s.school,
        s.grade_level,
        s.interests,
        u.created_at
       FROM users u
       JOIN students s ON u.id = s.user_id
       WHERE u.id = $1 AND u.role = 'student'`,
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
      data: result.rows[0]
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * UPDATE STUDENT
 */
exports.updateStudent = async (req, res) => {
  const { id } = req.params;
  const { firstname, lastname, email, school, grade_level, interests } = req.body;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userUpdate = await client.query(
      `UPDATE users
       SET firstname = COALESCE($1, firstname),
           lastname = COALESCE($2, lastname),
           email = COALESCE($3, email)
       WHERE id = $4 AND role = 'student'
       RETURNING id`,
      [firstname, lastname, email, id]
    );

    if (userUpdate.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

    await client.query(
      `UPDATE students
       SET school = COALESCE($1, school),
           grade_level = COALESCE($2, grade_level),
           interests = COALESCE($3, interests)
       WHERE user_id = $4`,
      [school, grade_level, interests, id]
    );

    await client.query("COMMIT");

    res.status(200).json({
      success: true,
      message: "Student updated successfully"
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  } finally {
    client.release();
  }
};

/**
 * DELETE STUDENT
 */
exports.deleteStudent = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `DELETE FROM users
       WHERE id = $1 AND role = 'student'
       RETURNING id`,
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
      message: "Student deleted successfully"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * CREATE STUDENT (IMPORTANT - FIXED FLOW)
 */
exports.createStudent = async (req, res) => {
  const { firstname, lastname, email, password, school, grade_level, interests } = req.body;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const hashedPassword = await bcrypt.hash(password, 10);

    const userResult = await client.query(
      `INSERT INTO users (firstname, lastname, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'student')
       RETURNING id`,
      [firstname, lastname, email, hashedPassword]
    );

    const userId = userResult.rows[0].id;

    await client.query(
      `INSERT INTO students (user_id, school, grade_level, interests)
       VALUES ($1, $2, $3, $4)`,
      [userId, school, grade_level, interests]
    );

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Student created successfully",
      user_id: userId
    });

  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      return res.status(400).json({
        success: false,
        message: "Email already exists"
      });
    }

    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });

  } finally {
    client.release();
  }
};