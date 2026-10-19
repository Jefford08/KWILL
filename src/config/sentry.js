const Sentry = require('@sentry/node');

const enabled = Boolean(process.env.SENTRY_DSN);

if (enabled) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
}

async function captureError(err, req, message) {
  console.error(message || 'Error:', err);
  if (!enabled) return;
  Sentry.withScope((scope) => {
    if (req) {
      scope.setTag('route', `${req.method} ${req.baseUrl || ''}${req.route ? req.route.path : req.path}`);
      if (req.session && req.session.userId) scope.setUser({ id: String(req.session.userId) });
    }
    if (message) scope.setExtra('context', message);
    Sentry.captureException(err);
  });
  await Sentry.flush(2000).catch(() => {});
}

module.exports = { captureError, sentryEnabled: enabled };
