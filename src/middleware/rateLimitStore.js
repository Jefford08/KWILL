const rateLimit = require('express-rate-limit');
const pool = require('../config/db');

class PgRateLimitStore {
  constructor(prefix) {
    this.prefix = prefix;
    this.localKeys = false;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  async increment(key) {
    const [[row]] = await pool.query(
      `INSERT INTO rate_limits (key, hits, reset_at)
       VALUES (?, 1, NOW() + (? || ' milliseconds')::interval)
       ON CONFLICT (key) DO UPDATE SET
         hits = CASE WHEN rate_limits.reset_at <= NOW() THEN 1 ELSE rate_limits.hits + 1 END,
         reset_at = CASE WHEN rate_limits.reset_at <= NOW() THEN EXCLUDED.reset_at ELSE rate_limits.reset_at END
       RETURNING hits, reset_at`,
      [this.prefix + key, String(this.windowMs)]
    );
    if (Math.random() < 0.02) {
      pool.query("DELETE FROM rate_limits WHERE reset_at < NOW() - INTERVAL '1 day'").catch(() => {});
    }
    return { totalHits: row.hits, resetTime: new Date(row.reset_at) };
  }

  async decrement(key) {
    await pool.query('UPDATE rate_limits SET hits = GREATEST(hits - 1, 0) WHERE key = ?', [this.prefix + key]);
  }

  async resetKey(key) {
    await pool.query('DELETE FROM rate_limits WHERE key = ?', [this.prefix + key]);
  }
}

function sharedRateLimit(name, { windowMinutes, max, handler }) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit: max,
    standardHeaders: true,
    legacyHeaders: false,
    store: new PgRateLimitStore(`${name}:`),
    passOnStoreError: true,
    handler,
  });
}

module.exports = { PgRateLimitStore, sharedRateLimit };
