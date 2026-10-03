const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const chartController = require('../controllers/chartController');

router.get('/:metric', requireLogin, async (req, res) => {
  try {
    let { from, to, granularity } = req.query;
    if (!from || !to) {
      const range = chartController.defaultRange(30);
      from = from || range.from;
      to = to || range.to;
    }
    granularity = chartController.normalizeGranularity(granularity);
    const series = await chartController.getSeries(req.session.userId, req.params.metric, from, to, granularity);
    res.json(series);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
