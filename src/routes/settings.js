const express = require('express');
const router = express.Router();
const { sharedRateLimit } = require('../middleware/rateLimitStore');
const { requireLogin } = require('../middleware/auth');
const wrap = require('../utils/wrap');
const { captureError } = require('../config/sentry');
const { accountFieldsError } = require('../utils/validate');
const { passwordError } = require('../utils/password');
const authController = require('../controllers/authController');
const verification = require('../services/verification');
const mailer = require('../services/mailer');

router.use(requireLogin);

const sendCodeLimiter = sharedRateLimit('settings-send-code', {
  windowMinutes: 15,
  max: 6,
  handler: (req, res) => {
    req.flash('error', 'Too many code requests. Please wait a few minutes and try again.');
    res.redirect('/settings#security');
  },
});

const CHANGE_WINDOW_MS = 15 * 60 * 1000;

async function renderSettings(req, res, { values = null, error = null, showPasswordConfirm = false, status = 200 } = {}) {
  const user = await authController.findById(req.session.userId);
  res.status(status).render('settings/index', { title: 'Settings', user, values, error, showPasswordConfirm });
}

router.get('/', wrap((req, res) => renderSettings(req, res)));


router.post('/profile', wrap(async (req, res) => {
  const userId = req.session.userId;
  const values = { name: (req.body.name || '').trim(), username: (req.body.username || '').trim(), email: (req.body.email || '').trim() };
  const current = await authController.findById(userId);
  const emailChanged = authController.normalizeEmail(values.email) !== authController.normalizeEmail(current.email);
  const fail = (error) => renderSettings(req, res, { values, error, showPasswordConfirm: emailChanged, status: 400 });

  const fieldError = accountFieldsError(values);
  if (fieldError) return fail(fieldError);

  if (emailChanged && !(await authController.checkPassword(userId, req.body.current_password))) {
    return fail('Your current password is incorrect, so the email was not changed.');
  }

  try {
    await authController.updateProfile(userId, values);
  } catch (err) {
    if (err instanceof authController.AccountError) return fail(err.message);
    throw err;
  }
  req.session.userName = values.name;
  req.flash('success', 'Your account details have been saved.');
  res.redirect('/settings');
}));


function changeState(req) {
  const state = req.session.passwordChange;
  if (!state || Date.now() - state.startedAt > CHANGE_WINDOW_MS) return null;
  return state;
}

async function sendChangeCode(user) {
  if (await verification.cooldownRemaining(user.id, 'change') > 0) return;
  const code = await verification.issueCode(user.id, 'change');
  await mailer.sendVerificationCode({
    to: user.email, name: user.name, code, purpose: 'change', minutes: verification.CODE_TTL_MINUTES,
  });
}

router.post('/password/send', sendCodeLimiter, wrap(async (req, res) => {
  const user = await authController.findById(req.session.userId);
  try {
    await sendChangeCode(user);
  } catch (err) {
    await captureError(err, req, 'Sending password change code failed');
    req.flash('error', "We couldn't send the verification email right now. Please try again in a few minutes.");
    return res.redirect('/settings#security');
  }
  req.session.passwordChange = { startedAt: Date.now(), verified: false };
  res.redirect('/settings/password/verify');
}));

async function renderVerify(req, res, { error = null, status = 200 } = {}) {
  const user = await authController.findById(req.session.userId);
  res.status(status).render('account/verify-code', {
    title: 'Verify it’s you',
    layout: 'app',
    error,
    email: user.email,
    action: '/settings/password/verify',
    resendAction: '/settings/password/resend',
    cooldown: await verification.cooldownRemaining(user.id, 'change'),
    backHref: '/settings',
    backLabel: 'Settings',
  });
}

router.get('/password/verify', wrap(async (req, res) => {
  if (!changeState(req)) return res.redirect('/settings');
  return renderVerify(req, res);
}));

router.post('/password/verify', wrap(async (req, res) => {
  const state = changeState(req);
  if (!state) return res.redirect('/settings');
  const result = await verification.verifyCode(req.session.userId, 'change', req.body.code);
  if (!result.ok) return renderVerify(req, res, { error: result.message, status: 400 });
  state.verified = true;
  res.redirect('/settings/password/new');
}));

router.post('/password/resend', sendCodeLimiter, wrap(async (req, res) => {
  if (!changeState(req)) return res.redirect('/settings');
  try {
    await sendChangeCode(await authController.findById(req.session.userId));
  } catch (err) {
    await captureError(err, req, 'Resending password change code failed');
    return renderVerify(req, res, { error: "We couldn't send the email right now. Please try again shortly.", status: 502 });
  }
  req.flash('success', 'A new code is on its way.');
  res.redirect('/settings/password/verify');
}));

function renderNewPassword(res, { error = null, status = 200 } = {}) {
  res.status(status).render('account/new-password', {
    title: 'Set a new password',
    layout: 'app',
    error,
    action: '/settings/password/new',
    backHref: '/settings',
    backLabel: 'Settings',
  });
}

router.get('/password/new', (req, res) => {
  const state = changeState(req);
  if (!state || !state.verified) return res.redirect('/settings');
  renderNewPassword(res);
});

router.post('/password/new', wrap(async (req, res) => {
  const state = changeState(req);
  if (!state || !state.verified) return res.redirect('/settings');
  const { password, confirm_password } = req.body;
  const error = passwordError(password) || (password !== confirm_password ? "Passwords don't match." : null);
  if (error) return renderNewPassword(res, { error, status: 400 });

  await authController.setPassword(req.session.userId, password);
  await authController.endOtherSessions(req.session.userId, req.sessionID);
  delete req.session.passwordChange;
  req.flash('success', 'Your password has been changed. Other devices have been signed out.');
  res.redirect('/settings');
}));

module.exports = router;
