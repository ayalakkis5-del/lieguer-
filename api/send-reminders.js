const Stripe = require('stripe');
const { sendEmail } = require('./send-email');

module.exports = async (req, res) => {
  // Protect the endpoint — only Vercel cron or manual call with secret
  const auth = req.headers['authorization'] || req.query.secret;
  if (auth !== `Bearer ${process.env.CRON_SECRET}` && auth !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

    // Figure out tomorrow's day name (in US Central time)
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const tomorrowDay = tomorrow.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Chicago' }); // "Saturday" or "Sunday"
    const tomorrowFull = tomorrow.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });

    // Only run on Fridays (tomorrow = Saturday) and Saturdays (tomorrow = Sunday)
    if (tomorrowDay !== 'Saturday' && tomorrowDay !== 'Sunday') {
      return res.status(200).json({ message: `No reminders needed — tomorrow is ${tomorrowDay}` });
    }

    // Fetch recent succeeded payment intents
    const paymentIntents = await stripe.paymentIntents.list({ limit: 100 });
    const orders = paymentIntents.data.filter(pi => pi.status === 'succeeded');

    let sent = 0;
    let skipped = 0;

    for (const pi of orders) {
      const { customerName, customerEmail, customerPhone, pickupTime, items: itemsRaw } = pi.metadata;

      // Only remind people picking up tomorrow
      if (!pickupTime || !pickupTime.startsWith(tomorrowDay)) { skipped++; continue; }
      if (!customerEmail) { skipped++; continue; }

      const firstName = (customerName || 'there').split(' ')[0];
      let items = [];
      try { items = JSON.parse(itemsRaw || '[]'); } catch {}
      const itemRows = items
        .filter(i => !/test item/i.test(i.name))
        .map(i => `
          <tr>
            <td style="padding:8px 16px;border-bottom:1px solid #ede8df;font-size:14px;color:#1a1208;">${i.qty}× ${i.name}</td>
            <td style="padding:8px 16px;border-bottom:1px solid #ede8df;font-size:14px;color:#1a1208;text-align:right;">$${(i.qty * i.price).toFixed(2)}</td>
          </tr>`).join('');

      await sendEmail({
        to: customerEmail,
        subject: `Your LIÈGUER pickup is tomorrow 🧇`,
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
            <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#c8852a;">Pickup Reminder</p>
            <h1 style="margin:0;font-family:Georgia,serif;font-size:32px;font-weight:400;color:#f5f0e8;letter-spacing:0.08em;">LIÈGUER</h1>
            <p style="margin:8px 0 0;font-size:13px;color:rgba(245,240,232,0.55);font-style:italic;letter-spacing:0.04em;">Waffles, at your leisure.</p>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding:36px 40px 24px;text-align:center;border-bottom:1px solid #ede8df;">
            <p style="margin:0 0 8px;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#c8852a;">Hi ${firstName},</p>
            <h2 style="margin:0;font-family:Georgia,serif;font-size:26px;font-weight:400;color:#1a1208;">Your waffles are ready<br/><em style="color:#7a4f1e;">tomorrow.</em></h2>
            <p style="margin:16px 0 0;font-size:14px;color:#888;line-height:1.7;">Just a friendly reminder — your LIÈGUER order is coming up. We can't wait to see you.</p>
          </td>
        </tr>

        <!-- Pickup callout -->
        <tr>
          <td style="padding:28px 40px;background:#faf7f2;text-align:center;border-bottom:1px solid #ede8df;">
            <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#c8852a;">Your Pickup Time</p>
            <p style="margin:0 0 16px;font-family:Georgia,serif;font-size:22px;color:#1a1208;font-weight:400;">${pickupTime}</p>
            <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#c8852a;">Pickup Location</p>
            <p style="margin:0 0 4px;font-size:15px;color:#1a1208;font-weight:400;">32951 Haverford Rd, Franklin MI 48025</p>
            <p style="margin:0 0 12px;font-size:12px;color:#aaa;">14 Mile &amp; Telegraph</p>
            <a href="https://maps.google.com/?q=32951+Haverford+Rd+Franklin+MI+48025" style="display:inline-block;font-size:12px;color:#c8852a;text-decoration:none;letter-spacing:0.06em;">Open in Google Maps →</a>
            <p style="margin:16px 0 0;font-size:12px;color:#c0392b;font-weight:500;">Please arrive within 15 minutes of your scheduled time.</p>
          </td>
        </tr>

        <!-- Order summary -->
        <tr>
          <td style="padding:24px 40px 0;">
            <p style="margin:0 0 12px;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#888;">Your Order</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${itemRows}
            </table>
          </td>
        </tr>

        <!-- Reheat tip -->
        <tr>
          <td style="padding:24px 40px;background:#faf7f2;border-top:1px solid #ede8df;border-bottom:1px solid #ede8df;text-align:center;">
            <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#c8852a;">Pro Tip</p>
            <p style="margin:0;font-size:14px;color:#1a1208;line-height:1.7;">Waffles will be at room temperature at pickup. Pop them in a <strong>toaster or hot oven</strong> for a few minutes — the pearl sugar caramelizes again and they'll taste like they just came off the iron. ✨</p>
          </td>
        </tr>

        <!-- Fine print -->
        <tr>
          <td style="padding:20px 40px 28px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#aaa;line-height:1.7;">Something came up? Reply to this email and we'll do our best.<br/>hellolieguer@gmail.com</p>
          </td>
        </tr>

        <!-- Instagram -->
        <tr>
          <td style="background:#1a1208;padding:28px 40px;text-align:center;">
            <p style="margin:0 0 10px;font-size:12px;color:rgba(245,240,232,0.5);letter-spacing:0.1em;text-transform:uppercase;">Follow the drop</p>
            <a href="https://www.instagram.com/lieguerwaffles/" style="display:inline-block;background:#c8852a;color:#ffffff;text-decoration:none;font-family:Georgia,serif;font-size:13px;letter-spacing:0.1em;padding:10px 24px;border-radius:2px;">@lieguerwaffles</a>
            <p style="margin:16px 0 0;font-size:12px;color:rgba(245,240,232,0.35);">See you tomorrow. 🧇</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
      });

      sent++;
    }

    res.status(200).json({ message: `Reminders sent: ${sent}, skipped: ${skipped}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
