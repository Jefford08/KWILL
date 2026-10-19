const bcrypt = require('bcryptjs');
const pool = require('../config/db');

const PUBLIC_FIELDS = 'id, name, username, email, email_verified, created_at';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function findByEmail(email) {
  const [rows] = await pool.query('SELECT * FROM users WHERE LOWER(email) = ?', [normalizeEmail(email)]);
  return rows[0];
}

async function findByUsername(username) {
  const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
  return rows[0];
}

async function findById(id) {
  const [rows] = await pool.query(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ?`, [id]);
  return rows[0];
}

class AccountError extends Error {}

function rethrowDuplicate(err) {

  if (err.code === '23505') throw new AccountError('That username or email is already taken.');
  throw err;
}

async function register({ name, username, email, password }) {
  if (await findByEmail(email)) {
    throw new AccountError('An account with that email already exists.');
  }
  if (await findByUsername(username)) {
    throw new AccountError('That username is already taken.');
  }
  const hash = await bcrypt.hash(password, 10);
  try {
    const [rows] = await pool.query(
      'INSERT INTO users (name, username, email, password_hash, email_verified) VALUES (?, ?, ?, ?, FALSE) RETURNING id',
      [name.trim(), username, normalizeEmail(email), hash]
    );
    return rows[0].id;
  } catch (err) {
    return rethrowDuplicate(err);
  }
}

const DUMMY_HASH = bcrypt.hashSync('kwill-timing-equalizer', 10);

async function verifyLogin(username, password) {
  const user = await findByUsername(username);
  const match = await bcrypt.compare(password || '', user ? user.password_hash : DUMMY_HASH);
  if (!user) return null;
  return match ? user : null;
}

async function checkPassword(userId, password) {
  const [rows] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [userId]);
  return rows[0] ? bcrypt.compare(password || '', rows[0].password_hash) : false;
}

async function updateProfile(userId, { name, username, email }) {
  const other = await findByUsername(username);
  if (other && other.id !== userId) throw new AccountError('That username is already taken.');
  const otherEmail = await findByEmail(email);
  if (otherEmail && otherEmail.id !== userId) throw new AccountError('An account with that email already exists.');
  try {
    await pool.query(
      'UPDATE users SET name = ?, username = ?, email = ? WHERE id = ?',
      [name.trim(), username, normalizeEmail(email), userId]
    );
  } catch (err) {
    rethrowDuplicate(err);
  }
}

async function markEmailVerified(userId) {
  await pool.query('UPDATE users SET email_verified = TRUE WHERE id = ?', [userId]);
}

async function setPassword(userId, password) {
  const hash = await bcrypt.hash(password, 10);
  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, userId]);
}

async function endOtherSessions(userId, keepSid = '') {
  await pool.query(
    `DELETE FROM "session" WHERE sess->>'userId' = ? AND sid <> ?`,
    [String(userId), keepSid]
  );
}

module.exports = {
  markEmailVerified,
  AccountError,
  normalizeEmail,
  findByEmail,
  findByUsername,
  findById,
  register,
  verifyLogin,
  checkPassword,
  updateProfile,
  setPassword,
  endOtherSessions,
};
