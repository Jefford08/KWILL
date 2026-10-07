const { Pool, types } = require('pg');

// Postgres returns DATE columns as JS Date objects by default; the app works
// with them as plain 'YYYY-MM-DD' strings (for sorting and display), so parse
// them as strings instead. OID 1082 = the `date` type.
types.setTypeParser(1082, (val) => val);

// The database is hosted on Supabase (a managed PostgreSQL). DATABASE_URL is
// the Supabase connection string from Project Settings -> Database -> Connect.
// On Vercel use the "Transaction pooler" string (port 6543): serverless
// functions open many short-lived connections and the pooler shares a small
// number of real ones between them. See .env.example.
// POSTGRES_URL is the name Vercel's Supabase integration sets automatically.
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

const isLocal = (url) => /@(localhost|127\.0\.0\.1)(:|\/)/.test(url);

// An `sslmode=` in the URL would override the `ssl` option below and make pg
// verify Supabase's certificate chain strictly, which fails without their CA
// file, so it's dropped and SSL is configured here instead.
function withoutSslMode(url) {
  return url.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '');
}

const pool = connectionString
  ? new Pool({
      connectionString: withoutSslMode(connectionString),
      // Supabase only accepts encrypted connections; a local server usually
      // isn't set up for SSL at all.
      ssl: isLocal(connectionString) ? false : { rejectUnauthorized: false },
      // Keep each serverless instance's pool small so many instances together
      // stay within Supabase's connection limit.
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

module.exports = { query, pool };
