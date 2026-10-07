require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const { pool } = require('./src/config/db');
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

if (isProduction) {
  app.set('trust proxy', 1);
}

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    store: new PgSession({ pool, createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET || 'kwill-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8, secure: isProduction },
  })
);

app.use(csrf.attachToken);
app.use(csrf.verifyToken);
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

(async () => {
  try {
    const fs = require('fs');
    const schema = fs.readFileSync(path.join(__dirname, 'src/db', 'schema.sql'), 'utf8');
    await pool.query(schema);
    console.log('Database schema applied successfully.');
  } catch (err) {
    console.error('Failed to initialize database:', err);

  }
})();

app.use((req, res) => {
  res.status(404).send('Page not found. <a href="/dashboard">Go to Dashboard</a>');
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', {
    title: 'Something went wrong',
    message: "That didn't go through. Please try again, and double-check the values you entered.",
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
