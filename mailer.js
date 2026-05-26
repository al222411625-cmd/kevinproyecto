const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
});

const sendMail = async (to, subject, html) => {
  try {
    await transporter.sendMail({
      from: `"ITrack" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log("Correo enviado a:", to);

  } catch (err) {
    console.error("Error correo:", err);
  }
};

module.exports = sendMail;