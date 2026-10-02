const pool = require('../config/db');

async function currentPopulation(userId) {
  const [[row]] = await pool.query(
    `SELECT COALESCE(SUM(CASE WHEN change_type = 'add' THEN quantity ELSE -quantity END), 0) AS total
     FROM quail_population WHERE user_id = ?`,
    [userId]
  );
  return Number(row.total);
}

async function listStock(userId) {
  const [rows] = await pool.query(
    "SELECT * FROM quail_population WHERE user_id = ? AND change_type IN ('add','remove') ORDER BY entry_date DESC, id DESC",
    [userId]
  );
  return rows;
}

async function getStockEntry(userId, id) {
  const [rows] = await pool.query(
    "SELECT * FROM quail_population WHERE id = ? AND user_id = ? AND change_type IN ('add','remove')",
    [id, userId]
  );
  return rows[0];
}

async function createStockEntry(userId, { entry_date, change_type, quantity, note }) {
  await pool.query(
    'INSERT INTO quail_population (user_id, entry_date, change_type, quantity, note) VALUES (?, ?, ?, ?, ?)',
    [userId, entry_date, change_type, quantity, note || null]
  );
}

async function updateStockEntry(userId, id, { entry_date, change_type, quantity, note }) {
  await pool.query(
    "UPDATE quail_population SET entry_date = ?, change_type = ?, quantity = ?, note = ? WHERE id = ? AND user_id = ? AND change_type IN ('add','remove')",
    [entry_date, change_type, quantity, note || null, id, userId]
  );
}

async function deleteStockEntry(userId, id) {
  await pool.query(
    "DELETE FROM quail_population WHERE id = ? AND user_id = ? AND change_type IN ('add','remove')",
    [id, userId]
  );
}

module.exports = {
  currentPopulation,
  listStock,
  getStockEntry,
  createStockEntry,
  updateStockEntry,
  deleteStockEntry,
};
