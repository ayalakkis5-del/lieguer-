const Stripe = require('stripe');
const https  = require('https');
const { klaviyoProfile } = require('./join-list');
const { sendEmail } = require('./send-email');

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

    // Send order notification to hellolieguer@gmail.com
    const itemLines = (items || [])
      .map(i => `<tr><td style="padding:6px 12px;">${i.qty}× ${i.name}</td><td style="padding:6px 12px;text-align:right;">$${(i.qty * i.price).toFixed(2)}</td></tr>`)
      .join('');
    sendEmail({
      to: 'hellolieguer@gmail.com',
      subject: `🧇 New Order — ${customerName || 'Customer'} · ${pickupTime}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1208;">
          <h2 style="color:#c8852a;margin-bottom:4px;">New Order Received</h2>
          <p style="color:#888;margin-top:0;">${new Date().toLocaleString('en-US',{timeZone:'America/Chicago'})}</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr style="background:#f5f0e8;"><th style="padding:8px 12px;text-align:left;">Item</th><th style="padding:8px 12px;text-align:right;">Price</th></tr>
            ${itemLines}
            <tr style="border-top:2px solid #c8852a;font-weight:bold;">
              <td style="padding:8px 12px;">Total</td>
              <td style="padding:8px 12px;text-align:right;">$${amount.toFixed(2)}</td>
            </tr>
          </table>
          <p><strong>Pickup:</strong> ${pickupTime}</p>
          <p><strong>Name:</strong> ${customerName || '—'}</p>
          <p><strong>Email:</strong> ${customerEmail || '—'}</p>
          <p><strong>Phone:</strong> ${customerPhone || '—'}</p>
          <p><strong>Promo opt-in:</strong> ${promoConsent === 'yes' ? '✅ Yes' : 'No'}</p>
        </div>
      `,
    }).catch(() => {});

    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
