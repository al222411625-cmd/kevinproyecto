const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== 'false'
  }
});

async function sendMail(to, subject, html) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error('SMTP no configurado. Revisa EMAIL_USER y EMAIL_PASS en el archivo .env.');
  }

  try {
    await transporter.verify();
  } catch (verifyError) {
    console.error('SMTP verify failed:', verifyError);
    throw new Error('Error de SMTP: ' + (verifyError?.response || verifyError?.message || verifyError));
  }

  return transporter.sendMail({
    from: `"ITrack Soporte" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html
  });
}

module.exports = sendMail;

