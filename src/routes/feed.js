const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const wrap = require('../utils/wrap');
const { isValidDateStr, isPositiveNumber, isNonNegativeNumber, isValidId, LIMITS } = require('../utils/validate');
const feedController = require('../controllers/feedController');

router.use(requireLogin);

function today() {
  return new Date().toISOString().slice(0, 10);
}

router.get('/', wrap(async (req, res) => {
  const history = await feedController.combinedHistory(req.session.userId);
  res.render('feed/index', { title: 'Feed Management', history, error: null, today: today() });
}));

router.post('/purchase', wrap(async (req, res) => {
  const { purchase_date, quantity_kg, cost } = req.body;
  if (
    !isValidDateStr(purchase_date) ||
    !isPositiveNumber(quantity_kg, LIMITS.FEED_KG) ||
    !isNonNegativeNumber(cost, LIMITS.FEED_COST)
  ) {
    const history = await feedController.combinedHistory(req.session.userId);
    return res.status(400).render('feed/index', {
      title: 'Feed Management',
      history,
      error: `Enter a valid purchase date, a quantity between 0 and ${LIMITS.FEED_KG.toLocaleString()} kg, and a cost between 0 and ₱${LIMITS.FEED_COST.toLocaleString()}.`,
      today: today(),
    });
  }
  await feedController.addPurchase(req.session.userId, { purchase_date, quantity_kg, cost });
  res.redirect('/feed');
}));

router.post('/consumption', wrap(async (req, res) => {
  const { consumption_date, quantity_kg } = req.body;
  if (!isValidDateStr(consumption_date) || !isPositiveNumber(quantity_kg, LIMITS.FEED_KG)) {
    const history = await feedController.combinedHistory(req.session.userId);
    return res.status(400).render('feed/index', {
      title: 'Feed Management',
      history,
      error: `Enter a valid consumption date and a quantity between 0 and ${LIMITS.FEED_KG.toLocaleString()} kg.`,
      today: today(),
    });
  }
  await feedController.addConsumption(req.session.userId, { consumption_date, quantity_kg });
  res.redirect('/feed');
}));

router.post('/purchase/:id/delete', wrap(async (req, res) => {
  if (!isValidId(req.params.id)) return res.redirect('/feed');
  await feedController.deletePurchase(req.session.userId, req.params.id);
  res.redirect('/feed');
}));

router.post('/consumption/:id/delete', wrap(async (req, res) => {
  if (!isValidId(req.params.id)) return res.redirect('/feed');
  await feedController.deleteConsumption(req.session.userId, req.params.id);
  res.redirect('/feed');
}));

module.exports = router;
