// ── Animated 3D perspective grid on hero canvas ──
(function () {
  const canvas = document.getElementById('heroGrid');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W, H, raf;
  let mouseX = 0.5, mouseY = 0.5;
  let targetX = 0.5, targetY = 0.5;
  let t = 0;

  function resize() {
    W = canvas.width = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  document.addEventListener('mousemove', (e) => {
    targetX = e.clientX / window.innerWidth;
    targetY = e.clientY / window.innerHeight;
  });

  const COLS = 14;
  const ROWS = 10;
  const CARAMEL = 'rgba(200,133,42,';
  const GOLD    = 'rgba(212,160,74,';

  function projectPoint(gx, gy, fov, vx, vy) {
    // gx,gy in [-1,1] on the ground plane
    // vanishing point shifts with mouse
    const vpx = W * (0.35 + vx * 0.3);
    const vpy = H * (0.25 + vy * 0.15);
    const depth = 0.3 + gy * 0.7;          // perspective depth
    const scale = fov / (fov + depth * fov);
    const sx = vpx + gx * W * 0.6 * scale;
    const sy = vpy + depth * H * 0.72 * scale;
    return { x: sx, y: sy, scale };
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    t += 0.003;

    // Smooth follow
    mouseX += (targetX - mouseX) * 0.04;
    mouseY += (targetY - mouseY) * 0.04;

    const fov = 1.2;
    const scroll = (t % 1);   // continuous scroll creates motion

    // Draw horizontal lines (receding into vanishing point)
    for (let row = 0; row <= ROWS; row++) {
      const gy = (row / ROWS + scroll) % 1;   // 0=near, 1=far
      const alpha = gy * 0.55;
      const p0 = projectPoint(-1, gy, fov, mouseX - 0.5, mouseY - 0.5);
      const p1 = projectPoint( 1, gy, fov, mouseX - 0.5, mouseY - 0.5);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.strokeStyle = CARAMEL + alpha + ')';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    // Draw vertical lines
    for (let col = 0; col <= COLS; col++) {
      const gx = (col / COLS) * 2 - 1;       // -1 to 1
      const pNear = projectPoint(gx, 0, fov, mouseX - 0.5, mouseY - 0.5);
      const pFar  = projectPoint(gx, 1, fov, mouseX - 0.5, mouseY - 0.5);
      const grad = ctx.createLinearGradient(pNear.x, pNear.y, pFar.x, pFar.y);
      grad.addColorStop(0, GOLD + '0.5)');
      grad.addColorStop(1, GOLD + '0)');
      ctx.beginPath();
      ctx.moveTo(pNear.x, pNear.y);
      ctx.lineTo(pFar.x, pFar.y);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }

    raf = requestAnimationFrame(draw);
  }

  draw();
})();

// Hero 3D parallax on mouse move
const scene = document.getElementById('heroScene');
if (scene) {
  document.addEventListener('mousemove', (e) => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const dx = (e.clientX - cx) / cx;
    const dy = (e.clientY - cy) / cy;
    const rx = -dy * 6;
    const ry = dx * 8;
    scene.style.transform = `perspective(1200px) rotateX(${rx}deg) rotateY(${ry}deg)`;

    // Parallax float cards at different depths
    document.querySelectorAll('.float-card').forEach(card => {
      const depth = parseFloat(card.dataset.depth || 0.05);
      const mx = (e.clientX - cx) * depth;
      const my = (e.clientY - cy) * depth;
      const base = card.classList.contains('float-card--1') ? 'translateZ(60px) rotate(-4deg)' :
                   card.classList.contains('float-card--2') ? 'translateZ(80px) rotate(3deg)' :
                                                               'translateZ(70px) rotate(5deg)';
      card.style.transform = `${base} translate(${mx}px, ${my}px)`;
    });
  });

  document.addEventListener('mouseleave', () => {
    scene.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg)';
  });
}

// Card tilt on hover (light bg cards)
document.querySelectorAll('[data-tilt]').forEach(card => {
  const isDark = card.classList.contains('card-3d-dark');

  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const rx = ((y - cy) / cy) * -7;
    const ry = ((x - cx) / cx) * 7;
    const shadow = isDark
      ? `0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(212,160,74,0.15)`
      : `0 20px 60px rgba(122,79,30,0.15), 0 0 0 1px rgba(122,79,30,0.08)`;
    card.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) scale(1.02)`;
    card.style.boxShadow = shadow;
  });

  card.addEventListener('mouseleave', () => {
    card.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)';
    card.style.boxShadow = '';
  });
});

// ── Countdown + order window state machine ──
(function () {
  const elCountdown = document.getElementById('stateCountdown');
  const elOpen      = document.getElementById('stateOpen');
  const elClosed    = document.getElementById('stateClosed');
  const cdDays  = document.getElementById('cdDays');
  const cdHours = document.getElementById('cdHours');
  const cdMins  = document.getElementById('cdMins');
  const cdSecs  = document.getElementById('cdSecs');

  function pad(n) { return String(n).padStart(2, '0'); }

  // Returns the next Sunday at 8pm local time from a given date
  function nextSundayOpen(from) {
    const d = new Date(from);
    const day = d.getDay(); // 0=Sun
    const daysUntilSunday = day === 0 ? 7 : 7 - day; // always next sunday, not today
    d.setDate(d.getDate() + daysUntilSunday);
    d.setHours(20, 0, 0, 0);
    return d;
  }

  function getState(now) {
    const day  = now.getDay();   // 0 Sun … 6 Sat
    const hour = now.getHours();
    const min  = now.getMinutes();

    // OPEN: Sunday 8pm → Thursday 11:59pm
    const sunAfter8  = day === 0 && (hour >= 20);
    const monToThu   = day >= 1 && day <= 4;
    const thuBefore  = day === 4 && (hour < 24);
    const thuClosed  = day === 4 && hour === 23 && min === 59;

    if (thuClosed) return 'closed';
    if (sunAfter8 || (monToThu && !(day === 4 && hour >= 24))) return 'open';

    // CLOSED: Friday & Saturday (prepping)
    if (day === 5 || day === 6) return 'closed';

    // COUNTDOWN: Sunday before 8pm, or any other state
    return 'countdown';
  }

  function tick() {
    const now   = new Date();
    const state = getState(now);

    elCountdown.style.display = state === 'countdown' ? '' : 'none';
    elOpen.style.display      = state === 'open'      ? '' : 'none';
    elClosed.style.display    = state === 'closed'    ? '' : 'none';

    if (state === 'countdown') {
      // Target: next Sunday 8pm
      let target;
      if (now.getDay() === 0 && now.getHours() < 20) {
        // today IS sunday but before 8pm
        target = new Date(now);
        target.setHours(20, 0, 0, 0);
      } else {
        target = nextSundayOpen(now);
      }

      const diff = target - now;
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000)  / 60000);
      const s = Math.floor((diff % 60000)    / 1000);

      cdDays.textContent  = pad(d);
      cdHours.textContent = pad(h);
      cdMins.textContent  = pad(m);
      cdSecs.textContent  = pad(s);
    }
  }

  tick();
  setInterval(tick, 1000);
})();

// ── Stripe In-Page Checkout ──────────────────────────────
const STRIPE_PK = 'pk_test_51TgRKSBYPi4eMJXqHLGxctfF7esAXO4nO2McmpR64qhgl0xOj6PwIm2ALd4Z3FtZd7zJcSt88yQDMzX71VTVCf2S00CqrsH9YO';
let stripe, elements, paymentElement;
let cartData = { items: [], total: 0, pickup: '' };

// Init cart qty buttons
document.querySelectorAll('.cart-item').forEach(item => {
  const plusBtn  = item.querySelector('[data-action="plus"]');
  const minusBtn = item.querySelector('[data-action="minus"]');
  const qtyEl    = item.querySelector('.qty-num');

  plusBtn.addEventListener('click', () => {
    qtyEl.textContent = parseInt(qtyEl.textContent) + 1;
    checkDipRow();
    updateCart();
  });
  minusBtn.addEventListener('click', () => {
    const v = parseInt(qtyEl.textContent);
    if (v > 0) { qtyEl.textContent = v - 1; checkDipRow(); updateCart(); }
  });
});

function checkDipRow() {
  const boxQty = parseInt(document.querySelector('#boxItem .qty-num').textContent);
  const dipRow = document.getElementById('waffleDipRow');
  if (dipRow) dipRow.style.display = boxQty > 0 ? '' : 'none';
}

document.querySelectorAll('input[name="pickup"]').forEach(r => {
  r.addEventListener('change', updateCart);
});

function updateCart() {
  let total = 0;
  const items = [];
  document.querySelectorAll('.cart-item').forEach(item => {
    const qty   = parseInt(item.querySelector('.qty-num').textContent);
    const price = parseFloat(item.dataset.price);
    const name  = item.dataset.name;
    if (qty > 0) {
      total += qty * price;
      items.push({ name, qty, price });
    }
  });
  const pickup = document.querySelector('input[name="pickup"]:checked')?.value || '';
  cartData = { items, total, pickup };

  document.getElementById('cartTotal').textContent = `$${total}`;
  const btn = document.getElementById('btnToPayment');
  btn.disabled = total === 0 || !pickup;
}

async function goToPayment() {
  document.getElementById('stepOrder').style.display   = 'none';
  document.getElementById('stepPayment').style.display = '';

  // Show order summary
  const dipChoice    = document.querySelector('input[name="waffleDip"]:checked')?.value || '';
  const sauceChoice  = document.querySelector('input[name="includedSauce"]:checked')?.value || '';
  const hasBox       = cartData.items.find(i => i.name === 'The LIÈGUER Box');
  const dipNote      = hasBox && dipChoice ? `<br><em style="font-size:0.75rem;color:var(--caramel)">Waffle style: ${dipChoice}</em>` : '';
  const sauceNote    = hasBox && sauceChoice ? `<br><em style="font-size:0.75rem;color:var(--caramel)">Included sauce: ${sauceChoice}</em>` : '';
  const summary = cartData.items.map(i => `${i.qty}× ${i.name} — $${(i.qty * i.price).toFixed(2)}`).join('<br>');
  document.getElementById('checkoutSummary').innerHTML =
    `${summary}${dipNote}${sauceNote}<br><strong style="font-size:0.9rem;color:var(--dark)">Pickup: ${cartData.pickup}</strong><br><strong style="font-size:0.9rem;color:var(--dark)">Total: $${cartData.total.toFixed(2)}</strong>`;

  // Init Stripe
  if (!stripe) stripe = Stripe(STRIPE_PK);

  // Create payment intent
  const res = await fetch('/api/create-payment-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: cartData.total, items: cartData.items, pickupTime: cartData.pickup }),
  });
  const { clientSecret, error } = await res.json();
  if (error) { document.getElementById('payment-error').textContent = error; return; }

  elements = stripe.elements({ clientSecret, appearance: {
    theme: 'flat',
    variables: {
      colorPrimary: '#c8852a',
      colorBackground: '#faf7f2',
      colorText: '#1a1208',
      colorDanger: '#c0392b',
      fontFamily: 'Jost, sans-serif',
      borderRadius: '0px',
    }
  }});

  paymentElement = elements.create('payment');
  paymentElement.mount('#payment-element');
}

function goBackToOrder() {
  document.getElementById('stepPayment').style.display = 'none';
  document.getElementById('stepOrder').style.display   = '';
  document.getElementById('payment-element').innerHTML = '';
  stripe = null; elements = null; paymentElement = null;
}

async function submitPayment() {
  const btn   = document.getElementById('btnPay');
  const errEl = document.getElementById('payment-error');
  const name  = document.getElementById('payName').value.trim();
  const email = document.getElementById('payEmail').value.trim();

  if (!name || !email) { errEl.textContent = 'Please enter your name and email.'; return; }

  btn.textContent = 'Processing…';
  btn.disabled = true;
  errEl.textContent = '';

  const { error } = await stripe.confirmPayment({
    elements,
    redirect: 'if_required',
    confirmParams: {
      payment_method_data: { billing_details: { name, email } },
      receipt_email: email,
    },
  });

  if (error) {
    errEl.textContent = error.message;
    btn.textContent = 'Confirm & Pay';
    btn.disabled = false;
  } else {
    document.getElementById('stepPayment').style.display = 'none';
    document.getElementById('stepSuccess').style.display = '';
    const pickupDay = cartData.pickup.startsWith('Sunday') ? 'Sunday' : 'Saturday';
    document.getElementById('stepSuccess').querySelector('h2').innerHTML = `See you<br /><em>${pickupDay}.</em>`;
    document.getElementById('successDetails').textContent =
      `Your order is confirmed for ${cartData.pickup}. A receipt is on its way to ${email}.`;
  }
}

// Notify me form
function handleSubmit(e) {
  e.preventDefault();
  const toast = document.getElementById('toast');
  toast.classList.add('show');
  e.target.reset();
  setTimeout(() => toast.classList.remove('show'), 4000);
}
