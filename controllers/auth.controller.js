const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/dbConnex");

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

// @desc Register User
// @route POST /auth/register
// @access Public
const register = async (req, res) => {
  const client = await pool.connect();
  try {
    const { email, password, firstname, lastname, role, ...profileData } = req.body;

    if (!email || !password || !firstname || !lastname || !role) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (role !== "student" && role !== "mentor") {
      return res.status(400).json({ message: "Invalid role" });
    }

    await client.query("BEGIN");

    // 1. Check if user exists
    const userExists = await client.query("SELECT id FROM users WHERE email = $1", [email]);
    if (userExists.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "User already exists" });
    }

    // 2. Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 3. Create user
    const newUser = await client.query(
      "INSERT INTO users (email, password_hash, firstname, lastname, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, firstname, lastname, role",
      [email, passwordHash, firstname, lastname, role]
    );

    const userId = newUser.rows[0].id;

    // 4. Create student or mentor profile
    if (role === "student") {
      const { school, grade_level, interests } = profileData;
      await client.query(
        "INSERT INTO students (user_id, school, grade_level, interests) VALUES ($1, $2, $3, $4)",
        [userId, school, grade_level, interests]
      );
    } else if (role === "mentor") {
      const { expertise, years_of_experience, bio } = profileData;
      await client.query(
        "INSERT INTO mentors (user_id, expertise, years_of_experience, bio) VALUES ($1, $2, $3, $4)",
        [userId, expertise, years_of_experience, bio]
      );
    }

    await client.query("COMMIT");

    res.status(201).json({
      message: "User registered successfully",
      user: newUser.rows[0]
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  } finally {
    client.release();
  }
};

// @desc Login
// @route POST /auth/login
// @access Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // 1. Find user
    const userResult = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

    if (userResult.rows.length === 0) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const user = userResult.rows[0];

    // 2. Compare password
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // 3. Fetch related profile
    let profile = null;
    if (user.role === "student") {
      const studentResult = await pool.query("SELECT * FROM students WHERE user_id = $1", [user.id]);
      profile = studentResult.rows[0];
    } else if (user.role === "mentor") {
      const mentorResult = await pool.query("SELECT * FROM mentors WHERE user_id = $1", [user.id]);
      profile = mentorResult.rows[0];
    }

    // 4. Create token
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });

    delete user.password_hash;

    res.json({
      message: "Login successful",
      user: { ...user, profile },
      token
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  register,
  login
};
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      student: {
        id: user.id,
        firstname: user.firstname,
        email: user.email
      },
      token
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  login
};