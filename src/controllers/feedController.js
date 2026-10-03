const pool = require('../config/db');

async function combinedHistory(userId) {
  const [purchases] = await pool.query(
    'SELECT id, purchase_date AS date, quantity_kg, cost FROM feed_purchases WHERE user_id = ? ORDER BY purchase_date DESC, id DESC',
    [userId]
  );
  const [consumption] = await pool.query(
    'SELECT id, consumption_date AS date, quantity_kg FROM feed_consumption WHERE user_id = ? ORDER BY consumption_date DESC, id DESC',
    [userId]
  );

  const combined = [
    ...purchases.map((r) => ({ ...r, kind: 'purchase' })),
    ...consumption.map((r) => ({ ...r, kind: 'consumption', cost: null })),
  ];
  combined.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return combined;
}

async function addPurchase(userId, { purchase_date, quantity_kg, cost }) {
  await pool.query(
    'INSERT INTO feed_purchases (user_id, purchase_date, quantity_kg, cost) VALUES (?, ?, ?, ?)',
    [userId, purchase_date, quantity_kg, cost]
  );
}

async function addConsumption(userId, { consumption_date, quantity_kg }) {
  await pool.query(
    'INSERT INTO feed_consumption (user_id, consumption_date, quantity_kg) VALUES (?, ?, ?)',
    [userId, consumption_date, quantity_kg]
  );
}

async function deletePurchase(userId, id) {
  await pool.query('DELETE FROM feed_purchases WHERE id = ? AND user_id = ?', [id, userId]);
}

async function deleteConsumption(userId, id) {
  await pool.query('DELETE FROM feed_consumption WHERE id = ? AND user_id = ?', [id, userId]);
}

module.exports = { combinedHistory, addPurchase, addConsumption, deletePurchase, deleteConsumption };
