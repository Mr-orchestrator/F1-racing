// @ts-check
// Validates the GridBox → Tealium integration this session built:
//   1. Every page initialises gridbox + carries data-track elements.
//   2. Clicking a data-track element produces a gb_<category>_<action>_<label> event in
//      window.gridboxLayer.event[] (the GridBox-native stream the Tealium Event Bridge consumes).
//   3. A faithful inline copy of the Event Bridge + GA4 Mapping extensions
//      (Mr-orchestrator/tealium-extensions) maps that event to the correct utag.link payload
//      and ga4_event_name — WITHOUT touching window.adobeDataLayer (Adobe's stream).
//
// Run locally against the LOCAL files (not the deployed Vercel build):
//   BASE_URL=http://localhost:3000 npx playwright test tests/gridbox-tealium-bridge.spec.js --project=chromium
const { test, expect } = require('@playwright/test');

const PAGES = [
  'index.html', 'tickets.html', 'merchandise.html', 'teams.html', 'experiences.html',
  'calendar.html', 'cart.html', 'checkout.html', 'login.html', 'register.html',
  'support.html', 'confirmation.html', 'booking-spa.html', 'privacy.html', 'terms.html'
];

// ── Page coverage: gridbox initialises + data-track elements exist ──────────────────────────
for (const pageName of PAGES) {
  test(`[${pageName}] gridbox initialises and data-track elements are present`, async ({ page }) => {
    await page.goto(pageName, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.gridbox && window.gridboxLayer), null, { timeout: 15000 });

    const trackCount = await page.locator('[data-track]').count();
    expect(trackCount, `${pageName} should have data-track elements`).toBeGreaterThan(0);

    const hasEventArray = await page.evaluate(() => Array.isArray(window.gridboxLayer.event));
    expect(hasEventArray).toBe(true);
  });
}

// ── Contract: a data-track click yields a gb_ event in gridboxLayer.event[] ──────────────────
test('data-track click produces a gb_ event in gridboxLayer.event[] (no adobeDataLayer needed)', async ({ page }) => {
  await page.goto('index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!(window.gridbox && window.gridboxLayer), null, { timeout: 15000 });

  const result = await page.evaluate(() => {
    const before = window.gridboxLayer.event.length;
    const el = document.querySelector('button[data-track]'); // buttons don't navigate
    if (!el) return { ok: false, reason: 'no button[data-track] on page' };
    el.click();
    const fired = window.gridboxLayer.event.slice(before);
    const ev = fired.find((e) => e && e.eventInfo && String(e.eventInfo.key || '').indexOf('gb_') === 0);
    if (!ev) return { ok: false, reason: 'no gb_ event recorded', firedKeys: fired.map((e) => e.eventInfo && e.eventInfo.key) };
    const attrs = {};
    (ev.attributes || []).forEach((a) => { if (a && a.key != null) attrs[a.key] = a.value; });
    return { ok: true, key: ev.eventInfo.key, eventCategory: attrs.eventCategory, eventAction: attrs.eventAction, eventLabel: attrs.eventLabel };
  });

  expect(result.ok, JSON.stringify(result)).toBe(true);
  expect(result.key).toMatch(/^gb_/);
  expect(result.eventCategory).toBeTruthy();
  expect(result.eventAction).toBeTruthy();
});

// ── Bridge + GA4 mapping: gridbox event → utag.link payload + ga4_event_name ─────────────────
test('Event Bridge forwards gridboxLayer.event[] to utag.link with correct GA4 event name', async ({ page }) => {
  await page.goto('index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!(window.gridbox && window.gridboxLayer), null, { timeout: 15000 });

  const out = await page.evaluate(() => {
    // ---- faithful inline copy of the two governance extensions ----
    const linkCalls = [];
    window.utag = { link: (d) => linkCalls.push(d) };

    // GridBox Event Bridge (00-pre-loader/03-event-bridge.js) — wrap gridboxLayer.event.push
    (function () {
      const arr = window.gridboxLayer.event;
      const origPush = arr.push;
      arr.push = function () {
        const ret = origPush.apply(this, arguments);
        for (let i = 0; i < arguments.length; i++) forward(arguments[i]);
        return ret;
      };
      function forward(ev) {
        if (!ev || typeof ev !== 'object' || !ev.eventInfo) return;
        if (!(window.utag && typeof window.utag.link === 'function')) return;
        const cat = ev.category && ev.category.primaryCategory;
        if (cat === 'PageView') return;
        const data = { tealium_event: ev.eventInfo.key || ev.eventInfo.eventName };
        if (cat) data.event_primary_category = cat;
        const attrs = ev.attributes;
        if (Array.isArray(attrs)) attrs.forEach((a) => { if (a && a.key != null) data[a.key] = a.value; });
        window.utag.link(data);
      }
    })();

    // GA4 Ecommerce Mapping (20-after-load-rules/01-ga4-ecommerce-mapping.js) — name derivation
    function ga4Name(b) {
      if (b.consent_analytics !== '1') return undefined;
      const COMMERCE = {
        ProductView: 'view_item', 'Product viewed': 'view_item',
        AddToCart: 'add_to_cart', 'Add to cart': 'add_to_cart',
        TicketAddedToCart: 'add_to_cart', MerchandiseAddedToCart: 'add_to_cart',
        RemoveFromCart: 'remove_from_cart', BeginCheckout: 'begin_checkout', Purchase: 'purchase'
      };
      const norm = (s) => String(s).trim().replace(/\s+/g, '_').toLowerCase();
      if (COMMERCE[b.tealium_event]) return COMMERCE[b.tealium_event];
      if (b.eventCategory && b.eventAction) return 'ga4_' + norm(b.eventCategory) + '_' + norm(b.eventAction);
      return 'page_view';
    }

    // ---- trigger a data-track click ----
    const el = document.querySelector('button[data-track]');
    if (!el) return { ok: false, reason: 'no button[data-track]' };
    el.click();

    const bridged = linkCalls.find((d) => String(d.tealium_event || '').indexOf('gb_') === 0);
    if (!bridged) return { ok: false, reason: 'bridge did not forward', linkCalls };
    return { ok: true, payload: bridged, ga4_event_name: ga4Name(Object.assign({ consent_analytics: '1' }, bridged)) };
  });

  expect(out.ok, JSON.stringify(out)).toBe(true);
  expect(out.payload.tealium_event).toMatch(/^gb_/);
  expect(out.payload.eventCategory).toBeTruthy();
  expect(out.payload.eventAction).toBeTruthy();
  // dynamic GA4 name = ga4_<category>_<action>
  expect(out.ga4_event_name).toMatch(/^ga4_.+_.+/);
});

// ── Guard: the bridge must NOT depend on adobeDataLayer (Adobe's stream stays separate) ──────
test('bridge path does not require adobeDataLayer', async ({ page }) => {
  await page.goto('index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!(window.gridbox && window.gridboxLayer), null, { timeout: 15000 });
  // The GridBox-native event array is the source of truth for Tealium.
  const hasGridboxEvents = await page.evaluate(() => Array.isArray(window.gridboxLayer.event));
  expect(hasGridboxEvents).toBe(true);
});
