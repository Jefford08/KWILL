require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

const TABLES = [
  'users', 'quail_population', 'egg_records', 'feed_purchases', 'feed_consumption',
  'sales', 'expenses', 'schema_migrations',
];

async function backup() {
  const data = { createdAt: new Date().toISOString(), tables: {} };
  for (const table of TABLES) {
    const { rows } = await pool.query(`SELECT * FROM ${table} ORDER BY 1`);
    data.tables[table] = rows;
    console.log(`  ${table.padEnd(18)} ${rows.length} rows`);
  }
  const dir = path.join(__dirname, '..', '..', 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `kwill-backup-${data.createdAt.replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  console.log(`Saved ${path.relative(process.cwd(), file)}`);
  await pool.end();
}

backup().catch((err) => {
  console.error('Backup failed:', err.message);
  process.exit(1);
});
