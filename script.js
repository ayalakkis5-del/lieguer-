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

  const banner          = document.getElementById('topBanner');
  const bannerText      = document.getElementById('bannerText');
  const bannerCountdown = document.getElementById('bannerCountdown');
  const bannerCta       = document.getElementById('bannerCta');

  function pad(n) { return String(n).padStart(2, '0'); }

  function fmtDiff(ms) {
    if (ms <= 0) return '';
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000)  / 60000);
    const s = Math.floor((ms % 60000)    / 1000);
    if (d > 0) return `${d}d ${pad(h)}h ${pad(m)}m`;
    return `${pad(h)}h ${pad(m)}m ${pad(s)}s`;
  }

  function updateBanner(state, now) {
    banner.className = 'top-banner';
    if (state === 'open') {
      // Count down to Wednesday 11:59pm
      const close = new Date(now);
      const daysToWed = (3 - now.getDay() + 7) % 7 || 7;
      close.setDate(now.getDate() + (now.getDay() === 3 ? 0 : daysToWed));
      close.setHours(23, 59, 0, 0);
      banner.classList.add('banner--open');
      bannerText.textContent = '✦ Ordering is OPEN — closes in';
      bannerCountdown.textContent = fmtDiff(close - now);
      bannerCta.textContent = 'Order Now →';
      bannerCta.href = '#order';
    } else if (state === 'closed') {
      // Count down to next Sunday 8pm
      const reopen = nextSundayOpen(now);
      banner.classList.add('banner--pickup');
      bannerText.textContent = 'Currently in pickup — next drop opens in';
      bannerCountdown.textContent = fmtDiff(reopen - now);
      bannerCta.textContent = 'Get Notified →';
      bannerCta.href = '#notify';
    } else {
      // countdown
      let target;
      if (now.getDay() === 0 && now.getHours() < 20) {
        target = new Date(now); target.setHours(20, 0, 0, 0);
      } else {
        target = nextSundayOpen(now);
      }
      banner.classList.add('banner--countdown');
      bannerText.textContent = 'Next drop opens in';
      bannerCountdown.textContent = fmtDiff(target - now);
      bannerCta.textContent = 'Get Notified →';
      bannerCta.href = '#notify';
    }
  }

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

    // OPEN: Sunday 8pm → Wednesday 11:59pm (extended through Thursday for this week)
    const sunAfter8  = day === 0 && (hour >= 20);
    const monToThu   = day >= 1 && day <= 4;
    const thuClosed  = day === 4 && hour === 23 && min >= 59;

    if (thuClosed) return 'closed';
    if (sunAfter8 || monToThu) return 'open';

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
    updateBanner(state, now);
    // if (state === 'open') loadBoxCounter(); // hidden for now

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
const STRIPE_PK = 'pk_live_51TgRKLBGEHGGFsb7Y8EcGnX0qnTcaYqceNnXQyqpcZhug6D209Q1uhOJptlnm0cMcIoyhHBgwDcyjdKBIDy6VxEn001opqgZO4';
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
    if (item.dataset.espresso) renderEspressoCustomizations(item);
    updateCart();
  });
  minusBtn.addEventListener('click', () => {
    const v = parseInt(qtyEl.textContent);
    if (v > 0) {
      qtyEl.textContent = v - 1;
      checkDipRow();
      if (item.dataset.espresso) renderEspressoCustomizations(item);
      updateCart();
    }
  });
});

// Insert per-item espresso customization wrappers into DOM
document.querySelectorAll('[data-espresso="true"]').forEach(item => {
  const wrap = document.createElement('div');
  wrap.className = 'espresso-cust-wrap';
  wrap.dataset.espressoFor = item.dataset.name;
  wrap.style.display = 'none';
  item.after(wrap);
});

function checkDipRow() {
  const boxQty = parseInt(document.querySelector('#boxItem .qty-num').textContent);
  const dipRow = document.getElementById('waffleDipRow');
  if (dipRow) dipRow.style.display = boxQty > 0 ? '' : 'none';
}

function renderEspressoCustomizations(item) {
  const name = item.dataset.name;
  const qty  = parseInt(item.querySelector('.qty-num').textContent);
  const wrap = document.querySelector(`.espresso-cust-wrap[data-espresso-for="${name}"]`);
  if (!wrap) return;

  if (qty === 0) {
    wrap.style.display = 'none';
    wrap.innerHTML = '';
    return;
  }

  // Snapshot existing values so we don't lose them on re-render
  const existing = [];
  wrap.querySelectorAll('.espresso-unit-row').forEach(row => {
    existing.push({
      milk:     row.querySelector('.esp-milk').value,
      temp:     row.querySelector('.esp-temp').value,
      ice:      row.querySelector('.esp-ice').value,
      foam:     row.querySelector('.esp-foam').checked,
      foamType: row.querySelector('.esp-foam-type').value,
    });
  });

  wrap.innerHTML = '';
  wrap.style.display = '';

  const headerEl = document.createElement('p');
  headerEl.className = 'addon-label';
  headerEl.textContent = qty > 1 ? `Customize your ${qty} ${name}s:` : `Customize your ${name}:`;
  wrap.appendChild(headerEl);

  for (let i = 0; i < qty; i++) {
    const prev    = existing[i] || {};
    const isHot   = prev.temp === 'Hot';
    const foamOn  = !!prev.foam;
    const foamVal = prev.foamType || (name.toLowerCase().includes('tiramisu') ? 'Tiramisu Cold Foam' : 'Sweet Cream Cold Foam');
    const unitLabel = qty > 1 ? `${name} #${i + 1}` : name;

    const row = document.createElement('div');
    row.className = 'espresso-unit-row';
    row.innerHTML = `
      <p class="espresso-unit-label">${unitLabel}</p>
      <div class="espresso-unit-fields">
        <div class="espresso-field">
          <label class="espresso-field-lbl">Temp</label>
          <select class="esp-select esp-temp">
            <option value="Iced"${!isHot ? ' selected' : ''}>Iced</option>
            <option value="Hot"${isHot ? ' selected' : ''}>Hot</option>
          </select>
        </div>
        <div class="espresso-field">
          <label class="espresso-field-lbl">Milk</label>
          <select class="esp-select esp-milk">
            <option value="Whole Milk"${(!prev.milk || prev.milk === 'Whole Milk') ? ' selected' : ''}>Whole Milk</option>
            <option value="Oat Milk"${prev.milk === 'Oat Milk' ? ' selected' : ''}>Oat Milk</option>
            <option value="Almond Milk"${prev.milk === 'Almond Milk' ? ' selected' : ''}>Almond Milk</option>
          </select>
        </div>
        <div class="espresso-field esp-ice-field"${isHot ? ' style="display:none"' : ''}>
          <label class="espresso-field-lbl">Ice</label>
          <select class="esp-select esp-ice">
            <option value="Regular Ice"${(!prev.ice || prev.ice === 'Regular Ice') ? ' selected' : ''}>Regular Ice</option>
            <option value="Light Ice"${prev.ice === 'Light Ice' ? ' selected' : ''}>Light Ice</option>
            <option value="Extra Ice"${prev.ice === 'Extra Ice' ? ' selected' : ''}>Extra Ice</option>
            <option value="No Ice"${prev.ice === 'No Ice' ? ' selected' : ''}>No Ice</option>
          </select>
        </div>
      </div>
      <p class="esp-ice-note" style="display:${(prev.ice === 'Light Ice' || prev.ice === 'No Ice') ? '' : 'none'}">💧 Less ice means more milk fills the cup — your drink will taste a little lighter and less coffee-forward.</p>
      <label class="espresso-foam-label">
        <input type="checkbox" class="esp-foam"${foamOn ? ' checked' : ''} />
        <span class="espresso-foam-text">Cold Foam <span class="foam-price">+$1</span>
          <select class="esp-foam-type esp-select esp-foam-type-sel">
            <option value="Sweet Cream Cold Foam"${foamVal !== 'Tiramisu Cold Foam' ? ' selected' : ''}>Sweet Cream</option>
            <option value="Tiramisu Cold Foam"${foamVal === 'Tiramisu Cold Foam' ? ' selected' : ''}>Tiramisu</option>
          </select>
        </span>
      </label>
    `;

    row.querySelector('.esp-temp').addEventListener('change', e => {
      row.querySelector('.esp-ice-field').style.display = e.target.value === 'Hot' ? 'none' : '';
      updateCart();
    });
    row.querySelector('.esp-milk').addEventListener('change', updateCart);
    row.querySelector('.esp-ice').addEventListener('change', updateCart);
    row.querySelector('.esp-foam').addEventListener('change', updateCart);
    row.querySelector('.esp-foam-type').addEventListener('change', updateCart);

    wrap.appendChild(row);
  }
}

// ── Tip buttons ──
let selectedTip = 0;
document.querySelectorAll('.tip-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tip-btn').forEach(b => b.classList.remove('tip-btn--active'));
    const val = btn.dataset.tip;
    if (val === 'other') {
      btn.classList.add('tip-btn--active');
      document.getElementById('tipCustomWrap').style.display = '';
      const input = document.getElementById('tipCustomInput');
      input.focus();
      selectedTip = parseFloat(input.value) || 0;
    } else {
      btn.classList.add('tip-btn--active');
      document.getElementById('tipCustomWrap').style.display = 'none';
      selectedTip = parseFloat(val);
    }
    updateCart();
  });
});
document.getElementById('tipCustomInput')?.addEventListener('input', e => {
  selectedTip = parseFloat(e.target.value) || 0;
  updateCart();
});

// Show ice note via event delegation so it works across all dynamically rendered rows
document.addEventListener('change', e => {
  if (e.target.classList.contains('esp-ice')) {
    const row  = e.target.closest('.espresso-unit-row');
    const note = row && row.querySelector('.esp-ice-note');
    if (note) {
      const lessIce = e.target.value === 'Light Ice' || e.target.value === 'No Ice';
      note.style.display = lessIce ? '' : 'none';
    }
  }
});

// Helper: collect all per-drink prefs as array
function collectEspressoPrefs() {
  const prefs = [];
  document.querySelectorAll('[data-espresso="true"]').forEach(item => {
    const qty  = parseInt(item.querySelector('.qty-num').textContent);
    if (qty === 0) return;
    const name = item.dataset.name;
    const wrap = document.querySelector(`.espresso-cust-wrap[data-espresso-for="${name}"]`);
    if (!wrap) return;
    wrap.querySelectorAll('.espresso-unit-row').forEach((row, i) => {
      const temp     = row.querySelector('.esp-temp').value;
      const milk     = row.querySelector('.esp-milk').value;
      const ice      = temp === 'Hot' ? '' : row.querySelector('.esp-ice').value;
      const foam     = row.querySelector('.esp-foam').checked;
      const foamType = foam ? row.querySelector('.esp-foam-type').value : '';
      prefs.push({ drink: qty > 1 ? `${name} #${i + 1}` : name, milk, temp, ice, foam, foamType });
    });
  });
  return prefs;
}

// Live box counter
async function loadBoxCounter() {
  try {
    const res = await fetch('/api/slot-availability');
    const { totalRemaining, totalCap } = await res.json();
    const counter = document.getElementById('boxCounter');
    const numEl   = document.getElementById('boxCounterNum');
    const ctaEl   = document.getElementById('boxCounterCta');
    if (!counter) return;
    counter.style.display = '';
    if (totalRemaining === 0) {
      numEl.textContent = 'Sold out this week';
      ctaEl.textContent = 'Join the notify list →';
      ctaEl.closest('a').href = '#notify';
    } else if (totalRemaining <= 3) {
      numEl.textContent = `Only ${totalRemaining} box${totalRemaining === 1 ? '' : 'es'} left`;
      numEl.style.color = '#c0392b';
      ctaEl.textContent = 'Order now →';
    } else {
      numEl.textContent = `${totalRemaining} available this week`;
      ctaEl.textContent = 'Order now →';
    }
  } catch {}
}

// Load slots dynamically from API
async function loadSlots() {
  try {
    const res = await fetch('/api/slot-availability');
    const { availability, slots } = await res.json();

    const satContainer = document.getElementById('slotsSat');
    const loading      = document.getElementById('slotsLoading');
    if (loading) loading.style.display = 'none';

    slots.forEach(slot => {
      const { available, remaining } = availability[slot];
      const container = satContainer;
      const timeLabel = slot.replace('Saturday ', '').replace('Sunday ', '');

      const label = document.createElement('label');
      label.className = 'slot' + (available ? '' : ' slot--full');

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'pickup';
      input.value = slot;
      if (!available) input.disabled = true;
      input.addEventListener('change', () => {
        cartData.pickup = slot;
        // Enable pay button if a slot is now selected
        const btnPay = document.getElementById('btnPay');
        if (btnPay) btnPay.disabled = false;
      });

      const span = document.createElement('span');
      span.textContent = available ? timeLabel : `${timeLabel} Full`;

      label.appendChild(input);
      label.appendChild(span);
      container.appendChild(label);
    });
  } catch (e) {
    const loading = document.getElementById('slotsLoading');
    if (loading) loading.textContent = 'Could not load slots — please refresh.';
  }
}

// Slots now load on step 2 — called in goToPayment()

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
  // Add cold foam add-ons (each checked esp-foam = $1)
  const foamCount = document.querySelectorAll('.esp-foam:checked').length;
  total += foamCount;
  if (foamCount > 0) items.push({ name: 'Cold Foam', qty: foamCount, price: 1 });

  // Add tip
  if (selectedTip > 0) {
    total += selectedTip;
    items.push({ name: 'Tip', qty: 1, price: selectedTip });
  }

  cartData = { items, total, pickup: cartData.pickup || '' };

  document.getElementById('cartTotal').textContent = `$${total.toFixed(2).replace('.00', '')}`;
  const btn = document.getElementById('btnToPayment');
  btn.disabled = total === 0;

  // Refresh checkout summary total if on step 2
  const summaryEl = document.getElementById('checkoutSummary');
  if (summaryEl && summaryEl.innerHTML) {
    summaryEl.innerHTML = summaryEl.innerHTML.replace(
      /<strong[^>]*>Total:.*?<\/strong>/,
      `<strong style="font-size:0.9rem;color:var(--dark)">Total: $${total.toFixed(2)}</strong>`
    );
  }
}

function getPickupDates() {
  const today = new Date();
  const day = today.getDay(); // 0=Sun
  // Find the next Saturday from today
  const daysUntilSat = (6 - day + 7) % 7 || 7;
  const sat = new Date(today);
  sat.setDate(today.getDate() + daysUntilSat);
  const sun = new Date(sat);
  sun.setDate(sat.getDate() + 1);
  const fmt = d => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  return { sat: fmt(sat), sun: fmt(sun) };
}

async function goToPayment() {
  document.getElementById('stepOrder').style.display   = 'none';
  document.getElementById('stepPayment').style.display = '';
  window.scrollTo({ top: document.getElementById('order').offsetTop - 80, behavior: 'smooth' });

  // Load slots fresh now that we're on step 2
  loadSlots();

  // Show actual pickup dates
  const { sat, sun } = getPickupDates();
  const satLabel = document.getElementById('pickupLabelSat');
  const sunLabel = document.getElementById('pickupLabelSun');
  if (satLabel) satLabel.textContent = sat;
  if (sunLabel) sunLabel.textContent = sun;

  // Show order summary (pickup shown after slot is chosen)
  const dipChoice   = document.querySelector('input[name="waffleDip"]:checked')?.value || '';
  const sauceChoice = document.querySelector('input[name="includedSauce"]:checked')?.value || '';
  const hasBox      = cartData.items.find(i => i.name === 'The LIÈGUER Box');
  const dipNote     = hasBox && dipChoice ? `<br><em style="font-size:0.75rem;color:var(--caramel)">Waffle style: ${dipChoice}</em>` : '';
  const sauceNote   = hasBox && sauceChoice ? `<br><em style="font-size:0.75rem;color:var(--caramel)">Included sauce: ${sauceChoice}</em>` : '';

  // Per-drink espresso prefs
  const espPrefs = collectEspressoPrefs();
  const espNote  = espPrefs.map(p => {
    const parts = [p.temp, p.milk];
    if (p.temp === 'Iced' && p.ice) parts.push(p.ice);
    if (p.foam) parts.push(p.foamType || 'Cold Foam');
    return `<br><em style="font-size:0.75rem;color:var(--caramel)">${p.drink}: ${parts.join(' · ')}</em>`;
  }).join('');

  const summary = cartData.items.map(i => `${i.qty}× ${i.name} — $${(i.qty * i.price).toFixed(2)}`).join('<br>');
  document.getElementById('checkoutSummary').innerHTML =
    `${summary}${dipNote}${sauceNote}${espNote}<br><strong style="font-size:0.9rem;color:var(--dark)">Total: $${cartData.total.toFixed(2)}</strong>`;

  // Init Stripe elements (no payment intent yet — created on submit)
  if (!stripe) stripe = Stripe(STRIPE_PK);
}

function goBackToOrder() {
  document.getElementById('stepPayment').style.display = 'none';
  document.getElementById('stepOrder').style.display   = '';
  document.getElementById('payment-element').innerHTML = '';
  document.getElementById('btnLoadCard').style.display = '';
  document.getElementById('btnPay').style.display      = 'none';
  document.getElementById('btnPay').disabled           = false;
  // Reset tip
  selectedTip = 0;
  document.querySelectorAll('.tip-btn').forEach(b => b.classList.remove('tip-btn--active'));
  document.getElementById('tipCustomWrap').style.display = 'none';
  document.getElementById('tipCustomInput').value = '';
  document.getElementById('payment-error').textContent = '';
  stripe = null; elements = null; paymentElement = null;
}

// Step A: validate info + create payment intent + mount card field
async function loadCardField() {
  const btn   = document.getElementById('btnLoadCard');
  const errEl = document.getElementById('payment-error');
  const name  = document.getElementById('payName').value.trim();
  const email = document.getElementById('payEmail').value.trim();
  const phone = document.getElementById('payPhone').value.trim();
  const promo = document.getElementById('payPromo')?.checked ? 'yes' : 'no';

  if (!cartData.pickup) { errEl.textContent = 'Please select a pickup time above.'; return; }
  if (!name)  { errEl.textContent = 'Please enter your name.'; return; }
  if (!email) { errEl.textContent = 'Please enter your email.'; return; }
  if (!phone) { errEl.textContent = 'Please enter your phone number.'; return; }

  errEl.textContent = '';
  btn.textContent   = 'Loading…';
  btn.disabled      = true;

  try {
    const piRes = await fetch('/api/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: cartData.total,
        items: cartData.items,
        pickupTime: cartData.pickup,
        customerName: name,
        customerEmail: email,
        customerPhone: phone,
        promoConsent: promo,
        espressoPrefs: JSON.stringify(collectEspressoPrefs()),
      }),
    });
    const { clientSecret, error: piError } = await piRes.json();
    if (piError) { errEl.textContent = piError; btn.textContent = 'Enter Card Details'; btn.disabled = false; return; }

    if (!stripe) stripe = Stripe(STRIPE_PK);
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

    // Swap buttons
    btn.style.display = 'none';
    document.getElementById('btnPay').style.display = '';
  } catch (e) {
    errEl.textContent = 'Could not connect. Please try again.';
    btn.textContent   = 'Enter Card Details';
    btn.disabled      = false;
  }
}

// Step B: charge the card
async function submitPayment() {
  const btn   = document.getElementById('btnPay');
  const errEl = document.getElementById('payment-error');
  const name  = document.getElementById('payName').value.trim();
  const email = document.getElementById('payEmail').value.trim();
  const phone = document.getElementById('payPhone').value.trim();

  btn.textContent = 'Processing…';
  btn.disabled    = true;
  errEl.textContent = '';

  try {
    const { error } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: {
        return_url: 'https://lieguer.com/#order',
        receipt_email: email,
      },
    });

    if (error) {
      errEl.textContent = error.message;
      btn.textContent   = 'Pay Now →';
      btn.disabled      = false;
    } else {
      document.getElementById('stepPayment').style.display = 'none';
      document.getElementById('stepSuccess').style.display = '';
      const { sat } = getPickupDates();
      const pickupDate = sat;
      document.getElementById('stepSuccess').querySelector('h2').innerHTML = `See you<br /><em>${pickupDate}.</em>`;
      document.getElementById('successDetails').textContent =
        `Your order is confirmed for ${cartData.pickup}. A confirmation email is on its way to ${email}.`;
    }
  } catch (e) {
    errEl.textContent = e?.message || 'Something went wrong. Please try again.';
    btn.textContent   = 'Pay Now →';
    btn.disabled      = false;
  }
}

// ── Notify me / join list ────────────────────────────────
async function submitNotify(e) {
  e.preventDefault();
  const btn = document.getElementById('notifyBtn');
  btn.textContent = 'Adding you…';
  btn.disabled = true;

  try {
    const res = await fetch('/api/join-list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: document.getElementById('nfName').value.trim(),
        email:     document.getElementById('nfEmail').value.trim(),
        phone:     document.getElementById('nfPhone').value.trim(),
      }),
    });
    const data = await res.json();
    if (data.ok || res.ok) {
      document.getElementById('notifyForm').style.display = 'none';
      document.getElementById('notifySuccess').style.display = 'block';
    } else {
      btn.textContent = 'Try again';
      btn.disabled = false;
    }
  } catch {
    btn.textContent = 'Try again';
    btn.disabled = false;
  }
}

// ── Catering inquiry form ────────────────────────────────
async function submitInquiry(e) {
  e.preventDefault();
  const form = e.target;
  const btn  = form.querySelector('button[type="submit"]');
  btn.textContent = 'Sending…';
  btn.disabled = true;

  const data = Object.fromEntries(new FormData(form));

  try {
    const res = await fetch('/api/send-inquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      form.style.display = 'none';
      document.getElementById('cateringSuccess').style.display = '';
    } else {
      throw new Error();
    }
  } catch {
    btn.textContent = 'Send Inquiry';
    btn.disabled = false;
    alert('Something went wrong — please email hellolieguer@gmail.com directly.');
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
