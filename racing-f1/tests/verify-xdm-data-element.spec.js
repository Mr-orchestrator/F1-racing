// @ts-check
// VERIFY the new XDM data element code WITHOUT publishing to Launch
// Loads code into browser and runs it against real adobeDataLayer events
const { test, expect } = require('@playwright/test');

test.setTimeout(120000);

// The PROPOSED new XDM data element code (will be tested)
const PROPOSED_CODE = `
var triggeringEvent = null;

if (typeof simulatedEvent !== 'undefined' && simulatedEvent && simulatedEvent.message) {
  triggeringEvent = simulatedEvent.message;
}

if (!triggeringEvent || !triggeringEvent.event) {
  var dl = window.adobeDataLayer || [];
  var commerceEvents = ['Purchase', 'Purchase completed', 'Add to cart',
                       'Remove from cart', 'View cart', 'BeginCheckout',
                       'Product viewed', 'ClearCart'];

  for (var i = dl.length - 1; i >= Math.max(0, dl.length - 3); i--) {
    if (dl[i] && commerceEvents.indexOf(dl[i].event) !== -1) {
      triggeringEvent = dl[i];
      break;
    }
  }

  if (!triggeringEvent) {
    for (var j = dl.length - 1; j >= 0; j--) {
      if (dl[j] && dl[j].event) { triggeringEvent = dl[j]; break; }
    }
  }
}

var eventName = triggeringEvent ? triggeringEvent.event : 'Page Loaded';
var attrs = triggeringEvent ? (triggeringEvent.attributes || {}) : {};
var page = triggeringEvent ? (triggeringEvent.page || {}) : {};
var pageInfo = page.pageInfo || {};

var eventTypeMap = {
  'Page Loaded': 'web.webpagedetails.pageViews',
  'Page View': 'web.webpagedetails.pageViews',
  'Product viewed': 'commerce.productViews',
  'Add to cart': 'commerce.productListAdds',
  'Remove from cart': 'commerce.productListRemovals',
  'View cart': 'commerce.productListViews',
  'BeginCheckout': 'commerce.checkouts',
  'Purchase': 'commerce.purchases',
  'Purchase completed': 'commerce.purchases',
  'User logged in': 'web.webinteraction.linkClicks',
  'Search performed': 'web.webinteraction.linkClicks',
  'Race details viewed': 'web.webinteraction.linkClicks',
  'Team profile viewed': 'web.webinteraction.linkClicks',
  'ClearCart': 'commerce.productListRemovals'
};

var xdm = {
  eventType: eventTypeMap[eventName] || 'web.webpagedetails.pageViews',
  timestamp: new Date().toISOString(),
  web: {
    webPageDetails: {
      name: pageInfo.pageName || document.title || 'unknown',
      URL: pageInfo.pageURL || window.location.href,
      pageViews: { value: 1 }
    },
    webReferrer: { URL: document.referrer || '' }
  },
  _experience: { analytics: { customDimensions: { eVars: {} } } }
};

if (eventName === 'Add to cart') {
  xdm.commerce = { productListAdds: { value: 1 } };
  xdm.productListItems = [{
    SKU: attrs.product_id || '',
    name: attrs.product_name || '',
    priceTotal: parseFloat(attrs.product_price) || 0,
    quantity: parseInt(attrs.product_quantity) || 1,
    currencyCode: attrs.currency || 'USD'
  }];
}

if (eventName === 'Product viewed') {
  xdm.commerce = { productViews: { value: 1 } };
  xdm.productListItems = [{
    SKU: attrs.product_id || '',
    name: attrs.product_name || '',
    priceTotal: parseFloat(attrs.product_price) || 0,
    currencyCode: 'USD'
  }];
}

if (eventName === 'Remove from cart' || eventName === 'ClearCart') {
  xdm.commerce = { productListRemovals: { value: 1 } };
}

if (eventName === 'BeginCheckout') {
  xdm.commerce = { checkouts: { value: 1 } };
}

if (eventName === 'Purchase' || eventName === 'Purchase completed') {
  xdm.commerce = {
    purchases: { value: 1 },
    order: {
      purchaseID: attrs.transaction_id || '',
      priceTotal: parseFloat(attrs.transaction_total) || 0,
      currencyCode: 'USD'
    }
  };
}

return { xdm: xdm, eventName: eventName, triggeringEvent: triggeringEvent };
`;

test('SCENARIO 1: Verify on home page (initial load)', async ({ page }) => {
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  const result = await page.evaluate((code) => {
    var fn = new Function('simulatedEvent', code);
    return fn(undefined);
  }, PROPOSED_CODE);

  console.log('\n[Home page initial load]');
  console.log(`  Resolved eventName: ${result.eventName}`);
  console.log(`  XDM eventType:      ${result.xdm.eventType}`);
  console.log(`  Page name:          ${result.xdm.web.webPageDetails.name}`);

  expect(result.xdm.eventType).toBe('web.webpagedetails.pageViews');
});

test('SCENARIO 2: Add to Cart event triggers commerce.productListAdds', async ({ page }) => {
  await page.goto('/merchandise', { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  const result = await page.evaluate((code) => {
    var simulatedEvent = {
      message: {
        event: 'Add to cart',
        attributes: { product_id: 'RB-JKT-2024', product_name: '2024 Jacket', product_price: 159.99, product_quantity: 1 }
      }
    };
    var fn = new Function('simulatedEvent', code);
    return fn(simulatedEvent);
  }, PROPOSED_CODE);

  console.log('\n[Add to Cart simulated rule trigger]');
  console.log(`  Resolved eventName: ${result.eventName}`);
  console.log(`  XDM eventType:      ${result.xdm.eventType}`);
  console.log(`  Product SKU:        ${result.xdm.productListItems?.[0]?.SKU}`);
  console.log(`  Product price:      ${result.xdm.productListItems?.[0]?.priceTotal}`);

  expect(result.eventName).toBe('Add to cart');
  expect(result.xdm.eventType).toBe('commerce.productListAdds');
  expect(result.xdm.productListItems[0].SKU).toBe('RB-JKT-2024');
  expect(result.xdm.commerce.productListAdds.value).toBe(1);
});

test('SCENARIO 3: Product Viewed triggers correctly', async ({ page }) => {
  await page.goto('/merchandise', { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  const result = await page.evaluate((code) => {
    var simulatedEvent = {
      message: {
        event: 'Product viewed',
        attributes: { product_id: 'FER-CAP-LC16', product_name: 'Leclerc Cap', product_price: 45 }
      }
    };
    var fn = new Function('simulatedEvent', code);
    return fn(simulatedEvent);
  }, PROPOSED_CODE);

  console.log('\n[Product Viewed simulated rule trigger]');
  console.log(`  Resolved eventName: ${result.eventName}`);
  console.log(`  XDM eventType:      ${result.xdm.eventType}`);

  expect(result.eventName).toBe('Product viewed');
  expect(result.xdm.eventType).toBe('commerce.productViews');
  expect(result.xdm.productListItems[0].SKU).toBe('FER-CAP-LC16');
});

test('SCENARIO 4: Purchase triggers commerce.purchases', async ({ page }) => {
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  const result = await page.evaluate((code) => {
    var simulatedEvent = {
      message: {
        event: 'Purchase completed',
        attributes: { transaction_id: 'TXN-12345', transaction_total: 299.99, item_count: 2 }
      }
    };
    var fn = new Function('simulatedEvent', code);
    return fn(simulatedEvent);
  }, PROPOSED_CODE);

  console.log('\n[Purchase completed simulated rule trigger]');
  console.log(`  Resolved eventName: ${result.eventName}`);
  console.log(`  XDM eventType:      ${result.xdm.eventType}`);
  console.log(`  PurchaseID:         ${result.xdm.commerce.order.purchaseID}`);
  console.log(`  Price:              ${result.xdm.commerce.order.priceTotal}`);

  expect(result.eventName).toBe('Purchase completed');
  expect(result.xdm.eventType).toBe('commerce.purchases');
  expect(result.xdm.commerce.order.purchaseID).toBe('TXN-12345');
});

test('SCENARIO 5: CRITICAL — race condition test (Purchase then ClearCart)', async ({ page }) => {
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  // Simulate the actual race condition: Purchase event fires, then ClearCart pushed AFTER
  const result = await page.evaluate((code) => {
    // Pre-push Purchase to datalayer (simulating what happened just before)
    window.adobeDataLayer = window.adobeDataLayer || [];
    window.adobeDataLayer.push({
      event: 'Purchase completed',
      attributes: { transaction_id: 'TXN-RACE-001', transaction_total: 199.99 }
    });
    // Then ClearCart pushed (this used to "win" in old code)
    window.adobeDataLayer.push({
      event: 'ClearCart',
      attributes: { items_cleared: 2 }
    });

    // Now simulate the Purchase rule firing - it should still get Purchase, not ClearCart
    var simulatedEvent = {
      message: {
        event: 'Purchase completed',
        attributes: { transaction_id: 'TXN-RACE-001', transaction_total: 199.99 }
      }
    };
    var fn = new Function('simulatedEvent', code);
    return fn(simulatedEvent);
  }, PROPOSED_CODE);

  console.log('\n[RACE CONDITION test - Purchase rule with ClearCart pushed later]');
  console.log(`  Resolved eventName: ${result.eventName}`);
  console.log(`  XDM eventType:      ${result.xdm.eventType}`);
  console.log(`  Expected:           commerce.purchases`);
  console.log(`  Match:              ${result.xdm.eventType === 'commerce.purchases' ? '✓ CORRECT' : '✗ STILL BROKEN'}`);

  expect(result.eventName).toBe('Purchase completed');
  expect(result.xdm.eventType).toBe('commerce.purchases');
  expect(result.xdm.commerce.order.purchaseID).toBe('TXN-RACE-001');
});

test('SCENARIO 6: Fallback - no simulatedEvent provided (Library Loaded scenario)', async ({ page }) => {
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(3000);

  // When Library Loaded fires, no event payload — should still produce valid XDM
  const result = await page.evaluate((code) => {
    var fn = new Function('simulatedEvent', code);
    return fn(undefined);
  }, PROPOSED_CODE);

  console.log('\n[Library Loaded fallback - no simulatedEvent]');
  console.log(`  Resolved eventName: ${result.eventName}`);
  console.log(`  XDM eventType:      ${result.xdm.eventType}`);

  expect(result.xdm.eventType).toMatch(/^web|^commerce/);
});

test('SCENARIO 7: Real adobeDataLayer audit (whatever pushed naturally)', async ({ page }) => {
  await page.goto('/merchandise', { waitUntil: 'load' });
  await page.waitForTimeout(3000);

  // Click Add to Cart button - this triggers the multi-event sequence
  const btn = page.locator('.add-cart-btn').first();
  if (await btn.count()) {
    await btn.click();
    await page.waitForTimeout(2000);
  }

  const dlAudit = await page.evaluate((code) => {
    var dl = window.adobeDataLayer || [];
    var allEvents = dl.filter(function(e) { return e.event; }).map(function(e) { return e.event; });

    // For EACH event, simulate the rule firing with that event and check XDM
    var results = [];
    allEvents.forEach(function(eventName) {
      var entry = dl.find(function(e) { return e.event === eventName; });
      var simulatedEvent = { message: entry };
      var fn = new Function('simulatedEvent', code);
      var result = fn(simulatedEvent);
      results.push({
        eventName: eventName,
        xdmEventType: result.xdm.eventType,
        hasCommerce: !!result.xdm.commerce,
        commerceKeys: result.xdm.commerce ? Object.keys(result.xdm.commerce) : []
      });
    });

    return { dl: allEvents, results: results };
  }, PROPOSED_CODE);

  console.log('\n[Real datalayer audit after Add to Cart click]');
  console.log(`  Total events in datalayer: ${dlAudit.dl.length}`);
  console.log(`  Events: ${dlAudit.dl.join(', ')}`);
  console.log('\n  Per-event simulation:');
  dlAudit.results.forEach(function(r) {
    console.log(`    "${r.eventName}" → ${r.xdmEventType} ${r.commerceKeys.length ? '[' + r.commerceKeys.join(',') + ']' : ''}`);
  });

  // Verify each unique event produces its OWN XDM type
  const productViewResult = dlAudit.results.find(r => r.eventName === 'Product viewed');
  const addToCartResult = dlAudit.results.find(r => r.eventName === 'Add to cart');

  if (productViewResult) {
    console.log(`\n  Product viewed → ${productViewResult.xdmEventType} (expected commerce.productViews)`);
    expect(productViewResult.xdmEventType).toBe('commerce.productViews');
  }
  if (addToCartResult) {
    console.log(`  Add to cart → ${addToCartResult.xdmEventType} (expected commerce.productListAdds)`);
    expect(addToCartResult.xdmEventType).toBe('commerce.productListAdds');
  }
});

test('SCENARIO 8: All event types coverage', async ({ page }) => {
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  const eventCases = [
    { event: 'Page Loaded', expected: 'web.webpagedetails.pageViews' },
    { event: 'Page View', expected: 'web.webpagedetails.pageViews' },
    { event: 'Product viewed', expected: 'commerce.productViews' },
    { event: 'Add to cart', expected: 'commerce.productListAdds' },
    { event: 'Remove from cart', expected: 'commerce.productListRemovals' },
    { event: 'View cart', expected: 'commerce.productListViews' },
    { event: 'BeginCheckout', expected: 'commerce.checkouts' },
    { event: 'Purchase', expected: 'commerce.purchases' },
    { event: 'Purchase completed', expected: 'commerce.purchases' },
    { event: 'User logged in', expected: 'web.webinteraction.linkClicks' },
    { event: 'Search performed', expected: 'web.webinteraction.linkClicks' },
    { event: 'Race details viewed', expected: 'web.webinteraction.linkClicks' },
    { event: 'Team profile viewed', expected: 'web.webinteraction.linkClicks' },
    { event: 'ClearCart', expected: 'commerce.productListRemovals' },
  ];

  const results = await page.evaluate((args) => {
    return args.cases.map(function(tc) {
      var simulatedEvent = { message: { event: tc.event, attributes: {} } };
      var fn = new Function('simulatedEvent', args.code);
      var result = fn(simulatedEvent);
      return {
        event: tc.event,
        expected: tc.expected,
        got: result.xdm.eventType,
        match: result.xdm.eventType === tc.expected
      };
    });
  }, { cases: eventCases, code: PROPOSED_CODE });

  console.log('\n[Event type coverage check]');
  results.forEach(r => {
    console.log(`  ${r.match ? '✓' : '✗'} "${r.event}" → ${r.got} (expected ${r.expected})`);
  });

  const failed = results.filter(r => !r.match);
  expect(failed, `Failed mappings: ${JSON.stringify(failed)}`).toHaveLength(0);
});
