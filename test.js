require('dotenv').config();

const pool = require("./config/dbConnex")

async function gh() {
	try {
		const res = await pool.query("SELECT NOW()");
		console.log("DB CONNECTED", res.rows[0]);
	} catch (err) {
		console.error("DB ERROR:", err.message)
	}
}

gh();


// curl -X POST http://localhost:3500/student \ -H "Content-Type: application/json" \ -H "Authorization: Bearer YOUR_TOKEN_HERE" \ -d "{\"firstname\":\"Adam\",\"lastname\":\"Eden\",\"email\":\"adam@test.com\",\"password\":\"123456\"}"