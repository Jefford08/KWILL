const pool = require('../config/db');
const { isValidDateStr } = require('./validate');

const PER_PAGE = 25;

function parsePaging(query = {}) {
  return {
    page: Math.max(1, parseInt(query.page, 10) || 1),
    from: isValidDateStr(query.from) ? query.from : null,
    to: isValidDateStr(query.to) ? query.to : null,
  };
}

function dateRange(column) {
  return `${column} BETWEEN COALESCE(?::date, '-infinity'::date) AND COALESCE(?::date, 'infinity'::date)`;
}

async function paginate(query, { countSql, rowsSql, params }) {
  const p = parsePaging(query);
  const args = params(p.from, p.to);
  const [[{ n }]] = await pool.query(countSql, args);
  const total = Number(n);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(p.page, pages);
  const offset = (page - 1) * PER_PAGE;
  const [rows] = await pool.query(`${rowsSql} LIMIT ? OFFSET ?`, [...args, PER_PAGE, offset]);
  return {
    rows,
    page: {
      page, pages, total, perPage: PER_PAGE, from: p.from, to: p.to,
      start: total ? offset + 1 : 0,
      end: offset + rows.length,
      filtered: Boolean(p.from || p.to),
    },
  };
}

module.exports = { PER_PAGE, parsePaging, dateRange, paginate };
