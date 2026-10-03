const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const wrap = require('../utils/wrap');
const dashboardController = require('../controllers/dashboardController');

router.get('/', requireLogin, wrap(async (req, res) => {
  const stats = await dashboardController.getStats(req.session.userId);
  res.render('dashboard', { title: 'Dashboard', stats });
}));

module.exports = router;
