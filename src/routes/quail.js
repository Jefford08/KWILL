const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const wrap = require('../utils/wrap');
const { isValidDateStr, isPositiveInt, isValidId, LIMITS } = require('../utils/validate');
const quailController = require('../controllers/quailController');

router.use(requireLogin);

function today() {
  return new Date().toISOString().slice(0, 10);
}

function validEntry(body) {
  const { entry_date, change_type, quantity, note } = body;
  if (!isValidDateStr(entry_date)) return 'Enter a valid date.';
  if (change_type !== 'add' && change_type !== 'remove') return 'Choose Add Stock or Remove Stock.';
  if (!isPositiveInt(quantity, LIMITS.QUAIL_QUANTITY)) {
    return `Quantity must be a whole number between 1 and ${LIMITS.QUAIL_QUANTITY.toLocaleString()}.`;
  }
  if (note && note.length > 255) return 'Note must be 255 characters or fewer.';
  return null;
}

router.get('/', wrap(async (req, res) => {
  const records = await quailController.listStock(req.session.userId);
  const currentTotal = await quailController.currentPopulation(req.session.userId);
  res.render('quail/index', {
    title: 'Quail Management', records, currentTotal, edit: null, error: null, today: today(),
  });
}));

router.post('/', wrap(async (req, res) => {
  const error = validEntry(req.body);
  if (error) {
    const records = await quailController.listStock(req.session.userId);
    const currentTotal = await quailController.currentPopulation(req.session.userId);
    return res.status(400).render('quail/index', {
      title: 'Quail Management', records, currentTotal, edit: req.body, error, today: today(),
    });
  }
  await quailController.createStockEntry(req.session.userId, req.body);
  res.redirect('/quail');
}));

router.get('/:id/edit', wrap(async (req, res) => {
  if (!isValidId(req.params.id)) return res.redirect('/quail');
  const records = await quailController.listStock(req.session.userId);
  const currentTotal = await quailController.currentPopulation(req.session.userId);
  const edit = await quailController.getStockEntry(req.session.userId, req.params.id);
  if (!edit) return res.redirect('/quail');
  res.render('quail/index', {
    title: 'Quail Management', records, currentTotal, edit, error: null, today: today(),
  });
}));

router.post('/:id/update', wrap(async (req, res) => {
  if (!isValidId(req.params.id)) return res.redirect('/quail');
  const error = validEntry(req.body);
  if (error) {
    const records = await quailController.listStock(req.session.userId);
    const currentTotal = await quailController.currentPopulation(req.session.userId);
    return res.status(400).render('quail/index', {
      title: 'Quail Management',
      records,
      currentTotal,
      edit: { id: req.params.id, ...req.body },
      error,
      today: today(),
    });
  }
  await quailController.updateStockEntry(req.session.userId, req.params.id, req.body);
  res.redirect('/quail');
}));

router.post('/:id/delete', wrap(async (req, res) => {
  if (!isValidId(req.params.id)) return res.redirect('/quail');
  await quailController.deleteStockEntry(req.session.userId, req.params.id);
  res.redirect('/quail');
}));

module.exports = router;
