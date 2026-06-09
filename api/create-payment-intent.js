const Stripe = require('stripe');

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

    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
