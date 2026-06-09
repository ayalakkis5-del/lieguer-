const { Resend } = require('resend');

async function sendEmail({ to, subject, html }) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: 'LIÈGUER <hello@lieguer.com>',
    reply_to: 'hellolieguer@gmail.com',
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  });
}

module.exports = { sendEmail };
