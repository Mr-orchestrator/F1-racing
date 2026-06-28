// @ts-check
// Verify the FINAL XDM data element code against Adobe official requirements
// Loads the code, executes it for every event type, validates output
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.setTimeout(60000);

// Load the FINAL XDM data element code
const XDM_CODE = fs.readFileSync(
  path.join(__dirname, '..', 'docs', 'analytics', 'xdm-data-element-FINAL.js'),
  'utf8'
);

// ════════════════════════════════════════════════════════════════════════════
// Adobe Official Required Fields per Event Type (from XDM schema docs)
// ════════════════════════════════════════════════════════════════════════════
const ADOBE_REQUIREMENTS = {
  'web.webpagedetails.pageViews': {
    required: ['eventType', 'web.webPageDetails.pageViews.value', 'web.webPageDetails.URL'],
    expectedValue: { 'web.webPageDetails.pageViews.value': 1 }
  },
  'commerce.productViews': {
    required: ['eventType', 'commerce.productViews.value', 'productListItems[0].SKU'],
    expectedValue: { 'commerce.productViews.value': 1 }
  },
  'commerce.productListAdds': {
    required: ['eventType', 'commerce.productListAdds.value', 'productListItems[0].SKU',
              'productListItems[0].quantity', 'productListItems[0].priceTotal',
              'productListItems[0].currencyCode'],
    expectedValue: { 'commerce.productListAdds.value': 1 }
  },
  'commerce.productListRemovals': {
    required: ['eventType', 'commerce.productListRemovals.value'],
    expectedValue: { 'commerce.productListRemovals.value': 1 }
  },
  'commerce.productListViews': {
    required: ['eventType', 'commerce.productListViews.value'],
    expectedValue: { 'commerce.productListViews.value': 1 }
  },
  'commerce.checkouts': {
    required: ['eventType', 'commerce.checkouts.value'],
    expectedValue: { 'commerce.checkouts.value': 1 }
  },
  'commerce.purchases': {
    required: ['eventType', 'commerce.purchases.value', 'commerce.order.purchaseID',
              'commerce.order.priceTotal', 'commerce.order.currencyCode'],
    expectedValue: { 'commerce.purchases.value': 1 }
  },
  'web.webinteraction.linkClicks': {
    required: ['eventType', 'web.webInteraction.linkClicks.value',
              'web.webInteraction.type', 'web.webInteraction.name'],
    expectedValue: { 'web.webInteraction.linkClicks.value': 1 }
  }
};

function deepGet(obj, path) {
  const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let val = obj;
  for (const k of keys) {
    if (val === null || val === undefined) return undefined;
    val = val[k];
  }
  return val;
}

function validateAdobeSchema(xdm) {
  const errors = [];
  const eventType = xdm.eventType;
  const req = ADOBE_REQUIREMENTS[eventType];

  if (!req) {
    errors.push(`Unknown eventType: ${eventType}`);
    return errors;
  }

  // Check required fields
  req.required.forEach(path => {
    const val = deepGet(xdm, path);
    if (val === undefined || val === null) {
      errors.push(`MISSING: ${path}`);
    }
  });

  // Check expected values
  if (req.expectedValue) {
    Object.entries(req.expectedValue).forEach(([path, expected]) => {
      const actual = deepGet(xdm, path);
      if (actual !== expected) {
        errors.push(`WRONG VALUE: ${path} expected ${expected}, got ${actual}`);
      }
    });
  }

  return errors;
}

// ════════════════════════════════════════════════════════════════════════════
// Test every event type the site fires
// ════════════════════════════════════════════════════════════════════════════
const ALL_EVENTS = [
  {
    name: 'Page Loaded',
    expectedEventType: 'web.webpagedetails.pageViews',
    attrs: {}
  },
  {
    name: 'Product viewed',
    expectedEventType: 'commerce.productViews',
    attrs: {
      product_id: 'RB-JKT-2024',
      product_name: '2024 Team Jacket',
      product_price: 159.99,
      product_category: 'Apparel'
    }
  },
  {
    name: 'Add to cart',
    expectedEventType: 'commerce.productListAdds',
    attrs: {
      product_id: 'RB-JKT-2024',
      product_name: '2024 Team Jacket',
      product_price: 159.99,
      product_quantity: 1,
      product_category: 'Apparel',
      currency: 'USD'
    }
  },
  {
    name: 'Remove from cart',
    expectedEventType: 'commerce.productListRemovals',
    attrs: { product_id: 'RB-JKT-2024', quantity_removed: 1 }
  },
  {
    name: 'View cart',
    expectedEventType: 'commerce.productListViews',
    attrs: {
      cart_total: 159.99,
      item_count: 1,
      item_0_id: 'RB-JKT-2024',
      item_0_name: '2024 Team Jacket',
      item_0_qty: 1,
      item_0_price: 159.99
    }
  },
  {
    name: 'BeginCheckout',
    expectedEventType: 'commerce.checkouts',
    attrs: {
      cart_total: 339.98,
      item_count: 2,
      currency: 'USD',
      item_0_id: 'RB-JKT-2024',
      item_0_name: '2024 Team Jacket',
      item_0_qty: 1,
      item_0_price: 159.99,
      item_1_id: 'FER-CAP-LC16',
      item_1_name: 'Leclerc Cap',
      item_1_qty: 1,
      item_1_price: 45.00
    }
  },
  {
    name: 'Purchase',
    expectedEventType: 'commerce.purchases',
    attrs: {
      transaction_id: 'RF1-TEST-001',
      transaction_total: 354.97,
      transaction_tax: 14.99,
      transaction_shipping: 9.99,
      currency: 'USD',
      item_count: 2,
      item_0_id: 'RB-JKT-2024',
      item_0_name: '2024 Team Jacket',
      item_0_qty: 1,
      item_0_price: 159.99,
      item_1_id: 'FER-CAP-LC16',
      item_1_name: 'Leclerc Cap',
      item_1_qty: 1,
      item_1_price: 45.00
    }
  },
  {
    name: 'Purchase completed',
    expectedEventType: 'commerce.purchases',
    attrs: {
      transaction_id: 'RF1-COMPLETED-001',
      transaction_total: 99.99,
      currency: 'USD',
      item_count: 1,
      item_0_id: 'TEST',
      item_0_name: 'Test',
      item_0_qty: 1,
      item_0_price: 99.99
    }
  },
  {
    name: 'ClearCart',
    expectedEventType: 'commerce.productListRemovals',
    attrs: { items_cleared: 2 }
  },
  {
    name: 'User logged in',
    expectedEventType: 'web.webinteraction.linkClicks',
    attrs: {
      user_id: 'test@user.com',
      user_email: 'test@user.com',
      user_type: 'registered',
      customer_tier: 'gold'
    }
  },
  {
    name: 'User logged out',
    expectedEventType: 'web.webinteraction.linkClicks',
    attrs: { user_id: 'test@user.com' }
  },
  {
    name: 'User signed up',
    expectedEventType: 'web.webinteraction.linkClicks',
    attrs: {
      user_id: 'newuser@test.com',
      user_email: 'newuser@test.com'
    }
  },
  {
    name: 'Search performed',
    expectedEventType: 'web.webinteraction.linkClicks',
    attrs: { search_term: 'ferrari', search_results: 5 }
  },
  {
    name: 'Promo code applied',
    expectedEventType: 'web.webinteraction.linkClicks',
    attrs: { promo_code: 'F1FAN20' }
  },
  {
    name: 'Race details viewed',
    expectedEventType: 'web.webinteraction.linkClicks',
    attrs: { race_name: 'Monaco GP', race_location: 'Monaco' }
  },
  {
    name: 'Race selected',
    expectedEventType: 'web.webinteraction.linkClicks',
    attrs: { race_name: 'Monaco GP' }
  },
  {
    name: 'Ticket type selected',
    expectedEventType: 'web.webinteraction.linkClicks',
    attrs: { ticket_type: 'VIP Paddock' }
  },
  {
    name: 'Seat selected',
    expectedEventType: 'web.webinteraction.linkClicks',
    attrs: { seat_id: 'A12' }
  },
  {
    name: 'Team profile viewed',
    expectedEventType: 'web.webinteraction.linkClicks',
    attrs: { team_name: 'Ferrari' }
  },
  {
    name: 'Experience booked',
    expectedEventType: 'commerce.checkouts',
    attrs: { experience_name: 'Pit Lane Walk', experience_price: 499 }
  },
  {
    name: 'Hospitality package selected',
    expectedEventType: 'web.webinteraction.linkClicks',
    attrs: { package_name: 'Champions Club', package_price: 2499 }
  },
  {
    name: 'Error occurred',
    expectedEventType: 'web.webinteraction.linkClicks',
    attrs: { error_type: 'payment_failure', ga_errorMessage: 'Card declined' }
  }
];

test('FULL XDM Data Element Adobe Compliance Verification', async ({ page }) => {
  await page.goto('https://racing-f1-rho.vercel.app/', { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  console.log('\n╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║   FULL XDM DATA ELEMENT — ADOBE OFFICIAL COMPLIANCE                      ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝');

  const results = await page.evaluate((args) => {
    const out = [];
    for (const ev of args.events) {
      // Reset datalayer & push just this one event
      window.adobeDataLayer = [];
      window.adobeDataLayer.push({ event: ev.name, attributes: ev.attrs });

      // Execute the XDM data element code
      let xdm;
      try {
        const fn = new Function(args.code);
        xdm = fn();
      } catch (e) {
        out.push({ event: ev.name, error: e.message });
        continue;
      }

      out.push({
        event: ev.name,
        expectedEventType: ev.expectedEventType,
        actualEventType: xdm.eventType,
        xdm: xdm
      });
    }
    return out;
  }, { events: ALL_EVENTS, code: XDM_CODE });

  console.log('\n┌──────────────────────────────────┬────────────────────────────────────────┬────────┐');
  console.log('│ Event                            │ XDM eventType                          │ Status │');
  console.log('├──────────────────────────────────┼────────────────────────────────────────┼────────┤');

  let totalPass = 0;
  let totalFail = 0;
  const failures = [];

  results.forEach(r => {
    if (r.error) {
      console.log(`│ ${r.event.padEnd(32)} │ ERROR: ${r.error.substring(0, 30).padEnd(32)} │ FAIL   │`);
      totalFail++;
      failures.push({ event: r.event, errors: [r.error] });
      return;
    }

    const eventTypeMatch = r.expectedEventType === r.actualEventType;
    const schemaErrors = validateAdobeSchema(r.xdm);
    const pass = eventTypeMatch && schemaErrors.length === 0;

    const status = pass ? 'PASS' : 'FAIL';
    console.log(`│ ${r.event.padEnd(32)} │ ${r.actualEventType.padEnd(38)} │ ${status.padEnd(6)} │`);

    if (pass) {
      totalPass++;
    } else {
      totalFail++;
      const errs = [];
      if (!eventTypeMatch) errs.push(`eventType mismatch: expected ${r.expectedEventType}, got ${r.actualEventType}`);
      errs.push(...schemaErrors);
      failures.push({ event: r.event, errors: errs });
    }
  });

  console.log('└──────────────────────────────────┴────────────────────────────────────────┴────────┘');

  console.log(`\n┌──────────────────────────────────────────────────┐`);
  console.log(`│ TOTAL: ${String(totalPass).padStart(2)} PASS / ${String(totalFail).padStart(2)} FAIL of ${ALL_EVENTS.length} events`.padEnd(50) + '│');
  console.log(`└──────────────────────────────────────────────────┘`);

  if (failures.length > 0) {
    console.log('\n=== FAILURE DETAILS ===');
    failures.forEach(f => {
      console.log(`\n  ✗ ${f.event}`);
      f.errors.forEach(e => console.log(`      - ${e}`));
    });
  } else {
    console.log('\n  ✓ All events fully comply with Adobe Official XDM Schema');
  }

  // Show example payloads for key events
  console.log('\n=== SAMPLE PAYLOAD: Add to Cart ===');
  const addCart = results.find(r => r.event === 'Add to cart');
  if (addCart) console.log(JSON.stringify(addCart.xdm, null, 2).substring(0, 800));

  console.log('\n=== SAMPLE PAYLOAD: Purchase ===');
  const purchase = results.find(r => r.event === 'Purchase');
  if (purchase) console.log(JSON.stringify(purchase.xdm, null, 2).substring(0, 1200));

  expect(totalFail).toBe(0);
});
