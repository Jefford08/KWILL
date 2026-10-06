const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');
const wrap = require('../utils/wrap');
const { isValidDateStr } = require('../utils/validate');
const reportController = require('../controllers/reportController');
const chartController = require('../controllers/chartController');

async function launchBrowser() {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    // Serverless hosts (Vercel) can't ship a full Chrome install inside a
    // function, so in production we use a pre-packaged Chromium
    // binary (@sparticuz/chromium) with puppeteer-core instead.
    // @sparticuz/chromium is published as an ESM-only package; requiring it from
    // CommonJS wraps the real export under `.default` instead of spreading it.
    const chromiumModule = require('@sparticuz/chromium');
    const chromium = chromiumModule.default || chromiumModule;
    const puppeteerCore = require('puppeteer-core');
    return puppeteerCore.launch({
      headless: true,
      args: chromium.args,
      executablePath: await chromium.executablePath(),
    });
  }
  const puppeteer = require('puppeteer');
  return puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
}

function defaultDates() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

router.use(requireLogin);

router.get('/', (req, res) => {
  const { from, to } = defaultDates();
  res.render('reports/index', { title: 'Reports', defaultFrom: from, defaultTo: to });
});

router.get('/view', wrap(async (req, res) => {
  const moduleName = req.query.module || 'eggs';
  const { from, to } = req.query;

  if (!reportController.MODULE_LABELS[moduleName]) {
    return res.status(400).render('error', {
      title: 'Unknown report',
      message: `"${moduleName}" isn't a report module. Go back to Reports and pick one from the list.`,
    });
  }
  if (!isValidDateStr(from) || !isValidDateStr(to)) {
    return res.status(400).render('error', {
      title: 'Missing date range',
      message: 'Choose a From and To date on the Reports page before viewing a report.',
    });
  }

  const granularity = req.query.granularity
    ? chartController.normalizeGranularity(req.query.granularity)
    : chartController.suggestGranularity(from, to);
  const report = await reportController.buildReport(req.session.userId, moduleName, from, to);
  res.render('reports/view', {
    title: 'Report',
    module: moduleName,
    moduleLabel: reportController.MODULE_LABELS[moduleName] || moduleName,
    from,
    to,
    granularity,
    ...report,
  });
}));

router.get('/pdf', async (req, res) => {
  let browser;
  try {
    const moduleName = req.query.module || 'eggs';
    const { from, to } = req.query;

    if (!reportController.MODULE_LABELS[moduleName] || !isValidDateStr(from) || !isValidDateStr(to)) {
      return res.status(400).send('Invalid report module or date range. Go back to Reports and try again.');
    }

    const granularity = req.query.granularity
      ? chartController.normalizeGranularity(req.query.granularity)
      : chartController.suggestGranularity(from, to);
    // On Vercel there is no long-running server listening on a local port, so
    // headless Chrome loads the report page through the public host instead.
    const origin = process.env.VERCEL
      ? `https://${req.get('host')}`
      : `http://127.0.0.1:${process.env.PORT || 3000}`;
    const url = `${origin}/reports/view?module=${encodeURIComponent(moduleName)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&granularity=${encodeURIComponent(granularity)}`;

    browser = await launchBrowser();
    const page = await browser.newPage();

    if (req.headers.cookie) {
      const cookies = req.headers.cookie.split(';').map((c) => {
        const idx = c.indexOf('=');
        return { name: c.slice(0, idx).trim(), value: c.slice(idx + 1).trim(), url: origin };
      });
      await page.setCookie(...cookies);
    }

    await page.goto(url, { waitUntil: 'networkidle0' });
    const pdfBytes = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' },
    });
    await browser.close();
    const pdfBuffer = Buffer.from(pdfBytes);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="kwill-${moduleName}-report.pdf"`,
    });
    res.send(pdfBuffer);
  } catch (err) {
    if (browser) await browser.close();
    console.error('PDF export failed:', err);
    res.status(500).render('error', {
      title: 'PDF export failed',
      message: 'Something went wrong generating the PDF. Please try again.',
    });
  }
});

module.exports = router;
