const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const Joi = require("joi");
const pool = require("../config/dbConnex");
const transporter = require("../utils/mailer");

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined in environment variables");
}

/**
 * Validation Schemas
 */
const registerSchema = Joi.object({
    first_name: Joi.string().required(),
    last_name: Joi.string().required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    role: Joi.string().valid("student", "mentor").required(),
    phone: Joi.string().optional(),
    address: Joi.string().optional(),
    bio: Joi.string().optional(),
    avatar_url: Joi.string().uri().optional(),
    // Conditional Fields
    school: Joi.string().when("role", { is: "student", then: Joi.required() }),
    grade_level: Joi.string().when("role", {
        is: "student",
        then: Joi.required()
    }),
    interests: Joi.array().items(Joi.string()).optional(),
    expertise: Joi.string().when("role", {
        is: "mentor",
        then: Joi.required()
    }),
    years_of_experience: Joi.number().when("role", {
        is: "mentor",
        then: Joi.required()
    })
});

/**
 * =========================
 * REGISTER
 * =========================
 */
const register = async (req, res) => {
    // 1. Validate Input
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
        return res
            .status(400)
            .json({ success: false, message: error.details[0].message });
    }

    const {
        first_name,
        last_name,
        role,
        phone,
        address,
        bio,
        avatar_url,
        email,
        password,
        school,
        grade_level,
        interests,
        expertise,
        years_of_experience
    } = value;

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // Check for existing user
        const existing = await client.query(
            "SELECT id FROM users WHERE email = $1",
            [email.toLowerCase()]
        );
        if (existing.rows.length > 0) {
            await client.query("ROLLBACK");
            return res
                .status(400)
                .json({ success: false, message: "User already exists" });
        }

        // Hash Password
        const password_hash = await bcrypt.hash(password, 10);

        // Insert User
        const newUser = await client.query(
            `INSERT INTO users (first_name, last_name, role, phone, address, bio, avatar_url, email, password_hash)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id, first_name, last_name, role`,
            [
                first_name,
                last_name,
                role,
                phone,
                address,
                bio,
                avatar_url,
                email.toLowerCase(),
                password_hash
            ]
        );

        const userId = newUser.rows[0].id;

        // Insert Profile based on role
        if (role === "student") {
            await client.query(
                `INSERT INTO students (user_id, school, grade_level, interests) VALUES ($1, $2, $3, $4)`,
                [userId, school, grade_level, interests]
            );
        } else if (role === "mentor") {
            await client.query(
                `INSERT INTO mentors (user_id, expertise, years_of_experience) VALUES ($1, $2, $3)`,
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
        console.error("🔥 REGISTER ERROR:", error);
        return res
            .status(500)
            .json({
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
    const { email, password } = req.body;

    if (!email || !password) {
        return res
            .status(400)
            .json({ success: false, message: "Missing credentials" });
    }

    try {
        const userResult = await pool.query(
            "SELECT * FROM users WHERE email = $1",
            [email.toLowerCase()]
        );

        if (userResult.rows.length === 0) {
            return res
                .status(400)
                .json({ success: false, message: "Invalid credentials" });
        }

        const user = userResult.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res
                .status(400)
                .json({ success: false, message: "Invalid credentials" });
        }

        // Fetch Profile
        const table = user.role === "student" ? "students" : "mentors";
        const profileRes = await pool.query(
            `SELECT * FROM ${table} WHERE user_id = $1`,
            [user.id]
        );

        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, {
            expiresIn: "7d"
        });

        const { password_hash, ...userWithoutPassword } = user;

        return res.json({
            success: true,
            message: "Login successful",
            token,
            user: { ...userWithoutPassword, profile: profileRes.rows[0] }
        });
    } catch (error) {
        console.error("🔥 LOGIN ERROR:", error);
        return res
            .status(500)
            .json({ success: false, message: "Server error" });
    }
};

/**
 * =========================
 * RESET PASSWORD REQUEST
 * =========================
 */
const requestReset = async (req, res) => {
    try {
        const { email } = req.body;
        const result = await pool.query(
            "SELECT id, email FROM users WHERE email = $1",
            [email.toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res
                .status(404)
                .json({ success: false, message: "User not found" });
        }

        const token = crypto.randomBytes(32).toString("hex");
        const expiry = new Date(Date.now() + 3600000); // 1 hour

        await pool.query(
            "UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE id = $3",
            [token, expiry, result.rows[0].id]
        );

        const clientUrl =
            process.env.NODE_ENV === "Development"
                ? process.env.CLIENT_URL_DEV
                : process.env.CLIENT_URL_PROD;
        const resetLink = `${clientUrl}/reset-password?token=${token}`;

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Password Reset Request",
            html: `<p>Click here to reset your password:</p><a href="${resetLink}">Reset Link</a>`
        });

        return res.json({ success: true, message: "Reset email sent" });
    } catch (error) {
        console.error("🔥 REQUEST RESET ERROR:", error);
        return res
            .status(500)
            .json({ success: false, message: "Server error" });
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
        if (result.rows.length === 0)
            return res
                .status(400)
                .json({ success: false, message: "Invalid token" });

        const user = result.rows[0];
        if (new Date(user.reset_token_expiry) < new Date()) {
            return res
                .status(400)
                .json({ success: false, message: "Token expired" });
        }

        const hash = await bcrypt.hash(newPassword, 10);
        await pool.query(
            "UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expiry = NULL WHERE id = $2",
            [hash, user.id]
        );

        return res.json({
            success: true,
            message: "Password reset successful"
        });
    } catch (error) {
        console.error("🔥 RESET PASSWORD ERROR:", error);
        return res
            .status(500)
            .json({ success: false, message: "Server error" });
    }
};

module.exports = { register, login, requestReset, resetPassword };
