const crypto = require('crypto');
const pool = require('../config/db');

const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;

function hashCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

function generateCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

async function cooldownRemaining(userId, purpose) {
  const [[row]] = await pool.query(
    `SELECT EXTRACT(EPOCH FROM (NOW() - MAX(created_at)))::int AS age
       FROM verification_codes WHERE user_id = ? AND purpose = ? AND used_at IS NULL`,
    [userId, purpose]
  );
  if (!row || row.age === null) return 0;
  return Math.max(0, RESEND_COOLDOWN_SECONDS - row.age);
}

async function issueCode(userId, purpose) {
  const code = generateCode();
  await pool.query("DELETE FROM verification_codes WHERE created_at < NOW() - INTERVAL '1 day'");
  await pool.query(
    'UPDATE verification_codes SET used_at = NOW() WHERE user_id = ? AND purpose = ? AND used_at IS NULL',
    [userId, purpose]
  );
  await pool.query(
    `INSERT INTO verification_codes (user_id, purpose, code_hash, expires_at)
     VALUES (?, ?, ?, NOW() + (? || ' minutes')::interval)`,
    [userId, purpose, hashCode(code), String(CODE_TTL_MINUTES)]
  );
  return code;
}

async function verifyCode(userId, purpose, submitted) {
  const code = String(submitted || '').replace(/\s+/g, '');
  const [[row]] = await pool.query(
    `SELECT id, code_hash, attempts, expires_at < NOW() AS expired
       FROM verification_codes
      WHERE user_id = ? AND purpose = ? AND used_at IS NULL
      ORDER BY created_at DESC LIMIT 1`,
    [userId, purpose]
  );
  if (!row) return { ok: false, message: 'That code is no longer valid. Please request a new one.' };
  if (row.expired) return { ok: false, message: 'That code has expired. Please request a new one.' };
  if (row.attempts >= MAX_ATTEMPTS) {
    return { ok: false, message: 'Too many incorrect attempts. Please request a new code.' };
  }

  const matches = /^\d{6}$/.test(code) &&
    crypto.timingSafeEqual(Buffer.from(hashCode(code)), Buffer.from(row.code_hash));
  if (!matches) {
    await pool.query('UPDATE verification_codes SET attempts = attempts + 1 WHERE id = ?', [row.id]);
    const left = MAX_ATTEMPTS - row.attempts - 1;
    return {
      ok: false,
      message: left > 0
        ? `That code isn't right. ${left} attempt${left === 1 ? '' : 's'} left.`
        : 'Too many incorrect attempts. Please request a new code.',
    };
  }

  await pool.query('UPDATE verification_codes SET used_at = NOW() WHERE id = ?', [row.id]);
  return { ok: true };
}

module.exports = { issueCode, verifyCode, cooldownRemaining, CODE_TTL_MINUTES };
