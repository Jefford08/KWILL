const pool = require('../config/db');
const { saleTotal } = require('../utils/calculations');

async function listSales(userId) {
  const [rows] = await pool.query('SELECT * FROM sales WHERE user_id = ? ORDER BY sale_date DESC, id DESC', [userId]);
  return rows.map((r) => ({ ...r, total: saleTotal(r.quantity, r.unit_price) }));
}

async function getSale(userId, id) {
  const [rows] = await pool.query('SELECT * FROM sales WHERE id = ? AND user_id = ?', [id, userId]);
  return rows[0];
}

async function createSale(userId, { sale_date, item_type, quantity, unit_price }) {
  await pool.query(
    'INSERT INTO sales (user_id, sale_date, item_type, quantity, unit_price) VALUES (?, ?, ?, ?, ?)',
    [userId, sale_date, item_type, quantity, unit_price]
  );
}

async function updateSale(userId, id, { sale_date, item_type, quantity, unit_price }) {
  await pool.query(
    'UPDATE sales SET sale_date = ?, item_type = ?, quantity = ?, unit_price = ? WHERE id = ? AND user_id = ?',
    [sale_date, item_type, quantity, unit_price, id, userId]
  );
}

async function deleteSale(userId, id) {
  await pool.query('DELETE FROM sales WHERE id = ? AND user_id = ?', [id, userId]);
}

module.exports = { listSales, getSale, createSale, updateSale, deleteSale };
