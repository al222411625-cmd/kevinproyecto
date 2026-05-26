const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
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