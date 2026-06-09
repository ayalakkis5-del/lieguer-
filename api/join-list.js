const https = require('https');

function klaviyoProfile(firstName, email, phone) {
  const attributes = { first_name: firstName };
  if (email) attributes.email = email;
  if (phone) {
    // Ensure E.164 format
    const digits = phone.replace(/\D/g, '');
    attributes.phone_number = '+1' + digits.slice(-10);
  }

  const body = JSON.stringify({
    data: {
      type: 'profile',
      attributes,
    },
  });

  const companyId = process.env.KLAVIYO_PUBLIC_KEY || 'WNJnVH';

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'a.klaviyo.com',
      path: `/client/profiles/?company_id=${companyId}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'revision': '2023-12-15',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (r) => {
      let data = '';
      r.on('data', chunk => data += chunk);
      r.on('end', () => resolve({ status: r.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { firstName, email, phone } = req.body;
  if (!email && !phone) return res.status(400).json({ error: 'Email or phone required' });

  try {
    const result = await klaviyoProfile(firstName || '', email, phone);
    // 200 or 201 = success, 409 = already exists (also fine)
    if ([200, 201, 202, 409].includes(result.status)) {
      return res.status(200).json({ ok: true });
    }
    return res.status(500).json({ error: 'Klaviyo error', detail: result.body });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Export the helper so create-payment-intent can reuse it
module.exports.klaviyoProfile = klaviyoProfile;
