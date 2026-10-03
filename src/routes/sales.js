const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const wrap = require('../utils/wrap');
const { isValidDateStr, isPositiveInt, isNonNegativeNumber, isValidId, LIMITS } = require('../utils/validate');
const salesController = require('../controllers/salesController');

router.use(requireLogin);

function today() {
  return new Date().toISOString().slice(0, 10);
}

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
  const records = await salesController.listSales(req.session.userId);
  res.render('sales/index', { title: 'Sales', records, edit: null, error: null, today: today() });
}));

router.post('/', wrap(async (req, res) => {
  const error = validEntry(req.body);
  if (error) {
    const records = await salesController.listSales(req.session.userId);
    return res.status(400).render('sales/index', { title: 'Sales', records, edit: req.body, error, today: today() });
  }
  await salesController.createSale(req.session.userId, req.body);
  res.redirect('/sales');
}));

router.get('/:id/edit', wrap(async (req, res) => {
  if (!isValidId(req.params.id)) return res.redirect('/sales');
  const records = await salesController.listSales(req.session.userId);
  const edit = await salesController.getSale(req.session.userId, req.params.id);
  if (!edit) return res.redirect('/sales');
  res.render('sales/index', { title: 'Sales', records, edit, error: null, today: today() });
}));

router.post('/:id/update', wrap(async (req, res) => {
  if (!isValidId(req.params.id)) return res.redirect('/sales');
  const error = validEntry(req.body);
  if (error) {
    const records = await salesController.listSales(req.session.userId);
    return res.status(400).render('sales/index', {
      title: 'Sales', records, edit: { id: req.params.id, ...req.body }, error, today: today(),
    });
  }
  await salesController.updateSale(req.session.userId, req.params.id, req.body);
  res.redirect('/sales');
}));

router.post('/:id/delete', wrap(async (req, res) => {
  if (!isValidId(req.params.id)) return res.redirect('/sales');
  await salesController.deleteSale(req.session.userId, req.params.id);
  res.redirect('/sales');
}));

module.exports = router;
