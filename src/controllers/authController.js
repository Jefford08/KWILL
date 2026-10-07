const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function findByEmail(email) {
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
  return rows[0];
}

async function findByUsername(username) {
  const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
  return rows[0];
}

class RegistrationError extends Error {}

async function register({ name, username, email, password }) {
  if (await findByEmail(email)) {
    throw new RegistrationError('An account with that email already exists.');
  }
  if (await findByUsername(username)) {
    throw new RegistrationError('That username is already taken.');
  }
  const hash = await bcrypt.hash(password, 10);
  try {
    const [rows] = await pool.query(
      'INSERT INTO users (name, username, email, password_hash) VALUES (?, ?, ?, ?) RETURNING id',
      [name, username, email, hash]
    );
    return rows[0].id;
  } catch (err) {

    if (err.code === '23505') {
      throw new RegistrationError('That username or email is already taken.');
    }
    throw err;
  }
}

async function verifyLogin(username, password) {
  const user = await findByUsername(username);
  if (!user) return null;
  const match = await bcrypt.compare(password, user.password_hash);
  return match ? user : null;
}

module.exports = { register, verifyLogin, findByEmail, findByUsername, RegistrationError };
