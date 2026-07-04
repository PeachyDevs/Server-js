const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const Joi = require("joi");
const { Resend } = require("resend");
const pool = require("../config/dbConnex");

const resend = new Resend(process.env.RESEND_API_KEY);
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined in environment variables");
}

/**
 * Validation Schema
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
    school: Joi.string().when("role", { is: "student", then: Joi.required() }),
    grade_level: Joi.string().when("role", { is: "student", then: Joi.required() }),
    interests: Joi.array().items(Joi.string()).optional(),
    expertise: Joi.string().when("role", { is: "mentor", then: Joi.required() }),
    years_of_experience: Joi.number().when("role", { is: "mentor", then: Joi.required() })
});

/**
 * REGISTER
 */
const register = async (req, res) => {
    const { error, value } = registerSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const existing = await client.query("SELECT id FROM users WHERE email = $1", [value.email.toLowerCase()]);
        if (existing.rows.length > 0) {
            await client.query("ROLLBACK");
            return res.status(400).json({ success: false, message: "User already exists" });
        }

        const hash = await bcrypt.hash(value.password, 10);
        const newUser = await client.query(
            `INSERT INTO users (first_name, last_name, role, phone, address, bio, avatar_url, email, password_hash)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, first_name, last_name, role`,
            [value.first_name, value.last_name, value.role, value.phone, value.address, value.bio, value.avatar_url, value.email.toLowerCase(), hash]
        );

        if (value.role === "student") {
            await client.query("INSERT INTO students (user_id, school, grade_level, interests) VALUES ($1, $2, $3, $4)",
                [newUser.rows[0].id, value.school, value.grade_level, value.interests]);
        } else {
            await client.query("INSERT INTO mentors (user_id, expertise, years_of_experience) VALUES ($1, $2, $3)",
                [newUser.rows[0].id, value.expertise, value.years_of_experience]);
        }

        await client.query("COMMIT");
        return res.status(201).json({ success: true, message: "User registered", user: newUser.rows[0] });
    } catch (e) {
        await client.query("ROLLBACK");
        return res.status(500).json({ success: false, message: "Server error", error: e.message });
    } finally {
        client.release();
    }
};

/**
 * LOGIN
 */
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await pool.query("SELECT * FROM users WHERE email = $1", [email.toLowerCase()]);
        if (result.rows.length === 0 || !(await bcrypt.compare(password, result.rows[0].password_hash))) {
            return res.status(400).json({ success: false, message: "Invalid credentials" });
        }

        const user = result.rows[0];
        const table = user.role === "student" ? "students" : "mentors";
        const profile = await pool.query(`SELECT * FROM ${table} WHERE user_id = $1`, [user.id]);
        
        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
        const { password_hash, ...userSafe } = user;

        return res.json({ success: true, token, user: { ...userSafe, profile: profile.rows[0] } });
    } catch (e) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * REQUEST RESET
 */
const requestReset = async (req, res) => {
    try {
        const result = await pool.query("SELECT id FROM users WHERE email = $1", [req.body.email.toLowerCase()]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: "User not found" });

        const token = crypto.randomBytes(32).toString("hex");
        const expiry = new Date(Date.now() + 3600000);
        await pool.query("UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE id = $3", [token, expiry, result.rows[0].id]);

        const link = `${process.env.NODE_ENV === "Development" ? process.env.CLIENT_URL_DEV : process.env.CLIENT_URL_PROD}/reset-password?token=${token}`;
        
        await resend.emails.send({
            from: "onboarding@resend.dev", // Replace with your verified domain email
            to: req.body.email.toLowerCase(),
            subject: "Password Reset",
            html: `<p>Reset your password here: <a href="${link}">Reset Link</a></p>`
        });

        return res.json({ success: true, message: "Email sent" });
    } catch (e) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * RESET PASSWORD
 */
const resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        const result = await pool.query("SELECT id, reset_token_expiry FROM users WHERE reset_token = $1", [token]);
        if (result.rows.length === 0 || new Date(result.rows[0].reset_token_expiry) < new Date()) {
            return res.status(400).json({ success: false, message: "Invalid or expired token" });
        }

        const hash = await bcrypt.hash(newPassword, 10);
        await pool.query("UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expiry = NULL WHERE id = $2", [hash, result.rows[0].id]);
        return res.json({ success: true, message: "Password updated" });
    } catch (e) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

module.exports = { register, login, requestReset, resetPassword };
