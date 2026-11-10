const nodemailer = require('nodemailer');

let cachedTransporter = null;

async function buildTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    SMTP_SECURE,
  } = process.env;

  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    const isGmail = SMTP_HOST.trim().toLowerCase() === 'smtp.gmail.com';
    cachedTransporter = nodemailer.createTransport({
      host: SMTP_HOST.trim(),
      port: Number(SMTP_PORT) || 587,
      secure: String(SMTP_SECURE).toLowerCase() === 'true',
      auth: {
        user: SMTP_USER.trim(),
        pass: isGmail ? SMTP_PASS.replace(/\s/g, '') : SMTP_PASS,
      },
    });
    return cachedTransporter;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Email delivery is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS; for Gmail, use smtp.gmail.com and a Google App Password.'
    );
  }

  // Dev fallback: Ethereal fake SMTP. Messages are viewable at
  // https://ethereal.email/messages after logging in with the generated account.
  const testAccount = await nodemailer.createTestAccount();
  cachedTransporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
  console.log('\n=== Ethereal test SMTP account ===');
  console.log(`User: ${testAccount.user}`);
  console.log(`Pass: ${testAccount.pass}`);
  console.log('View messages: https://ethereal.email/messages');
  console.log('=================================\n');
  return cachedTransporter;
}

async function sendPasswordResetEmail({ to, name, resetLink }) {
  const transporter = await buildTransporter();
  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@emberandoak.local';

  const info = await transporter.sendMail({
    from: `"Ember & Oak" <${fromAddress}>`,
    to,
    subject: 'Reset your Ember & Oak password',
    text: `Hi ${name || 'there'},\n\nUse the link below to reset your password. It expires in 15 minutes and can be used only once.\n\n${resetLink}\n\nIf you did not request this, you can ignore this email.`,
    html: `
      <p>Hi ${name || 'there'},</p>
      <p>Use the link below to reset your password. It expires in <strong>15 minutes</strong> and can be used only once.</p>
      <p><a href="${resetLink}">${resetLink}</a></p>
      <p>If you did not request this, you can ignore this email.</p>
    `,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log(`Password reset email preview: ${previewUrl}`);
  }
  return info;
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

async function sendEmailVerificationEmail({ to, name, verificationLink }) {
  const transporter = await buildTransporter();
  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@emberandoak.local';
  const safeName = escapeHtml(name || 'there');
  const safeLink = escapeHtml(verificationLink);

  const info = await transporter.sendMail({
    from: `"Ember & Oak" <${fromAddress}>`,
    to,
    subject: 'Verify your Ember & Oak email address',
    text: `Hi ${name || 'there'},\n\nVerify your email address using the one-time link below. It expires in 24 hours.\n\n${verificationLink}\n\nIf you did not create an account, you can ignore this email.`,
    html: `
      <p>Hi ${safeName},</p>
      <p>Verify your email address using the one-time link below. It expires in <strong>24 hours</strong>.</p>
      <p><a href="${safeLink}">Verify email address</a></p>
      <p>If you did not create an account, you can ignore this email.</p>
    `,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log(`Email verification message preview: ${previewUrl}`);
  }
  return { info, previewUrl };
}

module.exports = { sendPasswordResetEmail, sendEmailVerificationEmail };