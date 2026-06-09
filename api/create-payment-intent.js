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
    const { amount, items, pickupTime, customerName, customerEmail, customerPhone, promoConsent, espressoPrefs } = req.body;
    const parsedEspressoPrefs = espressoPrefs ? JSON.parse(espressoPrefs) : [];

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
        espressoPrefs: espressoPrefs || '',
      },
      receipt_email: customerEmail || undefined,
    });

    // SMS confirmation to customer
    if (customerPhone) {
      const firstName = (customerName || 'friend').split(' ')[0];
      const itemSummary = (items || []).filter(i => !/test item/i.test(i.name)).map(i => `${i.qty}× ${i.name}`).join(', ');
      const msg = `Hi ${firstName}! 🧇 Your LIÈGUER order is confirmed. ${itemSummary ? itemSummary + '. ' : ''}Pickup: ${pickupTime} at 32951 Haverford Rd, Franklin MI 48025 (14 Mile & Telegraph). We can't wait to see you — @lieguerwaffles`;
      sendSMS(customerPhone, msg).catch(() => {});
    }

    // Add to Klaviyo if they opted in for promos
    if (promoConsent === 'yes') {
      const firstName = (customerName || '').split(' ')[0];
      klaviyoProfile(firstName, customerEmail, customerPhone).catch(() => {});
    }

    // Beautiful confirmation email to customer
    if (customerEmail) {
      const firstName = (customerName || 'there').split(' ')[0];
      const customerItemRows = (items || [])
        .filter(i => !/test item/i.test(i.name))
        .map(i => `
          <tr>
            <td style="padding:10px 16px;border-bottom:1px solid #ede8df;font-size:14px;color:#1a1208;">${i.qty}× ${i.name}</td>
            <td style="padding:10px 16px;border-bottom:1px solid #ede8df;font-size:14px;color:#1a1208;text-align:right;">$${(i.qty * i.price).toFixed(2)}</td>
          </tr>`).join('');
      await sendEmail({
        to: customerEmail,
        subject: `Your LIÈGUER order is confirmed 🧇`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e8;padding:40px 16px;">
    <tr><td align="center">
      <table width="540" cellpadding="0" cellspacing="0" style="max-width:540px;width:100%;background:#ffffff;border-radius:4px;overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:#1a1208;padding:36px 40px;text-align:center;">
            <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#c8852a;">Order Confirmed</p>
            <h1 style="margin:0;font-family:Georgia,serif;font-size:32px;font-weight:400;color:#f5f0e8;letter-spacing:0.08em;">LIÈGUER</h1>
            <p style="margin:8px 0 0;font-size:13px;color:rgba(245,240,232,0.55);font-style:italic;letter-spacing:0.04em;">Waffles, at your leisure.</p>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding:36px 40px 24px;text-align:center;border-bottom:1px solid #ede8df;">
            <p style="margin:0 0 8px;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#c8852a;">Hi ${firstName},</p>
            <h2 style="margin:0;font-family:Georgia,serif;font-size:26px;font-weight:400;color:#1a1208;">Your order is on its way<br/><em style="color:#7a4f1e;">to your hands.</em></h2>
            <p style="margin:16px 0 0;font-size:14px;color:#888;line-height:1.7;">72 hours of cold fermentation, caramelized Belgian pearl sugar, brown butter throughout — it's almost yours.</p>
          </td>
        </tr>

        <!-- Pickup callout -->
        <tr>
          <td style="padding:28px 40px;background:#faf7f2;text-align:center;border-bottom:1px solid #ede8df;">
            <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#c8852a;">Your Pickup Time</p>
            <p style="margin:0 0 16px;font-family:Georgia,serif;font-size:22px;color:#1a1208;font-weight:400;">${pickupTime}</p>
            <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#c8852a;">Pickup Location</p>
            <p style="margin:0 0 4px;font-size:15px;color:#1a1208;font-weight:400;">32951 Haverford Rd, Franklin MI 48025</p>
            <p style="margin:0;font-size:12px;color:#aaa;">14 Mile &amp; Telegraph</p>
            <a href="https://maps.google.com/?q=32951+Haverford+Rd+Franklin+MI+48025" style="display:inline-block;margin-top:12px;font-size:12px;color:#c8852a;text-decoration:none;letter-spacing:0.06em;">Open in Google Maps →</a>
          </td>
        </tr>

        <!-- Order table -->
        <tr>
          <td style="padding:24px 40px 0;">
            <p style="margin:0 0 12px;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#888;">Order Summary</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${customerItemRows}
              <tr>
                <td style="padding:12px 16px;font-size:15px;font-weight:bold;color:#1a1208;">Total</td>
                <td style="padding:12px 16px;font-size:15px;font-weight:bold;color:#1a1208;text-align:right;">$${amount.toFixed(2)}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Reheat instructions -->
        <tr>
          <td style="padding:24px 40px;background:#faf7f2;border-top:1px solid #ede8df;border-bottom:1px solid #ede8df;">
            <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#c8852a;text-align:center;">How to Enjoy</p>
            <p style="margin:0 0 10px;font-size:14px;color:#1a1208;line-height:1.7;text-align:center;">Your waffles will be at room temperature when you pick them up — this is intentional. Room temp preserves the crunch.</p>
            <p style="margin:0;font-size:14px;color:#1a1208;line-height:1.7;text-align:center;">Pop them in a <strong>toaster</strong> or a <strong>hot oven for a few minutes</strong> before serving — the pearl sugar will wake right back up, the edges will caramelize again, and they'll taste like they just came off the iron. ✨</p>
          </td>
        </tr>

        <!-- Fine print -->
        <tr>
          <td style="padding:20px 40px 28px;">
            <p style="margin:0 0 10px;font-size:13px;font-weight:bold;color:#1a1208;line-height:1.7;text-align:center;text-transform:uppercase;letter-spacing:0.04em;">Please pick up within 15 minutes of your scheduled time.</p>
            <p style="margin:0 0 10px;font-size:12px;color:#666;line-height:1.7;text-align:center;">We cannot guarantee accommodations for other times or issue refunds for missed windows — but if anything comes up, please reach out and we will do our absolute best.</p>
            <p style="margin:0;font-size:12px;color:#aaa;line-height:1.7;text-align:center;">All sales final. No refunds or cancellations after orders close.<br/>Questions? Reply to this email or reach us at hellolieguer@gmail.com</p>
          </td>
        </tr>

        <!-- Instagram -->
        <tr>
          <td style="background:#1a1208;padding:28px 40px;text-align:center;">
            <p style="margin:0 0 10px;font-size:12px;color:rgba(245,240,232,0.5);letter-spacing:0.1em;text-transform:uppercase;">Follow the drop</p>
            <a href="https://www.instagram.com/lieguerwaffles/" style="display:inline-block;background:#c8852a;color:#ffffff;text-decoration:none;font-family:Georgia,serif;font-size:13px;letter-spacing:0.1em;padding:10px 24px;border-radius:2px;">@lieguerwaffles</a>
            <p style="margin:16px 0 0;font-size:12px;color:rgba(245,240,232,0.35);">We'll see you soon. 🧇</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
      });
    }

    // Internal order notification to hellolieguer@gmail.com
    const itemLines = (items || [])
      .map(i => `<tr><td style="padding:6px 12px;">${i.qty}× ${i.name}</td><td style="padding:6px 12px;text-align:right;">$${(i.qty * i.price).toFixed(2)}</td></tr>`)
      .join('');
    await sendEmail({
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
          ${parsedEspressoPrefs.length ? `
            <p><strong>Espresso Customizations:</strong></p>
            <ul style="margin:4px 0 0 1rem;padding:0;font-size:14px;line-height:1.8;">
              ${parsedEspressoPrefs.map(p => {
                const parts = [p.temp, p.milk];
                if (p.temp === 'Iced' && p.ice) parts.push(p.ice);
                if (p.foam) parts.push(p.foamType || 'Cold Foam');
                return `<li><strong>${p.drink}:</strong> ${parts.join(' · ')}</li>`;
              }).join('')}
            </ul>` : ''}
        </div>
      `,
    });

    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
