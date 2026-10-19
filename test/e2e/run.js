require('dotenv').config();
const { spawn } = require('child_process');
const net = require('net');
const path = require('path');
const puppeteer = require('puppeteer');
const { pool } = require('../../src/config/db');
const { runMigrations } = require('../../src/db/migrate');

const ROOT = path.join(__dirname, '..', '..');
const PREFIX = 'e2e';
let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? '  ✓' : '  ✗'} ${msg}`);
  if (!cond) failures += 1;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function freePort() {
  return new Promise((resolve) => {
    const srv = net.createServer().listen(0, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function startServer(port) {
  let output = '';
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'test',
      SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '',
      SENTRY_DSN: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => { output += d; });
  child.stderr.on('data', (d) => { output += d; });
  for (let i = 0; i < 100 && !output.includes('running on'); i++) await wait(100);
  if (!output.includes('running on')) throw new Error(`Server did not start:\n${output}`);
  return { child, log: () => output };
}

async function clearLocalRateLimits() {
  await pool.query(
    "DELETE FROM rate_limits WHERE key ~ ':(::1|::/56|127\\.0\\.0\\.1|::ffff:127\\.0\\.0\\.1)$'"
  );
}

async function cleanup() {
  const { rows } = await pool.query('DELETE FROM users WHERE username LIKE $1 RETURNING id', [`${PREFIX}%`]);
  if (rows.length) {
    await pool.query("DELETE FROM session WHERE sess->>'userId' = ANY($1::text[])", [rows.map((r) => String(r.id))]);
  }
  await clearLocalRateLimits();
}

async function main() {
  await runMigrations(pool, () => {});
  await cleanup();
  const port = await freePort();
  const server = await startServer(port);
  const B = `http://localhost:${port}`;
  const lastCode = (purpose) => {
    const m = [...server.log().matchAll(new RegExp(`${purpose} code for [^:]+: (\\d{6})`, 'g'))];
    return m.length ? m[m.length - 1][1] : null;
  };

  // GitHub's Ubuntu runners don't allow Chrome's sandbox.
  const browser = await puppeteer.launch({ headless: true, args: process.env.CI ? ['--no-sandbox'] : [] });
  const p = await browser.newPage();
  await p.setViewport({ width: 1366, height: 900 });
  const pageErrors = [];
  p.on('pageerror', (e) => pageErrors.push(e.message));
  p.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) pageErrors.push(`CSP: ${m.text()}`); });
  p.on('response', (r) => { if (r.status() >= 500) pageErrors.push(`HTTP ${r.status()} ${r.url()}`); });

  const go = (url) => p.goto(B + url, { waitUntil: 'networkidle0' });
  const nav = (fn) => Promise.all([p.waitForNavigation({ waitUntil: 'networkidle0' }), fn()]);
  const submit = (sel = 'form.form button[type=submit]') => nav(() => p.click(sel));
  const confirmDialog = async () => { await wait(250); await submit('#confirm-dialog [data-dialog-ok]'); };
  const text = () => p.$eval('body', (e) => e.innerText);
  const messages = () => p.$$eval('.alert, .toast', (l) => l.map((e) => e.innerText.replace(/\s+/g, ' ').trim()).join(' | '));
  const fill = async (sel, v) => { await p.$eval(sel, (e) => { e.value = ''; }); await p.type(sel, String(v)); };

  const username = `${PREFIX}${Date.now().toString().slice(-7)}`;
  const email = `${username}@example.com`;
  let password = 'Farm2026$';

  try {
    console.log('Sign-up and email verification');
    await go('/auth/register');
    await fill('#password', 'abc');
    ok((await p.$eval('[data-pw-label]', (e) => e.textContent)) === 'Weak', 'strength meter: Weak');
    await fill('#password', password);
    ok((await p.$eval('[data-pw-label]', (e) => e.textContent)) === 'Strong', 'strength meter: Strong');
    await fill('#name', 'Juan Dela Cruz'); await fill('#username', username); await fill('#email', email);
    await p.$eval('form.form', (f) => { f.noValidate = true; });
    await fill('#password', 'weakpass'); await fill('#confirm_password', 'weakpass'); await submit();
    ok(/number|special/.test(await messages()), 'server rejects a weak password');
    await fill('#password', password); await fill('#confirm_password', password); await submit();
    ok(p.url().endsWith('/auth/verify-email'), 'registering leads to email verification');
    await go('/auth/login'); await fill('#username', username); await fill('#password', password); await submit();
    ok(p.url().endsWith('/auth/verify-email'), 'unverified account cannot log in');
    await fill('#code', '000000'); await submit();
    ok(/isn.t right/.test(await messages()), 'wrong code rejected');
    await fill('#code', lastCode('verify')); await submit();
    ok(p.url().endsWith('/auth/login') && /Email verified/.test(await messages()), 'correct code verifies the email');
    await fill('#username', username); await fill('#password', password); await submit();
    ok(p.url().endsWith('/home'), 'verified account logs in to Home');

    console.log('Records');
    await go('/quail');
    await fill('#quantity', 100); await submit();
    await p.click('label[for=type-mortality]'); await fill('#quantity', 5); await submit();
    ok((await text()).includes('You have 95 quails'), 'quail count after a death');
    await p.click('label[for=type-mortality]'); await fill('#quantity', 1000); await submit();
    ok(/only have 95 quails/.test(await messages()), 'cannot record more deaths than quails');

    await go('/eggs'); await fill('#eggs_good', 120); await fill('#eggs_damaged', 6); await submit();
    await wait(300);
    ok(/Egg record saved/.test(await messages()), 'save shows a toast');
    ok(Boolean(await p.$('tr.row-saved')), 'saved row is highlighted');

    await go('/feed'); await fill('#quantity_kg_p', 25); await fill('#cost', 1250);
    await submit('form[action="/feed/purchase"] button');
    await go('/sales'); await fill('#quantity', 100); await fill('#unit_price', 3.5); await submit();
    await go('/expenses'); await fill('#amount', 200); await fill('#category', 'Medicine'); await submit();

    console.log('Profit counts feed');
    await go('/home');
    const home = await text();
    ok(home.includes('₱1,450.00'), 'costs this month = ₱1,250 feed + ₱200 other');
    ok(home.includes('-₱1,100.00'), 'profit = ₱350 sales − ₱1,450 costs');

    console.log('Pagination and date filter');
    const { rows: [{ id: userId }] } = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    await pool.query(
      `INSERT INTO egg_records (user_id, record_date, eggs_good, eggs_damaged)
       SELECT $1, DATE '2026-01-01' + g, 100, 1 FROM generate_series(0, 29) g`,
      [userId]
    );
    await go('/eggs');
    ok((await text()).includes('Showing 1–25 of 31'), 'first page shows 25 of 31');
    await nav(() => p.click('.pager-links a[aria-label="Next page"]'));
    ok((await text()).includes('Showing 26–31 of 31') && p.url().includes('page=2'), 'second page shows the rest');
    await go('/eggs?from=2026-01-01&to=2026-01-10');
    ok((await text()).includes('10 records in this range'), 'date filter narrows the list');
    await go('/eggs?from=2025-01-01&to=2025-01-31');
    ok((await text()).includes('Nothing recorded in this date range'), 'empty filtered range says so');

    console.log('Delete with confirmation');
    await go('/expenses');
    await p.click('tbody form[data-confirm] button'); await wait(250);
    ok(await p.$eval('#confirm-dialog', (d) => d.open), 'delete asks for confirmation');
    await p.click('#confirm-dialog [data-dialog-cancel]'); await wait(200);
    ok((await p.$$('tbody tr')).length === 1, 'cancel keeps the record');
    await p.click('tbody form[data-confirm] button'); await confirmDialog();
    ok(/Expense deleted/.test(await messages()), 'confirm deletes it');

    console.log('Home trends');
    await go('/home'); await wait(500);
    const lines = () => p.evaluate(() => Chart.getChart(document.getElementById('trend-chart')).data.datasets.length);
    const linesBecome = (n) => p.waitForFunction(
      (want) => { const c = Chart.getChart(document.getElementById('trend-chart')); return c && c.data.datasets.length === want; },
      { timeout: 8000 }, n
    ).then(() => true, () => false);
    await p.click('.metric-toggle-all span');
    ok(await linesBecome(6), '"All" plots every measure');
    await p.click('input[value=sales] + span');
    ok(await linesBecome(1), 'picking one measure while "All" is on shows just that one');
    await wait(1500);
    ok((await lines()) === 1, 'a slower earlier request does not overwrite it');

    console.log('Settings and password change');
    await go('/settings');
    await fill('#name', 'Juan P. Dela Cruz'); await submit('#profile-form button[type=submit]');
    ok((await text()).includes('Juan P. Dela Cruz'), 'profile name updated');
    await submit('form[action="/settings/password/send"] button');
    await fill('#code', lastCode('change')); await submit();
    ok(p.url().endsWith('/settings/password/new'), 'change code accepted');
    await fill('#password', 'NewFarm#77'); await fill('#confirm_password', 'NewFarm#77'); await submit();
    ok(/password has been changed/.test(await messages()), 'password changed');
    password = 'NewFarm#77';

    console.log('Sign out and forgot password');
    await p.click('form[action="/auth/logout"] button'); await confirmDialog();
    ok(p.url() === `${B}/`, 'sign out asks, then leaves');
    await go('/auth/forgot'); await fill('#email', email.toUpperCase()); await submit();
    await fill('#code', lastCode('reset')); await submit();
    ok(p.url().endsWith('/auth/forgot/reset'), 'reset code accepted');
    await fill('#password', 'Reset$2026'); await fill('#confirm_password', 'Reset$2026'); await submit();
    await fill('#username', username); await fill('#password', password); await submit();
    ok(/Incorrect/.test(await messages()), 'old password no longer works');
    await fill('#username', username); await fill('#password', 'Reset$2026'); await submit();
    ok(p.url().endsWith('/home'), 'new password works');

    console.log('PDF export');
    const pdf = await p.evaluate(async () => {
      const r = await fetch('/reports/pdf?module=profit&from=2026-01-01&to=2026-12-31&granularity=month');
      return { status: r.status, type: r.headers.get('content-type') };
    });
    ok(pdf.status === 200 && pdf.type === 'application/pdf', 'profit report exports as PDF');

    console.log('Shared rate limiting');
    await p.click('form[action="/auth/logout"] button'); await confirmDialog();
    await clearLocalRateLimits();
    for (let i = 0; i < 10; i++) {
      await go('/auth/login'); await fill('#username', username); await fill('#password', 'wrong-password'); await submit();
    }
    await go('/auth/login'); await fill('#username', username); await fill('#password', 'Reset$2026'); await submit();
    ok(/Too many attempts/.test(await text()), '11th login attempt in 15 minutes is blocked');
    const { rows: [counter] } = await pool.query("SELECT hits FROM rate_limits WHERE key LIKE 'login:%' ORDER BY reset_at DESC LIMIT 1");
    ok(counter && counter.hits >= 11, 'attempts are counted in the database');

    ok(pageErrors.length === 0, `no page errors${pageErrors.length ? ': ' + pageErrors.join(' | ') : ''}`);
  } finally {
    await browser.close();
    server.child.kill();
    await cleanup();
    await pool.end();
  }

  console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.');
  process.exit(failures ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
