const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

async function sendMail(to, subject, html) {
  return transporter.sendMail({
    from: `"ITrack Soporte" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html
  });
}

module.exports = sendMail;

