const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const wrap = require('../utils/wrap');
const { isValidDateStr, isNonNegativeInt, isValidId, LIMITS } = require('../utils/validate');
const eggController = require('../controllers/eggController');

router.use(requireLogin);

function today() {
  return new Date().toISOString().slice(0, 10);
}

router.get('/', wrap(async (req, res) => {
  const records = await eggController.listEggs(req.session.userId);
  res.render('eggs/index', { title: 'Egg Production', records, edit: null, error: null, today: today() });
}));

router.post('/', wrap(async (req, res) => {
  const { record_date, eggs_good, eggs_damaged } = req.body;
  if (
    !isValidDateStr(record_date) ||
    !isNonNegativeInt(eggs_good, LIMITS.EGGS_PER_RECORD) ||
    !isNonNegativeInt(eggs_damaged, LIMITS.EGGS_PER_RECORD)
  ) {
    const records = await eggController.listEggs(req.session.userId);
    return res.status(400).render('eggs/index', {
      title: 'Egg Production',
      records,
      edit: { record_date, eggs_good, eggs_damaged },
      error: `Enter a valid date and whole numbers (0 to ${LIMITS.EGGS_PER_RECORD.toLocaleString()}) for good and damaged eggs.`,
      today: today(),
    });
  }
  await eggController.createEgg(req.session.userId, {
    record_date,
    eggs_good: Number(eggs_good),
    eggs_damaged: Number(eggs_damaged),
  });
  res.redirect('/eggs');
}));

router.get('/:id/edit', wrap(async (req, res) => {
  if (!isValidId(req.params.id)) return res.redirect('/eggs');
  const records = await eggController.listEggs(req.session.userId);
  const edit = await eggController.getEgg(req.session.userId, req.params.id);
  if (!edit) return res.redirect('/eggs');
  res.render('eggs/index', { title: 'Egg Production', records, edit, error: null, today: today() });
}));

router.post('/:id/update', wrap(async (req, res) => {
  if (!isValidId(req.params.id)) return res.redirect('/eggs');
  const { record_date, eggs_good, eggs_damaged } = req.body;
  if (
    !isValidDateStr(record_date) ||
    !isNonNegativeInt(eggs_good, LIMITS.EGGS_PER_RECORD) ||
    !isNonNegativeInt(eggs_damaged, LIMITS.EGGS_PER_RECORD)
  ) {
    const records = await eggController.listEggs(req.session.userId);
    return res.status(400).render('eggs/index', {
      title: 'Egg Production',
      records,
      edit: { id: req.params.id, record_date, eggs_good, eggs_damaged },
      error: `Enter a valid date and whole numbers (0 to ${LIMITS.EGGS_PER_RECORD.toLocaleString()}) for good and damaged eggs.`,
      today: today(),
    });
  }
  await eggController.updateEgg(req.session.userId, req.params.id, {
    record_date,
    eggs_good: Number(eggs_good),
    eggs_damaged: Number(eggs_damaged),
  });
  res.redirect('/eggs');
}));

router.post('/:id/delete', wrap(async (req, res) => {
  if (!isValidId(req.params.id)) return res.redirect('/eggs');
  await eggController.deleteEgg(req.session.userId, req.params.id);
  res.redirect('/eggs');
}));

module.exports = router;
