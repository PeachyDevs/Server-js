const pool = require("../config/dbConnex.js");

/**
 * GET ALL STUDENTS
 */
exports.getStudents = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.phone,
        u.address,
        u.bio,
        u.avatar_url,
        s.school,
        s.grade_level,
        s.interests,
        s.created_at
       FROM users u
       JOIN students s ON u.id = s.user_id
       WHERE u.role = 'student'
       ORDER BY s.created_at DESC`
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
        u.first_name,
        u.last_name,
        u.phone,
        u.address,
        u.bio,
        u.avatar_url,
        s.school,
        s.grade_level,
        s.interests,
        s.created_at
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
  const { first_name, last_name, phone, address, bio, avatar_url, school, grade_level, interests } = req.body;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userUpdate = await client.query(
      `UPDATE users
       SET first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           phone = COALESCE($3, phone),
           address = COALESCE($4, address),
           bio = COALESCE($5, bio),
           avatar_url = COALESCE($6, avatar_url)
       WHERE id = $7 AND role = 'student'
       RETURNING id`,
      [first_name, last_name, phone, address, bio, avatar_url, id]
    );

    if (userUpdate.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Student not found" });
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