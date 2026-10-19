const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const wrap = require('../utils/wrap');
const { today } = require('../utils/dates');
const { isValidDateStr, isPositiveNumber, isNonNegativeNumber, isValidId, LIMITS } = require('../utils/validate');
const feedController = require('../controllers/feedController');

router.use(requireLogin);

router.get('/', wrap(async (req, res) => {
  const { rows: history, page } = await feedController.combinedHistory(req.session.userId, req.query);
  res.render('feed/index', { title: 'Feed Management', history, page, error: null, today: today() });
}));

router.post('/purchase', wrap(async (req, res) => {
  const { purchase_date, quantity_kg, cost } = req.body;
  if (
    !isValidDateStr(purchase_date) ||
    !isPositiveNumber(quantity_kg, LIMITS.FEED_KG) ||
    !isNonNegativeNumber(cost, LIMITS.FEED_COST)
  ) {
    const { rows: history, page } = await feedController.combinedHistory(req.session.userId, req.query);
    return res.status(400).render('feed/index', {
      title: 'Feed Management',
      history, page,
      error: `Enter a valid purchase date, a quantity between 0 and ${LIMITS.FEED_KG.toLocaleString()} kg, and a cost between 0 and ₱${LIMITS.FEED_COST.toLocaleString()}.`,
      today: today(),
    });
  }
  const newId = await feedController.addPurchase(req.session.userId, { purchase_date, quantity_kg, cost });
  req.flash('success', 'Feed purchase saved.', { highlight: `purchase-${newId}` });
  res.redirect('/feed');
}));

router.post('/consumption', wrap(async (req, res) => {
  const { consumption_date, quantity_kg } = req.body;
  if (!isValidDateStr(consumption_date) || !isPositiveNumber(quantity_kg, LIMITS.FEED_KG)) {
    const { rows: history, page } = await feedController.combinedHistory(req.session.userId, req.query);
    return res.status(400).render('feed/index', {
      title: 'Feed Management',
      history, page,
      error: `Enter a valid consumption date and a quantity between 0 and ${LIMITS.FEED_KG.toLocaleString()} kg.`,
      today: today(),
    });
  }
  const newId = await feedController.addConsumption(req.session.userId, { consumption_date, quantity_kg });
  req.flash('success', 'Feed consumption saved.', { highlight: `consumption-${newId}` });
  res.redirect('/feed');
}));

router.post('/purchase/:id/delete', wrap(async (req, res) => {
  if (!isValidId(req.params.id)) return res.redirect('/feed');
  await feedController.deletePurchase(req.session.userId, req.params.id);
  req.flash('success', 'Feed entry deleted.');
  res.redirect('/feed');
}));

router.post('/consumption/:id/delete', wrap(async (req, res) => {
  if (!isValidId(req.params.id)) return res.redirect('/feed');
  await feedController.deleteConsumption(req.session.userId, req.params.id);
  req.flash('success', 'Feed entry deleted.');
  res.redirect('/feed');
}));

module.exports = router;
