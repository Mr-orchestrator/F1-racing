// @ts-check
// Verifies the Purchase event fires on the CONFIRMATION page only and that
// gridboxLayer.product is cleared there. Run against local build:
//   BASE_URL=http://localhost:3000 npx playwright test confirmation-purchase --project=chromium
const { test, expect } = require('@playwright/test');

const ORDER = {
  orderNumber: 'RF1-2024-TEST01',
  email: 'buyer@example.com',
  shipping: { firstName: 'Test', lastName: 'Buyer', address: '1 Pit Lane', city: 'Monza', state: 'MB', zip: '20900', country: 'IT' },
  shippingMethod: 'standard', shippingPrice: 9.99,
  items: [
    { id: 'RB-JKT-2024', name: '2024 Team Jacket', price: 159.99, category: 'Apparel', brand: 'Red Bull', image: 'x.png', quantity: 1 },
    { id: 'FER-CAP-LC16', name: 'Leclerc Signature Cap', price: 45.00, category: 'Accessories', brand: 'Ferrari', image: 'y.png', quantity: 2 }
  ],
  subtotal: 249.99, tax: 20.62, total: 280.60, date: new Date().toISOString(),
  userId: 'buyer@example.com', userName: 'Test Buyer'
};

test('Purchase fires on confirmation page and clears gridboxLayer.product', async ({ page }) => {
  // Seed the stored order, clear any prior "fired" guard + cart, then load confirmation.
  await page.goto('/confirmation', { waitUntil: 'networkidle' });
  await page.evaluate((order) => {
    localStorage.setItem('rf1_last_order', JSON.stringify(order));
    localStorage.removeItem('rf1_purchase_fired_' + order.orderNumber);
    localStorage.removeItem('rf1_cart');
  }, ORDER);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const result = await page.evaluate(() => {
    const adl = window.adobeDataLayer || [];
    const purchase = adl.filter((e) => /purchase/i.test(e.event || ''));
    const last = purchase[purchase.length - 1] || null;
    const txn = window.gridboxLayer && window.gridboxLayer.transaction ? window.gridboxLayer.transaction : {};
    return {
      purchaseCount: purchase.length,
      purchaseAttrs: last ? Object.keys(last.attributes || {}) : [],
      txnId: txn.transactionID || (last && last.attributes && last.attributes.transaction_id),
      txnItemCount: txn.item ? txn.item.length : 0,
      productLen: (window.gridboxLayer && window.gridboxLayer.product) ? window.gridboxLayer.product.length : -1,
    };
  });
  console.log('CONFIRMATION RESULT >>>', JSON.stringify(result, null, 2));

  expect(result.purchaseCount, 'exactly one Purchase event should fire on confirmation').toBe(1);
  expect(result.txnId, 'transaction id should match the order').toContain('RF1-2024-TEST01');
  expect(result.txnItemCount, 'transaction should carry both line items').toBe(2);
  expect(result.productLen, 'gridboxLayer.product must be cleared on confirmation').toBe(0);

  // Refresh must NOT fire a second Purchase (dedup guard).
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const afterRefresh = await page.evaluate(() => (window.adobeDataLayer || []).filter((e) => /purchase/i.test(e.event || '')).length);
  expect(afterRefresh, 'refresh should not re-fire Purchase').toBe(0);
});
