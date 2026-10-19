require('dotenv').config();
const { captureError } = require('./src/config/sentry');
const path = require('path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const PgSession = require('connect-pg-simple')(session);
const { pool } = require('./src/config/db');
const csrf = require('./src/middleware/csrf');
const { SESSION_COOKIE } = require('./src/config/session');
const { formatDate } = require('./src/utils/dates');
const { RULES: passwordRules } = require('./src/utils/password');

const authRoutes = require('./src/routes/auth');
const homeRoutes = require('./src/routes/home');
const eggsRoutes = require('./src/routes/eggs');
const quailRoutes = require('./src/routes/quail');
const feedRoutes = require('./src/routes/feed');
const salesRoutes = require('./src/routes/sales');
const expensesRoutes = require('./src/routes/expenses');
const chartsRoutes = require('./src/routes/charts');
const reportsRoutes = require('./src/routes/reports');
const settingsRoutes = require('./src/routes/settings');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

const sessionSecret = process.env.SESSION_SECRET;
if (isProduction && (!sessionSecret || ['change-me', 'kwill-dev-secret'].includes(sessionSecret))) {
  throw new Error('SESSION_SECRET must be set to a long random string in production.');
}
if (isProduction && sessionSecret.length < 32) {
  console.warn('SESSION_SECRET is shorter than 32 characters; use a longer random value.');
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));

if (isProduction) {
  app.set('trust proxy', 1);
}

const pesoFormatter = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
app.locals.formatDate = formatDate;
app.locals.money = (n) => `${Number(n) < 0 ? '-' : ''}₱${pesoFormatter.format(Math.abs(Number(n) || 0))}`;
app.locals.number = (n) => Number(n || 0).toLocaleString('en-PH', { maximumFractionDigits: 2 });
app.locals.passwordRules = passwordRules;
app.locals.contactEmail = process.env.CONTACT_EMAIL || '';

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        baseUri: ["'self'"],
        upgradeInsecureRequests: isProduction ? [] : null,
      },
    },
    strictTransportSecurity: isProduction ? { maxAge: 63072000, includeSubDomains: true } : false,
    referrerPolicy: { policy: 'same-origin' },
  })
);

app.use(express.urlencoded({ extended: false, limit: '20kb', parameterLimit: 50 }));
app.use(express.json({ limit: '20kb' }));
app.use(express.static(path.join(__dirname, 'public')));


app.use(
  session({
    store: new PgSession({ pool, createTableIfMissing: true }),
    name: SESSION_COOKIE,
    secret: sessionSecret || 'kwill-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8, secure: isProduction, sameSite: 'lax', httpOnly: true },
  })
);

app.use((req, res, next) => {
  const redirect = res.redirect.bind(res);
  res.redirect = (...args) => {
    if (!req.session) return redirect(...args);
    req.session.save((err) => (err ? next(err) : redirect(...args)));
  };
  next();
});

app.use((req, res, next) => {
  if (req.session && req.session.userId) res.set('Cache-Control', 'no-store');
  next();
});

app.use(csrf.attachToken);
app.use(csrf.verifyToken);

app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  res.locals.currentUser = req.session.userId ? { id: req.session.userId, name: req.session.userName } : null;
  req.flash = (type, message, extra = {}) => { req.session.flash = { type, message, ...extra }; };

  let flash;
  Object.defineProperty(res.locals, 'flash', {
    enumerable: true,
    get() {
      if (flash === undefined) {
        flash = req.session.flash || null;
        if (flash) delete req.session.flash;
      }
      return flash;
    },
  });
  next();
});


app.get('/', (req, res) => {
  if (req.session.userId) return res.redirect('/home');
  res.render('landing', { title: 'Quail farm management' });
});

app.get('/privacy', (req, res) => {
  res.render('privacy', { title: 'Privacy Policy', layout: req.session.userId ? 'app' : 'doc' });
});

app.use('/auth', authRoutes);
app.use('/home', homeRoutes);
app.use('/eggs', eggsRoutes);
app.use('/quail', quailRoutes);
app.use('/feed', feedRoutes);
app.use('/sales', salesRoutes);
app.use('/expenses', expensesRoutes);
app.use('/api/charts', chartsRoutes);
app.use('/reports', reportsRoutes);
app.use('/settings', settingsRoutes);


app.get(['/dashboard', '/dashboard/*'], (req, res) => res.redirect(301, '/home'));
app.get(['/mortality', '/mortality/*'], (req, res) => res.redirect(301, '/quail'));

app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Page not found',
    message: "The page you're looking for doesn't exist or has moved.",
    layout: req.session && req.session.userId ? 'app' : 'auth',
  });
});

app.use(async (err, req, res, next) => {
  await captureError(err, req, 'Unhandled error');
  if (res.headersSent) return next(err);
  res.status(500).render('error', {
    title: 'Something went wrong',
    message: "That didn't go through. Please try again, and double-check the values you entered.",
    layout: req.session && req.session.userId ? 'app' : 'auth',
  });
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Kwill server running on http://localhost:${PORT}`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `Port ${PORT} is already in use; Kwill is probably already running in another terminal.\n` +
        `Stop that one (Ctrl+C in its terminal) or use another port (PowerShell: $env:PORT=3001; npm run dev)`
      );
      process.exit(1);
    }
    throw err;
  });
}

module.exports = app;
