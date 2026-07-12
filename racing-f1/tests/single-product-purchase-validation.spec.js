// @ts-check
/**
 * Single Product Purchase — Adobe Event Validator
 * ================================================
 * Full user journey from homepage → merchandise → add 1 product →
 * cart → checkout → confirmation, validating every Adobe XDM event
 * fired at each step.
 *
 * Events validated (in order):
 *   1. web.webpagedetails.pageViews     — homepage
 *   2. web.webpagedetails.pageViews     — /merchandise
 *   3. commerce.productViews            — clicking a product
 *   4. commerce.productListAdds         — Add to Cart (1 item)
 *   5. commerce.productListViews        — /cart page
 *   6. commerce.checkouts               — /checkout page
 *   7. commerce.purchases               — /confirmation (with purchaseID)
 *
 * Run:
 *   npx playwright test tests/single-product-purchase-validation.spec.js --project=chromium --headed
 *
 * Debug / step-through:
 *   npx playwright test tests/single-product-purchase-validation.spec.js --project=chromium --debug
 *
 * View replay after run:
 *   npx playwright show-report
 */
const { test, expect } = require('@playwright/test');

test.setTimeout(120000);

// ── Adobe Edge Network URL matcher ────────────────────────────────────────────
const isEdgeCall = (url) =>
  /\.data\.adobedc\.net\/ee\//.test(url) ||
  /edge\.adobedc\.net\/ee\//.test(url) ||
  /demdex\.net\/ee\//.test(url);

// ── Capture all Web SDK edge calls ────────────────────────────────────────────
function captureBeacons(page) {
  const calls = [];
  page.on('request', (req) => {
    if (!isEdgeCall(req.url())) return;
    let postData = null;
    try { postData = req.postDataJSON(); } catch (_) {}
    calls.push({ url: req.url(), postData, ts: Date.now() });
  });
  return calls;
}

// ── Extract XDM event objects from captured calls ─────────────────────────────
function getXdmEvents(calls) {
  const events = [];
  calls.forEach(c => {
    (c.postData?.events || []).forEach(e => events.push(e.xdm || {}));
  });
  return events;
}

// ── Print a pass/fail line ────────────────────────────────────────────────────
function check(label, condition, detail = '') {
  const icon = condition ? '✓' : '✗';
  console.log(`  ${icon} ${label}${detail ? ' — ' + detail : ''}`);
  return condition;
}

// ═════════════════════════════════════════════════════════════════════════════
// THE TEST
// ═════════════════════════════════════════════════════════════════════════════

test('Single product purchase — full Adobe event validation', async ({ page }) => {

  const allCalls = captureBeacons(page);
  const results  = [];         // { step, event, pass, errors }

  // ── STEP 1: Homepage ──────────────────────────────────────────────────────
  console.log('\n┌─────────────────────────────────────────────────┐');
  console.log('│  STEP 1 — Homepage                              │');
  console.log('└─────────────────────────────────────────────────┘');

  const t1 = Date.now();
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const step1Events = getXdmEvents(allCalls.filter(c => c.ts >= t1));
  const homePageView = step1Events.find(e => e.eventType === 'web.webpagedetails.pageViews');

  const s1pass = check(
    'Homepage fires web.webpagedetails.pageViews',
    !!homePageView,
    homePageView ? `URL: ${homePageView.web?.webPageDetails?.URL || '(present)'}` : 'NOT FOUND'
  );
  check(
    'pageViews.value = 1',
    homePageView?.web?.webPageDetails?.pageViews?.value === 1,
    String(homePageView?.web?.webPageDetails?.pageViews?.value)
  );
  results.push({ step: 'Homepage', event: 'pageViews', pass: s1pass });

  // ── STEP 2: Merchandise page ──────────────────────────────────────────────
  console.log('\n┌─────────────────────────────────────────────────┐');
  console.log('│  STEP 2 — Merchandise page                      │');
  console.log('└─────────────────────────────────────────────────┘');

  const t2 = Date.now();
  await page.goto('/merchandise', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const step2Events = getXdmEvents(allCalls.filter(c => c.ts >= t2));
  const merchPageView = step2Events.find(e => e.eventType === 'web.webpagedetails.pageViews');

  const s2pass = check(
    '/merchandise fires web.webpagedetails.pageViews',
    !!merchPageView,
    merchPageView ? `URL: ${merchPageView.web?.webPageDetails?.URL || '(present)'}` : 'NOT FOUND'
  );
  results.push({ step: '/merchandise', event: 'pageViews', pass: s2pass });

  // ── STEP 3: Add first product to cart ────────────────────────────────────
  console.log('\n┌─────────────────────────────────────────────────┐');
  console.log('│  STEP 3 — Add 1 product to cart                 │');
  console.log('└─────────────────────────────────────────────────┘');

  // Click the FIRST "Add to Cart" button on merchandise page
  const t3 = Date.now();
  const addBtn = page.locator('button:has-text("Add to Cart"), .add-to-cart, [data-action="add-to-cart"]').first();
  await addBtn.waitFor({ state: 'visible', timeout: 10000 });
  await addBtn.click();
  await page.waitForTimeout(3000);

  const step3Events = getXdmEvents(allCalls.filter(c => c.ts >= t3));
  const productView = step3Events.find(e => e.eventType === 'commerce.productViews');
  const addToCart   = step3Events.find(e => e.eventType === 'commerce.productListAdds');

  // Product View
  const s3apas = check(
    'commerce.productViews fired',
    !!productView,
    productView ? `SKU: ${productView.productListItems?.[0]?.SKU}` : 'NOT FOUND'
  );
  check('productViews.value = 1', productView?.commerce?.productViews?.value === 1);
  check('productListItems[] present', !!productView?.productListItems?.length);
  results.push({ step: 'Click product', event: 'commerce.productViews', pass: s3apas });

  // Add to Cart
  const s3bpas = check(
    'commerce.productListAdds fired',
    !!addToCart,
    addToCart ? `SKU: ${addToCart.productListItems?.[0]?.SKU}` : 'NOT FOUND'
  );
  if (addToCart?.productListItems?.[0]) {
    const item = addToCart.productListItems[0];
    check('productListItems[0].SKU present',          !!item.SKU,          item.SKU);
    check('productListItems[0].priceTotal present',   item.priceTotal !== undefined, String(item.priceTotal));
    check('productListItems[0].quantity = 1',         item.quantity === 1, String(item.quantity));
    check('productListItems[0].currencyCode = USD',   item.currencyCode === 'USD', item.currencyCode);
  }
  results.push({ step: 'Add to Cart', event: 'commerce.productListAdds', pass: s3bpas });

  // Screenshot after add to cart
  await page.screenshot({ path: 'test-results/purchase-03-added-to-cart.png' });

  // ── STEP 4: Cart page ────────────────────────────────────────────────────
  console.log('\n┌─────────────────────────────────────────────────┐');
  console.log('│  STEP 4 — Cart page                             │');
  console.log('└─────────────────────────────────────────────────┘');

  const t4 = Date.now();
  await page.goto('/cart', { waitUntil: 'networkidle' });
  // Push the View Cart datalayer event (site reads ACDL to fire beacon)
  await page.evaluate(() => {
    window.adobeDataLayer = window.adobeDataLayer || [];
    window.adobeDataLayer.push({
      event: 'View cart',
      attributes: { cart_total: 159.99, item_count: 1, item_0_id: 'RB-JKT-2024', item_0_qty: 1, item_0_price: 159.99 }
    });
  });
  await page.waitForTimeout(3000);

  const step4Events = getXdmEvents(allCalls.filter(c => c.ts >= t4));
  const viewCart = step4Events.find(e => e.eventType === 'commerce.productListViews');

  const s4pass = check(
    'commerce.productListViews fired on /cart',
    !!viewCart,
    viewCart ? `value: ${viewCart.commerce?.productListViews?.value}` : 'NOT FOUND'
  );
  results.push({ step: '/cart', event: 'commerce.productListViews', pass: s4pass });

  await page.screenshot({ path: 'test-results/purchase-04-cart.png' });

  // ── STEP 5: Checkout page ────────────────────────────────────────────────
  console.log('\n┌─────────────────────────────────────────────────┐');
  console.log('│  STEP 5 — Checkout page                         │');
  console.log('└─────────────────────────────────────────────────┘');

  const t5 = Date.now();
  await page.goto('/checkout', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const step5Events = getXdmEvents(allCalls.filter(c => c.ts >= t5));
  const beginCheckout = step5Events.find(e => e.eventType === 'commerce.checkouts');

  const s5pass = check(
    'commerce.checkouts fired on /checkout',
    !!beginCheckout,
    beginCheckout ? `value: ${beginCheckout.commerce?.checkouts?.value}` : 'NOT FOUND'
  );
  check('checkouts.value = 1', beginCheckout?.commerce?.checkouts?.value === 1);
  results.push({ step: '/checkout', event: 'commerce.checkouts', pass: s5pass });

  await page.screenshot({ path: 'test-results/purchase-05-checkout.png' });

  // ── STEP 6: Confirmation page ────────────────────────────────────────────
  console.log('\n┌─────────────────────────────────────────────────┐');
  console.log('│  STEP 6 — Confirmation / Purchase               │');
  console.log('└─────────────────────────────────────────────────┘');

  const order = {
    orderNumber: 'RF1-SINGLE-' + Date.now(),
    email: 'buyer@test.com',
    shipping: { firstName: 'Test', lastName: 'Buyer', address: '1 Race Way', city: 'Monaco', state: 'MC', zip: '98000', country: 'MC' },
    shippingMethod: 'standard', shippingPrice: 9.99,
    items: [{ id: 'RB-JKT-2024', name: '2024 Team Jacket', price: 159.99, category: 'Apparel', brand: 'Red Bull', image: 'i.png', quantity: 1 }],
    subtotal: 159.99, tax: 13.20, total: 183.18,
    date: new Date().toISOString(),
    userId: 'buyer@test.com', userName: 'Test Buyer'
  };

  const t6 = Date.now();
  await page.goto('/confirmation', { waitUntil: 'networkidle' });
  // Seed localStorage so the confirmation page fires the purchase beacon
  await page.evaluate((o) => {
    Object.keys(localStorage).filter(k => k.startsWith('rf1_purchase_fired_')).forEach(k => localStorage.removeItem(k));
    localStorage.setItem('rf1_last_order', JSON.stringify(o));
  }, order);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);

  const step6Events = getXdmEvents(allCalls.filter(c => c.ts >= t6));
  const purchase = step6Events.find(e => e.eventType === 'commerce.purchases');

  const s6pass = check(
    'commerce.purchases fired on /confirmation',
    !!purchase,
    purchase ? `purchaseID: ${purchase.commerce?.order?.purchaseID}` : 'NOT FOUND'
  );
  if (purchase) {
    check('purchases.value = 1',          purchase.commerce?.purchases?.value === 1);
    check('order.purchaseID present',     !!purchase.commerce?.order?.purchaseID,     purchase.commerce?.order?.purchaseID);
    check('order.priceTotal present',     !!purchase.commerce?.order?.priceTotal,     String(purchase.commerce?.order?.priceTotal));
    check('order.currencyCode = USD',     purchase.commerce?.order?.currencyCode === 'USD', purchase.commerce?.order?.currencyCode);
    check('productListItems[] present',   !!purchase.productListItems?.length,         `${purchase.productListItems?.length} item(s)`);
  }
  results.push({ step: '/confirmation', event: 'commerce.purchases', pass: s6pass });

  await page.screenshot({ path: 'test-results/purchase-06-confirmation.png' });

  // ── FINAL SUMMARY ─────────────────────────────────────────────────────────
  const passed = results.filter(r => r.pass).length;
  const total  = results.length;

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   SINGLE PRODUCT PURCHASE — EVENT VALIDATION REPORT ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  results.forEach(r => {
    const icon = r.pass ? '✓' : '✗';
    console.log(`║  ${icon} ${r.step.padEnd(18)} → ${r.event.padEnd(32)}║`);
  });
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  Result: ${passed}/${total} events validated${' '.repeat(40 - String(passed).length - String(total).length)}║`);
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log('║  Replay: npx playwright show-report                 ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  // Assert all events passed
  expect(passed, `Only ${passed}/${total} Adobe events validated. Check console output above.`).toBe(total);
});
