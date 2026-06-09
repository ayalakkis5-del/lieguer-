const https = require('https');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { name, email, phone, eventType, date, guestCount, details } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'Name and email required' });

    const body = JSON.stringify({
      from: 'LIÈGUER Inquiries <onboarding@resend.dev>',
      to: ['hellolieguer@gmail.com'],
      subject: `New Catering Inquiry — ${eventType || 'General'} from ${name}`,
      html: `
        <h2>New Catering Inquiry</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
        <p><strong>Event Type:</strong> ${eventType || 'Not specified'}</p>
        <p><strong>Event Date:</strong> ${date || 'Not specified'}</p>
        <p><strong>Guest Count:</strong> ${guestCount || 'Not specified'}</p>
        <p><strong>Details:</strong><br>${details || 'None provided'}</p>
      `,
    });

    await new Promise((resolve, reject) => {
      const reqOut = https.request({
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
        r.on('end', () => r.statusCode < 300 ? resolve(data) : reject(new Error(data)));
      });
      reqOut.on('error', reject);
      reqOut.write(body);
      reqOut.end();
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send inquiry' });
  }
};
