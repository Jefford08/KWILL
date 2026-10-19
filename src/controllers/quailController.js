const pool = require('../config/db');
const { paginate, dateRange } = require('../utils/paging');
const { mortalityRate } = require('../utils/calculations');

const CHANGE_TYPES = ['add', 'remove', 'mortality'];

async function currentPopulation(userId) {
  const [[row]] = await pool.query(
    `SELECT COALESCE(SUM(CASE WHEN change_type = 'add' THEN quantity ELSE -quantity END), 0) AS total
     FROM quail_population WHERE user_id = ?`,
    [userId]
  );
  return Number(row.total);
}

async function listEntries(userId, query) {
  const { rows, page } = await paginate(query, {
    countSql: `SELECT COUNT(*) AS n FROM quail_population WHERE user_id = ? AND ${dateRange('entry_date')}`,
    rowsSql: `SELECT * FROM quail_population WHERE user_id = ? AND ${dateRange('entry_date')} ORDER BY entry_date DESC, id DESC`,
    params: (from, to) => [userId, from, to],
  });
  return {
    rows: rows.map((r) => ({
      ...r,
      mortalityRate: r.change_type === 'mortality' ? mortalityRate(r.quantity, r.population_before) : null,
    })),
    page,
  };
}

async function getEntry(userId, id) {
  const [rows] = await pool.query('SELECT * FROM quail_population WHERE id = ? AND user_id = ?', [id, userId]);
  return rows[0];
}

async function createEntry(userId, { entry_date, change_type, quantity, note }) {

  const before = change_type === 'mortality' ? await currentPopulation(userId) : null;
  const [rows] = await pool.query(
    'INSERT INTO quail_population (user_id, entry_date, change_type, quantity, population_before, note) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
    [userId, entry_date, change_type, quantity, before, note || null]
  );
  return rows[0].id;
}

async function updateEntry(userId, id, { entry_date, quantity, note }) {
  await pool.query(
    'UPDATE quail_population SET entry_date = ?, quantity = ?, note = ? WHERE id = ? AND user_id = ?',
    [entry_date, quantity, note || null, id, userId]
  );
}

async function deleteEntry(userId, id) {
  await pool.query('DELETE FROM quail_population WHERE id = ? AND user_id = ?', [id, userId]);
}

module.exports = {
  CHANGE_TYPES,
  currentPopulation,
  listEntries,
  getEntry,
  createEntry,
  updateEntry,
  deleteEntry,
};
