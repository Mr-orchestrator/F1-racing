// @ts-check
// Run the FULL Adobe Official Compliance suite using the dev Launch library override
// This tests the EXACT scenarios that failed against a20 to confirm dev fixes them
const { test, expect } = require('@playwright/test');

test.setTimeout(180000);

const DEV_LAUNCH_URL = 'https://assets.adobedtm.com/236ca7d75265/a5282319db5b/launch-cc5a36c615c3-development.min.js';
const PROD_LAUNCH_PATTERN = /launch-[a-f0-9]+\.min\.js$/;

const isWebSdkCall = (url) => /\.data\.adobedc\.net\/ee\//.test(url) ||
                              /edge\.adobedc\.net\/ee\//.test(url) ||
                              /demdex\.net\/ee\//.test(url);

async function useDevLaunchLibrary(page) {
  await page.route('**/launch-*.min.js', async (route) => {
    const url = route.request().url();
    if (PROD_LAUNCH_PATTERN.test(url) && !url.includes('-development')) {
      const response = await page.request.fetch(DEV_LAUNCH_URL);
      await route.fulfill({
        status: response.status(),
        headers: { 'Content-Type': 'application/javascript' },
        body: await response.body()
      });
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

async function pushDl(page, payload, wait = 2500) {
  await page.evaluate((p) => {
    window.adobeDataLayer = window.adobeDataLayer || [];
    window.adobeDataLayer.push(p);
  }, payload);
  await page.waitForTimeout(wait);
}

test.beforeEach(async ({ page }) => {
  await useDevLaunchLibrary(page);
});

// ═══════════════════════════════════════════════════════════════════════════
// VERIFY ISSUE 1: Add to Cart click fires 2-3 productListAdds → should be 1
// ═══════════════════════════════════════════════════════════════════════════
test('ISSUE 1 — Add to Cart click fires exactly 1 productListAdds', async ({ page }) => {
  const calls = captureBeacons(page);
  await page.goto('/merchandise', { waitUntil: 'load' });
  await page.waitForTimeout(3000);

  const beforeClick = calls.length;
  await page.locator('.add-cart-btn').first().click();
  await page.waitForTimeout(3500);

  const newCalls = calls.slice(beforeClick);
  const events = getEvents(newCalls);
  const productListAdds = events.filter(e => e.eventType === 'commerce.productListAdds');

  console.log('\n=== ISSUE 1: Add to Cart click → productListAdds count ===');
  console.log(`  productListAdds calls: ${productListAdds.length}`);
  console.log(`  Expected: 1`);
  console.log(`  Status: ${productListAdds.length === 1 ? '✓ FIXED' : '✗ STILL BROKEN (' + productListAdds.length + ' calls)'}`);

  expect(productListAdds.length, 'Add to Cart click should fire exactly 1 productListAdds').toBe(1);
});

// ═══════════════════════════════════════════════════════════════════════════
// VERIFY ISSUE 2: Click no longer fires productViews → should fire 1
// ═══════════════════════════════════════════════════════════════════════════
test('ISSUE 2 — Click fires productViews (regression a19 fixed)', async ({ page }) => {
  const calls = captureBeacons(page);
  await page.goto('/merchandise', { waitUntil: 'load' });
  await page.waitForTimeout(3000);

  const beforeClick = calls.length;
  await page.locator('.add-cart-btn').first().click();
  await page.waitForTimeout(3500);

  const newCalls = calls.slice(beforeClick);
  const events = getEvents(newCalls);
  const productViews = events.filter(e => e.eventType === 'commerce.productViews');

  console.log('\n=== ISSUE 2: Add to Cart click → productViews count ===');
  console.log(`  productViews calls: ${productViews.length}`);
  console.log(`  Expected: 1 (from gridbox.addProduct call)`);
  console.log(`  Status: ${productViews.length === 1 ? '✓ FIXED' : '✗ STILL BROKEN (' + productViews.length + ' calls)'}`);

  if (productViews.length === 1) {
    console.log(`  SKU: ${productViews[0].productListItems?.[0]?.SKU}`);
  }

  expect(productViews.length, 'Click cascade should fire exactly 1 productViews').toBe(1);
});

// ═══════════════════════════════════════════════════════════════════════════
// VERIFY ISSUE 3: User Logged In identityMap in chained flow (Flow 5)
// ═══════════════════════════════════════════════════════════════════════════
test('ISSUE 3 — User Logged In identityMap in chained-events flow', async ({ page }) => {
  const calls = captureBeacons(page);
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  // Replicate the Flow 5 compliance test — push many events in sequence,
  // ending with User logged in to mimic the failure conditions
  const sequence = [
    { event: 'Product viewed', attrs: { product_id: 'P1', product_name: 'T', product_price: 99, product_category: 'C' } },
    { event: 'Add to cart', attrs: { product_id: 'P2', product_name: 'T', product_price: 99, product_quantity: 1, currency: 'USD' } },
    { event: 'Remove from cart', attrs: { product_id: 'P2', quantity_removed: 1 } },
    { event: 'View cart', attrs: { cart_total: 99, item_count: 1, item_0_id: 'P2', item_0_qty: 1, item_0_price: 99 } },
    { event: 'BeginCheckout', attrs: { cart_total: 99, item_count: 1, currency: 'USD', item_0_id: 'P2', item_0_name: 'T', item_0_qty: 1, item_0_price: 99 } },
    { event: 'User logged in', attrs: { user_id: 'chained@test.com', user_email: 'chained@test.com', user_type: 'registered', customer_tier: 'gold' } },
  ];

  for (const s of sequence) {
    await pushDl(page, s);
  }

  const events = getEvents(calls);
  const loginEvent = events.find(e => e.identityMap?.Email);

  console.log('\n=== ISSUE 3: User Logged In identityMap in chained-events flow ===');
  console.log(`  Events pushed in sequence: ${sequence.length}`);
  console.log(`  Web SDK events received: ${events.length}`);

  if (loginEvent) {
    console.log(`  ✓ FIXED — identityMap found`);
    console.log(`    id: ${loginEvent.identityMap.Email[0].id}`);
    console.log(`    authenticatedState: ${loginEvent.identityMap.Email[0].authenticatedState}`);
    console.log(`    eVar6/7/8: ${loginEvent._experience?.analytics?.customDimensions?.eVars?.eVar6}/${loginEvent._experience?.analytics?.customDimensions?.eVars?.eVar7}/${loginEvent._experience?.analytics?.customDimensions?.eVars?.eVar8}`);
  } else {
    console.log(`  ✗ STILL BROKEN — no event has identityMap`);
    events.forEach((e, i) => console.log(`    Event ${i + 1}: ${e.eventType}`));
  }

  expect(loginEvent, 'User Login in chained flow must populate identityMap').toBeTruthy();
  expect(loginEvent.identityMap.Email[0].authenticatedState).toBe('authenticated');
  expect(loginEvent.identityMap.Email[0].id).toBe('chained@test.com');
});

// ═══════════════════════════════════════════════════════════════════════════
// EXTENDED — Run the same FLOW 1 (anonymous browse → add → abandon) sequence
// ═══════════════════════════════════════════════════════════════════════════
test('FLOW 1 replicated — Anonymous Browse → Click → View Cart → Remove', async ({ page }) => {
  const calls = captureBeacons(page);

  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  let homeViews = getEvents(calls).filter(e => e.eventType === 'web.webpagedetails.pageViews');
  console.log(`\n  ✓ Home page pageViews: ${homeViews.length}`);

  await page.goto('/merchandise', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  let merchViews = getEvents(calls).filter(e => e.eventType === 'web.webpagedetails.pageViews');
  console.log(`  ✓ After merchandise nav — total pageViews: ${merchViews.length}`);

  const beforeClick = calls.length;
  await page.locator('.add-cart-btn').first().click();
  await page.waitForTimeout(3500);
  const clickCalls = getEvents(calls.slice(beforeClick));
  const productView = clickCalls.find(e => e.eventType === 'commerce.productViews');
  const productAdd = clickCalls.find(e => e.eventType === 'commerce.productListAdds');
  console.log(`  ${productView ? '✓' : '✗'} 1.3a Click fires commerce.productViews`);
  console.log(`  ${productAdd ? '✓' : '✗'} 1.3b Click fires commerce.productListAdds`);

  await page.goto('/cart', { waitUntil: 'load' });
  await pushDl(page, { event: 'View cart', attributes: { cart_total: 159.99, item_count: 1, item_0_id: 'RB-JKT-2024', item_0_qty: 1, item_0_price: 159.99 } });
  const viewCart = getEvents(calls).find(e => e.eventType === 'commerce.productListViews');
  console.log(`  ${viewCart ? '✓' : '✗'} 1.4 View Cart fires commerce.productListViews`);

  await pushDl(page, { event: 'Remove from cart', attributes: { product_id: 'RB-JKT-2024', quantity_removed: 1 } });
  const remove = getEvents(calls).find(e => e.eventType === 'commerce.productListRemovals');
  console.log(`  ${remove ? '✓' : '✗'} 1.5 Remove from Cart fires commerce.productListRemovals`);

  expect(productView).toBeTruthy();
  expect(productAdd).toBeTruthy();
  expect(viewCart).toBeTruthy();
  expect(remove).toBeTruthy();
});

// ═══════════════════════════════════════════════════════════════════════════
// EXTENDED — FLOW 2 (Logged-In multi-product Purchase)
// ═══════════════════════════════════════════════════════════════════════════
test('FLOW 2 replicated — Logged In User → Multi-Add → Purchase', async ({ page }) => {
  const calls = captureBeacons(page);

  await page.goto('/', { waitUntil: 'load' });
  await pushDl(page, { event: 'User logged in', attributes: { user_id: 'f2@t.com', user_email: 'f2@t.com', user_type: 'registered', customer_tier: 'gold' } });

  let events = getEvents(calls);
  const login = events.find(e => e.identityMap?.Email);
  console.log(`\n  ${login ? '✓' : '✗'} 2.1 User Login populates identityMap.Email`);

  await page.goto('/merchandise', { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  const btns = page.locator('.add-cart-btn');
  const beforeAdds = calls.length;
  if (await btns.count() >= 2) {
    await btns.nth(0).click();
    await page.waitForTimeout(2000);
    await btns.nth(1).click();
    await page.waitForTimeout(3000);
  }
  const adds = getEvents(calls.slice(beforeAdds)).filter(e => e.eventType === 'commerce.productListAdds');
  console.log(`  ${adds.length >= 2 ? '✓' : '✗'} 2.3 Multiple Add to Cart events — ${adds.length} fired`);

  await page.goto('/checkout', { waitUntil: 'load' });
  await pushDl(page, { event: 'BeginCheckout', attributes: { cart_total: 339.98, item_count: 2, currency: 'USD', item_0_id: 'RB-JKT-2024', item_0_name: 'T', item_0_qty: 1, item_0_price: 159.99, item_1_id: 'FER-CAP-LC16', item_1_name: 'C', item_1_qty: 1, item_1_price: 45 } });
  const checkout = getEvents(calls).find(e => e.eventType === 'commerce.checkouts');
  console.log(`  ${checkout ? '✓' : '✗'} 2.4 BeginCheckout fires commerce.checkouts`);

  const order = {
    orderNumber: 'RF1-DEV-FLOW2-' + Date.now(),
    email: 'f2@t.com',
    shipping: { firstName: 'F', lastName: 'T', address: '1', city: 'M', state: 'MC', zip: '98000', country: 'MC' },
    shippingMethod: 'express', shippingPrice: 14.99,
    items: [
      { id: 'RB-JKT-2024', name: '2024 Team Jacket', price: 159.99, category: 'Apparel', brand: 'RB', image: 'i.png', quantity: 1 },
      { id: 'FER-CAP-LC16', name: 'Leclerc Cap', price: 45, category: 'Accessories', brand: 'Ferrari', image: 'i.png', quantity: 1 }
    ],
    subtotal: 204.99, tax: 16.91, total: 236.89,
    date: new Date().toISOString(), userId: 'f2@t.com', userName: 'F T'
  };
  await page.goto('/confirmation', { waitUntil: 'load' });
  await page.evaluate((o) => {
    Object.keys(localStorage).filter(k => k.startsWith('rf1_purchase_fired_')).forEach(k => localStorage.removeItem(k));
    localStorage.setItem('rf1_last_order', JSON.stringify(o));
  }, order);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(5000);

  const purchase = getEvents(calls).find(e => e.eventType === 'commerce.purchases');
  console.log(`  ${purchase ? '✓' : '✗'} 2.5 Purchase fires commerce.purchases with purchaseID`);
  if (purchase) {
    console.log(`     purchaseID: ${purchase.commerce.order.purchaseID}`);
    console.log(`     priceTotal: ${purchase.commerce.order.priceTotal}`);
    console.log(`     items: ${purchase.productListItems?.length}`);
  }

  expect(login).toBeTruthy();
  expect(checkout).toBeTruthy();
  expect(purchase).toBeTruthy();
});
