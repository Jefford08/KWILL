require('dotenv').config();
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const LOCK_KEY = 4815162342;

function migrationFiles() {
  return fs.readdirSync(MIGRATIONS_DIR).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
}

async function runMigrations(pool, log = console.log) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;
  `);

  const applied = [];
  for (const file of migrationFiles()) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1)', [LOCK_KEY]);
      const { rowCount } = await client.query('SELECT 1 FROM schema_migrations WHERE version = $1', [file]);
      if (rowCount) {
        await client.query('ROLLBACK');
        continue;
      }
      await client.query(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
      await client.query('COMMIT');
      applied.push(file);
      log(`Applied migration ${file}`);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      err.message = `Migration ${file} failed: ${err.message}`;
      throw err;
    } finally {
      client.release();
    }
  }
  if (!applied.length) log('Database is up to date.');
  return applied;
}

module.exports = { runMigrations, migrationFiles };

if (require.main === module) {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL && process.env.VERCEL) {
    console.warn('No DATABASE_URL set; skipping migrations.');
    process.exit(0);
  }
  const { pool } = require('../config/db');
  runMigrations(pool)
    .then(() => pool.end())
    .catch((err) => {
      console.error(err.message);
      pool.end().finally(() => process.exit(1));
    });
}
