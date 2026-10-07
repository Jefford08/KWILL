const { Pool, types } = require('pg');

types.setTypeParser(1082, (val) => val);

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const isLocal = (url) => /@(localhost|127\.0\.0\.1)(:|\/)/.test(url);

function withoutSslMode(url) {
  return url.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '');
}

const pool = connectionString
  ? new Pool({
      connectionString: withoutSslMode(connectionString),

      ssl: isLocal(connectionString) ? false : { rejectUnauthorized: false },
      max: process.env.VERCEL ? 3 : 10,
      connectionTimeoutMillis: 10000,
    })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'kwill_db',
      ssl: false,
    });

async function query(text, params = []) {
  let i = 0;
  const pgText = text.replace(/\?/g, () => `$${++i}`);
  const result = await pool.query(pgText, params);
  return [result.rows];
}

module.exports = { query, pool };
