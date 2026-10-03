const pool = require('../config/db');

async function listExpenses(userId) {
  const [rows] = await pool.query('SELECT * FROM expenses WHERE user_id = ? ORDER BY expense_date DESC, id DESC', [userId]);
  return rows;
}

async function getExpense(userId, id) {
  const [rows] = await pool.query('SELECT * FROM expenses WHERE id = ? AND user_id = ?', [id, userId]);
  return rows[0];
}

async function createExpense(userId, { expense_date, category, description, amount }) {
  await pool.query(
    'INSERT INTO expenses (user_id, expense_date, category, description, amount) VALUES (?, ?, ?, ?, ?)',
    [userId, expense_date, category, description || null, amount]
  );
}

async function updateExpense(userId, id, { expense_date, category, description, amount }) {
  await pool.query(
    'UPDATE expenses SET expense_date = ?, category = ?, description = ?, amount = ? WHERE id = ? AND user_id = ?',
    [expense_date, category, description || null, amount, id, userId]
  );
}

async function deleteExpense(userId, id) {
  await pool.query('DELETE FROM expenses WHERE id = ? AND user_id = ?', [id, userId]);
}

module.exports = { listExpenses, getExpense, createExpense, updateExpense, deleteExpense };
