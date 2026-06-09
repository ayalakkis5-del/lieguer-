const Stripe = require('stripe');

const MAX_PER_SLOT = 4;

const SLOTS = [];
const days = ['Saturday', 'Sunday'];
const times = [
  '9:00am','9:15am','9:30am','9:45am',
  '10:00am','10:15am','10:30am','10:45am',
  '11:00am','11:15am','11:30am','11:45am',
  '12:00pm','12:15pm','12:30pm','12:45pm'
];
days.forEach(day => times.forEach(t => SLOTS.push(`${day} ${t}`)));

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

    // Fetch recent successful/pending payment intents
    const intents = await stripe.paymentIntents.list({ limit: 100 });

    // Count per slot
    const counts = {};
    SLOTS.forEach(s => counts[s] = 0);

    intents.data
      .filter(pi => ['succeeded', 'processing', 'requires_capture'].includes(pi.status))
      .forEach(pi => {
        const slot = pi.metadata?.pickupTime;
        if (slot && counts[slot] !== undefined) counts[slot]++;
      });

    const availability = {};
    SLOTS.forEach(s => {
      availability[s] = {
        available: counts[s] < MAX_PER_SLOT,
        remaining: Math.max(0, MAX_PER_SLOT - counts[s]),
      };
    });

    res.status(200).json({ availability, slots: SLOTS });
  } catch (err) {
    console.error(err);
    // On error, return all slots as available so checkout isn't blocked
    const availability = {};
    SLOTS.forEach(s => availability[s] = { available: true, remaining: MAX_PER_SLOT });
    res.status(200).json({ availability, slots: SLOTS });
  }
};
