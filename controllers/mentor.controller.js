const pool = require("../config/dbConnex");

// @desc Get all mentors
// @route GET /mentors
// @access Private
const getMentors = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.firstname, u.lastname, u.email, m.expertise, m.years_of_experience, m.bio, u.created_at
       FROM users u
       JOIN mentors m ON u.id = m.user_id
       WHERE u.role = 'mentor'
       ORDER BY u.created_at DESC`
    );

    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc Get mentor profile
// @route GET /mentors/:id
// @access Private
const getMentorProfile = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT u.id, u.firstname, u.lastname, u.email, m.expertise, m.years_of_experience, m.bio, u.created_at
       FROM users u
       JOIN mentors m ON u.id = m.user_id
       WHERE u.id = $1 AND u.role = 'mentor'`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Mentor not found" });
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

module.exports = {
  getMentors,
  getMentorProfile
};
