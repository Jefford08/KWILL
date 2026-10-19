const nodemailer = require('nodemailer');

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
const MAIL_FROM = process.env.MAIL_FROM || (SMTP_USER ? `Kwill <${SMTP_USER}>` : 'Kwill <no-reply@kwill.local>');

const isConfigured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

const transporter = isConfigured
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  : null;

const PURPOSE_TEXT = {
  verify: { subject: 'Verify your Kwill email', intro: 'Welcome to Kwill! Use this code to verify your email address and finish creating your account.' },
  reset: { subject: 'Your Kwill password reset code', intro: 'Use this code to reset your Kwill password.' },
  change: { subject: 'Your Kwill verification code', intro: 'Use this code to confirm your Kwill password change.' },
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function codeEmail({ name, code, purpose, minutes }) {
  const { subject, intro } = PURPOSE_TEXT[purpose];
  const text =
    `Hi ${name},\n\n${intro}\n\n    ${code}\n\n` +
    `The code expires in ${minutes} minutes. If you didn't request this, you can ignore this email; ` +
    `your password won't change.\n\n— Kwill`;
  const html = `
  <div style="background:#f4f6f3;padding:32px 16px;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1d2a20">
    <div style="max-width:440px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e3e8e1">
      <p style="margin:0 0 4px;font-size:20px;font-weight:700;color:#2f6f3e">Kwill</p>
      <p style="margin:0 0 24px;color:#5d6b60;font-size:14px">Quail Farm Management</p>
      <p style="margin:0 0 12px;font-size:16px">Hi ${escapeHtml(name)},</p>
      <p style="margin:0 0 20px;font-size:16px;line-height:1.5">${intro}</p>
      <p style="margin:0 0 20px;text-align:center;font-size:34px;font-weight:700;letter-spacing:10px;font-family:Consolas,Menlo,monospace;background:#eef5ef;border-radius:10px;padding:16px 0;color:#1d2a20">${code}</p>
      <p style="margin:0;font-size:14px;line-height:1.5;color:#5d6b60">
        The code expires in ${minutes} minutes. If you didn't request this, you can ignore this email; your password won't change.
      </p>
    </div>
  </div>`;
  return { subject, text, html };
}

async function sendVerificationCode({ to, name, code, purpose, minutes }) {
  const message = codeEmail({ name, code, purpose, minutes });
  if (!transporter) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Email is not configured: set SMTP_HOST, SMTP_USER and SMTP_PASS.');
    }
    console.log(`[mailer] SMTP not configured. ${purpose} code for ${to}: ${code}`);
    return;
  }
  await transporter.sendMail({ from: MAIL_FROM, to, ...message });
}

module.exports = { sendVerificationCode, isConfigured };
