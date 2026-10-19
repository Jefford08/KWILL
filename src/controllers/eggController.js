const pool = require('../config/db');
const { paginate, dateRange } = require('../utils/paging');
const { eggTotals } = require('../utils/calculations');

async function listEggs(userId, query) {
  const { rows, page } = await paginate(query, {
    countSql: `SELECT COUNT(*) AS n FROM egg_records WHERE user_id = ? AND ${dateRange('record_date')}`,
    rowsSql: `SELECT * FROM egg_records WHERE user_id = ? AND ${dateRange('record_date')} ORDER BY record_date DESC, id DESC`,
    params: (from, to) => [userId, from, to],
  });
  return { rows: rows.map((r) => ({ ...r, ...eggTotals(r.eggs_good, r.eggs_damaged) })), page };
}

async function getEgg(userId, id) {
  const [rows] = await pool.query('SELECT * FROM egg_records WHERE id = ? AND user_id = ?', [id, userId]);
  return rows[0];
}

async function createEgg(userId, { record_date, eggs_good, eggs_damaged }) {
  const [rows] = await pool.query(
    'INSERT INTO egg_records (user_id, record_date, eggs_good, eggs_damaged) VALUES (?, ?, ?, ?) RETURNING id',
    [userId, record_date, eggs_good || 0, eggs_damaged || 0]
  );
  return rows[0].id;
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
