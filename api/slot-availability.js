const Stripe = require('stripe');

const MAX_PER_SLOT = 1;
const TOTAL_CAP    = 5; // shown as 6 to customers

const SLOTS = [];
const times = [
  '9:00am','9:15am','9:30am','9:45am',
  '10:00am','10:15am','10:30am','10:45am',
  '11:00am','11:15am','11:30am','11:45am',
  '12:00pm','12:15pm','12:30pm','12:45pm'
];
times.forEach(t => SLOTS.push(`Saturday ${t}`));

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

    // Fetch recent successful/pending payment intents
    const intents = await stripe.paymentIntents.list({ limit: 100 });

    // Only count orders from the current drop window (since last Sunday 8pm CT)
    // ORDER_WINDOW_START env var can override this (Unix timestamp) — use to skip test orders
    let windowStartTs;
    if (process.env.ORDER_WINDOW_START) {
      windowStartTs = parseInt(process.env.ORDER_WINDOW_START);
    } else {
      const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
      const windowStart = new Date(now);
      const day = windowStart.getDay(); // 0=Sun
      const daysBackToSun = day === 0 ? 0 : day;
      windowStart.setDate(windowStart.getDate() - daysBackToSun);
      windowStart.setHours(20, 0, 0, 0);
      windowStartTs = Math.floor(windowStart.getTime() / 1000);
    }

    // Count per slot and total
    const counts = {};
    SLOTS.forEach(s => counts[s] = 0);
    let totalOrders = 0;

    intents.data
      .filter(pi => ['succeeded', 'processing', 'requires_capture'].includes(pi.status))
      .filter(pi => pi.created >= windowStartTs)
      .forEach(pi => {
        const slot = pi.metadata?.pickupTime;
        if (slot && counts[slot] !== undefined) {
          counts[slot]++;
          totalOrders++;
        }
      });

    const totalRemaining = Math.max(0, TOTAL_CAP - totalOrders);
    const soldOut = totalRemaining === 0;

    const availability = {};
    SLOTS.forEach(s => {
      const slotFull = counts[s] >= MAX_PER_SLOT;
      availability[s] = {
        available: !soldOut && !slotFull,
        remaining: Math.max(0, MAX_PER_SLOT - counts[s]),
      };
    });

    res.status(200).json({ availability, slots: SLOTS, totalOrders, totalRemaining, totalCap: 6 });
  } catch (err) {
    console.error(err);
    // On error, return all slots as available so checkout isn't blocked
    const availability = {};
    SLOTS.forEach(s => availability[s] = { available: true, remaining: MAX_PER_SLOT });
    res.status(200).json({ availability, slots: SLOTS, totalOrders: 0, totalRemaining: 6, totalCap: 6 });
  }
};
