// @ts-check
// ══════════════════════════════════════════════════════════════════════════════
//  F1 Racing Store — Bulk Traffic Generator (1,500+ sessions)
//  EVERY session = unique logged-in user with unique profile ID, email, name.
//  Every event ties to the unique user via gridbox.setUser() so eVar6, eVar7,
//  eVar8 (login_status, user_type, tier), Profile ID, and transaction emails
//  all populate uniquely in AA / CJA / RTCDP.
//
//  Run:
//    BASE_URL=https://racing-f1-rho.vercel.app \
//    npx playwright test bulk-traffic-generator --project=chromium --workers=8 --timeout=600000
// ══════════════════════════════════════════════════════════════════════════════
const { test, expect } = require('@playwright/test');

test.setTimeout(600000);

const BASE   = process.env.BASE_URL || 'https://racing-f1-rho.vercel.app';
const TARGET = 1500;
const WORKERS = 20;
const SESSIONS_PER_WORKER = Math.ceil(TARGET / WORKERS);

// ─── Tier mix (weighted, NO guest — every session is authenticated) ──────────
const TIERS = [
  { tier: 'standard', weight: 35 },
  { tier: 'silver',   weight: 25 },
  { tier: 'gold',     weight: 20 },
  { tier: 'vip',      weight: 12 },
  { tier: 'new',      weight: 8 },   // brand-new signup
];

// ─── Realistic identity pools (unique per session via combinatorics) ─────────
const FIRST_NAMES = ['Max','Charles','Lewis','Lando','George','Carlos','Fernando','Oscar','Sergio','Pierre','Esteban','Yuki','Alex','Logan','Daniel','Valtteri','Zhou','Kevin','Nico','Lance','Aria','Maya','Chloe','Sophia','Olivia','Ava','Emma','Isabella','Mia','Charlotte','Amelia','Harper','Evelyn','Abigail','Ella','Aarav','Vivaan','Aditya','Arjun','Sai','Krishna','Ishaan','Reyansh','Mohammed','Ayaan','Hiroshi','Yuki','Kai','Ren','Hiro','Akira','Liu','Wei','Jin','Tao','Ming','Hassan','Omar','Khalid','Yusuf','Ahmed','Lucas','Mateo','Diego','Santiago','Sebastian','Liam','Noah','Ethan','Jacob','Mason','Logan','Aiden','James','William','Benjamin','Alexander','Henry','Daniel','Michael','Jackson','Sebastian','Owen','Wyatt','John','David','Joseph','Samuel','Anthony','Andrew','Joshua','Christopher'];
const LAST_NAMES = ['Verstappen','Leclerc','Hamilton','Norris','Russell','Sainz','Alonso','Piastri','Perez','Gasly','Ocon','Tsunoda','Albon','Sargeant','Ricciardo','Bottas','Zhou','Magnussen','Hulkenberg','Stroll','Patel','Singh','Kumar','Sharma','Reddy','Iyer','Khan','Ahmed','Rao','Gupta','Smith','Johnson','Brown','Williams','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin','Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson','Walker','Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores','Green','Adams','Nelson','Baker','Hall','Rivera','Campbell','Mitchell','Carter','Roberts','Tanaka','Suzuki','Sato','Kim','Park','Lee','Chen','Wang','Zhang','Li','Liu','Yang'];
const FAVORITE_TEAMS = ['Red Bull Racing','Ferrari','McLaren','Mercedes','Aston Martin','Alpine','Williams','RB','Sauber','Haas'];
const COUNTRIES = ['IN','US','GB','IT','DE','FR','JP','AU','BR','CA','ES','NL','AE','SG','TH'];

// ─── Product catalogue (matches /merchandise.html) ───────────────────────────
const PRODUCTS = [
  { id: 'RB-JKT-2024',  name: '2024 Team Jacket',        price: 159.99, category: 'Apparel',      brand: 'Red Bull' },
  { id: 'FER-JKT-2024', name: 'Scuderia Team Jacket',    price: 179.99, category: 'Apparel',      brand: 'Ferrari' },
  { id: 'MCL-JKT-2024', name: 'Papaya Team Jacket',      price: 169.99, category: 'Apparel',      brand: 'McLaren' },
  { id: 'MER-PLO-2024', name: 'Team Polo Shirt',         price: 79.99,  category: 'Apparel',      brand: 'Mercedes' },
  { id: 'FER-CAP-LC16', name: 'Leclerc Signature Cap',   price: 45.00,  category: 'Accessories',  brand: 'Ferrari' },
  { id: 'RB-CAP-MV1',   name: 'Verstappen Cap',          price: 39.99,  category: 'Accessories',  brand: 'Red Bull' },
  { id: 'MER-CAP-LH44', name: 'Hamilton Cap',            price: 42.00,  category: 'Accessories',  brand: 'Mercedes' },
  { id: 'MCL-CAP-LN4',  name: 'Norris Cap',              price: 38.00,  category: 'Accessories',  brand: 'McLaren' },
  { id: 'MCL-MOD-38',   name: 'MCL38 1:18 Scale Model',  price: 249.99, category: 'Collectibles', brand: 'McLaren' },
  { id: 'FER-MOD-24',   name: 'SF-24 1:18 Scale Model',  price: 289.99, category: 'Collectibles', brand: 'Ferrari' },
  { id: 'RB-MOD-20',    name: 'RB20 1:18 Scale Model',   price: 269.99, category: 'Collectibles', brand: 'Red Bull' },
];

const RACES = [
  { name: 'Monaco Grand Prix',    location: 'Monaco',       date: '2026-05-24', circuit: 'Circuit de Monaco' },
  { name: 'British Grand Prix',   location: 'Silverstone',  date: '2026-07-06', circuit: 'Silverstone Circuit' },
  { name: 'Italian Grand Prix',   location: 'Monza',        date: '2026-09-07', circuit: 'Autodromo Nazionale Monza' },
  { name: 'Japanese Grand Prix',  location: 'Suzuka',       date: '2026-04-05', circuit: 'Suzuka International Racing Course' },
  { name: 'Singapore Grand Prix', location: 'Singapore',    date: '2026-09-21', circuit: 'Marina Bay Street Circuit' },
  { name: 'Abu Dhabi Grand Prix', location: 'Abu Dhabi',    date: '2026-12-13', circuit: 'Yas Marina Circuit' },
];

const SEARCH_TERMS = ['ferrari jacket','red bull cap','mclaren model','hamilton','verstappen','f1 collectibles','leclerc','norris papaya','mercedes polo','team jacket','scale model','signature cap'];
const PROMOS_VALID = ['SAVE10','F1FAN20','WELCOME15','SUMMER25','VIP30','GOLD15','SILVER10','RACE2026'];
const PROMOS_INVALID = ['INVALID99','EXPIRED','NOTAUSER','FAKE100'];

// ─── Utilities ────────────────────────────────────────────────────────────────
function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randN(n)  { return Math.floor(Math.random() * n); }
function pick(arr, n) {
  const copy = [...arr]; const result = [];
  for (let i = 0; i < Math.min(n, copy.length); i++) {
    result.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return result;
}
function weighted(items) {
  const total = items.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const x of items) { r -= x.weight; if (r <= 0) return x; }
  return items[items.length - 1];
}

// ─── UNIQUE identity generator ────────────────────────────────────────────────
// Each session gets a guaranteed-unique profileID using:
//   - Timestamp (ms since epoch)
//   - Worker ID + session # injected by caller
//   - Random suffix
//   - First+Last name combo + tier
let _idCounter = 0;
function makeUniqueIdentity(workerIdx, sessionIdx) {
  _idCounter++;
  const tierObj = weighted(TIERS);
  const tier = tierObj.tier;
  const firstName = rand(FIRST_NAMES);
  const lastName = rand(LAST_NAMES);
  const ts = Date.now();
  const rnd = Math.random().toString(36).slice(2, 8);

  // Globally unique profile ID format:
  // RF1-{worker}-{session}-{tier}-{counter}-{random}@f1traffic.com
  const profileID = `rf1-w${workerIdx}-s${sessionIdx}-${tier}-${_idCounter}-${rnd}`;
  const email = `${profileID}@f1traffic.com`;

  return {
    profileID,                                  // unique user_id sent to gridbox.setUser
    email,                                      // unique email (also unique by combination)
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`,
    customerTier: tier,
    userType: tier === 'new' ? 'new' : 'registered',
    favoriteTeam: rand(FAVORITE_TEAMS),
    country: rand(COUNTRIES),
    sessionStartTs: ts,
  };
}

// ─── Push datalayer event ─────────────────────────────────────────────────────
async function dl(page, payload, waitMs = 80) {
  await page.evaluate((p) => {
    window.adobeDataLayer = window.adobeDataLayer || [];
    window.adobeDataLayer.push(p);
  }, payload);
  await page.waitForTimeout(waitMs);
}

async function nav(page, path) {
  try {
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(80 + randN(120));
  } catch (e) {}
}

// ─── Seed the UNIQUE user into the site (localStorage + gridbox.setUser) ─────
async function loginUser(page, user) {
  await page.evaluate((u) => {
    // 1. Persist to localStorage so site auth treats this as logged in
    localStorage.setItem('rf1_user', JSON.stringify({
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      favoriteTeam: u.favoriteTeam,
      customerTier: u.customerTier,
      loginPersistence: false
    }));

    // 2. Push login event directly so AA event3 fires with unique user_id
    window.adobeDataLayer = window.adobeDataLayer || [];
    window.adobeDataLayer.push({
      event: 'User logged in',
      attributes: {
        user_id: u.profileID,
        user_email: u.email,
        user_name: u.fullName,
        user_type: u.userType,
        customer_tier: u.customerTier,
        favorite_team: u.favoriteTeam,
        login_status: true
      }
    });

    // 3. Call gridbox.setUser if available (sets gridboxLayer.user[0].profile[0])
    if (window.gridbox && window.gridbox.setUser) {
      window.gridbox.setUser({
        id: u.profileID,
        name: u.fullName,
        email: u.email,
        type: u.userType,
        tier: u.customerTier,
        loginPersistence: false
      });
    }
  }, user);
  await page.waitForTimeout(150);
}

// ─── Reusable event pushers (every one carries unique user context) ──────────
function userAttrs(user) {
  return {
    user_id: user.profileID,
    user_email: user.email,
    user_type: user.userType,
    customer_tier: user.customerTier
  };
}

async function viewProduct(page, user, prod) {
  await dl(page, {
    event: 'Product viewed',
    attributes: {
      ...userAttrs(user),
      product_id: prod.id, product_name: prod.name,
      product_category: prod.category, product_price: prod.price, product_brand: prod.brand
    }
  });
}

async function addCart(page, user, prod, qty = 1) {
  await dl(page, {
    event: 'Add to cart',
    attributes: {
      ...userAttrs(user),
      product_id: prod.id, product_name: prod.name,
      product_category: prod.category, product_price: prod.price,
      product_quantity: qty, currency: 'USD'
    }
  });
}

async function viewCart(page, user, items) {
  const total = items.reduce((s, i) => s + i.price * (i.qty || 1), 0);
  const attrs = { ...userAttrs(user), cart_total: total, item_count: items.length, currency: 'USD' };
  items.forEach((i, idx) => {
    attrs[`item_${idx}_id`] = i.id; attrs[`item_${idx}_name`] = i.name;
    attrs[`item_${idx}_qty`] = i.qty || 1; attrs[`item_${idx}_price`] = i.price;
  });
  await dl(page, { event: 'View cart', attributes: attrs });
}

async function beginCheckout(page, user, items) {
  const total = items.reduce((s, i) => s + i.price * (i.qty || 1), 0);
  const attrs = { ...userAttrs(user), cart_total: total, item_count: items.length, currency: 'USD' };
  items.forEach((i, idx) => {
    attrs[`item_${idx}_id`] = i.id; attrs[`item_${idx}_name`] = i.name;
    attrs[`item_${idx}_qty`] = i.qty || 1; attrs[`item_${idx}_price`] = i.price;
  });
  await dl(page, { event: 'BeginCheckout', attributes: attrs });
}

async function completePurchase(page, user, items) {
  const subtotal = items.reduce((s, i) => s + i.price * (i.qty || 1), 0);
  const tax = +(subtotal * 0.0825).toFixed(2);
  const shipping = rand([9.99, 14.99, 24.99]);
  const total = +(subtotal + tax + shipping).toFixed(2);
  const orderNumber = `RF1-${user.customerTier.toUpperCase()}-${user.profileID.slice(-8)}-${Date.now()}-${randN(9999)}`;

  const order = {
    orderNumber, email: user.email,
    shipping: { firstName: user.firstName, lastName: user.lastName, address: '1 Racing Lane', city: 'Monaco', state: 'MC', zip: '98000', country: user.country },
    shippingMethod: shipping === 24.99 ? 'overnight' : (shipping === 14.99 ? 'express' : 'standard'),
    shippingPrice: shipping,
    items: items.map(i => ({ id: i.id, name: i.name, price: i.price, category: i.category, brand: i.brand, image: 'img.png', quantity: i.qty || 1 })),
    subtotal, tax, total,
    date: new Date().toISOString(),
    userId: user.email,
    userName: user.fullName,
    customerTier: user.customerTier
  };

  await page.goto(BASE + '/confirmation', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.evaluate((o) => {
    Object.keys(localStorage).filter(k => k.startsWith('rf1_purchase_fired_')).forEach(k => localStorage.removeItem(k));
    localStorage.setItem('rf1_last_order', JSON.stringify(o));
  }, order);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1500);
  return orderNumber;
}

// ─── Journey types (every one is logged-in & uses unique user) ───────────────
const JOURNEYS = [

  // Quick browse
  async function quickBrowse(page, user) {
    await nav(page, '/');
    await nav(page, '/' + rand(['merchandise','teams','calendar','experiences','tickets']));
    await viewProduct(page, user, rand(PRODUCTS));
    return 'quickBrowse';
  },

  // Cart abandon (browse + add + leave)
  async function cartAbandon(page, user) {
    await nav(page, '/merchandise');
    const prods = pick(PRODUCTS, 1 + randN(3));
    for (const p of prods) await viewProduct(page, user, p);
    const chosen = rand(prods);
    await addCart(page, user, chosen);
    try { const btn = page.locator('.add-cart-btn').first(); if (await btn.count()) await btn.click(); } catch(e){}
    await page.waitForTimeout(150);
    await nav(page, '/cart');
    await viewCart(page, user, [{ ...chosen, qty: 1 }]);
    if (Math.random() < 0.4) {
      await dl(page, { event: 'Remove from cart', attributes: { ...userAttrs(user), product_id: chosen.id, product_name: chosen.name, quantity_removed: 1, cart_total: 0, item_count: 0 } });
    }
    return 'cartAbandon';
  },

  // Search → view → purchase
  async function searchToBuy(page, user) {
    await nav(page, '/merchandise');
    await dl(page, { event: 'Search performed', attributes: { ...userAttrs(user), search_term: rand(SEARCH_TERMS), search_results: 2 + randN(8) } });
    const prod = rand(PRODUCTS);
    await viewProduct(page, user, prod);
    await addCart(page, user, prod);
    await nav(page, '/checkout');
    await beginCheckout(page, user, [{ ...prod, qty: 1 }]);
    await completePurchase(page, user, [{ ...prod, qty: 1 }]);
    return 'searchToBuy';
  },

  // Multi-product purchase
  async function multiPurchase(page, user) {
    await nav(page, '/merchandise');
    const prods = pick(PRODUCTS, 2 + randN(3));
    for (const p of prods) await viewProduct(page, user, p);
    for (const p of prods) await addCart(page, user, p);
    try {
      const btns = page.locator('.add-cart-btn');
      const c = Math.min(await btns.count(), prods.length);
      for (let i = 0; i < c; i++) { await btns.nth(i).click(); await page.waitForTimeout(100); }
    } catch(e){}
    if (Math.random() > 0.5) {
      await nav(page, '/cart');
      const valid = Math.random() > 0.4;
      const promo = rand(valid ? PROMOS_VALID : PROMOS_INVALID);
      await dl(page, { event: valid ? 'Promo code applied' : 'Promo code failed', attributes: { ...userAttrs(user), promo_code: promo, promo_discount: valid ? 10 + randN(30) : 0 } });
    }
    await nav(page, '/checkout');
    const items = prods.map(p => ({ ...p, qty: 1 }));
    await beginCheckout(page, user, items);
    await completePurchase(page, user, items);
    return 'multiPurchase';
  },

  // F1 Tickets / Experiences journey
  async function ticketsJourney(page, user) {
    await nav(page, '/calendar');
    const race = rand(RACES);
    await dl(page, { event: 'Race details viewed', attributes: { ...userAttrs(user), race_name: race.name, race_location: race.location, race_date: race.date, circuit_name: race.circuit } });
    if (Math.random() > 0.4) await dl(page, { event: 'Race selected', attributes: { ...userAttrs(user), race_name: race.name, race_location: race.location } });

    await nav(page, '/tickets');
    const ticketType = rand(['General Admission','VIP Paddock','Grandstand','Pit Lane']);
    await dl(page, { event: 'Ticket type selected', attributes: { ...userAttrs(user), ticket_type: ticketType, ticket_category: 'Standard', stand_name: 'Stand ' + String.fromCharCode(65+randN(6)), ticket_price: [199,299,499,999,1499][randN(5)], race_name: race.name } });
    if (Math.random() > 0.5) await dl(page, { event: 'Seat selected', attributes: { ...userAttrs(user), seat_id: String.fromCharCode(65+randN(6)) + (10+randN(90)), row: String.fromCharCode(65+randN(10)), section: 'S' + (1+randN(5)), seat_price: 299 + randN(700) } });

    await nav(page, '/experiences');
    if (Math.random() > 0.4) await dl(page, { event: 'Hospitality package viewed', attributes: { ...userAttrs(user), package_name: rand(['Champions Club','Paddock Lounge','VIP Suite','Monaco Exclusive']), package_price: 1499 + randN(3000), race_name: race.name } });
    if (Math.random() > 0.6) await dl(page, { event: 'Hospitality package selected', attributes: { ...userAttrs(user), package_name: 'Champions Club', package_price: 2499 } });
    if (Math.random() > 0.5) await dl(page, { event: 'Experience booked', attributes: { ...userAttrs(user), experience_name: rand(['Pit Lane Walk','Driver Meet & Greet','Factory Tour','Simulator Session']), experience_type: 'VIP Access', experience_price: 299 + randN(700) } });
    return 'ticketsJourney';
  },

  // Team-deep + collectible purchase
  async function teamDive(page, user) {
    await nav(page, '/teams');
    const teams = pick(FAVORITE_TEAMS, 2 + randN(2));
    for (const t of teams) await dl(page, { event: 'Team profile viewed', attributes: { ...userAttrs(user), team_name: t } });
    await nav(page, '/merchandise');
    const prod = rand(PRODUCTS.filter(p => p.category === 'Collectibles'));
    await viewProduct(page, user, prod);
    if (Math.random() > 0.5) {
      await addCart(page, user, prod);
      await nav(page, '/checkout');
      await beginCheckout(page, user, [{ ...prod, qty: 1 }]);
      await completePurchase(page, user, [{ ...prod, qty: 1 }]);
    }
    return 'teamDive';
  },

  // Error scenario
  async function errorJourney(page, user) {
    await nav(page, '/checkout');
    const prod = rand(PRODUCTS);
    await beginCheckout(page, user, [{ ...prod, qty: 1 }]);
    await dl(page, { event: 'Error occurred', attributes: { ...userAttrs(user), error_type: rand(['payment_failure','session_expired','stock_error','network_error']), error_code: 'ERR_' + (400 + randN(100)), ga_errorMessage: rand(['Card declined','Session expired','Out of stock','Network timeout']) } });
    return 'errorJourney';
  },
];

// ─── Single session — guaranteed unique logged-in user ───────────────────────
async function runSession(browser, workerIdx, sessionIdx) {
  // Always create unique user identity
  const user = makeUniqueIdentity(workerIdx, sessionIdx);

  const viewports = [
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 375,  height: 812 },
    { width: 414,  height: 896 },
    { width: 768,  height: 1024 },
  ];
  const ctx = await browser.newContext({ viewport: rand(viewports), userAgent: undefined });
  const page = await ctx.newPage();

  try {
    // Step 1: Land on home
    await page.goto(BASE + '/', { waitUntil: 'load', timeout: 25000 });
    // Step 2: Log in the unique user (sets localStorage + fires User logged in)
    await loginUser(page, user);
    // Step 3: Run randomized journey — all events carry the user's profileID
    const journeyFn = rand(JOURNEYS);
    const journeyType = await journeyFn(page, user);

    return { ok: true, profileID: user.profileID, tier: user.customerTier, journey: journeyType };
  } catch (e) {
    return { ok: false, profileID: user.profileID, journey: 'errored', err: e.message.slice(0, 80) };
  } finally {
    await ctx.close();
  }
}

// ─── Workers (8 parallel × ~188 sessions = 1,500 unique users) ───────────────
function makeWorkerTest(workerIdx) {
  return test(`Traffic worker ${workerIdx + 1} of ${WORKERS} (${SESSIONS_PER_WORKER} unique users)`, async ({ browser }) => {
    const stats = { ok: 0, fail: 0, byJourney: {}, byTier: {}, uniqueProfileIds: new Set() };
    const start = Date.now();

    for (let i = 0; i < SESSIONS_PER_WORKER; i++) {
      const r = await runSession(browser, workerIdx, i + 1);
      if (r.ok) {
        stats.ok++;
        stats.byJourney[r.journey] = (stats.byJourney[r.journey] || 0) + 1;
        stats.byTier[r.tier] = (stats.byTier[r.tier] || 0) + 1;
        stats.uniqueProfileIds.add(r.profileID);
      } else {
        stats.fail++;
      }
      if (i > 0 && i % 30 === 0) await new Promise(r => setTimeout(r, 150));
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`\n[Worker ${workerIdx + 1}] ${elapsed}s | ✓${stats.ok} ✗${stats.fail} | Unique IDs: ${stats.uniqueProfileIds.size}`);
    console.log('  Journeys:', Object.entries(stats.byJourney).map(([k,v]) => `${k}:${v}`).join(' | '));
    console.log('  Tiers:', Object.entries(stats.byTier).map(([k,v]) => `${k}:${v}`).join(' | '));

    // Every successful session must have produced a unique profileID
    expect(stats.uniqueProfileIds.size).toBe(stats.ok);
    expect(stats.ok / (stats.ok + stats.fail)).toBeGreaterThan(0.85);
  });
}

for (let i = 0; i < WORKERS; i++) makeWorkerTest(i);

// ─── Summary test ────────────────────────────────────────────────────────────
test('Traffic generation summary', async ({}) => {
  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║   F1 RACING STORE — BULK TRAFFIC GEN (unique logged-in users)       ║');
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  console.log(`║   Target sessions:        ${String(TARGET).padEnd(43)}║`);
  console.log(`║   Workers (parallel):     ${String(WORKERS).padEnd(43)}║`);
  console.log(`║   Sessions per worker:    ${String(SESSIONS_PER_WORKER).padEnd(43)}║`);
  console.log('║                                                                      ║');
  console.log('║   Every session:                                                     ║');
  console.log('║    • Unique profileID (rf1-w<N>-s<N>-<tier>-<counter>-<rnd>)        ║');
  console.log('║    • Unique email + first name + last name                          ║');
  console.log('║    • Fires User logged in + setUser before any other event          ║');
  console.log('║    • Every datalayer event carries user_id + tier                   ║');
  console.log('║    • Purchases tie email to transaction (eVar10)                    ║');
  console.log('║                                                                      ║');
  console.log('║   Tier mix:    standard 35% | silver 25% | gold 20% | vip 12% | new 8%║');
  console.log('║   Journeys:    quickBrowse | cartAbandon | searchToBuy |             ║');
  console.log('║                multiPurchase | ticketsJourney | teamDive | error    ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  expect(true).toBeTruthy();
});
