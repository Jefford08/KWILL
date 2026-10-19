const express = require('express');
const router = express.Router();
const { sharedRateLimit } = require('../middleware/rateLimitStore');
const wrap = require('../utils/wrap');
const { captureError } = require('../config/sentry');
const { accountFieldsError, isValidEmail } = require('../utils/validate');
const { passwordError } = require('../utils/password');
const authController = require('../controllers/authController');
const verification = require('../services/verification');
const mailer = require('../services/mailer');
const { SESSION_COOKIE } = require('../config/session');

function limitHandler(req, res) {
  res.status(429).render('error', {
    title: 'Too many attempts',
    message: 'Too many attempts from this device. Please wait a few minutes and try again.',
    layout: 'auth',
  });
}

const loginLimiter = sharedRateLimit('login', { windowMinutes: 15, max: 10, handler: limitHandler });
const registerLimiter = sharedRateLimit('register', { windowMinutes: 60, max: 20, handler: limitHandler });
const sendCodeLimiter = sharedRateLimit('send-code', { windowMinutes: 15, max: 6, handler: limitHandler });
const verifyLimiter = sharedRateLimit('verify-code', { windowMinutes: 15, max: 20, handler: limitHandler });

const RESET_WINDOW_MS = 15 * 60 * 1000;

function maskEmail(email) {
  const [local, domain] = String(email).split('@');
  if (!domain) return email;
  return `${local.slice(0, 2)}${'•'.repeat(Math.max(local.length - 2, 3))}@${domain}`;
}

function redirectIfLoggedIn(req, res, next) {
  if (req.session.userId) return res.redirect('/home');
  next();
}


router.get('/register', redirectIfLoggedIn, (req, res) => {
  res.render('auth/register', { title: 'Create account', error: null, values: null });
});

router.post('/register', registerLimiter, wrap(async (req, res) => {
  const { name, username, email, password, confirm_password } = req.body;
  const values = { name, username, email };
  const fail = (message) => res.status(400).render('auth/register', { title: 'Create account', error: message, values });

  if (!name || !username || !email || !password || !confirm_password) {
    return fail('Please fill in every field.');
  }
  const fieldError = accountFieldsError(values) || passwordError(password);
  if (fieldError) return fail(fieldError);
  if (password !== confirm_password) return fail("Passwords don't match.");

  let userId;
  try {
    userId = await authController.register({ name, username, email, password });
  } catch (err) {

    if (err instanceof authController.AccountError) return fail(err.message);
    throw err;
  }
  await startEmailVerification(req, await authController.findById(userId));
  res.redirect('/auth/verify-email');
}));

const VERIFY_WINDOW_MS = 24 * 60 * 60 * 1000;

async function sendVerifyCode(user) {
  if (await verification.cooldownRemaining(user.id, 'verify') > 0) return;
  const code = await verification.issueCode(user.id, 'verify');
  await mailer.sendVerificationCode({
    to: user.email, name: user.name, code, purpose: 'verify', minutes: verification.CODE_TTL_MINUTES,
  });
}

async function startEmailVerification(req, user) {
  req.session.pendingVerification = { userId: user.id, email: user.email, startedAt: Date.now() };
  try {
    await sendVerifyCode(user);
  } catch (err) {
    await captureError(err, req, 'Sending verification code failed');
    req.flash('error', "We couldn't send the verification email just now. Use \"send a new code\" below to try again.");
  }
}

function pendingVerification(req) {
  const state = req.session.pendingVerification;
  if (!state || Date.now() - state.startedAt > VERIFY_WINDOW_MS) return null;
  return state;
}

async function renderVerifyEmail(req, res, { error = null, status = 200 } = {}) {
  const state = pendingVerification(req);
  res.status(status).render('account/verify-code', {
    title: 'Verify your email',
    heading: 'Verify your email',
    layout: 'auth',
    error,
    email: maskEmail(state.email),
    action: '/auth/verify-email',
    resendAction: '/auth/verify-email/resend',
    cooldown: await verification.cooldownRemaining(state.userId, 'verify'),
    backHref: '/auth/login',
    backLabel: 'Back to log in',
  });
}

router.get('/verify-email', wrap(async (req, res) => {
  if (!pendingVerification(req)) return res.redirect('/auth/login');
  return renderVerifyEmail(req, res);
}));

router.post('/verify-email', verifyLimiter, wrap(async (req, res) => {
  const state = pendingVerification(req);
  if (!state) return res.redirect('/auth/login');
  const result = await verification.verifyCode(state.userId, 'verify', req.body.code);
  if (!result.ok) return renderVerifyEmail(req, res, { error: result.message, status: 400 });
  await authController.markEmailVerified(state.userId);
  delete req.session.pendingVerification;
  req.flash('success', 'Email verified! Your account is ready. Log in to get started.');
  res.redirect('/auth/login');
}));

router.post('/verify-email/resend', sendCodeLimiter, wrap(async (req, res) => {
  const state = pendingVerification(req);
  if (!state) return res.redirect('/auth/login');
  try {
    await sendVerifyCode(await authController.findById(state.userId));
  } catch (err) {
    await captureError(err, req, 'Resending verification code failed');
    return renderVerifyEmail(req, res, { error: "We couldn't send the email right now. Please try again shortly.", status: 502 });
  }
  req.flash('success', 'A new code is on its way.');
  res.redirect('/auth/verify-email');
}));

// ---- Log in / out -------------------------------------------------------------

router.get('/login', redirectIfLoggedIn, (req, res) => {
  res.render('auth/login', { title: 'Log in', error: null });
});

router.post('/login', loginLimiter, wrap(async (req, res, next) => {
  const { username, password } = req.body;
  const fail = (message) => res.status(400).render('auth/login', { title: 'Log in', error: message, username });
  if (!username || !password) return fail('Enter your username and password.');

  const user = await authController.verifyLogin(username, password);
  if (!user) return fail('Incorrect username or password.');
  if (!user.email_verified) {
    await startEmailVerification(req, user);
    if (!req.session.flash) req.flash('info', 'Please verify your email before logging in. We sent a code to your inbox.');
    return res.redirect('/auth/verify-email');
  }

  req.session.regenerate((err) => {
    if (err) return next(err);
    req.session.userId = user.id;
    req.session.userName = user.name;
    res.redirect('/home');
  });
}));

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie(SESSION_COOKIE);
    res.redirect('/');
  });
});

async function sendResetCode(user) {
  if (!user) return;
  if (await verification.cooldownRemaining(user.id, 'reset') > 0) return;
  const code = await verification.issueCode(user.id, 'reset');
  await mailer.sendVerificationCode({
    to: user.email, name: user.name, code, purpose: 'reset', minutes: verification.CODE_TTL_MINUTES,
  });
}

function resetState(req) {
  const state = req.session.reset;
  if (!state || Date.now() - state.startedAt > RESET_WINDOW_MS) return null;
  return state;
}

router.get('/forgot', redirectIfLoggedIn, (req, res) => {
  res.render('auth/forgot', { title: 'Forgot password', error: null, email: '' });
});

router.post('/forgot', sendCodeLimiter, wrap(async (req, res) => {
  const email = authController.normalizeEmail(req.body.email);
  if (!isValidEmail(email)) {
    return res.status(400).render('auth/forgot', { title: 'Forgot password', error: 'Enter a valid email address.', email });
  }
  const user = await authController.findByEmail(email);
  try {
    await sendResetCode(user);
  } catch (err) {
    await captureError(err, req, 'Sending reset code failed');
    return res.status(502).render('auth/forgot', {
      title: 'Forgot password',
      error: "We couldn't send the email right now. Please try again in a few minutes.",
      email,
    });
  }
  req.session.reset = { userId: user ? user.id : null, email, startedAt: Date.now(), verified: false };
  res.redirect('/auth/forgot/verify');
}));

async function renderVerify(req, res, { error = null, status = 200 } = {}) {
  const state = resetState(req);
  const cooldown = state.userId ? await verification.cooldownRemaining(state.userId, 'reset') : 0;
  res.status(status).render('account/verify-code', {
    title: 'Enter verification code',
    layout: 'auth',
    error,
    email: maskEmail(state.email),
    action: '/auth/forgot/verify',
    resendAction: '/auth/forgot/resend',
    cooldown,
    backHref: '/auth/login',
    backLabel: 'Back to log in',
  });
}

router.get('/forgot/verify', wrap(async (req, res) => {
  if (!resetState(req)) return res.redirect('/auth/forgot');
  return renderVerify(req, res);
}));

router.post('/forgot/verify', verifyLimiter, wrap(async (req, res) => {
  const state = resetState(req);
  if (!state) return res.redirect('/auth/forgot');
  const result = state.userId
    ? await verification.verifyCode(state.userId, 'reset', req.body.code)
    : { ok: false, message: "That code isn't right." };
  if (!result.ok) return renderVerify(req, res, { error: result.message, status: 400 });
  state.verified = true;
  res.redirect('/auth/forgot/reset');
}));

router.post('/forgot/resend', sendCodeLimiter, wrap(async (req, res) => {
  const state = resetState(req);
  if (!state) return res.redirect('/auth/forgot');
  try {
    await sendResetCode(state.userId ? await authController.findById(state.userId) : null);
  } catch (err) {
    await captureError(err, req, 'Resending reset code failed');
    return renderVerify(req, res, { error: "We couldn't send the email right now. Please try again shortly.", status: 502 });
  }
  req.flash('success', 'A new code is on its way.');
  res.redirect('/auth/forgot/verify');
}));

function renderNewPassword(res, { error = null, status = 200 } = {}) {
  res.status(status).render('account/new-password', {
    title: 'Set a new password',
    layout: 'auth',
    error,
    action: '/auth/forgot/reset',
    backHref: '/auth/login',
    backLabel: 'Back to log in',
  });
}

router.get('/forgot/reset', (req, res) => {
  const state = resetState(req);
  if (!state || !state.verified) return res.redirect('/auth/forgot');
  renderNewPassword(res);
});

router.post('/forgot/reset', wrap(async (req, res) => {
  const state = resetState(req);
  if (!state || !state.verified || !state.userId) return res.redirect('/auth/forgot');
  const { password, confirm_password } = req.body;
  const error = passwordError(password) || (password !== confirm_password ? "Passwords don't match." : null);
  if (error) return renderNewPassword(res, { error, status: 400 });

  await authController.setPassword(state.userId, password);
  await authController.markEmailVerified(state.userId);
  await authController.endOtherSessions(state.userId, req.sessionID);
  delete req.session.reset;
  req.flash('success', 'Your password has been reset. Log in with your new password.');
  res.redirect('/auth/login');
}));

module.exports = router;
