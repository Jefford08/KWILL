const pool = require('../config/db');
const { profit: calcProfit } = require('../utils/calculations');
const { today: todayStr, monthStart: monthStartStr } = require('../utils/dates');
const { currentPopulation } = require('./quailController');

async function sum(sql, params) {
  const [[row]] = await pool.query(sql, params);
  return Number(row.total);
}

async function getStats(userId) {
  const today = todayStr();
  const monthStart = monthStartStr();
  const month = [userId, monthStart, today];

  const [
    totalQuails, eggsToday, eggsMonth, deathsMonth, deathsTotal, feedUsedMonth, salesMonth, expensesMonth, feedCostMonth,
  ] = await Promise.all([
    currentPopulation(userId),
    sum('SELECT COALESCE(SUM(eggs_good + eggs_damaged), 0) AS total FROM egg_records WHERE user_id = ? AND record_date = ?', [userId, today]),
    sum('SELECT COALESCE(SUM(eggs_good + eggs_damaged), 0) AS total FROM egg_records WHERE user_id = ? AND record_date BETWEEN ? AND ?', month),
    sum("SELECT COALESCE(SUM(quantity), 0) AS total FROM quail_population WHERE user_id = ? AND change_type = 'mortality' AND entry_date BETWEEN ? AND ?", month),
    sum("SELECT COALESCE(SUM(quantity), 0) AS total FROM quail_population WHERE user_id = ? AND change_type = 'mortality'", [userId]),
    sum('SELECT COALESCE(SUM(quantity_kg), 0) AS total FROM feed_consumption WHERE user_id = ? AND consumption_date BETWEEN ? AND ?', month),
    sum('SELECT COALESCE(SUM(quantity * unit_price), 0) AS total FROM sales WHERE user_id = ? AND sale_date BETWEEN ? AND ?', month),
    sum('SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE user_id = ? AND expense_date BETWEEN ? AND ?', month),
    sum('SELECT COALESCE(SUM(cost), 0) AS total FROM feed_purchases WHERE user_id = ? AND purchase_date BETWEEN ? AND ?', month),
  ]);

  return {
    totalQuails,
    eggsToday,
    eggsMonth,
    deathsMonth,
    deathsTotal,
    feedUsedMonth,
    salesMonth,
    expensesMonth,
    feedCostMonth,
    costsMonth: expensesMonth + feedCostMonth,
    profitMonth: calcProfit(salesMonth, expensesMonth + feedCostMonth),
  };
}

module.exports = { getStats };
