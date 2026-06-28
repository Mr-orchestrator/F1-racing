// @ts-check
// Verify the NEW index-consumption logic in xdm-data-element-FINAL.js
// SPECIFICALLY tests the Add to Cart click cascade where 3 events fire in sequence
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.setTimeout(60000);

const XDM_CODE = fs.readFileSync(
  path.join(__dirname, '..', 'docs', 'analytics', 'xdm-data-element-FINAL.js'),
  'utf8'
);

test('CRITICAL — Add to Cart cascade fires distinct XDM types for each rule', async ({ page }) => {
  await page.goto('https://racing-f1-rho.vercel.app/', { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  const result = await page.evaluate((code) => {
    // Reset
    window.adobeDataLayer = [];
    delete window.__dlConsumedIndex;

    // Simulate the exact site behavior — 3 events pushed synchronously
    window.adobeDataLayer.push({ event: 'add to cart', attributes: { product_id: 'RB-JKT-2024' } });  // lowercase from gridbox.track (no rule)
    window.adobeDataLayer.push({ event: 'Product viewed', attributes: { product_id: 'RB-JKT-2024', product_name: '2024 Team Jacket', product_price: 159.99, product_category: 'Apparel' } });
    window.adobeDataLayer.push({ event: 'Add to cart', attributes: { product_id: 'RB-JKT-2024', product_name: '2024 Team Jacket', product_price: 159.99, product_quantity: 1, currency: 'USD' } });

    // Now simulate ACDL firing rules in order — data element evaluates each time
    var results = [];
    var fn = new Function(code);

    // Invocation 1: Product viewed rule fires (ACDL processed event 2 in DL order)
    // Lowercase "add to cart" first (no rule), then Product viewed → triggers rule
    var xdm1 = fn();
    results.push({ invocation: 1, eventType: xdm1.eventType, commerce: xdm1.commerce ? Object.keys(xdm1.commerce) : null, productSKU: xdm1.productListItems?.[0]?.SKU });

    // Invocation 2: Add to cart rule fires
    var xdm2 = fn();
    results.push({ invocation: 2, eventType: xdm2.eventType, commerce: xdm2.commerce ? Object.keys(xdm2.commerce) : null, productSKU: xdm2.productListItems?.[0]?.SKU });

    return { results, finalConsumedIndex: window.__dlConsumedIndex };
  }, XDM_CODE);

  console.log('\n=== Add to Cart Click Cascade Test ===');
  console.log(`Final consumed index: ${result.finalConsumedIndex}`);
  result.results.forEach(r => {
    console.log(`\n  Invocation ${r.invocation}:`);
    console.log(`    eventType: ${r.eventType}`);
    console.log(`    commerce:  ${JSON.stringify(r.commerce)}`);
    console.log(`    SKU:       ${r.productSKU}`);
  });

  // Invocation 1 must be Product viewed (commerce.productViews)
  expect(result.results[0].eventType).toBe('commerce.productViews');
  expect(result.results[0].commerce).toContain('productViews');

  // Invocation 2 must be Add to cart (commerce.productListAdds)
  expect(result.results[1].eventType).toBe('commerce.productListAdds');
  expect(result.results[1].commerce).toContain('productListAdds');

  console.log('\n  ✓ Each rule invocation returns the correct, distinct XDM type');
});

test('Purchase race condition — Purchase rule wins over ClearCart pushed after', async ({ page }) => {
  await page.goto('https://racing-f1-rho.vercel.app/', { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  const result = await page.evaluate((code) => {
    window.adobeDataLayer = [];
    delete window.__dlConsumedIndex;

    // Simulate Purchase flow — Purchase pushed, then ClearCart (deferred by 150ms via setTimeout)
    window.adobeDataLayer.push({ event: 'PageView', attributes: {} });
    window.adobeDataLayer.push({ event: 'Purchase', attributes: { transaction_id: 'RACE-TEST-001', transaction_total: 199.99, currency: 'USD', item_count: 1, item_0_id: 'RB-JKT-2024', item_0_name: 'Jacket', item_0_qty: 1, item_0_price: 199.99 } });
    window.adobeDataLayer.push({ event: 'ClearCart', attributes: {} });

    var fn = new Function(code);
    var results = [];

    // Invocation 1: Page Load rule (Library Loaded) - should get PageView
    var xdm1 = fn();
    results.push({ invocation: 1, name: 'Library Loaded rule', eventType: xdm1.eventType });

    // Invocation 2: Purchase rule fires
    var xdm2 = fn();
    results.push({ invocation: 2, name: 'Purchase rule', eventType: xdm2.eventType, purchaseID: xdm2.commerce?.order?.purchaseID });

    // Invocation 3: ClearCart rule fires (delayed 150ms via setTimeout but in test fired in order)
    var xdm3 = fn();
    results.push({ invocation: 3, name: 'ClearCart rule', eventType: xdm3.eventType });

    return results;
  }, XDM_CODE);

  console.log('\n=== Purchase Race Condition Test ===');
  result.forEach(r => {
    console.log(`\n  Invocation ${r.invocation} (${r.name}):`);
    console.log(`    eventType: ${r.eventType}`);
    if (r.purchaseID) console.log(`    purchaseID: ${r.purchaseID}`);
  });

  expect(result[0].eventType).toBe('web.webpagedetails.pageViews');
  expect(result[1].eventType).toBe('commerce.purchases');
  expect(result[1].purchaseID).toBe('RACE-TEST-001');
  expect(result[2].eventType).toBe('commerce.productListRemovals');

  console.log('\n  ✓ Purchase returns commerce.purchases (not ClearCart)');
  console.log('  ✓ ClearCart returns commerce.productListRemovals');
});

test('All 22 event types — each maps to correct XDM eventType', async ({ page }) => {
  await page.goto('https://racing-f1-rho.vercel.app/', { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  const eventCases = [
    { event: 'Page Loaded', expected: 'web.webpagedetails.pageViews' },
    { event: 'Product viewed', expected: 'commerce.productViews', attrs: { product_id: 'P1', product_name: 'Test', product_price: 99, product_category: 'Cat' } },
    { event: 'Add to cart', expected: 'commerce.productListAdds', attrs: { product_id: 'P2', product_name: 'T', product_price: 99, product_quantity: 1, currency: 'USD' } },
    { event: 'Remove from cart', expected: 'commerce.productListRemovals', attrs: { product_id: 'P2', quantity_removed: 1 } },
    { event: 'View cart', expected: 'commerce.productListViews', attrs: { cart_total: 99, item_count: 1, item_0_id: 'P2', item_0_qty: 1, item_0_price: 99 } },
    { event: 'BeginCheckout', expected: 'commerce.checkouts', attrs: { cart_total: 99, item_count: 1, currency: 'USD', item_0_id: 'P2', item_0_name: 'T', item_0_qty: 1, item_0_price: 99 } },
    { event: 'Purchase', expected: 'commerce.purchases', attrs: { transaction_id: 'T1', transaction_total: 99, currency: 'USD', item_count: 1, item_0_id: 'P2', item_0_name: 'T', item_0_qty: 1, item_0_price: 99 } },
    { event: 'Purchase completed', expected: 'commerce.purchases', attrs: { transaction_id: 'T2', transaction_total: 99, currency: 'USD', item_count: 1, item_0_id: 'P3', item_0_name: 'T2', item_0_qty: 1, item_0_price: 99 } },
    { event: 'ClearCart', expected: 'commerce.productListRemovals', attrs: {} },
    { event: 'User logged in', expected: 'web.webinteraction.linkClicks', attrs: { user_id: 'u@t.com', user_email: 'u@t.com', user_type: 'registered', customer_tier: 'gold' } },
    { event: 'User logged out', expected: 'web.webinteraction.linkClicks', attrs: { user_id: 'u@t.com' } },
    { event: 'User signed up', expected: 'web.webinteraction.linkClicks', attrs: { user_id: 'new@t.com', user_email: 'new@t.com' } },
    { event: 'Search performed', expected: 'web.webinteraction.linkClicks', attrs: { search_term: 'test' } },
    { event: 'Promo code applied', expected: 'web.webinteraction.linkClicks', attrs: { promo_code: 'SAVE10' } },
    { event: 'Race details viewed', expected: 'web.webinteraction.linkClicks', attrs: { race_name: 'Monaco' } },
    { event: 'Race selected', expected: 'web.webinteraction.linkClicks', attrs: { race_name: 'Monaco' } },
    { event: 'Ticket type selected', expected: 'web.webinteraction.linkClicks', attrs: { ticket_type: 'VIP' } },
    { event: 'Seat selected', expected: 'web.webinteraction.linkClicks', attrs: { seat_id: 'A1' } },
    { event: 'Team profile viewed', expected: 'web.webinteraction.linkClicks', attrs: { team_name: 'Ferrari' } },
    { event: 'Experience booked', expected: 'commerce.checkouts', attrs: { experience_name: 'Pit Walk' } },
    { event: 'Hospitality package selected', expected: 'web.webinteraction.linkClicks', attrs: { package_name: 'VIP' } },
    { event: 'Error occurred', expected: 'web.webinteraction.linkClicks', attrs: { error_type: 'test', ga_errorMessage: 'oops' } },
  ];

  const results = await page.evaluate((args) => {
    var fn = new Function(args.code);
    var out = [];
    args.cases.forEach(tc => {
      // Reset for each test - simulate single isolated event
      window.adobeDataLayer = [];
      delete window.__dlConsumedIndex;
      window.adobeDataLayer.push({ event: tc.event, attributes: tc.attrs || {} });
      var xdm = fn();
      out.push({ event: tc.event, expected: tc.expected, actual: xdm.eventType });
    });
    return out;
  }, { cases: eventCases, code: XDM_CODE });

  console.log('\n=== All 22 Event Types Mapping ===');
  let passed = 0;
  let failed = 0;
  results.forEach(r => {
    const ok = r.actual === r.expected;
    if (ok) passed++; else failed++;
    console.log(`  ${ok ? '✓' : '✗'} ${r.event.padEnd(35)} → ${r.actual}`);
  });

  console.log(`\n  Total: ${passed}/${results.length} PASS, ${failed} FAIL`);
  expect(failed).toBe(0);
});

test('User Login produces valid identityMap', async ({ page }) => {
  await page.goto('https://racing-f1-rho.vercel.app/', { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  const result = await page.evaluate((code) => {
    window.adobeDataLayer = [];
    delete window.__dlConsumedIndex;
    window.adobeDataLayer.push({
      event: 'User logged in',
      attributes: { user_id: 'login@test.com', user_email: 'login@test.com', user_type: 'registered', customer_tier: 'gold' }
    });
    var fn = new Function(code);
    return fn();
  }, XDM_CODE);

  console.log('\n=== User Login identityMap ===');
  console.log(`  identityMap: ${JSON.stringify(result.identityMap, null, 2)}`);
  console.log(`  eVar6 (login_status): ${result._experience?.analytics?.customDimensions?.eVars?.eVar6}`);
  console.log(`  eVar7 (user_type):    ${result._experience?.analytics?.customDimensions?.eVars?.eVar7}`);
  console.log(`  eVar8 (tier):         ${result._experience?.analytics?.customDimensions?.eVars?.eVar8}`);

  expect(result.identityMap).toBeTruthy();
  expect(result.identityMap.Email).toHaveLength(1);
  expect(result.identityMap.Email[0].authenticatedState).toBe('authenticated');
  expect(result.identityMap.Email[0].id).toBe('login@test.com');
  expect(result._experience.analytics.customDimensions.eVars.eVar6).toBe('true');
});
