const pool = require('../config/db');
const { paginate, dateRange } = require('../utils/paging');

async function combinedHistory(userId, query) {
  return paginate(query, {
    countSql: `SELECT
        (SELECT COUNT(*) FROM feed_purchases WHERE user_id = ? AND ${dateRange('purchase_date')})
      + (SELECT COUNT(*) FROM feed_consumption WHERE user_id = ? AND ${dateRange('consumption_date')}) AS n`,
    rowsSql: `SELECT id, purchase_date AS date, quantity_kg, cost, 'purchase' AS kind
         FROM feed_purchases WHERE user_id = ? AND ${dateRange('purchase_date')}
       UNION ALL
       SELECT id, consumption_date AS date, quantity_kg, NULL AS cost, 'consumption' AS kind
         FROM feed_consumption WHERE user_id = ? AND ${dateRange('consumption_date')}
       ORDER BY date DESC, id DESC`,
    params: (from, to) => [userId, from, to, userId, from, to],
  });
}

async function addPurchase(userId, { purchase_date, quantity_kg, cost }) {
  const [rows] = await pool.query(
    'INSERT INTO feed_purchases (user_id, purchase_date, quantity_kg, cost) VALUES (?, ?, ?, ?) RETURNING id',
    [userId, purchase_date, quantity_kg, cost]
  );
  return rows[0].id;
}

async function addConsumption(userId, { consumption_date, quantity_kg }) {
  const [rows] = await pool.query(
    'INSERT INTO feed_consumption (user_id, consumption_date, quantity_kg) VALUES (?, ?, ?) RETURNING id',
    [userId, consumption_date, quantity_kg]
  );
  return rows[0].id;
}

async function deletePurchase(userId, id) {
  await pool.query('DELETE FROM feed_purchases WHERE id = ? AND user_id = ?', [id, userId]);
}

async function deleteConsumption(userId, id) {
  await pool.query('DELETE FROM feed_consumption WHERE id = ? AND user_id = ?', [id, userId]);
}

module.exports = { combinedHistory, addPurchase, addConsumption, deletePurchase, deleteConsumption };
