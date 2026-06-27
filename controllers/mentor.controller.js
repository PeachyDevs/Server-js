const pool = require("../config/dbConnex");

// GET ALL MENTORS
const getMentors = async (req, res) => {
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
        m.expertise,
        m.years_of_experience,
        m.bio AS mentor_bio,
        m.created_at
       FROM users u
       JOIN mentors m ON u.id = m.user_id
       WHERE u.role = 'mentor'
       ORDER BY m.created_at DESC`
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

// GET SINGLE MENTOR
const getMentorProfile = async (req, res) => {
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
        m.expertise,
        m.years_of_experience,
        m.bio AS mentor_bio,
        m.created_at
       FROM users u
       JOIN mentors m ON u.id = m.user_id
       WHERE u.id = $1 AND u.role = 'mentor'`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Mentor not found"
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

module.exports = {
  getMentors,
  getMentorProfile
};