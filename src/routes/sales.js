const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const wrap = require('../utils/wrap');
const { today } = require('../utils/dates');
const { isValidDateStr, isPositiveInt, isNonNegativeNumber, isValidId, LIMITS } = require('../utils/validate');
const salesController = require('../controllers/salesController');

router.use(requireLogin);

function validEntry(body) {
  const { sale_date, item_type, quantity, unit_price } = body;
  if (!isValidDateStr(sale_date)) return 'Enter a valid date.';
  if (item_type !== 'egg' && item_type !== 'quail') return 'Choose Eggs or Quails.';
  if (!isPositiveInt(quantity, LIMITS.SALE_QUANTITY)) {
    return `Quantity must be a whole number between 1 and ${LIMITS.SALE_QUANTITY.toLocaleString()}.`;
  }
  if (!isNonNegativeNumber(unit_price, LIMITS.UNIT_PRICE)) {
    return `Unit price must be between 0 and ₱${LIMITS.UNIT_PRICE.toLocaleString()}.`;
  }
  return null;
}

router.get('/', wrap(async (req, res) => {
  const { rows: records, page } = await salesController.listSales(req.session.userId, req.query);
  res.render('sales/index', { title: 'Sales', records, page, edit: null, error: null, today: today() });
}));

router.post('/', wrap(async (req, res) => {
  const error = validEntry(req.body);
  if (error) {
    const { rows: records, page } = await salesController.listSales(req.session.userId, req.query);
    return res.status(400).render('sales/index', { title: 'Sales', records, page, edit: req.body, error, today: today() });
  }
  const newId = await salesController.createSale(req.session.userId, req.body);
  req.flash('success', 'Sale saved.', { highlight: newId });
  res.redirect('/sales');
}));

router.get('/:id/edit', wrap(async (req, res) => {
  if (!isValidId(req.params.id)) return res.redirect('/sales');
  const { rows: records, page } = await salesController.listSales(req.session.userId, req.query);
  const edit = await salesController.getSale(req.session.userId, req.params.id);
  if (!edit) return res.redirect('/sales');
  res.render('sales/index', { title: 'Sales', records, page, edit, error: null, today: today() });
}));

router.post('/:id/update', wrap(async (req, res) => {
  if (!isValidId(req.params.id)) return res.redirect('/sales');
  const error = validEntry(req.body);
  if (error) {
    const { rows: records, page } = await salesController.listSales(req.session.userId, req.query);
    return res.status(400).render('sales/index', {
      title: 'Sales', records, page, edit: { id: req.params.id, ...req.body }, error, today: today(),
    });
  }
  await salesController.updateSale(req.session.userId, req.params.id, req.body);
  req.flash('success', 'Sale updated.', { highlight: req.params.id });
  res.redirect('/sales');
}));

router.post('/:id/delete', wrap(async (req, res) => {
  if (!isValidId(req.params.id)) return res.redirect('/sales');
  await salesController.deleteSale(req.session.userId, req.params.id);
  req.flash('success', 'Sale deleted.');
  res.redirect('/sales');
}));

module.exports = router;
