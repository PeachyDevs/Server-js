const { Pool } = require("pg");

const pool = new Pool({
	connectionString: process.env.DATABSE_URL,
	ssl: {
		rejectUnauthorized: false
	}
});

module.exports = pool;