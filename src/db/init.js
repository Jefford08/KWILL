require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function init() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const connectionString = process.env.DATABASE_URL;

  const client = connectionString
    ? new Client({
        connectionString,
        ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
      })
    : new Client({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'kwill_db',
      });

  await client.connect();
  await client.query(schema);
  console.log('Database schema applied successfully.');
  await client.end();
}

init().catch((err) => {
  console.error('Failed to initialize database:', err.message);
  process.exit(1);
});
