const { Pool, types } = require('pg');

// Postgres returns DATE columns as JS Date objects by default; the app works
// with them as plain 'YYYY-MM-DD' strings (for sorting and display), so parse
// them as strings instead. OID 1082 = the `date` type.
types.setTypeParser(1082, (val) => val);

const connectionString = process.env.DATABASE_URL;

const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
    })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'kwill_db',
    });

// Thin mysql2-compatible shim: controllers were written against mysql2's
// `const [rows] = await pool.query(sql, params)` pattern using `?`
// placeholders. Converting `?` to Postgres's `$1, $2...` here means none of
// the controller queries had to be rewritten by hand.
async function query(text, params = []) {
  let i = 0;
  const pgText = text.replace(/\?/g, () => `$${++i}`);
  const result = await pool.query(pgText, params);
  return [result.rows];
}

module.exports = { query };
