const pool = require('../config/db');
const { paginate, dateRange } = require('../utils/paging');
const { saleTotal } = require('../utils/calculations');

async function listSales(userId, query) {
  const { rows, page } = await paginate(query, {
    countSql: `SELECT COUNT(*) AS n FROM sales WHERE user_id = ? AND ${dateRange('sale_date')}`,
    rowsSql: `SELECT * FROM sales WHERE user_id = ? AND ${dateRange('sale_date')} ORDER BY sale_date DESC, id DESC`,
    params: (from, to) => [userId, from, to],
  });
  return { rows: rows.map((r) => ({ ...r, total: saleTotal(r.quantity, r.unit_price) })), page };
}

async function getSale(userId, id) {
  const [rows] = await pool.query('SELECT * FROM sales WHERE id = ? AND user_id = ?', [id, userId]);
  return rows[0];
}

async function createSale(userId, { sale_date, item_type, quantity, unit_price }) {
  const [rows] = await pool.query(
    'INSERT INTO sales (user_id, sale_date, item_type, quantity, unit_price) VALUES (?, ?, ?, ?, ?) RETURNING id',
    [userId, sale_date, item_type, quantity, unit_price]
  );
  return rows[0].id;
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
