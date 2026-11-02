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
    cachedTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: String(SMTP_SECURE).toLowerCase() === 'true',
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    return cachedTransporter;
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
  const fromAddress = process.env.SMTP_FROM || 'no-reply@emberandoak.local';

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

module.exports = { sendPasswordResetEmail };