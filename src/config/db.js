const { Pool, types } = require('pg');

// Postgres returns DATE columns as JS Date objects by default; the app works
// with them as plain 'YYYY-MM-DD' strings (for sorting and display), so parse
// them as strings instead. OID 1082 = the `date` type.
types.setTypeParser(1082, (val) => val);

const connectionString = process.env.DATABASE_URL;

let pool;
if (connectionString) {
  // Parse the connection string to avoid potential parsing issues
  // Handle both postgres:// and postgresql:// protocols
  const match = connectionString.match(/^postgresq?l:\/\/([^:]+):(.+)@(.+)$/);
  if (match) {
    const user = match[1];
    const passwordAndHost = match[2];
    const hostAndRest = match[3];

    // Split password and host
    const passHostMatch = passwordAndHost.match(/^(.+)@(.+)$/);
    if (passHostMatch) {
      const password = passHostMatch[1];
      const hostAndPort = passHostMatch[2];

      // Split host and port
      const hostParts = hostAndPort.split(':');
      const host = hostParts[0];
      const port = parseInt(hostParts[1]) || 5432;

      // Extract database from hostAndRest (format: host:port/database or just host/database)
      const hostRestMatch = hostAndRest.match(/^([^:/]+)(?::(\d+))?\/(.+)$/);
      let dbHost = host;
      let dbPort = port;
      let database = 'kwill_db';

      if (hostRestMatch) {
        dbHost = hostRestMatch[1];
        if (hostRestMatch[2]) {
          dbPort = parseInt(hostRestMatch[2]);
        }
        database = hostRestMatch[3];
      } else {
        // Fallback: try to extract database from the end
        const dbMatch = hostAndRest.match(/\/([^\/]+)$/);
        if (dbMatch) {
          database = dbMatch[1];
        }
      }

      pool = new Pool({
        host: dbHost,
        port: dbPort,
        user: user,
        password: password,
        database: database,
        ssl: (dbHost === 'localhost' || dbHost === '127.0.0.1') ? false : { rejectUnauthorized: false },
      });
    } else {
      // Fallback to individual environment variables
      pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'kwill_db',
        ssl: false,
      });
    }
  } else {
    // Fallback to individual environment variables
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'kwill_db',
      ssl: false,
    });
  }
} else {
  // Fallback to individual environment variables
  pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'kwill_db',
    ssl: false,
  });
}

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