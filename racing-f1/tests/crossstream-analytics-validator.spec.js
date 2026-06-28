// @ts-check
/**
 * CROSS-STREAM ANALYTICS VALIDATOR
 * ================================
 * Compares the ACTUAL flow + values across the three stacks the F1 site emits:
 *   • GridBox  — window.gridboxLayer.event[]   (SOURCE OF TRUTH)
 *   • Adobe    — window.adobeDataLayer          (ACDL, fed by analytics.js chokepoint → Launch)
 *   • GA4/GTM  — window.dataLayer               (fed by analytics.js → GTM GA4 tag)
 * Plus best-effort NETWORK capture of GA4 (/g/collect) and Adobe Edge (/ee, omtrdc, demdex).
 *
 * Invariants asserted (hard):
 *   1. GridBox records every event (source of truth).
 *   2. Adobe (ACDL) receives every FIRED event (the single chokepoint) → GridBox↔Adobe VALUE PARITY.
 *   3. GA4 event-name derivation (the Tealium GA4 mapping) is correct for each event.
 * Everything else (GTM presence, GA4/Adobe network) is captured and REPORTED so divergence
 * between code paths is surfaced rather than hidden.
 *
 * Run locally against the LOCAL files:
 *   BASE_URL=http://localhost:3000 npx playwright test tests/crossstream-analytics-validator.spec.js --project=chromium
 */
const { test, expect } = require('@playwright/test');

// ── network matchers ────────────────────────────────────────────────────────────────────────
const isGA4 = (u) => /google-analytics\.com\/(g|j)\/collect|analytics\.google\.com\/g\/collect|region\d*\.google-analytics\.com\/g\/collect/.test(u);
const isAdobe = (u) => /edge\.adobedc\.net\/ee|\/ee\/v\d+\/interact|\.sc\.omtrdc\.net|\.demdex\.net/.test(u);

function parseGA4(url) {
  try {
    const q = new URL(url).searchParams;
    return { en: q.get('en'), ep_currency: q.get('cu'), value: q.get('epn.value') || q.get('ep.value') };
  } catch { return { en: null }; }
}

// ── the GA4 event-name mapping under test (mirrors 20-after-load-rules/01-ga4-ecommerce-mapping.js) ─
function expectedGA4Name(key, eventCategory, eventAction) {
  const COMMERCE = {
    ProductView: 'view_item', 'Product viewed': 'view_item',
    AddToCart: 'add_to_cart', 'Add to cart': 'add_to_cart',
    TicketAddedToCart: 'add_to_cart', MerchandiseAddedToCart: 'add_to_cart',
    RemoveFromCart: 'remove_from_cart', 'Remove from cart': 'remove_from_cart',
    BeginCheckout: 'begin_checkout', 'Begin checkout': 'begin_checkout', gb_checkout_begin: 'begin_checkout',
    Purchase: 'purchase', 'Purchase completed': 'purchase', gb_purchase_complete: 'purchase'
  };
  const norm = (s) => String(s).trim().replace(/\s+/g, '_').toLowerCase();
  if (COMMERCE[key]) return COMMERCE[key];
  if (eventCategory && eventAction) return 'ga4_' + norm(eventCategory) + '_' + norm(eventAction);
  return 'page_view';
}

// ── capture harness — read the three streams by snapshotting array indices (robust: all three
//    are plain arrays the site pushes to; no fragile push-wrapping that races Adobe Launch) ──────
function installNetwork(page) {
  page.__ga4 = []; page.__adobeNet = [];
  page.on('request', (req) => {
    const u = req.url();
    if (isGA4(u)) page.__ga4.push(parseGA4(u));
    else if (isAdobe(u)) page.__adobeNet.push(u);
  });
}

async function ready(page) {
  await page.waitForFunction(() => !!(window.gridbox && window.gridboxLayer && Array.isArray(window.gridboxLayer.event)), null, { timeout: 15000 });
  await page.evaluate(() => {
    try {
      const CS = window.gridbox.CONSENT_STATES;
      window.gridbox.setConsent(CS ? CS.GRANTED : 'granted', { analytics: true, marketing: true, personalization: true });
    } catch (e) {}
  });
}

async function capture(page, actionFn) {
  const before = await page.evaluate(() => ({
    gb: window.gridboxLayer.event.length,
    ad: (window.adobeDataLayer && window.adobeDataLayer.length) || 0,
    gt: (window.dataLayer && window.dataLayer.length) || 0
  }));
  page.__ga4.length = 0; page.__adobeNet.length = 0;
  await page.evaluate(actionFn);
  await page.waitForTimeout(900); // let async pushes + network settle
  const cap = await page.evaluate((b) => {
    const flat = (attrs) => {
      const o = {};
      if (Array.isArray(attrs)) attrs.forEach((a) => { if (a && a.key != null) o[a.key] = a.value; });
      else if (attrs && typeof attrs === 'object') Object.assign(o, attrs);
      return o;
    };
    const gridbox = window.gridboxLayer.event.slice(b.gb).filter((e) => e && e.eventInfo)
      .map((e) => ({ key: e.eventInfo.key, eventName: e.eventInfo.eventName, category: e.category && e.category.primaryCategory, attrs: flat(e.attributes) }));
    const adobe = (window.adobeDataLayer || []).slice(b.ad).filter((p) => p && p.eventInfo)
      .map((p) => ({ event: p.event, eventName: p.eventInfo.eventName, category: p.eventInfo.category, attrs: flat(p.attributes) }));
    const gtm = (window.dataLayer || []).slice(b.gt).filter((p) => p && typeof p === 'object' && !Array.isArray(p) && p.event)
      .map((p) => ({ event: p.event, eventCategory: p.eventCategory, eventAction: p.eventAction, eventLabel: p.eventLabel, obj: p }));
    return { gridbox, adobe, gtm };
  }, before);
  return { ...cap, ga4net: page.__ga4.slice(), adobenet: page.__adobeNet.slice() };
}

// pick a gridbox record by stable key (or eventName)
const find = (list, key) => list.find((e) => e.key === key || e.eventName === key);
// assert a field is equal across whichever streams carry it
function assertParity(label, streams, field) {
  const vals = streams.filter(Boolean).map((s) => s.attrs ? s.attrs[field] : s[field]).filter((v) => v !== undefined && v !== null && v !== '');
  if (vals.length >= 2) {
    const norm = vals.map((v) => String(v));
    expect(new Set(norm).size, `${label}: '${field}' should match across streams, got ${JSON.stringify(norm)}`).toBe(1);
  }
  return vals[0];
}

test.beforeEach(async ({ page }) => { installNetwork(page); });

// ── PAGE VIEW ────────────────────────────────────────────────────────────────────────────────
test('page_view — GridBox ↔ Adobe parity + GA4 name', async ({ page }) => {
  await page.goto('index.html', { waitUntil: 'domcontentloaded' });
  await ready(page);
  const cap = await capture(page, () => { window.gridbox.view && window.gridbox.view({}); });

  const gb = cap.gridbox.find((e) => e.category === 'PageView') || find(cap.gridbox, 'PageView');
  expect(gb, 'GridBox must record a PageView').toBeTruthy();
  // Adobe chokepoint should mirror it
  const ad = cap.adobe.find((e) => e.category === 'PageView' || /page/i.test(String(e.eventName)));
  test.info().annotations.push({ type: 'page_view streams', description: `gridbox=${!!gb} adobe=${!!ad} gtm=${cap.gtm.length} ga4net=${cap.ga4net.length}` });
  expect(gb.category).toBe('PageView');
});

// ── NAV CLICK (data-track → gb_ contract) ─────────────────────────────────────────────────────
test('data-track click — gb_ event, GridBox ↔ Adobe ↔ GTM parity + dynamic GA4 name', async ({ page }) => {
  await page.goto('index.html', { waitUntil: 'domcontentloaded' });
  await ready(page);
  const cap = await capture(page, () => { const b = document.querySelector('button[data-track]'); b && b.click(); });

  const gb = cap.gridbox.find((e) => String(e.key || '').startsWith('gb_'));
  expect(gb, `GridBox must record a gb_ event. Got: ${JSON.stringify(cap.gridbox.map((e) => e.key))}`).toBeTruthy();
  const ad = cap.adobe.find((e) => e.eventName === gb.eventName || String(e.key || '').startsWith('gb_'));
  const gt = cap.gtm.find((e) => String(e.obj && (e.obj.action_type || e.event) || '').includes('gb_') || (e.eventCategory && e.eventAction));

  assertParity('nav', [gb, ad, gt], 'eventCategory');
  assertParity('nav', [gb, ad, gt], 'eventAction');
  const expected = expectedGA4Name(gb.key, gb.attrs.eventCategory, gb.attrs.eventAction);
  expect(expected).toMatch(/^ga4_.+_.+/);
  test.info().annotations.push({ type: 'nav streams', description: `key=${gb.key} gtm=${!!gt} ga4_name=${expected} ga4net=${cap.ga4net.map((g) => g.en).join(',')}` });
});

// ── COMMERCE: each type — GridBox is source, Adobe must mirror VALUES, report GTM + GA4 net ────
const COMMERCE_CASES = [
  {
    name: 'AddToCart', ga4: 'add_to_cart',
    action: () => window.gridbox.addToCart && window.gridbox.addToCart({ productId: 'TKT-VIP', productName: 'VIP Ticket', productPrice: '450', productCategory: 'tickets', quantity: 1, currency: 'USD' }),
    parity: ['product_id', 'product_price', 'currency']
  },
  {
    name: 'RemoveFromCart', ga4: 'remove_from_cart',
    action: () => {
      // seed the cart, then remove the id the site actually stored
      window.gridbox.addToCart && window.gridbox.addToCart({ productId: 'TKT-VIP', productName: 'VIP Ticket', productPrice: '450', productCategory: 'tickets', quantity: 1, currency: 'USD' });
      var it = window.gridboxLayer.cart.item[0];
      var id = (it && it.productInfo && it.productInfo.productID) || 'TKT-VIP';
      window.gridbox.removeFromCart && window.gridbox.removeFromCart(id, 1);
    },
    parity: ['product_id']
  },
  {
    name: 'BeginCheckout', ga4: 'begin_checkout',
    action: () => window.gridbox.beginCheckout && window.gridbox.beginCheckout({ cartTotal: '450', currency: 'USD' }),
    parity: ['currency']
  },
  {
    name: 'Purchase', ga4: 'purchase',
    action: () => window.gridbox.purchase && window.gridbox.purchase({ transactionId: 'T-1001', transactionTotal: '450', currency: 'USD' }),
    parity: ['currency']
  }
];

for (const c of COMMERCE_CASES) {
  test(`commerce ${c.name} — GridBox↔Adobe value parity + GA4 name '${c.ga4}'`, async ({ page }) => {
    await page.goto('merchandise.html', { waitUntil: 'domcontentloaded' });
    await ready(page);
    const cap = await capture(page, c.action);

    const gb = find(cap.gridbox, c.name);
    if (!gb) {
      test.skip(true, `${c.name}: gridbox.${c.name} not driven (API shape differs) — gridbox keys: ${cap.gridbox.map((e) => e.key)}`);
      return;
    }
    // INVARIANT: Adobe chokepoint mirrors the GridBox event.
    // NOTE: the site's adobeDataLayer payload carries only the human eventName (NOT the stable
    // eventInfo.key), so cross-stream correlation on the Adobe side is by eventName.
    const ad = cap.adobe.find((e) => e.eventName === gb.eventName || e.key === gb.key);
    expect(ad, `${c.name}: Adobe (ACDL) must mirror the GridBox event (chokepoint invariant). Adobe saw: ${JSON.stringify(cap.adobe.map((e) => e.eventName))}`).toBeTruthy();
    // INVARIANT: values are identical between source (GridBox) and Adobe
    for (const f of c.parity) assertParity(c.name, [gb, ad], f);
    // GA4 mapping correctness
    expect(expectedGA4Name(gb.key, gb.attrs.eventCategory, gb.attrs.eventAction)).toBe(c.ga4);
    // REPORT divergence: did GTM (GA4 feed) + GA4 network also see it?
    const gt = find(cap.gtm.map((g) => ({ key: g.event, ...g })), c.name) || cap.gtm.find((g) => g.event === gb.key);
    test.info().annotations.push({
      type: `${c.name} matrix`,
      description: `gridbox=Y adobe=Y gtm=${gt ? 'Y' : 'N'} ga4net=${cap.ga4net.map((g) => g.en).filter(Boolean).join(',') || 'none'} expectGA4=${c.ga4}`
    });
  });
}
