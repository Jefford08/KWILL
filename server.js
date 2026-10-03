require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const csrf = require('./src/middleware/csrf');

const authRoutes = require('./src/routes/auth');
const eggsRoutes = require('./src/routes/eggs');
const quailRoutes = require('./src/routes/quail');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));

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

app.use(csrf.attachToken);
app.use(csrf.verifyToken);

app.get('/', (req, res) => {
  if (req.session.userId) return res.redirect('/dashboard');
  res.render('landing', { title: 'Welcome' });
});

app.use('/auth', authRoutes);
app.use('/eggs', eggsRoutes);
app.use('/quail', quailRoutes);

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

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Kwill server running on port ${PORT}`);
});
