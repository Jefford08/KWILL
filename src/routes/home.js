const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const wrap = require('../utils/wrap');
const { TIME_ZONE } = require('../utils/dates');
const homeController = require('../controllers/homeController');

function greeting() {
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function longToday() {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }).format(new Date());
}

router.get('/', requireLogin, wrap(async (req, res) => {
  const stats = await homeController.getStats(req.session.userId);
  const firstName = (req.session.userName || '').trim().split(/\s+/)[0];
  res.render('home', { title: 'Home', stats, greeting: greeting(), firstName, longToday: longToday() });
}));

module.exports = router;
