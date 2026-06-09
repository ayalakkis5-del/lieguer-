const Stripe = require('stripe');

module.exports = async (req, res) => {
  // Simple password gate — set ADMIN_PASSWORD in Vercel env vars
  const { password } = req.query;
  const adminPassword = process.env.ADMIN_PASSWORD || 'lieguer2025';
  if (password !== adminPassword) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

    // Fetch up to 100 most recent succeeded payment intents
    const paymentIntents = await stripe.paymentIntents.list({
      limit: 100,
    });

    const orders = paymentIntents.data
      .filter(pi => pi.status === 'succeeded')
      .map(pi => {
        let items = [];
        try { items = JSON.parse(pi.metadata.items || '[]'); } catch {}
        return {
          id: pi.id,
          date: new Date(pi.created * 1000).toLocaleString('en-US', { timeZone: 'America/Chicago' }),
          createdTs: pi.created,
          amount: (pi.amount / 100).toFixed(2),
          customerName:  pi.metadata.customerName  || '—',
          customerEmail: pi.metadata.customerEmail || '—',
          customerPhone: pi.metadata.customerPhone || '—',
          pickupTime:    pi.metadata.pickupTime    || '—',
          promoConsent:  pi.metadata.promoConsent  || 'no',
          items,
        };
      })
      .sort((a, b) => a.pickupTime.localeCompare(b.pickupTime));

    res.status(200).json({ orders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
