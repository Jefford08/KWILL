const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const wrap = require('../utils/wrap');
const { isValidDateStr, isPositiveInt, isValidId, LIMITS } = require('../utils/validate');
const mortalityController = require('../controllers/mortalityController');
const { currentPopulation } = require('../controllers/quailController');

router.use(requireLogin);

function today() {
  return new Date().toISOString().slice(0, 10);
}

function validEntry(body) {
  const { entry_date, quantity, note } = body;
  if (!isValidDateStr(entry_date)) return 'Enter a valid date.';
  if (!isPositiveInt(quantity, LIMITS.QUAIL_QUANTITY)) {
    return `Number of dead quails must be a whole number between 1 and ${LIMITS.QUAIL_QUANTITY.toLocaleString()}.`;
  }
  if (note && note.length > 255) return 'Note must be 255 characters or fewer.';
  return null;
}

router.get('/', wrap(async (req, res) => {
  const records = await mortalityController.listMortality(req.session.userId);
  res.render('mortality/index', { title: 'Mortality Tracking', records, edit: null, error: null, today: today() });
}));

router.post('/', wrap(async (req, res) => {
  let error = validEntry(req.body);
  // Only checked on create: an edit could legitimately correct an earlier
  // over-count, and re-deriving "population before" for a past date would
  // need to replay the whole ledger, not just compare to today's total.
  if (!error) {
    const population = await currentPopulation(req.session.userId);
    if (Number(req.body.quantity) > population) {
      error = `Cannot record ${req.body.quantity} deaths against a current population of ${population}.`;
    }
  }
  if (error) {
    const records = await mortalityController.listMortality(req.session.userId);
    return res.status(400).render('mortality/index', {
      title: 'Mortality Tracking', records, edit: req.body, error, today: today(),
    });
  }
  await mortalityController.createMortality(req.session.userId, req.body);
  res.redirect('/mortality');
}));

router.get('/:id/edit', wrap(async (req, res) => {
  if (!isValidId(req.params.id)) return res.redirect('/mortality');
  const records = await mortalityController.listMortality(req.session.userId);
  const edit = await mortalityController.getMortalityEntry(req.session.userId, req.params.id);
  if (!edit) return res.redirect('/mortality');
  res.render('mortality/index', { title: 'Mortality Tracking', records, edit, error: null, today: today() });
}));

router.post('/:id/update', wrap(async (req, res) => {
  if (!isValidId(req.params.id)) return res.redirect('/mortality');
  const error = validEntry(req.body);
  if (error) {
    const records = await mortalityController.listMortality(req.session.userId);
    return res.status(400).render('mortality/index', {
      title: 'Mortality Tracking',
      records,
      edit: { id: req.params.id, ...req.body },
      error,
      today: today(),
    });
  }
  await mortalityController.updateMortality(req.session.userId, req.params.id, req.body);
  res.redirect('/mortality');
}));

router.post('/:id/delete', wrap(async (req, res) => {
  if (!isValidId(req.params.id)) return res.redirect('/mortality');
  await mortalityController.deleteMortality(req.session.userId, req.params.id);
  res.redirect('/mortality');
}));

module.exports = router;
