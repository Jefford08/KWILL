require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

async function init() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  console.log('Database schema applied successfully.');
  await pool.end();
}

init().catch((err) => {
  console.error('Failed to initialize database:', err.message);
  process.exit(1);
});
