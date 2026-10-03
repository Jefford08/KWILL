const pool = require('../config/db');
const { profit: calcProfit } = require('../utils/calculations');
const { currentPopulation } = require('./quailController');

async function getStats(userId) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const totalQuails = await currentPopulation(userId);

  const [[eggsTodayRow]] = await pool.query(
    'SELECT COALESCE(SUM(eggs_good + eggs_damaged), 0) AS total FROM egg_records WHERE user_id = ? AND record_date = ?',
    [userId, today]
  );

  const [[mortalityRow]] = await pool.query(
    "SELECT COALESCE(SUM(quantity), 0) AS total FROM quail_population WHERE user_id = ? AND change_type = 'mortality'",
    [userId]
  );

  const [[feedRow]] = await pool.query(
    'SELECT COALESCE(SUM(quantity_kg), 0) AS total FROM feed_consumption WHERE user_id = ? AND consumption_date BETWEEN ? AND ?',
    [userId, monthStart, today]
  );

  const [[salesRow]] = await pool.query(
    'SELECT COALESCE(SUM(quantity * unit_price), 0) AS total FROM sales WHERE user_id = ? AND sale_date BETWEEN ? AND ?',
    [userId, monthStart, today]
  );

  const [[expensesRow]] = await pool.query(
    'SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE user_id = ? AND expense_date BETWEEN ? AND ?',
    [userId, monthStart, today]
  );

  const salesMonth = Number(salesRow.total);
  const expensesMonth = Number(expensesRow.total);

  return {
    totalQuails,
    eggsToday: Number(eggsTodayRow.total),
    mortalityToDate: Number(mortalityRow.total),
    feedUsedMonth: Number(feedRow.total),
    salesMonth,
    profitMonth: calcProfit(salesMonth, expensesMonth),
  };
}

module.exports = { getStats };
