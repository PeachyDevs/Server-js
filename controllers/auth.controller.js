const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const pool = require("../config/dbConnex");
const transporter = require("../utils/mailer");

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined in environment variables");
}

/**
 * =========================
 * REGISTER
 * =========================
 */
const register = async (req, res) => {
    const client = await pool.connect();

    try {
        const {
            first_name,
            last_name,
            role,
            phone,
            address,
            bio,
            avatar_url,
            password,
            ...profileData
        } = req.body;

        // Normalize email to prevent duplicates caused by capitalization
        const email = req.body.email?.toLowerCase();

        if (!first_name || !last_name || !role || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields"
            });
        }

        if (!["student", "mentor"].includes(role)) {
            return res.status(400).json({
                success: false,
                message: "Invalid role"
            });
        }

        await client.query("BEGIN");

        const existing = await client.query(
            "SELECT id FROM users WHERE email = $1",
            [email]
        );

        if (existing.rows.length > 0) {
            await client.query("ROLLBACK");
            return res.status(400).json({
                success: false,
                message: "User already exists"
            });
        }

        const password_hash = await bcrypt.hash(password, 10);

        const newUser = await client.query(
            `INSERT INTO users 
    (first_name, last_name, role, phone, address, bio, avatar_url, email, password_hash)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
   RETURNING id, first_name, last_name, role`,
            [
                first_name,
                last_name,
                role,
                phone,
                address,
                bio,
                avatar_url,
                email,
                password_hash
            ]
        );

        const userId = newUser.rows[0].id;

        if (role === "student") {
            const { school, grade_level, interests } = profileData;

            await client.query(
                `INSERT INTO students (user_id, school, grade_level, interests)
         VALUES ($1,$2,$3,$4)`,
                [userId, school, grade_level, interests]
            );
        }

        if (role === "mentor") {
            const { expertise, years_of_experience } = profileData;

            await client.query(
                `INSERT INTO mentors (user_id, expertise, years_of_experience)
         VALUES ($1,$2,$3)`,
                [userId, expertise, years_of_experience]
            );
        }

        await client.query("COMMIT");

        return res.status(201).json({
            success: true,
            message: "User registered successfully",
            user: newUser.rows[0]
        });
    } catch (error) {
        await client.query("ROLLBACK");
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    } finally {
        client.release();
    }
};

/**
 * =========================
 * LOGIN
 * =========================
 */
const login = async (req, res) => {
    try {
        const password = req.body.password;
        // Normalize email to match the database stored format
        const email = req.body.email?.toLowerCase();

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Missing credentials"
            });
        }

        const userResult = await pool.query(
            "SELECT * FROM users WHERE email = $1",
            [email]
        );

        if (userResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        const user = userResult.rows[0];

        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        let profile = null;

        if (user.role === "student") {
            const r = await pool.query(
                "SELECT * FROM students WHERE user_id = $1",
                [user.id]
            );
            profile = r.rows[0];
        }

        if (user.role === "mentor") {
            const r = await pool.query(
                "SELECT * FROM mentors WHERE user_id = $1",
                [user.id]
            );
            profile = r.rows[0];
        }

        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, {
            expiresIn: "7d"
        });

        delete user.password_hash;

        return res.json({
            success: true,
            message: "Login successful",
            token,
            user: {
                ...user,
                profile
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

/**
 * =========================
 * RESET PASSWORD REQUEST
 * =========================
 */
const requestReset = async (req, res) => {
    try {
        const email = req.body.email?.toLowerCase();

        const result = await pool.query(
            "SELECT id, email FROM users WHERE email = $1",
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const user = result.rows[0];

        const token = crypto.randomBytes(32).toString("hex");

        const expiry = new Date();
        expiry.setHours(expiry.getHours() + 1);

        await pool.query(
            `UPDATE users 
       SET reset_token = $1,
           reset_token_expiry = $2
       WHERE id = $3`,
            [token, expiry, user.id]
        );

        // Dynamically assign URL based on the environment
        const clientUrl = process.env.NODE_ENV === "Development" 
            ? process.env.CLIENT_URL_DEV 
            : process.env.CLIENT_URL_PROD;

        const resetLink = `${clientUrl}/reset-password?token=${token}`;

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: "Password Reset",
            html: `<p>Click to reset password:</p><a href="${resetLink}">Reset</a>`
        });

        return res.json({
            success: true,
            message: "Reset email sent"
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

/**
 * =========================
 * RESET PASSWORD
 * =========================
 */
const resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        const result = await pool.query(
            "SELECT * FROM users WHERE reset_token = $1",
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid token"
            });
        }

        const user = result.rows[0];

        if (new Date(user.reset_token_expiry) < new Date()) {
            return res.status(400).json({
                success: false,
                message: "Token expired"
            });
        }

        const hash = await bcrypt.hash(newPassword, 10);

        await pool.query(
            `UPDATE users
       SET password_hash = $1,
           reset_token = NULL,
           reset_token_expiry = NULL
       WHERE id = $2`,
            [hash, user.id]
        );

        return res.json({
            success: true,
            message: "Password reset successful"
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

module.exports = {
    register,
    login,
    requestReset,
    resetPassword
};
