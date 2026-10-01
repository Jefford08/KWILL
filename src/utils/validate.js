// Small, dependency-free server-side validation helpers. The forms use
// browser attributes like `required`, `min`, and `type="date"`, but those
// are easy to bypass with a direct POST request, so every value that
// reaches a controller is re-checked here.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateStr(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  return Number.isFinite(Date.parse(value + 'T00:00:00Z'));
}

function isPositiveInt(value, max = Infinity) {
  if (value === '' || value === null || value === undefined) return false;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n <= max;
}

function isNonNegativeInt(value, max = Infinity) {
  if (value === '' || value === null || value === undefined) return false;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= max;
}

function isPositiveNumber(value, max = Infinity) {
  if (value === '' || value === null || value === undefined) return false;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 && n <= max;
}

function isNonNegativeNumber(value, max = Infinity) {
  if (value === '' || value === null || value === undefined) return false;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= max;
}

function isNonEmptyString(value, maxLength) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  if (maxLength && trimmed.length > maxLength) return false;
  return true;
}

// Route params (:id) arrive as strings; reject anything that isn't a plain
// positive integer before it reaches a SQL query.
function isValidId(value) {
  return /^\d+$/.test(String(value));
}

// Realistic upper bounds for a single farm's data entry, well under the
// DB columns' actual capacity (INT / DECIMAL(10,2)) — these exist to catch
// mistyped or abusive input (e.g. an extra zero or two), not to constrain
// a real farm's operation.
const LIMITS = {
  EGGS_PER_RECORD: 50000,
  QUAIL_QUANTITY: 50000,
  FEED_KG: 5000,
  FEED_COST: 500000,
  SALE_QUANTITY: 50000,
  UNIT_PRICE: 100000,
  EXPENSE_AMOUNT: 1000000,
};

module.exports = {
  isValidDateStr,
  isPositiveInt,
  isNonNegativeInt,
  isPositiveNumber,
  isNonNegativeNumber,
  isNonEmptyString,
  isValidId,
  LIMITS,
};
