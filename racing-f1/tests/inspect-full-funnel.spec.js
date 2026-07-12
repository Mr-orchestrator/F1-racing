// @ts-check
// Full-funnel inspector — captures actual datalayer + XDM values for all events
const { test } = require('@playwright/test');
test.setTimeout(120000);

const isEdge = url =>
  /adobedc\.net\/ee\//.test(url) || /demdex\.net\/ee\//.test(url);

test('inspect full funnel', async ({ page }) => {
  const beacons = [];
  page.on('request', req => {
    if (!isEdge(req.url())) return;
    let d = null;
    try { d = req.postDataJSON(); } catch (_) {}
    beacons.push({ ts: Date.now(), data: d });
  });

  function xdmSince(t) {
    return beacons
      .filter(b => b.ts >= t)
      .flatMap(b => (b.data?.events || []).map(e => e.xdm || {}));
  }

  function acdlAll(page) {
    return page.evaluate(() =>
      (window.adobeDataLayer || [])
        .filter(x => x && x.event)
        .map(x => ({ event: x.event, attributes: x.attributes || {} }))
    );
  }

  function gl(page) {
    return page.evaluate(() => {
      const g = window.gridboxLayer;
      if (!g) return null;
      return { page: g.page, cart: g.cart, product: g.product };
    });
  }

  // ── 1. Homepage ──────────────────────────────────────────────────────────
  const t1 = Date.now();
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const xdm1  = xdmSince(t1);
  const acdl1 = await acdlAll(page);
  const gl1   = await gl(page);
  console.log('\n=== 1. HOMEPAGE ===');
  console.log('gridboxLayer.page:', JSON.stringify(gl1?.page, null, 2));
  console.log('ACDL events:', JSON.stringify(acdl1, null, 2));
  console.log('XDM events:', JSON.stringify(xdm1.map(e => ({ eventType: e.eventType, web: e.web, commerce: e.commerce, productListItems: e.productListItems })), null, 2));

  // ── 2. Merchandise page ──────────────────────────────────────────────────
  const t2 = Date.now();
  await page.goto('/merchandise', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const xdm2  = xdmSince(t2);
  const acdl2 = await acdlAll(page);
  const gl2   = await gl(page);
  console.log('\n=== 2. MERCHANDISE PAGE ===');
  console.log('gridboxLayer.page:', JSON.stringify(gl2?.page, null, 2));
  console.log('ACDL events:', JSON.stringify(acdl2, null, 2));
  console.log('XDM events:', JSON.stringify(xdm2.map(e => ({ eventType: e.eventType, web: e.web })), null, 2));

  // ── 3. Product viewed + Add to Cart ─────────────────────────────────────
  const btn = page.locator('button:has-text("Add to Cart"), .add-cart-btn').first();
  await btn.waitFor({ state: 'visible', timeout: 10000 });
  const t3 = Date.now();
  await btn.click();
  await page.waitForTimeout(4000);
  const xdm3  = xdmSince(t3);
  const acdl3 = await acdlAll(page);
  const gl3   = await gl(page);
  console.log('\n=== 3. PRODUCT VIEWED + ADD TO CART ===');
  console.log('gridboxLayer.cart:', JSON.stringify(gl3?.cart, null, 2));
  console.log('gridboxLayer.product:', JSON.stringify(gl3?.product, null, 2));
  console.log('ACDL events after click:', JSON.stringify(acdl3.slice(-5), null, 2));
  console.log('XDM events after click:', JSON.stringify(xdm3.map(e => ({ eventType: e.eventType, commerce: e.commerce, productListItems: e.productListItems })), null, 2));

  // ── 4. Cart page ─────────────────────────────────────────────────────────
  const t4 = Date.now();
  await page.goto('/cart', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    window.adobeDataLayer = window.adobeDataLayer || [];
    window.adobeDataLayer.push({
      event: 'View cart',
      attributes: { cart_total: '159.99', item_count: '1', product_id: 'RB-JKT-2024', product_quantity: '1', product_price: '159.99', currency: 'USD' }
    });
  });
  await page.waitForTimeout(3000);
  const xdm4  = xdmSince(t4);
  const acdl4 = await acdlAll(page);
  const gl4   = await gl(page);
  console.log('\n=== 4. CART PAGE ===');
  console.log('gridboxLayer.page:', JSON.stringify(gl4?.page, null, 2));
  console.log('ACDL events (last 3):', JSON.stringify(acdl4.slice(-3), null, 2));
  console.log('XDM events:', JSON.stringify(xdm4.map(e => ({ eventType: e.eventType, commerce: e.commerce, productListItems: e.productListItems })), null, 2));

  // ── 5. Checkout ──────────────────────────────────────────────────────────
  const t5 = Date.now();
  await page.goto('/checkout', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const xdm5  = xdmSince(t5);
  const acdl5 = await acdlAll(page);
  const gl5   = await gl(page);
  console.log('\n=== 5. CHECKOUT ===');
  console.log('gridboxLayer.page:', JSON.stringify(gl5?.page, null, 2));
  console.log('ACDL events (last 3):', JSON.stringify(acdl5.slice(-3), null, 2));
  console.log('XDM events:', JSON.stringify(xdm5.map(e => ({ eventType: e.eventType, commerce: e.commerce, productListItems: e.productListItems })), null, 2));

  // ── 6. Confirmation / Purchase ───────────────────────────────────────────
  const order = {
    orderNumber: 'RF1-INSPECT-001',
    email: 'buyer@test.com',
    shipping: { firstName: 'Test', lastName: 'Buyer', address: '1 Race Way', city: 'Monaco', state: 'MC', zip: '98000', country: 'MC' },
    shippingMethod: 'standard', shippingPrice: 9.99,
    items: [{ id: 'RB-JKT-2024', name: '2024 Team Jacket', price: 159.99, category: 'Apparel', brand: 'Red Bull Racing', image: 'i.png', quantity: 1 }],
    subtotal: 159.99, tax: 13.20, total: 183.18,
    date: new Date().toISOString(), userId: 'buyer@test.com', userName: 'Test Buyer'
  };
  await page.goto('/confirmation', { waitUntil: 'networkidle' });
  await page.evaluate(o => {
    Object.keys(localStorage).filter(k => k.startsWith('rf1_purchase_fired_')).forEach(k => localStorage.removeItem(k));
    localStorage.setItem('rf1_last_order', JSON.stringify(o));
  }, order);
  const t6 = Date.now();
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);
  const xdm6  = xdmSince(t6);
  const acdl6 = await acdlAll(page);
  const gl6   = await gl(page);
  console.log('\n=== 6. CONFIRMATION / PURCHASE ===');
  console.log('gridboxLayer.page:', JSON.stringify(gl6?.page, null, 2));
  console.log('ACDL events (last 3):', JSON.stringify(acdl6.slice(-3), null, 2));
  console.log('XDM events:', JSON.stringify(xdm6.map(e => ({ eventType: e.eventType, commerce: e.commerce, productListItems: e.productListItems })), null, 2));
});
