// @ts-check
// ════════════════════════════════════════════════════════════════════════════
// ADOBE OFFICIAL COMPLIANCE VERIFICATION
// Validates Web SDK events against Adobe's official XDM schema documentation:
//
// References:
//   - https://experienceleague.adobe.com/docs/experience-platform/xdm/data-types/commerce-details.html
//   - https://experienceleague.adobe.com/docs/experience-platform/xdm/data-types/product-list-item.html
//   - https://experienceleague.adobe.com/docs/experience-platform/xdm/data-types/web-page-details.html
//   - https://experienceleague.adobe.com/docs/experience-platform/edge/fundamentals/tracking-events.html
//   - https://experienceleague.adobe.com/docs/experience-platform/identity/identity-map.html
// ════════════════════════════════════════════════════════════════════════════
const { test, expect } = require('@playwright/test');

test.setTimeout(180000);

const isWebSdkCall = (url) => /\.data\.adobedc\.net\/ee\//.test(url) ||
                              /edge\.adobedc\.net\/ee\//.test(url) ||
                              /demdex\.net\/ee\//.test(url);

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

// ════════════════════════════════════════════════════════════════════════════
// ADOBE OFFICIAL REQUIREMENT CHECKERS
// ════════════════════════════════════════════════════════════════════════════

function validatePageView(xdm) {
  const errors = [];
  if (xdm.eventType !== 'web.webpagedetails.pageViews')
    errors.push(`eventType must be web.webpagedetails.pageViews (got ${xdm.eventType})`);
  if (!xdm.web?.webPageDetails)
    errors.push('Missing web.webPageDetails object');
  if (!xdm.web?.webPageDetails?.pageViews?.value)
    errors.push('Missing web.webPageDetails.pageViews.value');
  if (xdm.web?.webPageDetails?.pageViews?.value !== 1)
    errors.push(`web.webPageDetails.pageViews.value must be 1 (got ${xdm.web?.webPageDetails?.pageViews?.value})`);
  if (!xdm.web?.webPageDetails?.URL)
    errors.push('Missing web.webPageDetails.URL');
  return errors;
}

function validateProductView(xdm) {
  const errors = [];
  if (xdm.eventType !== 'commerce.productViews')
    errors.push(`eventType must be commerce.productViews (got ${xdm.eventType})`);
  if (!xdm.commerce?.productViews?.value)
    errors.push('Missing commerce.productViews.value');
  if (xdm.commerce?.productViews?.value !== 1)
    errors.push(`commerce.productViews.value must be 1 (got ${xdm.commerce?.productViews?.value})`);
  if (!xdm.productListItems || !Array.isArray(xdm.productListItems) || !xdm.productListItems.length)
    errors.push('Missing productListItems[] array');
  if (xdm.productListItems?.[0] && !xdm.productListItems[0].SKU)
    errors.push('productListItems[0].SKU is required');
  return errors;
}

function validateAddToCart(xdm) {
  const errors = [];
  if (xdm.eventType !== 'commerce.productListAdds')
    errors.push(`eventType must be commerce.productListAdds (got ${xdm.eventType})`);
  if (!xdm.commerce?.productListAdds?.value)
    errors.push('Missing commerce.productListAdds.value');
  if (xdm.commerce?.productListAdds?.value !== 1)
    errors.push(`commerce.productListAdds.value must be 1 (got ${xdm.commerce?.productListAdds?.value})`);
  if (!xdm.productListItems?.length)
    errors.push('Missing productListItems[]');
  const item = xdm.productListItems?.[0];
  if (item) {
    if (!item.SKU) errors.push('productListItems[0].SKU is required');
    if (item.priceTotal === undefined || item.priceTotal === null) errors.push('productListItems[0].priceTotal is required');
    if (!item.quantity) errors.push('productListItems[0].quantity is required');
    if (!item.currencyCode) errors.push('productListItems[0].currencyCode is required');
  }
  return errors;
}

function validateRemoveFromCart(xdm) {
  const errors = [];
  if (xdm.eventType !== 'commerce.productListRemovals')
    errors.push(`eventType must be commerce.productListRemovals (got ${xdm.eventType})`);
  if (!xdm.commerce?.productListRemovals?.value)
    errors.push('Missing commerce.productListRemovals.value');
  if (xdm.commerce?.productListRemovals?.value !== 1)
    errors.push(`commerce.productListRemovals.value must be 1`);
  return errors;
}

function validateViewCart(xdm) {
  const errors = [];
  if (xdm.eventType !== 'commerce.productListViews')
    errors.push(`eventType must be commerce.productListViews (got ${xdm.eventType})`);
  if (!xdm.commerce?.productListViews?.value)
    errors.push('Missing commerce.productListViews.value');
  return errors;
}

function validateBeginCheckout(xdm) {
  const errors = [];
  if (xdm.eventType !== 'commerce.checkouts')
    errors.push(`eventType must be commerce.checkouts (got ${xdm.eventType})`);
  if (!xdm.commerce?.checkouts?.value)
    errors.push('Missing commerce.checkouts.value');
  if (xdm.commerce?.checkouts?.value !== 1)
    errors.push(`commerce.checkouts.value must be 1`);
  return errors;
}

function validatePurchase(xdm) {
  const errors = [];
  if (xdm.eventType !== 'commerce.purchases')
    errors.push(`eventType must be commerce.purchases (got ${xdm.eventType})`);
  if (!xdm.commerce?.purchases?.value)
    errors.push('Missing commerce.purchases.value');
  if (xdm.commerce?.purchases?.value !== 1)
    errors.push(`commerce.purchases.value must be 1`);
  // PURCHASE-CRITICAL FIELDS per Adobe Analytics dedup requirements
  if (!xdm.commerce?.order?.purchaseID)
    errors.push('CRITICAL: commerce.order.purchaseID is required for purchase dedup');
  if (!xdm.commerce?.order?.priceTotal)
    errors.push('commerce.order.priceTotal is required');
  if (!xdm.commerce?.order?.currencyCode)
    errors.push('commerce.order.currencyCode is required');
  if (!xdm.productListItems?.length)
    errors.push('productListItems[] required for purchase');
  return errors;
}

function validateUserLogin(xdm) {
  const errors = [];
  if (!xdm.identityMap)
    errors.push('User Login should populate identityMap');
  const emailEntries = xdm.identityMap?.Email;
  if (!emailEntries || !emailEntries.length)
    errors.push('identityMap.Email[] required for authenticated user');
  if (emailEntries?.[0]?.authenticatedState !== 'authenticated')
    errors.push('identityMap.Email[0].authenticatedState should be "authenticated"');
  return errors;
}

function reportTest(name, errors) {
  console.log(`\n  ${errors.length === 0 ? '✓' : '✗'} ${name}`);
  if (errors.length > 0) {
    errors.forEach(e => console.log(`      ✗ ${e}`));
  }
  return errors.length === 0;
}

// ════════════════════════════════════════════════════════════════════════════
// FLOW 1: Anonymous User Browse → View → Add → Abandon
// ════════════════════════════════════════════════════════════════════════════

test('FLOW 1 — Anonymous browse → product view → add to cart → abandon', async ({ page }) => {
  const calls = captureBeacons(page);

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║   FLOW 1: Anonymous Browse → Add → Abandon                  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  // 1.1 - Home page load
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  let events = getEvents(calls);
  const homeView = events.find(e => e.eventType === 'web.webpagedetails.pageViews');
  reportTest('1.1 Home page fires valid PageView', homeView ? validatePageView(homeView) : ['No pageView fired']);

  // 1.2 - Navigate to merchandise
  await page.goto('/merchandise', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  events = getEvents(calls);
  const merchViews = events.filter(e => e.eventType === 'web.webpagedetails.pageViews');
  reportTest('1.2 Merchandise navigation fires PageView',
    merchViews.length >= 2 ? validatePageView(merchViews[merchViews.length - 1]) : ['Only ' + merchViews.length + ' pageViews']);

  // 1.3 - Click Add to Cart (real button)
  const beforeAdd = calls.length;
  const addBtn = page.locator('.add-cart-btn').first();
  await addBtn.click();
  await page.waitForTimeout(3500);
  const newCalls = calls.slice(beforeAdd);
  const newEvents = getEvents(newCalls);

  const prodView = newEvents.find(e => e.eventType === 'commerce.productViews');
  const addCart = newEvents.find(e => e.eventType === 'commerce.productListAdds');
  reportTest('1.3a Click fires Product View (commerce.productViews)',
    prodView ? validateProductView(prodView) : ['No productView fired']);
  reportTest('1.3b Click fires Add to Cart (commerce.productListAdds)',
    addCart ? validateAddToCart(addCart) : ['No add to cart fired']);

  // 1.4 - View cart
  await page.goto('/cart', { waitUntil: 'load' });
  await pushDl(page, {
    event: 'View cart',
    attributes: { cart_total: 159.99, item_count: 1, item_0_id: 'RB-JKT-2024', item_0_qty: 1, item_0_price: 159.99 }
  });
  events = getEvents(calls);
  const viewCart = events.find(e => e.eventType === 'commerce.productListViews');
  reportTest('1.4 View Cart fires (commerce.productListViews)',
    viewCart ? validateViewCart(viewCart) : ['No view cart fired']);

  // 1.5 - Abandon — remove from cart
  await pushDl(page, {
    event: 'Remove from cart',
    attributes: { product_id: 'RB-JKT-2024', quantity_removed: 1 }
  });
  events = getEvents(calls);
  const removeCart = events.find(e => e.eventType === 'commerce.productListRemovals');
  reportTest('1.5 Remove from Cart fires (commerce.productListRemovals)',
    removeCart ? validateRemoveFromCart(removeCart) : ['No removal fired']);
});

// ════════════════════════════════════════════════════════════════════════════
// FLOW 2: Authenticated User → Multi-product → Purchase
// ════════════════════════════════════════════════════════════════════════════

test('FLOW 2 — Authenticated user → multi-product → Purchase', async ({ page }) => {
  const calls = captureBeacons(page);

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║   FLOW 2: Logged-In User → Multi-Product → Purchase         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  // 2.1 - User logs in
  await page.goto('/', { waitUntil: 'load' });
  await pushDl(page, {
    event: 'User logged in',
    attributes: {
      user_id: 'flow2@test.com',
      user_email: 'flow2@test.com',
      user_type: 'registered',
      customer_tier: 'gold',
      login_status: true
    }
  });
  let events = getEvents(calls);
  const login = events.find(e => e.identityMap?.Email);
  reportTest('2.1 User Login populates identityMap.Email',
    login ? validateUserLogin(login) : ['No identityMap.Email']);

  // 2.2 - Browse + add multiple items
  await page.goto('/merchandise', { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  // 2.3 - Add to cart
  const btns = page.locator('.add-cart-btn');
  const beforeAdd = calls.length;
  if (await btns.count() >= 2) {
    await btns.nth(0).click();
    await page.waitForTimeout(1500);
    await btns.nth(1).click();
    await page.waitForTimeout(2500);
  }
  let newEvents = getEvents(calls.slice(beforeAdd));
  const addCarts = newEvents.filter(e => e.eventType === 'commerce.productListAdds');
  reportTest(`2.3 Multiple Add to Cart events fire (${addCarts.length} expected ≥ 2)`,
    addCarts.length >= 2 ? validateAddToCart(addCarts[0]) : [`Only ${addCarts.length} fired`]);

  // 2.4 - Checkout
  await page.goto('/checkout', { waitUntil: 'load' });
  await pushDl(page, {
    event: 'BeginCheckout',
    attributes: {
      cart_total: 339.98, item_count: 2, currency: 'USD',
      item_0_id: 'RB-JKT-2024', item_0_name: '2024 Team Jacket', item_0_qty: 1, item_0_price: 159.99,
      item_1_id: 'FER-CAP-LC16', item_1_name: 'Leclerc Cap', item_1_qty: 1, item_1_price: 45.00
    }
  });
  events = getEvents(calls);
  const checkout = events.find(e => e.eventType === 'commerce.checkouts');
  reportTest('2.4 Begin Checkout fires (commerce.checkouts)',
    checkout ? validateBeginCheckout(checkout) : ['No checkout fired']);

  // 2.5 - Purchase via confirmation page
  const order = {
    orderNumber: 'RF1-FLOW2-' + Date.now(),
    email: 'flow2@test.com',
    shipping: { firstName: 'Flow', lastName: 'Test', address: '1', city: 'Monaco', state: 'MC', zip: '98000', country: 'MC' },
    shippingMethod: 'express', shippingPrice: 14.99,
    items: [
      { id: 'RB-JKT-2024', name: '2024 Team Jacket', price: 159.99, category: 'Apparel', brand: 'Red Bull', image: 'i.png', quantity: 1 },
      { id: 'FER-CAP-LC16', name: 'Leclerc Cap', price: 45.00, category: 'Accessories', brand: 'Ferrari', image: 'i.png', quantity: 1 }
    ],
    subtotal: 204.99, tax: 16.91, total: 236.89,
    date: new Date().toISOString(),
    userId: 'flow2@test.com', userName: 'Flow Test'
  };

  await page.goto('/confirmation', { waitUntil: 'load' });
  await page.evaluate((o) => {
    Object.keys(localStorage).filter(k => k.startsWith('rf1_purchase_fired_')).forEach(k => localStorage.removeItem(k));
    localStorage.setItem('rf1_last_order', JSON.stringify(o));
  }, order);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(5000);

  events = getEvents(calls);
  const purchase = events.find(e => e.eventType === 'commerce.purchases');
  reportTest('2.5 Purchase fires with purchaseID (Adobe dedup requirement)',
    purchase ? validatePurchase(purchase) : ['No purchase fired']);

  if (purchase) {
    console.log(`     purchaseID: ${purchase.commerce.order.purchaseID}`);
    console.log(`     priceTotal: ${purchase.commerce.order.priceTotal}`);
    console.log(`     currency:   ${purchase.commerce.order.currencyCode}`);
    console.log(`     items:      ${purchase.productListItems?.length}`);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// FLOW 3: Per-Page navigation verification
// ════════════════════════════════════════════════════════════════════════════

test('FLOW 3 — Per-page navigation fires correct pageView each time', async ({ page }) => {
  const calls = captureBeacons(page);

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║   FLOW 3: Per-Page Navigation                               ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  const pages = ['/', '/merchandise', '/teams', '/tickets', '/experiences', '/calendar', '/cart'];
  let totalPageViews = 0;

  for (const path of pages) {
    const before = calls.length;
    await page.goto(path, { waitUntil: 'load' });
    await page.waitForTimeout(2500);
    const newCalls = calls.slice(before);
    const pageView = newCalls.find(c =>
      (c.postData?.events || []).some(e => e.xdm?.eventType === 'web.webpagedetails.pageViews')
    );
    if (pageView) totalPageViews++;
    console.log(`  ${pageView ? '✓' : '✗'} ${path.padEnd(20)} pageView fired`);
  }

  expect(totalPageViews).toBe(pages.length);
  console.log(`\n  Result: ${totalPageViews}/${pages.length} pages fired pageView ✓`);
});

// ════════════════════════════════════════════════════════════════════════════
// FLOW 4: Verify NO duplicates per action
// ════════════════════════════════════════════════════════════════════════════

test('FLOW 4 — Verify NO duplicate events per action', async ({ page }) => {
  const calls = captureBeacons(page);

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║   FLOW 4: No-Duplicate Verification                         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  // Test 4.1: Single page load = 1 pageView
  let before = calls.length;
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  let pvs = getEvents(calls.slice(before)).filter(e => e.eventType === 'web.webpagedetails.pageViews');
  console.log(`  ${pvs.length === 1 ? '✓' : '✗'} 1 home page load → ${pvs.length} pageView (expected 1)`);
  expect(pvs.length).toBe(1);

  // Test 4.2: Single product viewed push = 1 productViews
  before = calls.length;
  await pushDl(page, {
    event: 'Product viewed',
    attributes: { product_id: 'DEDUP-TEST', product_name: 'Test', product_price: 99, product_category: 'Test' }
  });
  const pviews = getEvents(calls.slice(before)).filter(e => e.eventType === 'commerce.productViews');
  console.log(`  ${pviews.length === 1 ? '✓' : '✗'} 1 Product Viewed push → ${pviews.length} call (expected 1)`);
  expect(pviews.length).toBe(1);

  // Test 4.3: Add to Cart click = expected count
  await page.goto('/merchandise', { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  before = calls.length;
  const btn = page.locator('.add-cart-btn').first();
  await btn.click();
  await page.waitForTimeout(3000);
  const clickCalls = getEvents(calls.slice(before));
  const addCarts = clickCalls.filter(e => e.eventType === 'commerce.productListAdds');
  const productViews = clickCalls.filter(e => e.eventType === 'commerce.productViews');
  console.log(`  ${addCarts.length === 1 ? '✓' : '✗'} 1 Add to Cart click → ${addCarts.length} productListAdds (expected 1)`);
  console.log(`  ${productViews.length === 1 ? '✓' : '✗'} 1 Add to Cart click → ${productViews.length} productViews (expected 1)`);
  expect(addCarts.length).toBe(1);
  expect(productViews.length).toBe(1);
});

// ════════════════════════════════════════════════════════════════════════════
// FLOW 5: Final compliance report
// ════════════════════════════════════════════════════════════════════════════

test('FLOW 5 — Final Adobe official compliance report', async ({ page }) => {
  const calls = captureBeacons(page);

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║   FLOW 5: ADOBE OFFICIAL COMPLIANCE REPORT                  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  // Push one of EVERY event type to verify XDM compliance
  const eventTests = [
    { event: 'Product viewed', attrs: { product_id: 'P1', product_name: 'Test1', product_price: 99, product_category: 'Cat' }, expected: 'commerce.productViews', validator: validateProductView },
    { event: 'Add to cart', attrs: { product_id: 'P2', product_name: 'Test2', product_price: 99, product_quantity: 1, currency: 'USD' }, expected: 'commerce.productListAdds', validator: validateAddToCart },
    { event: 'Remove from cart', attrs: { product_id: 'P2', quantity_removed: 1 }, expected: 'commerce.productListRemovals', validator: validateRemoveFromCart },
    { event: 'View cart', attrs: { cart_total: 99, item_count: 1, item_0_id: 'P2', item_0_qty: 1, item_0_price: 99 }, expected: 'commerce.productListViews', validator: validateViewCart },
    { event: 'BeginCheckout', attrs: { cart_total: 99, item_count: 1, currency: 'USD', item_0_id: 'P2', item_0_name: 'T', item_0_qty: 1, item_0_price: 99 }, expected: 'commerce.checkouts', validator: validateBeginCheckout },
    { event: 'User logged in', attrs: { user_id: 'flow5@t.com', user_email: 'flow5@t.com', user_type: 'registered', customer_tier: 'gold' }, expected: null, validator: validateUserLogin },
  ];

  const results = [];

  for (const t of eventTests) {
    const before = calls.length;
    await pushDl(page, { event: t.event, attributes: t.attrs }, 2500);
    const newEvents = getEvents(calls.slice(before));

    let event;
    if (t.expected) {
      event = newEvents.find(e => e.eventType === t.expected);
    } else {
      event = newEvents.find(e => e.identityMap?.Email);
    }

    const errors = event ? t.validator(event) : [`No ${t.expected || 'identity'} event fired`];
    const status = event && errors.length === 0 ? 'PASS' : 'FAIL';
    results.push({ event: t.event, expected: t.expected || 'identityMap', status, errors });
  }

  console.log('\n┌─────────────────────────────────┬──────────────────────────────────┬────────┐');
  console.log('│ Event                           │ XDM eventType                    │ Status │');
  console.log('├─────────────────────────────────┼──────────────────────────────────┼────────┤');
  results.forEach(r => {
    console.log(`│ ${r.event.padEnd(31)} │ ${(r.expected || 'identityMap').padEnd(32)} │ ${r.status.padEnd(6)} │`);
  });
  console.log('└─────────────────────────────────┴──────────────────────────────────┴────────┘');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;

  console.log(`\n  Adobe Official Compliance: ${passed}/${results.length} events PASS`);

  if (failed > 0) {
    console.log('\n  FAILURES:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`    ✗ ${r.event}`);
      r.errors.forEach(e => console.log(`        - ${e}`));
    });
  }

  expect(failed).toBe(0);
});
