const pool = require('../config/db');
const { eggTotals } = require('../utils/calculations');

async function listEggs(userId) {
  const [rows] = await pool.query(
    'SELECT * FROM egg_records WHERE user_id = ? ORDER BY record_date DESC, id DESC',
    [userId]
  );
  return rows.map((r) => ({ ...r, ...eggTotals(r.eggs_good, r.eggs_damaged) }));
}

async function getEgg(userId, id) {
  const [rows] = await pool.query('SELECT * FROM egg_records WHERE id = ? AND user_id = ?', [id, userId]);
  return rows[0];
}

async function createEgg(userId, { record_date, eggs_good, eggs_damaged }) {
  await pool.query(
    'INSERT INTO egg_records (user_id, record_date, eggs_good, eggs_damaged) VALUES (?, ?, ?, ?)',
    [userId, record_date, eggs_good || 0, eggs_damaged || 0]
  );
}

async function updateEgg(userId, id, { record_date, eggs_good, eggs_damaged }) {
  await pool.query(
    'UPDATE egg_records SET record_date = ?, eggs_good = ?, eggs_damaged = ? WHERE id = ? AND user_id = ?',
    [record_date, eggs_good || 0, eggs_damaged || 0, id, userId]
  );
}

async function deleteEgg(userId, id) {
  await pool.query('DELETE FROM egg_records WHERE id = ? AND user_id = ?', [id, userId]);
}

module.exports = { listEggs, getEgg, createEgg, updateEgg, deleteEgg };
