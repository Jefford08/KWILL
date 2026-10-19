const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const wrap = require('../utils/wrap');
const { today } = require('../utils/dates');
const { isValidDateStr, isPositiveInt, isValidId, LIMITS } = require('../utils/validate');
const quailController = require('../controllers/quailController');

router.use(requireLogin);

const TITLE = 'Quail';

function validEntry(body, { checkType = true } = {}) {
  const { entry_date, change_type, quantity, note } = body;
  if (!isValidDateStr(entry_date)) return 'Enter a valid date.';
  if (checkType && !quailController.CHANGE_TYPES.includes(change_type)) return 'Choose Added, Removed or Died.';
  if (!isPositiveInt(quantity, LIMITS.QUAIL_QUANTITY)) {
    return `Quantity must be a whole number between 1 and ${LIMITS.QUAIL_QUANTITY.toLocaleString()}.`;
  }
  if (note && note.length > 255) return 'Note must be 255 characters or fewer.';
  return null;
}

async function renderPage(req, res, { edit = null, error = null, status = 200 } = {}) {
  const userId = req.session.userId;
  const [{ rows: records, page }, currentTotal] = await Promise.all([
    quailController.listEntries(userId, req.query),
    quailController.currentPopulation(userId),
  ]);
  res.status(status).render('quail/index', { title: TITLE, records, page, currentTotal, edit, error, today: today() });
}

router.get('/', wrap((req, res) => renderPage(req, res)));

router.post('/', wrap(async (req, res) => {
  let error = validEntry(req.body);

  if (!error && req.body.change_type !== 'add') {
    const population = await quailController.currentPopulation(req.session.userId);
    if (Number(req.body.quantity) > population) {
      error = `You only have ${population.toLocaleString()} quail${population === 1 ? '' : 's'} right now.`;
    }
  }
  if (error) return renderPage(req, res, { edit: req.body, error, status: 400 });
  const newId = await quailController.createEntry(req.session.userId, req.body);
  req.flash('success', 'Quail entry saved.', { highlight: newId });
  res.redirect('/quail');
}));

router.get('/:id/edit', wrap(async (req, res) => {
  if (!isValidId(req.params.id)) return res.redirect('/quail');
  const edit = await quailController.getEntry(req.session.userId, req.params.id);
  if (!edit) return res.redirect('/quail');
  return renderPage(req, res, { edit });
}));

router.post('/:id/update', wrap(async (req, res) => {
  if (!isValidId(req.params.id)) return res.redirect('/quail');
  const existing = await quailController.getEntry(req.session.userId, req.params.id);
  if (!existing) return res.redirect('/quail');
  const error = validEntry(req.body, { checkType: false });
  if (error) {
    return renderPage(req, res, {
      edit: { ...existing, ...req.body, id: existing.id, change_type: existing.change_type },
      error,
      status: 400,
    });
  }
  await quailController.updateEntry(req.session.userId, req.params.id, req.body);
  req.flash('success', 'Quail entry updated.', { highlight: req.params.id });
  res.redirect('/quail');
}));

router.post('/:id/delete', wrap(async (req, res) => {
  if (!isValidId(req.params.id)) return res.redirect('/quail');
  await quailController.deleteEntry(req.session.userId, req.params.id);
  req.flash('success', 'Quail entry deleted.');
  res.redirect('/quail');
}));

module.exports = router;
