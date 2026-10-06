const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const wrap = require('../utils/wrap');
const authController = require('../controllers/authController');

function limitHandler(req, res) {
  res.status(429).render('error', {
    title: 'Too many attempts',
    message: 'Too many attempts from this device. Please wait a few minutes and try again.',
  });
}

// Slows down credential-stuffing / brute-force login attempts. Keyed by IP,
// so it throttles per-device rather than per-account (no account lockout,
// which would let an attacker lock a real user out just by guessing).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitHandler,
});

// Looser limit on registration, mainly to slow down automated account spam.
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitHandler,
});

router.get('/register', (req, res) => {
  if (req.session.userId) return res.redirect('/dashboard');
  res.render('auth/register', { title: 'Register', error: null });
});

router.post('/register', registerLimiter, wrap(async (req, res) => {
  const { name, username, email, password, confirm_password } = req.body;
  const fail = (message) => res.status(400).render('auth/register', { title: 'Register', error: message });

  if (!name || !username || !email || !password || !confirm_password) {
    return fail('All fields are required.');
  }
  if (username.length < 3 || username.length > 20) {
    return fail('Username must be between 3 and 20 characters.');
  }
  if (password.length < 6) {
    return fail('Password must be at least 6 characters.');
  }
  if (password !== confirm_password) {
    return fail('Passwords do not match.');
  }

  try {
    // Don't log the new user in here: send them to the login page so they
    // sign in with the credentials they just created.
    await authController.register({ name, username, email, password });
    res.redirect('/auth/login?registered=1');
  } catch (err) {
    // Duplicate email/username, thrown by authController.register
    fail(err.message);
  }
}));

router.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/dashboard');
  const success = req.query.registered ? 'Account created! Please log in.' : null;
  res.render('auth/login', { title: 'Log In', error: null, success });
});

router.post('/login', loginLimiter, wrap(async (req, res, next) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).render('auth/login', { title: 'Log In', error: 'Enter your username and password.' });
  }

  const user = await authController.verifyLogin(username, password);
  if (!user) {
    return res.status(400).render('auth/login', { title: 'Log In', error: 'Invalid username or password.' });
  }

  // Regenerate the session on login so a session id issued before
  // authentication can't be reused to hijack the logged-in session.
  req.session.regenerate((err) => {
    if (err) return next(err);
    req.session.userId = user.id;
    req.session.userName = user.name;
    res.redirect('/dashboard');
  });
}));

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
