// @ts-check
// ══════════════════════════════════════════════════════════════════════════════
//  F1 Racing Store — Rich Traffic Generator
//  Simulates realistic multi-persona, multi-product logged-in user journeys.
//
//  Run all journeys:
//    BASE_URL=https://racing-f1-rho.vercel.app \
//    npx playwright test traffic-generator --project=chromium --workers=4
//
//  Run a specific journey:
//    npx playwright test traffic-generator -g "VIP Gold" --project=chromium
// ══════════════════════════════════════════════════════════════════════════════
const { test, expect, chromium } = require('@playwright/test');

// Long journeys need extended timeouts
test.setTimeout(120000);

// ─── User personas ────────────────────────────────────────────────────────────
const USERS = {
  gold: {
    email: 'max.verstappen.fan@f1store.com',
    firstName: 'Max', lastName: 'Fan',
    password: 'RedBull2026!',
    favoriteTeam: 'Red Bull Racing',
    customerTier: 'gold',
    type: 'registered'
  },
  silver: {
    email: 'charles.leclerc.fan@f1store.com',
    firstName: 'Charles', lastName: 'Supporter',
    password: 'Ferrari2026!',
    favoriteTeam: 'Ferrari',
    customerTier: 'silver',
    type: 'registered'
  },
  standard: {
    email: 'lando.norris.fan@f1store.com',
    firstName: 'Lando', lastName: 'Follower',
    password: 'Papaya2026!',
    favoriteTeam: 'McLaren',
    customerTier: 'standard',
    type: 'registered'
  },
  newUser: {
    email: 'new.f1fan.' + Date.now() + '@f1store.com',
    firstName: 'New', lastName: 'Registrant',
    password: 'NewFan2026!',
    favoriteTeam: 'Mercedes',
    customerTier: 'standard',
    type: 'new'
  },
  vip: {
    email: 'vip.paddock.member@f1store.com',
    firstName: 'Paddock', lastName: 'VIP',
    password: 'PaddockClub2026!',
    favoriteTeam: 'All Teams',
    customerTier: 'vip',
    type: 'registered'
  }
};

// ─── Product catalogue ─────────────────────────────────────────────────────────
const PRODUCTS = {
  rbJacket:    { id: 'RB-JKT-2024',  name: '2024 Team Jacket',        price: 159.99, category: 'Apparel',      brand: 'Red Bull' },
  ferJacket:   { id: 'FER-JKT-2024', name: 'Scuderia Team Jacket',    price: 179.99, category: 'Apparel',      brand: 'Ferrari' },
  mclJacket:   { id: 'MCL-JKT-2024', name: 'Papaya Team Jacket',      price: 169.99, category: 'Apparel',      brand: 'McLaren' },
  merJacket:   { id: 'MER-PLO-2024', name: 'Team Polo Shirt',         price: 79.99,  category: 'Apparel',      brand: 'Mercedes' },
  ferCap:      { id: 'FER-CAP-LC16', name: 'Leclerc Signature Cap',   price: 45.00,  category: 'Accessories',  brand: 'Ferrari' },
  rbCap:       { id: 'RB-CAP-MV1',   name: 'Verstappen Cap',          price: 39.99,  category: 'Accessories',  brand: 'Red Bull' },
  merCap:      { id: 'MER-CAP-LH44', name: 'Hamilton Cap',            price: 42.00,  category: 'Accessories',  brand: 'Mercedes' },
  mclMod:      { id: 'MCL-MOD-38',   name: 'MCL38 1:18 Scale Model',  price: 249.99, category: 'Collectibles', brand: 'McLaren' },
  ferMod:      { id: 'FER-MOD-24',   name: 'SF-24 1:18 Scale Model',  price: 289.99, category: 'Collectibles', brand: 'Ferrari' },
  rbMod:       { id: 'RB-MOD-20',    name: 'RB20 1:18 Scale Model',   price: 269.99, category: 'Collectibles', brand: 'Red Bull' },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
function trackBeacons(page) {
  const beacons = [];
  page.on('response', async (res) => {
    const url = res.url();
    if (!/\/b\/ss\//.test(url)) return;
    try {
      const u = new URL(url);
      beacons.push({
        events: u.searchParams.get('events') || '',
        products: decodeURIComponent(u.searchParams.get('products') || ''),
        pev2: decodeURIComponent(u.searchParams.get('pev2') || ''),
        v3: u.searchParams.get('v3') || '',
        v6: u.searchParams.get('v6') || '',
        purchaseID: u.searchParams.get('purchaseID') || '',
        cc: u.searchParams.get('cc') || '',
        rsid: (url.match(/\/b\/ss\/([^/]+)\//) || [])[1] || '',
        status: res.status()
      });
    } catch (e) {}
  });
  return beacons;
}

// Seed user into localStorage so auth persists across pages
async function seedUser(page, user) {
  await page.evaluate((u) => {
    const userData = {
      email: u.email, firstName: u.firstName, lastName: u.lastName,
      favoriteTeam: u.favoriteTeam, customerTier: u.customerTier,
      loginPersistence: false
    };
    localStorage.setItem('rf1_user', JSON.stringify(userData));
    // Also ensure user is in rf1_users list
    const users = JSON.parse(localStorage.getItem('rf1_users') || '[]');
    if (!users.find(x => x.email === u.email)) {
      users.push({ ...u, createdAt: new Date().toISOString() });
      localStorage.setItem('rf1_users', JSON.stringify(users));
    }
  }, user);
}

async function push(page, payload, wait = 400) {
  await page.evaluate((p) => {
    window.adobeDataLayer = window.adobeDataLayer || [];
    window.adobeDataLayer.push(p);
  }, payload);
  await page.waitForTimeout(wait);
}

function makeOrder(user, items, extra = {}) {
  const subtotal = items.reduce((s, i) => s + (i.price * (i.quantity || 1)), 0);
  const tax = Math.round(subtotal * 0.0825 * 100) / 100;
  const shipping = extra.shipping || 9.99;
  return {
    orderNumber: 'RF1-' + user.customerTier.toUpperCase() + '-' + Date.now(),
    email: user.email,
    shipping: { firstName: user.firstName, lastName: user.lastName, address: '1 Racing Lane', city: 'Monaco', state: 'MC', zip: '98000', country: 'MC' },
    shippingMethod: extra.shippingMethod || 'standard', shippingPrice: shipping,
    items: items.map(i => ({ id: i.id, name: i.name, price: i.price, category: i.category, brand: i.brand, image: 'img.png', quantity: i.quantity || 1 })),
    subtotal: Math.round(subtotal * 100) / 100,
    tax, total: Math.round((subtotal + tax + shipping) * 100) / 100,
    date: new Date().toISOString(),
    userId: user.email, userName: user.firstName + ' ' + user.lastName,
    customerTier: user.customerTier
  };
}

async function completePurchase(page, order) {
  await page.goto('/confirmation', { waitUntil: 'load' });
  await page.evaluate((o) => {
    Object.keys(localStorage).filter(k => k.startsWith('rf1_purchase_fired_')).forEach(k => localStorage.removeItem(k));
    localStorage.setItem('rf1_last_order', JSON.stringify(o));
  }, order);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(5000);
}

// ══════════════════════════════════════════════════════════════════════════════
// JOURNEY 1 — Gold Member: Browse → Multi-product cart → Full purchase
// Persona: Max Fan (Gold tier, Red Bull fan)
// Products: RB Jacket + RB Cap + RB Model
// ══════════════════════════════════════════════════════════════════════════════
test('Journey 1: Gold member — Red Bull multi-product purchase', async ({ page }) => {
  const beacons = trackBeacons(page);
  const user = USERS.gold;

  // Seed logged-in state
  await page.goto('/', { waitUntil: 'load' });
  await seedUser(page, user);
  await page.reload({ waitUntil: 'load' });

  // Verify auth restored
  const loggedIn = await page.evaluate(() => !!JSON.parse(localStorage.getItem('rf1_user') || 'null'));
  expect(loggedIn, 'Gold user should be logged in').toBeTruthy();

  // Browse merchandise
  await page.goto('/merchandise', { waitUntil: 'load' });
  await page.waitForTimeout(500);

  // Product views
  for (const prod of [PRODUCTS.rbJacket, PRODUCTS.rbCap, PRODUCTS.rbMod]) {
    await push(page, { event: 'Product viewed', attributes: { product_id: prod.id, product_name: prod.name, product_category: prod.category, product_price: prod.price, product_brand: prod.brand } });
  }

  // Add all 3 Red Bull products to cart
  const addBtns = page.locator('.add-cart-btn');
  const btnCount = await addBtns.count();
  for (let i = 0; i < Math.min(btnCount, 3); i++) {
    await addBtns.nth(i).click();
    await page.waitForTimeout(600);
  }

  // View cart
  await page.goto('/cart', { waitUntil: 'load' });
  await push(page, {
    event: 'View cart',
    attributes: { cart_total: 469.97, item_count: 3, item_0_id: PRODUCTS.rbJacket.id, item_0_qty: 1, item_0_price: PRODUCTS.rbJacket.price, item_1_id: PRODUCTS.rbCap.id, item_1_qty: 1, item_1_price: PRODUCTS.rbCap.price, item_2_id: PRODUCTS.rbMod.id, item_2_qty: 1, item_2_price: PRODUCTS.rbMod.price }
  });

  // Promo (gold members get 15% off)
  await push(page, { event: 'Promo code applied', attributes: { promo_code: 'GOLD15', promo_discount: 70.50 } });

  // Checkout
  await page.goto('/checkout', { waitUntil: 'load' });
  await push(page, {
    event: 'BeginCheckout',
    attributes: { cart_total: 469.97, item_count: 3, currency: 'USD', item_0_id: PRODUCTS.rbJacket.id, item_0_name: PRODUCTS.rbJacket.name, item_0_qty: 1, item_0_price: PRODUCTS.rbJacket.price, item_1_id: PRODUCTS.rbCap.id, item_1_name: PRODUCTS.rbCap.name, item_1_qty: 1, item_1_price: PRODUCTS.rbCap.price, item_2_id: PRODUCTS.rbMod.id, item_2_name: PRODUCTS.rbMod.name, item_2_qty: 1, item_2_price: PRODUCTS.rbMod.price }
  });

  // Purchase
  const order = makeOrder(user, [
    { ...PRODUCTS.rbJacket, quantity: 1 },
    { ...PRODUCTS.rbCap, quantity: 1 },
    { ...PRODUCTS.rbMod, quantity: 1 }
  ], { shippingMethod: 'express', shipping: 14.99 });
  await completePurchase(page, order);

  // Verify auth still persisted after purchase
  const stillLoggedIn = await page.evaluate(() => !!JSON.parse(localStorage.getItem('rf1_user') || 'null'));
  expect(stillLoggedIn, 'User should remain logged in after purchase').toBeTruthy();

  const purchaseB = beacons.find(b => b.events === 'purchase');
  const scAddBeacons = beacons.filter(b => b.events === 'scAdd');

  console.log('\n[Journey 1] Gold Member — Red Bull Multi-product Purchase');
  console.log('  User:', user.email, '| Tier:', user.customerTier);
  console.log('  Products added:', scAddBeacons.length);
  console.log('  Purchase beacon:', purchaseB ? '✓ purchaseID=' + purchaseB.purchaseID : '✗ MISSING');
  console.log('  Auth persisted:', stillLoggedIn ? '✓' : '✗');

  expect(purchaseB, 'Purchase beacon must fire').toBeTruthy();
  expect(purchaseB.purchaseID).toBeTruthy();
  expect(purchaseB.cc).toBe('USD');
});

// ══════════════════════════════════════════════════════════════════════════════
// JOURNEY 2 — Silver Member: Search → Browse → Ferrari products → Purchase + Abandon mix
// Persona: Charles Supporter (Silver tier, Ferrari fan)
// Products: Ferrari Jacket + Leclerc Cap + Ferrari Model
// ══════════════════════════════════════════════════════════════════════════════
test('Journey 2: Silver member — Ferrari search + partial purchase', async ({ page }) => {
  const beacons = trackBeacons(page);
  const user = USERS.silver;

  await page.goto('/', { waitUntil: 'load' });
  await seedUser(page, user);
  await page.reload({ waitUntil: 'load' });

  // Search for Ferrari products
  await page.goto('/merchandise', { waitUntil: 'load' });
  await push(page, { event: 'Search performed', attributes: { search_term: 'ferrari jacket', search_results: 3 } });

  // View Ferrari products
  for (const prod of [PRODUCTS.ferJacket, PRODUCTS.ferCap, PRODUCTS.ferMod]) {
    await push(page, { event: 'Product viewed', attributes: { product_id: prod.id, product_name: prod.name, product_category: prod.category, product_price: prod.price, product_brand: prod.brand } });
    await page.waitForTimeout(300);
  }

  // Add jacket + cap (NOT model — price hesitation)
  const addBtns = page.locator('.add-cart-btn');
  if (await addBtns.count() >= 2) {
    await addBtns.nth(0).click(); await page.waitForTimeout(600);
    await addBtns.nth(1).click(); await page.waitForTimeout(600);
  }

  // View teams page — Ferrari profile
  await page.goto('/teams', { waitUntil: 'load' });
  await push(page, { event: 'Team profile viewed', attributes: { team_name: 'Ferrari' } });

  // Back to cart — update quantity (2x caps)
  await page.goto('/cart', { waitUntil: 'load' });
  await push(page, { event: 'Update cart quantity', attributes: { product_id: PRODUCTS.ferCap.id, old_quantity: 1, new_quantity: 2, cart_total: 269.99 } });
  await push(page, { event: 'View cart', attributes: { cart_total: 269.99, item_count: 2, item_0_id: PRODUCTS.ferJacket.id, item_0_qty: 1, item_0_price: 179.99, item_1_id: PRODUCTS.ferCap.id, item_1_qty: 2, item_1_price: 45.00 } });

  // Checkout
  await page.goto('/checkout', { waitUntil: 'load' });
  await push(page, { event: 'BeginCheckout', attributes: { cart_total: 269.99, item_count: 2, currency: 'USD', item_0_id: PRODUCTS.ferJacket.id, item_0_name: PRODUCTS.ferJacket.name, item_0_qty: 1, item_0_price: 179.99, item_1_id: PRODUCTS.ferCap.id, item_1_name: PRODUCTS.ferCap.name, item_1_qty: 2, item_1_price: 45.00 } });

  // Purchase
  const order = makeOrder(user, [
    { ...PRODUCTS.ferJacket, quantity: 1 },
    { ...PRODUCTS.ferCap, quantity: 2 }
  ]);
  await completePurchase(page, order);

  // Verify auth persists AFTER purchase + navigation
  await page.goto('/merchandise', { waitUntil: 'load' });
  const authAfterNav = await page.evaluate(() => JSON.parse(localStorage.getItem('rf1_user') || 'null'));
  expect(authAfterNav, 'Auth must persist across pages after purchase').toBeTruthy();
  expect(authAfterNav.email).toBe(user.email);
  expect(authAfterNav.customerTier).toBe('silver');

  const purchaseB = beacons.find(b => b.events === 'purchase');
  console.log('\n[Journey 2] Silver Member — Ferrari Products');
  console.log('  User:', user.email, '| Tier:', user.customerTier);
  console.log('  Products in purchase:', purchaseB ? purchaseB.products.slice(0, 60) : 'N/A');
  console.log('  Auth tier persisted:', authAfterNav ? authAfterNav.customerTier : 'LOST');

  expect(purchaseB).toBeTruthy();
});

// ══════════════════════════════════════════════════════════════════════════════
// JOURNEY 3 — Standard Member: Browse only → Cart abandon → Error → Re-engage
// Persona: Lando Follower (Standard tier, McLaren fan)
// Tests: Browse multiple categories, add/remove, promo fail, abandon
// ══════════════════════════════════════════════════════════════════════════════
test('Journey 3: Standard member — browse + cart abandon + re-engage', async ({ page }) => {
  const beacons = trackBeacons(page);
  const user = USERS.standard;

  await page.goto('/', { waitUntil: 'load' });
  await seedUser(page, user);
  await page.reload({ waitUntil: 'load' });

  // Browse multiple pages (auth persists across each navigation)
  const pagesAndEvents = [
    { path: '/merchandise', events: [
      { event: 'Product viewed', attributes: { product_id: PRODUCTS.mclJacket.id, product_name: PRODUCTS.mclJacket.name, product_category: 'Apparel', product_price: 169.99, product_brand: 'McLaren' } },
      { event: 'Product viewed', attributes: { product_id: PRODUCTS.mclMod.id, product_name: PRODUCTS.mclMod.name, product_category: 'Collectibles', product_price: 249.99, product_brand: 'McLaren' } }
    ]},
    { path: '/teams', events: [
      { event: 'Team profile viewed', attributes: { team_name: 'McLaren' } }
    ]},
    { path: '/calendar', events: [
      { event: 'Race details viewed', attributes: { race_name: 'British Grand Prix', race_location: 'Silverstone', race_date: '2026-07-06' } }
    ]},
    { path: '/tickets', events: [
      { event: 'Ticket type selected', attributes: { ticket_type: 'General Admission', ticket_category: 'Standard', stand_name: 'Stowe', ticket_price: 199 } }
    ]}
  ];

  for (const { path, events } of pagesAndEvents) {
    await page.goto(path, { waitUntil: 'load' });
    // Verify auth still present on EVERY page
    const auth = await page.evaluate(() => JSON.parse(localStorage.getItem('rf1_user') || 'null'));
    expect(auth && auth.email, `Auth must persist on ${path}`).toBeTruthy();
    for (const evt of events) await push(page, evt);
    await page.waitForTimeout(400);
  }

  // Add to cart on merchandise
  await page.goto('/merchandise', { waitUntil: 'load' });
  const btn = page.locator('.add-cart-btn').first();
  if (await btn.count()) await btn.click();
  await page.waitForTimeout(600);

  // Try invalid promo
  await page.goto('/cart', { waitUntil: 'load' });
  await push(page, { event: 'Promo code failed', attributes: { promo_code: 'INVALID50' } });

  // Payment error
  await page.goto('/checkout', { waitUntil: 'load' });
  await push(page, { event: 'BeginCheckout', attributes: { cart_total: 169.99, item_count: 1, currency: 'USD', item_0_id: PRODUCTS.mclJacket.id, item_0_name: PRODUCTS.mclJacket.name, item_0_qty: 1, item_0_price: 169.99 } });
  await push(page, { event: 'Error occurred', attributes: { error_type: 'payment_failure', error_code: 'ERR_402', ga_errorMessage: 'Card declined — please retry' } });

  // Abandon — remove from cart
  await page.goto('/cart', { waitUntil: 'load' });
  await push(page, { event: 'Remove from cart', attributes: { product_id: PRODUCTS.mclJacket.id, product_name: PRODUCTS.mclJacket.name, quantity_removed: 1, cart_total: 0, item_count: 0 } });

  await page.waitForTimeout(2000);

  const checkoutB = beacons.find(b => b.events === 'scCheckout');
  const errorB = beacons.find(b => b.events === 'event10');
  const removeB = beacons.find(b => b.events === 'scRemove');

  console.log('\n[Journey 3] Standard Member — Browse + Abandon');
  console.log('  User:', user.email, '| Tier:', user.customerTier);
  console.log('  Checkout initiated:', checkoutB ? '✓' : '✗');
  console.log('  Error captured:', errorB ? '✓' : '✗');
  console.log('  Cart abandoned (scRemove):', removeB ? '✓' : '✗');
  console.log('  Pages with auth verified: 4/4 ✓');

  expect(checkoutB, 'Checkout beacon should fire').toBeTruthy();
  expect(removeB, 'Remove from cart should fire on abandon').toBeTruthy();
});

// ══════════════════════════════════════════════════════════════════════════════
// JOURNEY 4 — New User Registration → Immediate purchase
// Persona: Fresh registrant (no prior session)
// Tests: Register → persist → buy collectible
// ══════════════════════════════════════════════════════════════════════════════
test('Journey 4: New user registration → first purchase', async ({ page }) => {
  const beacons = trackBeacons(page);
  const user = { ...USERS.newUser, email: 'new.fan.' + Date.now() + '@f1store.com' };

  // Simulate fresh registration
  await page.goto('/register', { waitUntil: 'load' });
  await page.evaluate((u) => {
    // Simulate successful registration (form submit + redirect)
    const users = JSON.parse(localStorage.getItem('rf1_users') || '[]');
    users.push({ ...u, createdAt: new Date().toISOString() });
    localStorage.setItem('rf1_users', JSON.stringify(users));
    localStorage.setItem('rf1_user', JSON.stringify({
      email: u.email, firstName: u.firstName, lastName: u.lastName,
      favoriteTeam: u.favoriteTeam, customerTier: 'standard', loginPersistence: false
    }));
  }, user);

  await push(page, { event: 'User signed up', attributes: { user_id: user.email, user_type: 'new', favorite_team: user.favoriteTeam } });

  // Navigate to merchandise — auth should carry over
  await page.goto('/merchandise', { waitUntil: 'load' });
  const auth = await page.evaluate(() => JSON.parse(localStorage.getItem('rf1_user') || 'null'));
  expect(auth && auth.email, 'New user auth must persist after registration redirect').toBeTruthy();

  // Browse collectibles (high-value first purchase)
  await push(page, { event: 'Product viewed', attributes: { product_id: PRODUCTS.ferMod.id, product_name: PRODUCTS.ferMod.name, product_category: 'Collectibles', product_price: PRODUCTS.ferMod.price, product_brand: 'Ferrari' } });
  await push(page, { event: 'Product viewed', attributes: { product_id: PRODUCTS.mclMod.id, product_name: PRODUCTS.mclMod.name, product_category: 'Collectibles', product_price: PRODUCTS.mclMod.price, product_brand: 'McLaren' } });

  // Click add to cart (real button)
  const addBtns = page.locator('.add-cart-btn');
  if (await addBtns.count()) {
    await addBtns.first().click();
    await page.waitForTimeout(600);
  }

  // Checkout
  await page.goto('/checkout', { waitUntil: 'load' });
  await push(page, { event: 'BeginCheckout', attributes: { cart_total: 289.99, item_count: 1, currency: 'USD', item_0_id: PRODUCTS.ferMod.id, item_0_name: PRODUCTS.ferMod.name, item_0_qty: 1, item_0_price: PRODUCTS.ferMod.price } });

  // First purchase
  const order = makeOrder({ ...user, customerTier: 'standard' }, [{ ...PRODUCTS.ferMod, quantity: 1 }]);
  await completePurchase(page, order);

  // CRITICAL: auth still present after first purchase
  const authPost = await page.evaluate(() => JSON.parse(localStorage.getItem('rf1_user') || 'null'));

  console.log('\n[Journey 4] New User Registration → First Purchase');
  console.log('  User:', user.email);
  console.log('  Auth after purchase:', authPost ? '✓ persisted' : '✗ LOST');

  const purchaseB = beacons.find(b => b.events === 'purchase');
  expect(authPost, 'Auth must persist after first purchase').toBeTruthy();
  expect(purchaseB, 'Purchase beacon must fire for new user').toBeTruthy();
});

// ══════════════════════════════════════════════════════════════════════════════
// JOURNEY 5 — VIP Member: Full F1 experience (tickets + hospitality + merch)
// Persona: Paddock VIP (highest tier)
// Tests: Race → Tickets → Hospitality → Experiences → Merch purchase
// ══════════════════════════════════════════════════════════════════════════════
test('Journey 5: VIP member — full F1 experience + merch bundle', async ({ page }) => {
  const beacons = trackBeacons(page);
  const user = USERS.vip;

  await page.goto('/', { waitUntil: 'load' });
  await seedUser(page, user);
  await page.reload({ waitUntil: 'load' });

  // Calendar → Race selection
  await page.goto('/calendar', { waitUntil: 'load' });
  await push(page, { event: 'Race details viewed', attributes: { race_name: 'Monaco Grand Prix', race_location: 'Monaco', race_date: '2026-05-24', circuit_name: 'Circuit de Monaco' } });
  await push(page, { event: 'Race selected', attributes: { race_name: 'Monaco Grand Prix', race_location: 'Monaco' } });

  // Tickets → Seat selection
  await page.goto('/tickets', { waitUntil: 'load' });
  await push(page, { event: 'Ticket type selected', attributes: { ticket_type: 'VIP Paddock', ticket_category: 'Premium', stand_name: 'Paddock Club', ticket_price: 2499 } });
  await push(page, { event: 'Seat map viewed', attributes: { stand_name: 'Paddock Club', race_name: 'Monaco Grand Prix' } });
  await push(page, { event: 'Seat selected', attributes: { seat_id: 'PC-001', row: 'A', section: 'Paddock', seat_price: 2499 } });

  // Experiences
  await page.goto('/experiences', { waitUntil: 'load' });
  await push(page, { event: 'Hospitality package viewed', attributes: { package_name: 'Monaco Exclusive', package_price: 3999, race_name: 'Monaco Grand Prix' } });
  await push(page, { event: 'Hospitality package selected', attributes: { package_name: 'Monaco Exclusive', package_price: 3999 } });
  await push(page, { event: 'Experience booked', attributes: { experience_name: 'Driver Meet & Greet', experience_type: 'VIP Access', experience_price: 899 } });
  await push(page, { event: 'Experience booked', attributes: { experience_name: 'Pit Lane Walk', experience_type: 'VIP Access', experience_price: 499 } });

  // Teams page
  await page.goto('/teams', { waitUntil: 'load' });
  for (const team of ['Red Bull Racing', 'Ferrari', 'McLaren', 'Mercedes']) {
    await push(page, { event: 'Team profile viewed', attributes: { team_name: team } });
    await page.waitForTimeout(200);
  }

  // Merch — buy one item from EACH brand (VIP splurge)
  await page.goto('/merchandise', { waitUntil: 'load' });
  const splurge = [PRODUCTS.rbJacket, PRODUCTS.ferJacket, PRODUCTS.mclJacket, PRODUCTS.ferMod];
  for (const prod of splurge) {
    await push(page, { event: 'Product viewed', attributes: { product_id: prod.id, product_name: prod.name, product_category: prod.category, product_price: prod.price, product_brand: prod.brand } });
  }
  const addBtns = page.locator('.add-cart-btn');
  const btnCount = await addBtns.count();
  for (let i = 0; i < Math.min(btnCount, 4); i++) {
    await addBtns.nth(i).click();
    await page.waitForTimeout(500);
  }

  // VIP promo
  await page.goto('/cart', { waitUntil: 'load' });
  await push(page, { event: 'Promo code applied', attributes: { promo_code: 'VIP25', promo_discount: 174.99 } });

  // Checkout + purchase
  const cartTotal = splurge.reduce((s, p) => s + p.price, 0);
  await page.goto('/checkout', { waitUntil: 'load' });
  await push(page, {
    event: 'BeginCheckout',
    attributes: {
      cart_total: cartTotal, item_count: splurge.length, currency: 'USD',
      ...Object.fromEntries(splurge.flatMap((p, i) => [
        [`item_${i}_id`, p.id], [`item_${i}_name`, p.name],
        [`item_${i}_qty`, 1], [`item_${i}_price`, p.price]
      ]))
    }
  });

  const order = makeOrder(user, splurge.map(p => ({ ...p, quantity: 1 })), { shippingMethod: 'overnight', shipping: 24.99 });
  await completePurchase(page, order);

  // VIP auth persists through the whole journey
  const authFinal = await page.evaluate(() => JSON.parse(localStorage.getItem('rf1_user') || 'null'));
  expect(authFinal && authFinal.customerTier, 'VIP tier must persist').toBe('vip');

  const purchaseB = beacons.find(b => b.events === 'purchase');
  const event6 = beacons.find(b => b.events === 'event6');
  const event7 = beacons.find(b => b.events === 'event7');
  const event8 = beacons.filter(b => b.events === 'event8');
  const event9 = beacons.find(b => b.events === 'event9');

  console.log('\n[Journey 5] VIP Member — Full F1 Experience');
  console.log('  User:', user.email, '| Tier:', user.customerTier);
  console.log('  Ticket Selected (event6):', event6 ? '✓' : '✗');
  console.log('  Seat Selected (event7):', event7 ? '✓' : '✗');
  console.log('  Experience Booked (event8):', event8.length, 'times');
  console.log('  Hospitality (event9):', event9 ? '✓' : '✗');
  console.log('  Products purchased:', splurge.length);
  console.log('  Purchase beacon:', purchaseB ? '✓ purchaseID=' + purchaseB.purchaseID : '✗');
  console.log('  VIP tier persisted:', authFinal ? authFinal.customerTier : 'LOST');

  expect(purchaseB, 'Purchase beacon must fire for VIP member').toBeTruthy();
  expect(event6, 'Ticket selection must be tracked').toBeTruthy();
});

// ══════════════════════════════════════════════════════════════════════════════
// JOURNEY 6 — Auth persistence stress test
// Verifies login persists through 8+ page navigations without re-login
// ══════════════════════════════════════════════════════════════════════════════
test('Journey 6: Auth persistence across all pages (no re-login required)', async ({ page }) => {
  const user = USERS.silver;

  await page.goto('/', { waitUntil: 'load' });
  await seedUser(page, user);

  const allPages = ['/', '/merchandise', '/teams', '/tickets', '/experiences', '/calendar', '/cart', '/checkout', '/support'];
  const results = [];

  for (const path of allPages) {
    await page.goto(path, { waitUntil: 'load' });
    const auth = await page.evaluate(() => JSON.parse(localStorage.getItem('rf1_user') || 'null'));
    const loginStatus = await page.evaluate(() => {
      const gl = window.gridboxLayer;
      return gl && gl.user && gl.user[0] && gl.user[0].profile && gl.user[0].profile[0]
        ? gl.user[0].profile[0].profileInfo.loginStatus
        : null;
    });
    results.push({ path, hasAuth: !!auth, email: auth ? auth.email : null, loginStatus });
    await page.waitForTimeout(300);
  }

  console.log('\n[Journey 6] Auth Persistence Across All Pages:');
  results.forEach(r => {
    console.log('  ' + r.path.padEnd(15) + '| auth:' + (r.hasAuth ? '✓' : '✗') + ' | loginStatus:' + r.loginStatus + ' | email:' + (r.email || 'NONE'));
  });

  const failed = results.filter(r => !r.hasAuth || r.loginStatus !== true);
  if (failed.length > 0) {
    console.log('  FAILED pages:', failed.map(r => r.path).join(', '));
  }

  expect(failed.length, 'Auth must persist on all pages without re-login: ' + failed.map(r=>r.path).join(',')).toBe(0);
});

// ══════════════════════════════════════════════════════════════════════════════
// JOURNEY 7 — Logout + Re-login flow
// Verifies clean state after logout and correct re-hydration after login
// ══════════════════════════════════════════════════════════════════════════════
test('Journey 7: Logout → guest state → re-login → persisted session', async ({ page }) => {
  const beacons = trackBeacons(page);
  const user = USERS.gold;

  // Start logged in
  await page.goto('/', { waitUntil: 'load' });
  await seedUser(page, user);
  await page.reload({ waitUntil: 'load' });

  // Verify logged in
  let auth = await page.evaluate(() => JSON.parse(localStorage.getItem('rf1_user') || 'null'));
  expect(auth, 'Should be logged in initially').toBeTruthy();

  // Logout via datalayer + clear localStorage
  await push(page, { event: 'User logged out', attributes: { user_id: user.email, user_type: 'guest', login_status: false } });
  await page.evaluate(() => localStorage.removeItem('rf1_user'));

  // Verify guest state on next page
  await page.goto('/merchandise', { waitUntil: 'load' });
  auth = await page.evaluate(() => JSON.parse(localStorage.getItem('rf1_user') || 'null'));
  expect(auth, 'Should be logged out after logout').toBeFalsy();

  const loginStatus = await page.evaluate(() => {
    const gl = window.gridboxLayer;
    return gl && gl.user[0] && gl.user[0].profile[0] ? gl.user[0].profile[0].profileInfo.loginStatus : null;
  });
  expect(loginStatus, 'loginStatus should be false after logout').toBeFalsy();

  // Re-login
  await seedUser(page, user);
  await page.reload({ waitUntil: 'load' });
  await push(page, { event: 'User logged in', attributes: { user_id: user.email, user_type: 'registered', login_status: true, customer_tier: user.customerTier } });

  auth = await page.evaluate(() => JSON.parse(localStorage.getItem('rf1_user') || 'null'));
  const loginStatusAfter = await page.evaluate(() => {
    const gl = window.gridboxLayer;
    return gl && gl.user[0] && gl.user[0].profile[0] ? gl.user[0].profile[0].profileInfo.loginStatus : null;
  });

  console.log('\n[Journey 7] Logout → Re-login Flow');
  console.log('  Login beacon:', beacons.find(b => b.events === 'event3') ? '✓ event3' : '✗');
  console.log('  Logout beacon:', beacons.find(b => b.pev2 === 'User Logout') ? '✓' : '✗');
  console.log('  loginStatus after re-login:', loginStatusAfter);

  expect(auth, 'Should be logged in after re-login').toBeTruthy();
  expect(auth.email).toBe(user.email);
  expect(loginStatusAfter, 'loginStatus must be true after re-login').toBeTruthy();
});
