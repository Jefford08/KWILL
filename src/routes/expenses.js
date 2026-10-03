const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const wrap = require('../utils/wrap');
const { isValidDateStr, isNonEmptyString, isNonNegativeNumber, isValidId, LIMITS } = require('../utils/validate');
const expensesController = require('../controllers/expensesController');

router.use(requireLogin);

function today() {
  return new Date().toISOString().slice(0, 10);
}

function validEntry(body) {
  const { expense_date, category, description, amount } = body;
  if (!isValidDateStr(expense_date)) return 'Enter a valid date.';
  if (!isNonEmptyString(category, 100)) return 'Category is required (100 characters or fewer).';
  if (description && description.length > 255) return 'Description must be 255 characters or fewer.';
  if (!isNonNegativeNumber(amount, LIMITS.EXPENSE_AMOUNT)) {
    return `Amount must be between 0 and ₱${LIMITS.EXPENSE_AMOUNT.toLocaleString()}.`;
  }
  return null;
}

router.get('/', wrap(async (req, res) => {
  const records = await expensesController.listExpenses(req.session.userId);
  res.render('expenses/index', { title: 'Expenses', records, edit: null, error: null, today: today() });
}));

router.post('/', wrap(async (req, res) => {
  const error = validEntry(req.body);
  if (error) {
    const records = await expensesController.listExpenses(req.session.userId);
    return res.status(400).render('expenses/index', { title: 'Expenses', records, edit: req.body, error, today: today() });
  }
  await expensesController.createExpense(req.session.userId, req.body);
  res.redirect('/expenses');
}));

router.get('/:id/edit', wrap(async (req, res) => {
  if (!isValidId(req.params.id)) return res.redirect('/expenses');
  const records = await expensesController.listExpenses(req.session.userId);
  const edit = await expensesController.getExpense(req.session.userId, req.params.id);
  if (!edit) return res.redirect('/expenses');
  res.render('expenses/index', { title: 'Expenses', records, edit, error: null, today: today() });
}));

router.post('/:id/update', wrap(async (req, res) => {
  if (!isValidId(req.params.id)) return res.redirect('/expenses');
  const error = validEntry(req.body);
  if (error) {
    const records = await expensesController.listExpenses(req.session.userId);
    return res.status(400).render('expenses/index', {
      title: 'Expenses', records, edit: { id: req.params.id, ...req.body }, error, today: today(),
    });
  }
  await expensesController.updateExpense(req.session.userId, req.params.id, req.body);
  res.redirect('/expenses');
}));

router.post('/:id/delete', wrap(async (req, res) => {
  if (!isValidId(req.params.id)) return res.redirect('/expenses');
  await expensesController.deleteExpense(req.session.userId, req.params.id);
  res.redirect('/expenses');
}));

module.exports = router;
