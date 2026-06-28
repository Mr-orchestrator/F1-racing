// @ts-check
// Validates a9 rules: Remove from Cart, Begin Checkout, Product Viewed
// BASE_URL=https://racing-f1-rho.vercel.app npx playwright test a9-rules-validation --project=chromium
const { test, expect } = require('@playwright/test');

function captureBeacons(page) {
  const beacons = [];
  page.on('response', async (res) => {
    const url = res.url();
    if (/\/b\/ss\//.test(url)) {
      const u = new URL(url);
      beacons.push({
        events:     u.searchParams.get('events') || '',
        products:   decodeURIComponent(u.searchParams.get('products') || ''),
        pe:         u.searchParams.get('pe') || '',
        pev2:       decodeURIComponent(u.searchParams.get('pev2') || ''),
        cc:         u.searchParams.get('cc') || '',
        v3:         u.searchParams.get('v3') || '',
        v4:         u.searchParams.get('v4') || '',
        v5:         u.searchParams.get('v5') || '',
        status:     res.status(),
      });
    }
  });
  return beacons;
}

test('Product Viewed fires event1 with products string', async ({ page }) => {
  const beacons = captureBeacons(page);
  await page.goto('/merchandise', { waitUntil: 'networkidle' });

  // Trigger Product viewed via the datalayer API directly
  await page.evaluate(() => {
    window.adobeDataLayer = window.adobeDataLayer || [];
    window.adobeDataLayer.push({
      event: 'Product viewed',
      attributes: {
        product_id: 'RB-JKT-2024',
        product_name: '2024 Team Jacket',
        product_category: 'Apparel',
        product_price: 159.99,
        product_brand: 'Red Bull',
        PageID: 'merchandise'
      },
      page: { pageInfo: { pageName: 'merchandise' }, category: { pageType: 'plp' } }
    });
  });

  await page.waitForTimeout(3000);
  console.log('PRODUCT VIEWED BEACONS >>>', JSON.stringify(beacons.filter(b => b.events || b.products), null, 2));

  const pv = beacons.find(b => b.events === 'event1');
  expect(pv, 'Product Viewed should fire event1').toBeTruthy();
  expect(pv.products, 'products should contain product id').toContain('RB-JKT-2024');
  expect(pv.pe, 'should be s.tl() link call').toBe('lnk_o');
  expect(pv.status).toBe(200);
});

test('Remove from Cart fires scRemove with product id', async ({ page }) => {
  const beacons = captureBeacons(page);
  await page.goto('/cart', { waitUntil: 'networkidle' });

  await page.evaluate(() => {
    window.adobeDataLayer = window.adobeDataLayer || [];
    window.adobeDataLayer.push({
      event: 'Remove from cart',
      attributes: {
        product_id: 'RB-JKT-2024',
        product_name: '2024 Team Jacket',
        quantity_removed: 1,
        cart_total: 0,
        item_count: 0,
        PageID: 'cart'
      },
      page: { pageInfo: { pageName: 'cart' }, category: { pageType: 'cart' } }
    });
  });

  await page.waitForTimeout(3000);
  console.log('REMOVE FROM CART BEACONS >>>', JSON.stringify(beacons.filter(b => b.events || b.products), null, 2));

  const rc = beacons.find(b => b.events === 'scRemove');
  expect(rc, 'Remove from Cart should fire scRemove').toBeTruthy();
  expect(rc.products, 'products should contain product id').toContain('RB-JKT-2024');
  expect(rc.pe).toBe('lnk_o');
  expect(rc.status).toBe(200);
});

test('Begin Checkout fires scCheckout with all line items', async ({ page }) => {
  const beacons = captureBeacons(page);
  await page.goto('/checkout', { waitUntil: 'networkidle' });

  await page.evaluate(() => {
    window.adobeDataLayer = window.adobeDataLayer || [];
    window.adobeDataLayer.push({
      event: 'BeginCheckout',
      attributes: {
        cart_total: 249.99,
        item_count: 2,
        currency: 'USD',
        item_0_id: 'RB-JKT-2024',
        item_0_name: '2024 Team Jacket',
        item_0_qty: 1,
        item_0_price: 159.99,
        item_1_id: 'FER-CAP-LC16',
        item_1_name: 'Leclerc Signature Cap',
        item_1_qty: 2,
        item_1_price: 45.00,
        PageID: 'checkout'
      },
      page: { pageInfo: { pageName: 'checkout' }, category: { pageType: 'checkout' } }
    });
  });

  await page.waitForTimeout(3000);
  console.log('BEGIN CHECKOUT BEACONS >>>', JSON.stringify(beacons.filter(b => b.events || b.products), null, 2));

  const co = beacons.find(b => b.events === 'scCheckout');
  expect(co, 'Begin Checkout should fire scCheckout').toBeTruthy();
  expect(co.products, 'products should contain first item').toContain('RB-JKT-2024');
  expect(co.products, 'products should contain second item').toContain('FER-CAP-LC16');
  expect(co.pe).toBe('lnk_o');
  expect(co.status).toBe(200);
});
