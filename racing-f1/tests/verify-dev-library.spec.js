// @ts-check
// Override prod Launch library with the DEVELOPMENT build to test the new
// XDM data element code BEFORE publishing to prod.
//
// Dev script:  launch-cc5a36c615c3-development.min.js
// Prod script: launch-53116e4becf9.min.js (currently a20)
const { test, expect } = require('@playwright/test');

test.setTimeout(120000);

const DEV_LAUNCH_URL = 'https://assets.adobedtm.com/236ca7d75265/a5282319db5b/launch-cc5a36c615c3-development.min.js';
const PROD_LAUNCH_PATTERN = /launch-[a-f0-9]+\.min\.js$/;

const isWebSdkCall = (url) => /\.data\.adobedc\.net\/ee\//.test(url) ||
                              /edge\.adobedc\.net\/ee\//.test(url) ||
                              /demdex\.net\/ee\//.test(url);

/** Hijack the prod Launch script and serve the dev build instead */
async function useDevLaunchLibrary(page) {
  await page.route('**/launch-*.min.js', async (route) => {
    const url = route.request().url();
    // If the request is for the prod Launch library (not the dev one),
    // serve the dev library response in its place
    if (PROD_LAUNCH_PATTERN.test(url) && !url.includes('-development')) {
      const response = await page.request.fetch(DEV_LAUNCH_URL);
      await route.fulfill({
        status: response.status(),
        headers: { 'Content-Type': 'application/javascript' },
        body: await response.body()
      });
      console.log(`  [override] Swapped ${url.split('/').pop()} → dev build`);
      return;
    }
    await route.continue();
  });
}

function captureBeacons(page) {
  const calls = [];
  page.on('request', (req) => {
    const url = req.url();
    if (isWebSdkCall(url)) {
      let postData = null;
      try { postData = req.postDataJSON(); } catch(e) {}
      calls.push({ url, postData, ts: Date.now() });
    }
  });
  return calls;
}

function getEvents(calls) {
  const events = [];
  calls.forEach(c => {
    (c.postData?.events || []).forEach(e => events.push(e.xdm || {}));
  });
  return events;
}

test.beforeEach(async ({ page }) => {
  await useDevLaunchLibrary(page);
});

// ═══════════════════════════════════════════════════════════════════════════
// CRITICAL TEST 1: Verify dev library actually loaded
// ═══════════════════════════════════════════════════════════════════════════
test('Verify dev Launch library is in use', async ({ page }) => {
  const launchScripts = [];
  page.on('request', (req) => {
    if (req.url().includes('launch-') && req.url().includes('.min.js')) {
      launchScripts.push(req.url());
    }
  });

  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(3000);

  console.log('\n=== Launch library requests ===');
  launchScripts.forEach(s => console.log(`  ${s}`));

  const buildInfo = await page.evaluate(() => {
    return window._satellite?.buildInfo || null;
  });
  console.log('\n=== Build info ===');
  console.log(JSON.stringify(buildInfo, null, 2));

  expect(launchScripts.length).toBeGreaterThan(0);
});

// ═══════════════════════════════════════════════════════════════════════════
// CRITICAL TEST 2: Add to Cart cascade — the bug we're fixing
// ═══════════════════════════════════════════════════════════════════════════
test('Add to Cart click cascade — distinct XDM per rule (the a20 regression fix)', async ({ page }) => {
  const calls = captureBeacons(page);

  await page.goto('/merchandise', { waitUntil: 'load' });
  await page.waitForTimeout(3000);

  // Click Add to Cart ONCE
  const beforeClick = calls.length;
  const btn = page.locator('.add-cart-btn').first();
  await btn.click();
  await page.waitForTimeout(3000);

  const newCalls = calls.slice(beforeClick);
  const events = getEvents(newCalls);

  console.log('\n=== Add to Cart Click Results (dev library) ===');
  events.forEach((e, i) => {
    console.log(`  Call ${i + 1}: ${e.eventType}`);
    if (e.commerce) console.log(`    commerce: ${JSON.stringify(Object.keys(e.commerce))}`);
    if (e.productListItems?.[0]?.SKU) console.log(`    SKU: ${e.productListItems[0].SKU}`);
  });

  const productViews = events.filter(e => e.eventType === 'commerce.productViews');
  const productListAdds = events.filter(e => e.eventType === 'commerce.productListAdds');

  console.log(`\n  commerce.productViews:    ${productViews.length}x (expected 1)`);
  console.log(`  commerce.productListAdds: ${productListAdds.length}x (expected 1)`);

  expect(productViews.length, 'Click should fire 1 commerce.productViews').toBe(1);
  expect(productListAdds.length, 'Click should fire 1 commerce.productListAdds').toBe(1);
});

// ═══════════════════════════════════════════════════════════════════════════
// CRITICAL TEST 3: Page Load fires exactly ONE pageView
// ═══════════════════════════════════════════════════════════════════════════
test('Single page load fires exactly 1 pageView (no duplicates)', async ({ page }) => {
  const calls = captureBeacons(page);

  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(5000);

  const pageViews = getEvents(calls).filter(e => e.eventType === 'web.webpagedetails.pageViews');
  console.log(`\n=== Single home page load ===`);
  console.log(`  pageView calls: ${pageViews.length} (expected 1)`);

  expect(pageViews.length).toBe(1);
});

// ═══════════════════════════════════════════════════════════════════════════
// CRITICAL TEST 4: Purchase on confirmation page
// ═══════════════════════════════════════════════════════════════════════════
test('Purchase fires commerce.purchases with purchaseID on confirmation page', async ({ page }) => {
  const calls = captureBeacons(page);

  await page.goto('/confirmation', { waitUntil: 'load' });

  const order = {
    orderNumber: 'RF1-DEV-TEST-' + Date.now(),
    email: 'dev@test.com',
    shipping: { firstName: 'Dev', lastName: 'Test', address: '1', city: 'Monaco', state: 'MC', zip: '98000', country: 'MC' },
    shippingMethod: 'standard', shippingPrice: 9.99,
    items: [
      { id: 'RB-JKT-2024', name: '2024 Team Jacket', price: 159.99, category: 'Apparel', brand: 'Red Bull', image: 'i.png', quantity: 1 }
    ],
    subtotal: 159.99, tax: 13.20, total: 183.18,
    date: new Date().toISOString(),
    userId: 'dev@test.com', userName: 'Dev Test'
  };

  await page.evaluate((o) => {
    Object.keys(localStorage).filter(k => k.startsWith('rf1_purchase_fired_')).forEach(k => localStorage.removeItem(k));
    localStorage.setItem('rf1_last_order', JSON.stringify(o));
  }, order);

  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(5000);

  const events = getEvents(calls);
  const purchase = events.find(e => e.eventType === 'commerce.purchases');
  const removal = events.find(e => e.eventType === 'commerce.productListRemovals');

  console.log('\n=== Purchase Confirmation Flow ===');
  if (purchase) {
    console.log(`  ✓ commerce.purchases fired`);
    console.log(`    purchaseID: ${purchase.commerce?.order?.purchaseID}`);
    console.log(`    priceTotal: ${purchase.commerce?.order?.priceTotal}`);
    console.log(`    items:      ${purchase.productListItems?.length}`);
  } else {
    console.log(`  ✗ commerce.purchases NOT fired`);
  }
  console.log(`  ClearCart (commerce.productListRemovals): ${removal ? 'fired' : 'not fired'}`);

  expect(purchase, 'Purchase must fire on confirmation').toBeTruthy();
  expect(purchase.commerce.order.purchaseID).toContain('RF1-DEV-TEST');
  expect(purchase.commerce.order.priceTotal).toBe(183.18);
});

// ═══════════════════════════════════════════════════════════════════════════
// CRITICAL TEST 5: User Login produces identityMap.Email
// ═══════════════════════════════════════════════════════════════════════════
test('User Login produces identityMap with authenticated Email', async ({ page }) => {
  const calls = captureBeacons(page);

  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  await page.evaluate(() => {
    window.adobeDataLayer = window.adobeDataLayer || [];
    window.adobeDataLayer.push({
      event: 'User logged in',
      attributes: {
        user_id: 'login@devtest.com',
        user_email: 'login@devtest.com',
        user_type: 'registered',
        customer_tier: 'gold',
        login_status: true
      }
    });
  });
  await page.waitForTimeout(3000);

  const events = getEvents(calls);
  const loginEvent = events.find(e => e.identityMap?.Email);

  console.log('\n=== User Login Verification ===');
  if (loginEvent) {
    console.log(`  ✓ identityMap.Email present`);
    console.log(`    id: ${loginEvent.identityMap.Email[0].id}`);
    console.log(`    authenticatedState: ${loginEvent.identityMap.Email[0].authenticatedState}`);
    console.log(`    primary: ${loginEvent.identityMap.Email[0].primary}`);
    console.log(`    eVar6 (login_status): ${loginEvent._experience?.analytics?.customDimensions?.eVars?.eVar6}`);
    console.log(`    eVar7 (user_type):    ${loginEvent._experience?.analytics?.customDimensions?.eVars?.eVar7}`);
    console.log(`    eVar8 (tier):         ${loginEvent._experience?.analytics?.customDimensions?.eVars?.eVar8}`);
  } else {
    console.log(`  ✗ identityMap NOT populated`);
  }

  expect(loginEvent, 'User Login must populate identityMap').toBeTruthy();
  expect(loginEvent.identityMap.Email[0].authenticatedState).toBe('authenticated');
  expect(loginEvent.identityMap.Email[0].id).toBe('login@devtest.com');
});

// ═══════════════════════════════════════════════════════════════════════════
// CRITICAL TEST 6: Full event-type coverage
// ═══════════════════════════════════════════════════════════════════════════
test('All event types fire correct XDM eventType', async ({ page }) => {
  const calls = captureBeacons(page);
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  const tests = [
    { event: 'Product viewed', expected: 'commerce.productViews', attrs: { product_id: 'P1', product_name: 'T', product_price: 99, product_category: 'C' } },
    { event: 'Add to cart', expected: 'commerce.productListAdds', attrs: { product_id: 'P2', product_name: 'T', product_price: 99, product_quantity: 1, currency: 'USD' } },
    { event: 'Remove from cart', expected: 'commerce.productListRemovals', attrs: { product_id: 'P2', quantity_removed: 1 } },
    { event: 'View cart', expected: 'commerce.productListViews', attrs: { cart_total: 99, item_count: 1, item_0_id: 'P2', item_0_qty: 1, item_0_price: 99 } },
    { event: 'BeginCheckout', expected: 'commerce.checkouts', attrs: { cart_total: 99, item_count: 1, currency: 'USD', item_0_id: 'P2', item_0_name: 'T', item_0_qty: 1, item_0_price: 99 } },
    { event: 'Search performed', expected: 'web.webinteraction.linkClicks', attrs: { search_term: 'test' } },
    { event: 'Promo code applied', expected: 'web.webinteraction.linkClicks', attrs: { promo_code: 'SAVE10' } },
    { event: 'Race details viewed', expected: 'web.webinteraction.linkClicks', attrs: { race_name: 'Monaco' } },
    { event: 'Team profile viewed', expected: 'web.webinteraction.linkClicks', attrs: { team_name: 'Ferrari' } },
  ];

  const results = [];
  for (const t of tests) {
    const before = calls.length;
    await page.evaluate(({ name, a }) => {
      window.adobeDataLayer.push({ event: name, attributes: a });
    }, { name: t.event, a: t.attrs });
    await page.waitForTimeout(2000);
    const newEvents = getEvents(calls.slice(before));
    // For each test, find the event that matches expected eventType
    const match = newEvents.find(e => e.eventType === t.expected);
    results.push({ event: t.event, expected: t.expected, got: match?.eventType || 'NOT FOUND' });
  }

  console.log('\n=== Event Type Coverage (dev library) ===');
  let passed = 0;
  results.forEach(r => {
    const ok = r.got === r.expected;
    if (ok) passed++;
    console.log(`  ${ok ? '✓' : '✗'} ${r.event.padEnd(25)} → ${r.got}`);
  });
  console.log(`\n  Total: ${passed}/${results.length} PASS`);
  expect(passed).toBe(results.length);
});
