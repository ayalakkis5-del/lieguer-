const https = require('https');

function sendEmail({ to, subject, html }) {
  const body = JSON.stringify({
    from: 'LIÈGUER <hello@lieguer.com>',
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (r) => {
      let data = '';
      r.on('data', c => data += c);
      r.on('end', () => r.statusCode < 300 ? resolve(data) : reject(new Error(`Resend ${r.statusCode}: ${data}`)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = { sendEmail };
