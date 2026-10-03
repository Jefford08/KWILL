const pool = require('../config/db');
const { mortalityRate } = require('../utils/calculations');
const { currentPopulation } = require('./quailController');

async function listMortality(userId) {
  const [rows] = await pool.query(
    "SELECT * FROM quail_population WHERE user_id = ? AND change_type = 'mortality' ORDER BY entry_date DESC, id DESC",
    [userId]
  );
  return rows.map((r) => ({ ...r, mortalityRate: mortalityRate(r.quantity, r.population_before) }));
}

async function getMortalityEntry(userId, id) {
  const [rows] = await pool.query(
    "SELECT * FROM quail_population WHERE id = ? AND user_id = ? AND change_type = 'mortality'",
    [id, userId]
  );
  return rows[0];
}

async function createMortality(userId, { entry_date, quantity, note }) {
  const before = await currentPopulation(userId);
  await pool.query(
    "INSERT INTO quail_population (user_id, entry_date, change_type, quantity, population_before, note) VALUES (?, ?, 'mortality', ?, ?, ?)",
    [userId, entry_date, quantity, before, note || null]
  );
}

async function updateMortality(userId, id, { entry_date, quantity, note }) {
  await pool.query(
    "UPDATE quail_population SET entry_date = ?, quantity = ?, note = ? WHERE id = ? AND user_id = ? AND change_type = 'mortality'",
    [entry_date, quantity, note || null, id, userId]
  );
}

async function deleteMortality(userId, id) {
  await pool.query(
    "DELETE FROM quail_population WHERE id = ? AND user_id = ? AND change_type = 'mortality'",
    [id, userId]
  );
}

module.exports = { listMortality, getMortalityEntry, createMortality, updateMortality, deleteMortality };
