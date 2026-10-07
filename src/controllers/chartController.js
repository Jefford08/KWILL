const pool = require('../config/db');

const GRANULARITIES = ['day', 'week', 'month', 'year'];

function dateRangeArray(from, to) {
  const dates = [];
  const current = new Date(from + 'T00:00:00Z');
  const end = new Date(to + 'T00:00:00Z');
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

function mondayOf(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

function weekRangeArray(from, to) {
  const weeks = [];
  const current = mondayOf(from);
  const end = mondayOf(to);
  while (current <= end) {
    weeks.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 7);
  }
  return weeks;
}

function monthRangeArray(from, to) {
  const months = [];
  const start = new Date(from + 'T00:00:00Z');
  const end = new Date(to + 'T00:00:00Z');
  let y = start.getUTCFullYear();
  let m = start.getUTCMonth();
  const endY = end.getUTCFullYear();
  const endM = end.getUTCMonth();
  while (y < endY || (y === endY && m <= endM)) {
    months.push(`${y}-${String(m + 1).padStart(2, '0')}`);
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return months;
}

function yearRangeArray(from, to) {
  const years = [];
  const startY = new Date(from + 'T00:00:00Z').getUTCFullYear();
  const endY = new Date(to + 'T00:00:00Z').getUTCFullYear();
  for (let y = startY; y <= endY; y += 1) years.push(String(y));
  return years;
}

function normalizeGranularity(granularity) {
  return GRANULARITIES.includes(granularity) ? granularity : 'day';
}

function labelsForRange(from, to, granularity) {
  switch (normalizeGranularity(granularity)) {
    case 'week':
      return weekRangeArray(from, to);
    case 'month':
      return monthRangeArray(from, to);
    case 'year':
      return yearRangeArray(from, to);
    default:
      return dateRangeArray(from, to);
  }
}


function truncColumn(dateCol, granularity) {
  switch (normalizeGranularity(granularity)) {
    case 'week':
      return `TO_CHAR(DATE_TRUNC('week', ${dateCol}), 'YYYY-MM-DD')`;
    case 'month':
      return `TO_CHAR(${dateCol}, 'YYYY-MM')`;
    case 'year':
      return `TO_CHAR(${dateCol}, 'YYYY')`;
    default:
      return dateCol;
  }
}

function daysBetween(from, to) {
  const a = new Date(from + 'T00:00:00Z');
  const b = new Date(to + 'T00:00:00Z');
  return Math.round((b - a) / 86400000) + 1;
}


function suggestGranularity(from, to) {
  const span = daysBetween(from, to);
  if (span > 366) return 'year';
  if (span > 180) return 'month';
  if (span > 60) return 'week';
  return 'day';
}

function defaultRange(days = 30) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function fillSeries(rows, labels, keyField, valueField) {
  const map = new Map(rows.map((r) => [r[keyField], Number(r[valueField]) || 0]));
  return labels.map((l) => map.get(l) || 0);
}

async function getEggsSeries(userId, from, to, granularity) {
  const labels = labelsForRange(from, to, granularity);
  const d = truncColumn('record_date', granularity);
  const [rows] = await pool.query(
    `SELECT ${d} AS d, SUM(eggs_good + eggs_damaged) AS v
     FROM egg_records WHERE user_id = ? AND record_date BETWEEN ? AND ?
     GROUP BY ${d}`,
    [userId, from, to]
  );
  return { labels, data: fillSeries(rows, labels, 'd', 'v') };
}

async function getMortalitySeries(userId, from, to, granularity) {
  const labels = labelsForRange(from, to, granularity);
  const d = truncColumn('entry_date', granularity);
  const [rows] = await pool.query(
    `SELECT ${d} AS d, SUM(quantity) AS v
     FROM quail_population WHERE user_id = ? AND change_type = 'mortality' AND entry_date BETWEEN ? AND ?
     GROUP BY ${d}`,
    [userId, from, to]
  );
  return { labels, data: fillSeries(rows, labels, 'd', 'v') };
}

async function getFeedSeries(userId, from, to, granularity) {
  const labels = labelsForRange(from, to, granularity);
  const d = truncColumn('consumption_date', granularity);
  const [rows] = await pool.query(
    `SELECT ${d} AS d, SUM(quantity_kg) AS v
     FROM feed_consumption WHERE user_id = ? AND consumption_date BETWEEN ? AND ?
     GROUP BY ${d}`,
    [userId, from, to]
  );
  return { labels, data: fillSeries(rows, labels, 'd', 'v') };
}

async function getSalesSeries(userId, from, to, granularity) {
  const labels = labelsForRange(from, to, granularity);
  const d = truncColumn('sale_date', granularity);
  const [rows] = await pool.query(
    `SELECT ${d} AS d, SUM(quantity * unit_price) AS v
     FROM sales WHERE user_id = ? AND sale_date BETWEEN ? AND ?
     GROUP BY ${d}`,
    [userId, from, to]
  );
  return { labels, data: fillSeries(rows, labels, 'd', 'v') };
}

async function getExpensesSeries(userId, from, to, granularity) {
  const labels = labelsForRange(from, to, granularity);
  const d = truncColumn('expense_date', granularity);
  const [rows] = await pool.query(
    `SELECT ${d} AS d, SUM(amount) AS v
     FROM expenses WHERE user_id = ? AND expense_date BETWEEN ? AND ?
     GROUP BY ${d}`,
    [userId, from, to]
  );
  return { labels, data: fillSeries(rows, labels, 'd', 'v') };
}

async function getPopulationSeries(userId, from, to, granularity) {
  const labels = labelsForRange(from, to, granularity);
  const d = truncColumn('entry_date', granularity);
  const [rows] = await pool.query(
    `SELECT ${d} AS d,
            SUM(CASE WHEN change_type = 'add' THEN quantity ELSE -quantity END) AS v
     FROM quail_population WHERE user_id = ? AND entry_date BETWEEN ? AND ?
     GROUP BY ${d}`,
    [userId, from, to]
  );
  return { labels, data: fillSeries(rows, labels, 'd', 'v') };
}

async function getProfitSeries(userId, from, to, granularity) {
  const sales = await getSalesSeries(userId, from, to, granularity);
  const expenses = await getExpensesSeries(userId, from, to, granularity);
  const data = sales.labels.map((_, i) => Math.round((sales.data[i] - expenses.data[i]) * 100) / 100);
  return { labels: sales.labels, data };
}

const METRIC_HANDLERS = {
  eggs: getEggsSeries,
  mortality: getMortalitySeries,
  feed: getFeedSeries,
  sales: getSalesSeries,
  expenses: getExpensesSeries,
  profit: getProfitSeries,
  population: getPopulationSeries,
};

async function getSeries(userId, metric, from, to, granularity = 'day') {
  const handler = METRIC_HANDLERS[metric];
  if (!handler) throw new Error('Unknown metric: ' + metric);
  return handler(userId, from, to, granularity);
}

module.exports = {
  getSeries,
  defaultRange,
  dateRangeArray,
  normalizeGranularity,
  suggestGranularity,
  GRANULARITIES,
};
