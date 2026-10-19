const pool = require('../config/db');
const { paginate, dateRange } = require('../utils/paging');

async function listExpenses(userId, query) {
  return paginate(query, {
    countSql: `SELECT COUNT(*) AS n FROM expenses WHERE user_id = ? AND ${dateRange('expense_date')}`,
    rowsSql: `SELECT * FROM expenses WHERE user_id = ? AND ${dateRange('expense_date')} ORDER BY expense_date DESC, id DESC`,
    params: (from, to) => [userId, from, to],
  });
}

async function getExpense(userId, id) {
  const [rows] = await pool.query('SELECT * FROM expenses WHERE id = ? AND user_id = ?', [id, userId]);
  return rows[0];
}

async function createExpense(userId, { expense_date, category, description, amount }) {
  const [rows] = await pool.query(
    'INSERT INTO expenses (user_id, expense_date, category, description, amount) VALUES (?, ?, ?, ?, ?) RETURNING id',
    [userId, expense_date, category, description || null, amount]
  );
  return rows[0].id;
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
