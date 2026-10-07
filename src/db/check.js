
require('dotenv').config();
const { pool } = require('../config/db');

const APP_TABLES = [
  'users', 'quail_population', 'egg_records', 'feed_purchases',
  'feed_consumption', 'sales', 'expenses', 'session',
];

async function check() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    console.warn('DATABASE_URL is not set; checking the local DB_* fallback instead.');
  } else {
    const { hostname, port } = new URL(url);
    console.log(`Connecting to ${hostname}:${port || 5432} ...`);
  }

  const { rows: [info] } = await pool.query('SELECT current_database() AS db, current_user AS usr, version()');
  console.log(`Connected: database "${info.db}" as "${info.usr}"`);
  console.log(info.version.split(',')[0]);

  const { rows } = await pool.query(
    `SELECT c.relname AS name, c.relrowsecurity AS rls
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'`
  );
  const found = new Map(rows.map((r) => [r.name, r.rls]));
  for (const table of APP_TABLES) {
    if (!found.has(table)) console.log(`  missing  ${table}`);
    else console.log(`  ok       ${table}${found.get(table) ? '' : '  (RLS off: run npm run db:init)'}`);
  }
  if (APP_TABLES.some((t) => !found.has(t))) {
    console.log('Some tables are missing; run `npm run db:init` (or just start the app) to create them.');
  }
  await pool.end();
}

check().catch((err) => {
  console.error('Database connection failed:', err.message);
  process.exit(1);
});
