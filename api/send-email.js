const nodemailer = require('nodemailer');

function getTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'hellolieguer@gmail.com',
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

async function sendEmail({ to, subject, html }) {
  const transporter = getTransport();
  await transporter.sendMail({
    from: '"LIÈGUER" <hellolieguer@gmail.com>',
    to: Array.isArray(to) ? to.join(', ') : to,
    subject,
    html,
  });
}

module.exports = { sendEmail };
