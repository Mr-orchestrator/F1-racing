// @ts-check
// Diagnostic: does an Adobe Analytics /b/ss/ beacon fire on prod, and what
// currency code (cc=) does it carry? Simulates a console-triggered event by
// pushing into adobeDataLayer and by clicking a real add-to-cart button.
//   BASE_URL=https://racing-f1-rho.vercel.app npx playwright test adobe-currency-check --project=chromium
const { test, expect } = require('@playwright/test');

function parseBeacon(url) {
  const u = new URL(url);
  const get = (k) => u.searchParams.get(k);
  return {
    url,
    rsid: (u.pathname.match(/\/b\/ss\/([^/]+)\//) || [])[1] || '',
    events: get('events') || get('c.a.events') || '',
    cc: get('cc') || '',            // currency code
    products: get('products') || '',
    pe: get('pe') || '',            // link-type beacon marker
    pageName: get('pageName') || '',
    purchaseID: get('purchaseID') || '',
  };
}

test('Adobe Launch runtime + beacon currency on prod', async ({ page }) => {
  const beacons = [];
  page.on('response', async (res) => {
    const url = res.url();
    if (/\/b\/ss\//.test(url) || /adobedc\.net\/(ee|b)\//.test(url)) {
      const b = parseBeacon(url);
      b.status = res.status();
      b.isPageView = b.pe === '';   // s.t() page view has no pe= param; s.tl() link has pe=lnk
      beacons.push(b);
    }
  });

  await page.goto('/', { waitUntil: 'networkidle' });

  // 1) What's actually live in the Launch runtime?
  const runtime = await page.evaluate(() => {
    const c = (window._satellite && window._satellite._container) || {};
    return {
      hasSatellite: typeof window._satellite !== 'undefined',
      buildInfo: window._satellite && window._satellite.buildInfo ? window._satellite.buildInfo : null,
      stage: c.environment ? c.environment.stage : null,
      extensions: c.extensions ? Object.keys(c.extensions) : [],
      ruleNames: Array.isArray(c.rules) ? c.rules.map((r) => r.name) : [],
      dataElements: c.dataElements ? Object.keys(c.dataElements) : [],
      trackerGlobal: typeof window.s !== 'undefined',
      trackingServer: (window.s && (window.s.trackingServer || window.s.trackingServerSecure)) || null,
      account: (window.s && window.s.account) || null,
      currencyCode: (window.s && window.s.currencyCode) || null,
      getVarCurrency: (window._satellite && window._satellite.getVar) ? (function () { try { return window._satellite.getVar('currencyCode'); } catch (e) { return 'ERR:' + e.message; } })() : null,
      acdlLen: (window.adobeDataLayer || []).length,
    };
  });
  console.log('RUNTIME >>>', JSON.stringify(runtime, null, 2));

  // 2) Simulate a console-triggered custom event (what the user would type).
  await page.evaluate(() => {
    window.adobeDataLayer = window.adobeDataLayer || [];
    window.adobeDataLayer.push({
      event: 'Add to cart',
      attributes: {
        product_id: 'TEST-CONSOLE-1', product_name: 'Console Test', product_price: 159.99,
        product_category: 'Apparel', product_quantity: 1, currency: 'USD', cart_total: 159.99, item_count: 1,
      },
      page: { pageInfo: { pageName: 'merchandise' }, category: { pageType: 'plp' } },
      cart: { cartInfo: { cartID: 'test' }, price: { totalPrice: { currency: 'USD', amount: 159.99 } }, item: [] },
    });
  });

  // 3) Also exercise a real button (fires the site's own datalayer path).
  const addBtn = page.locator('.add-cart-btn').first();
  if (await addBtn.count()) { await addBtn.click().catch(() => {}); }

  // Give Launch rules time to evaluate and beacon.
  await page.waitForTimeout(4000);

  console.log('BEACONS >>>', JSON.stringify(beacons, null, 2));

  // Soft assertion: report rather than hard-fail so we always see diagnostics.
  expect(runtime.hasSatellite, '_satellite (Launch) should be loaded').toBeTruthy();
});
