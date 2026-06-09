const Stripe = require('stripe');
const https  = require('https');
const { klaviyoProfile } = require('./join-list');

async function sendSMS(to, body) {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = process.env.TWILIO_PHONE;
  if (!sid || !token || !from) return; // skip if not configured

  const params = new URLSearchParams({ To: to, From: from, Body: body }).toString();
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.twilio.com',
      path: `/2010-04-01/Accounts/${sid}/Messages.json`,
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(params),
      },
    }, (r) => { r.resume(); r.on('end', resolve); });
    req.on('error', resolve);
    req.write(params);
    req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const { amount, items, pickupTime, customerName, customerEmail, customerPhone, promoConsent } = req.body;

    const amountCents = Math.round(amount * 100);
    // Stripe minimum is 50 cents
    if (!amount || amountCents < 50) return res.status(400).json({ error: 'Minimum order is $0.50' });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      metadata: {
        items: JSON.stringify(items),
        pickupTime,
        customerName:  customerName  || '',
        customerEmail: customerEmail || '',
        customerPhone: customerPhone || '',
        promoConsent:  promoConsent  || 'no',
      },
      receipt_email: customerEmail || undefined,
    });

    // Send SMS confirmation if phone provided
    if (customerPhone) {
      const msg = `LIÈGUER ✓ Your order is confirmed! Pickup: ${pickupTime}. We can't wait to see you. Questions? Reply to this message.`;
      sendSMS(customerPhone, msg).catch(() => {});
    }

    // Add to Klaviyo if they opted in for promos
    if (promoConsent === 'yes') {
      const firstName = (customerName || '').split(' ')[0];
      klaviyoProfile(firstName, customerEmail, customerPhone).catch(() => {});
    }

    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
