require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const csrf = require('./src/middleware/csrf');

const authRoutes = require('./src/routes/auth');
const dashboardRoutes = require('./src/routes/dashboard');
const eggsRoutes = require('./src/routes/eggs');
const quailRoutes = require('./src/routes/quail');
const mortalityRoutes = require('./src/routes/mortality');
const feedRoutes = require('./src/routes/feed');
const salesRoutes = require('./src/routes/sales');
const expensesRoutes = require('./src/routes/expenses');
const chartsRoutes = require('./src/routes/charts');
const reportsRoutes = require('./src/routes/reports');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));

// Render (and most hosts) terminate HTTPS at a proxy in front of the app;
// this tells Express to trust that and treat the original request as secure,
// which the session cookie's `secure` flag below depends on.
if (isProduction) {
  app.set('trust proxy', 1);
}

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'src/public')));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'kwill-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8, secure: isProduction },
  })
);

// Issues/checks a per-session CSRF token on every request, before any
// route handles a state-changing form submission.
app.use(csrf.attachToken);
app.use(csrf.verifyToken);

// Logged-out visitors land on the landing page and choose to log in or
// register; logged-in visitors go straight to their dashboard.
app.get('/', (req, res) => {
  if (req.session.userId) return res.redirect('/dashboard');
  res.render('landing', { title: 'Welcome' });
});

app.use('/auth', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/eggs', eggsRoutes);
app.use('/quail', quailRoutes);
app.use('/mortality', mortalityRoutes);
app.use('/feed', feedRoutes);
app.use('/sales', salesRoutes);
app.use('/expenses', expensesRoutes);
app.use('/api/charts', chartsRoutes);
app.use('/reports', reportsRoutes);

// Initialize database schema on startup
(async () => {
  try {
    const fs = require('fs');
    const path = require('path');
    const { Client } = require('pg');

    const schema = fs.readFileSync(path.join(__dirname, 'src/db', 'schema.sql'), 'utf8');
    const connectionString = process.env.DATABASE_URL;

    const client = connectionString
      ? new Client({
          connectionString,
          ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
        })
      : new Client({
          host: process.env.DB_HOST || 'localhost',
          port: process.env.DB_PORT || 5432,
          user: process.env.DB_USER || 'postgres',
          password: process.env.DB_PASSWORD || '',
          database: process.env.DB_NAME || 'kwill_db',
        });

    await client.connect();
    await client.query(schema);
    console.log('Database schema applied successfully.');
    await client.end();
  } catch (err) {
    console.error('Failed to initialize database:', err);
    // Don't exit - let the app run and handle DB errors gracefully
  }
})();

app.use((req, res) => {
  res.status(404).send('Page not found. <a href="/dashboard">Go to Dashboard</a>');
});

// Catches anything forwarded by wrap() in the route files (a bad date, an
// unknown report module, an unexpected DB error) so one bad request can't
// take the whole server down. Must be last, and must take all four
// arguments for Express to treat it as an error handler.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', {
    title: 'Something went wrong',
    message: "That didn't go through. Please try again, and double-check the values you entered.",
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Kwill server running on port ${PORT}`);
});
