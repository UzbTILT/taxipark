const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

pool.connect((err) => {
  if (err) {
    console.error('PostgreSQL ga ulanishda xato:', err);
  } else {
    console.log('PostgreSQL ga ulandi! ✅');
  }
});

module.exports = pool;