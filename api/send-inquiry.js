const { sendEmail } = require('./send-email');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { name, email, phone, eventType, date, guestCount, details } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'Name and email required' });

    // Internal alert to hello@lieguer.com
    await sendEmail({
      to: 'hello@lieguer.com',
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

    // Confirmation to submitter
    const firstName = (name || 'there').split(' ')[0];
    await sendEmail({
      to: email,
      subject: `We got your inquiry, ${firstName} 🧇`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e8;padding:40px 16px;">
    <tr><td align="center">
      <table width="540" cellpadding="0" cellspacing="0" style="max-width:540px;width:100%;background:#ffffff;border-radius:4px;overflow:hidden;">
        <tr>
          <td style="background:#1a1208;padding:36px 40px;text-align:center;">
            <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#c8852a;">Catering Inquiry</p>
            <h1 style="margin:0;font-family:Georgia,serif;font-size:32px;font-weight:400;color:#f5f0e8;letter-spacing:0.08em;">LIÈGUER</h1>
            <p style="margin:8px 0 0;font-size:13px;color:rgba(245,240,232,0.55);font-style:italic;">Waffles, at your leisure.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 32px;text-align:center;border-bottom:1px solid #ede8df;">
            <p style="margin:0 0 8px;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#c8852a;">Hi ${firstName},</p>
            <h2 style="margin:0 0 16px;font-family:Georgia,serif;font-size:26px;font-weight:400;color:#1a1208;">We received your inquiry<br/><em style="color:#7a4f1e;">and we're excited.</em></h2>
            <p style="margin:0;font-size:14px;color:#888;line-height:1.8;">We'll review the details for your <strong style="color:#1a1208;">${eventType || 'event'}</strong> and get back to you within 24 hours.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 40px;background:#faf7f2;border-bottom:1px solid #ede8df;">
            <p style="margin:0 0 14px;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#888;">Your Submission</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#1a1208;line-height:1.9;">
              ${eventType ? `<tr><td style="color:#aaa;width:110px;">Event</td><td>${eventType}</td></tr>` : ''}
              ${date ? `<tr><td style="color:#aaa;">Date</td><td>${date}</td></tr>` : ''}
              ${guestCount ? `<tr><td style="color:#aaa;">Guests</td><td>${guestCount}</td></tr>` : ''}
              ${phone ? `<tr><td style="color:#aaa;">Phone</td><td>${phone}</td></tr>` : ''}
              ${details ? `<tr><td style="color:#aaa;vertical-align:top;">Details</td><td>${details}</td></tr>` : ''}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 40px;text-align:center;border-bottom:1px solid #ede8df;">
            <p style="margin:0;font-size:14px;color:#888;line-height:1.8;">Questions? Reply to this email or reach us at<br/><a href="mailto:hello@lieguer.com" style="color:#c8852a;text-decoration:none;">hello@lieguer.com</a></p>
          </td>
        </tr>
        <tr>
          <td style="background:#1a1208;padding:28px 40px;text-align:center;">
            <p style="margin:0 0 10px;font-size:12px;color:rgba(245,240,232,0.5);letter-spacing:0.1em;text-transform:uppercase;">Follow along</p>
            <a href="https://www.instagram.com/lieguerwaffles/" style="display:inline-block;background:#c8852a;color:#ffffff;text-decoration:none;font-family:Georgia,serif;font-size:13px;letter-spacing:0.1em;padding:10px 24px;border-radius:2px;">@lieguerwaffles</a>
            <p style="margin:16px 0 0;font-size:12px;color:rgba(245,240,232,0.35);">Talk soon. 🧇</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send inquiry' });
  }
};
