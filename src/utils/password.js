const MIN_LENGTH = 8;

const RULES = [
  { key: 'length', label: `At least ${MIN_LENGTH} characters`, test: (pw) => pw.length >= MIN_LENGTH },
  { key: 'number', label: 'At least 1 number', test: (pw) => /\d/.test(pw) },
  { key: 'special', label: 'At least 1 special character ($ # * ! @ …)', test: (pw) => /[^A-Za-z0-9\s]/.test(pw) },
];

function checkPassword(password) {
  const pw = typeof password === 'string' ? password : '';
  const results = RULES.map((r) => ({ key: r.key, label: r.label, met: r.test(pw) }));
  return { results, strong: results.every((r) => r.met) };
}
function passwordError(password) {
  const { results } = checkPassword(password);
  const unmet = results.find((r) => !r.met);
  return unmet ? `Password needs: ${unmet.label.toLowerCase()}.` : null;
}

module.exports = { RULES, MIN_LENGTH, checkPassword, passwordError };
