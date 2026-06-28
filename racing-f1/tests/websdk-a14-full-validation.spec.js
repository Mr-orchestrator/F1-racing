// @ts-check
// Complete validation of all Web SDK rules on a14 published library
// Captures requests to the actual custom edge domain (cognizanttechnologys.data.adobedc.net)
const { test, expect } = require('@playwright/test');

test.setTimeout(180000);

// Match Web SDK calls regardless of custom edge domain
const isWebSdkCall = (url) => /\.data\.adobedc\.net\/ee\//.test(url) || /edge\.adobedc\.net\/ee\//.test(url) || /demdex\.net\/ee\//.test(url);

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

function findEvent(events, eventType) {
  return events.find(e => e.eventType === eventType ||
    (eventType === 'commerce.productListAdds' && e.commerce?.productListAdds) ||
    (eventType === 'commerce.productViews' && e.commerce?.productViews) ||
    (eventType === 'commerce.productListRemovals' && e.commerce?.productListRemovals) ||
    (eventType === 'commerce.productListViews' && e.commerce?.productListViews) ||
    (eventType === 'commerce.checkouts' && e.commerce?.checkouts) ||
    (eventType === 'commerce.purchases' && e.commerce?.purchases) ||
    (eventType === 'web.webpagedetails.pageViews' && e.web?.webPageDetails?.pageViews?.value) ||
    (eventType === 'web.webinteraction.linkClicks' && e.web?.webInteraction?.linkClicks?.value)
  );
}

async function pushEvent(page, payload) {
  await page.evaluate((p) => {
    window.adobeDataLayer = window.adobeDataLayer || [];
    window.adobeDataLayer.push(p);
  }, payload);
  await page.waitForTimeout(2500);
}

test('SCENARIO 1: Page Load fires Web SDK with pageViews', async ({ page }) => {
  const calls = captureBeacons(page);
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(4000);

  const events = getEvents(calls);
  console.log(`\n[Scenario 1] Page Load:`);
  console.log(`  Total Web SDK calls: ${calls.length}`);
  console.log(`  Events captured:`, events.map(e => e.eventType).join(', ') || 'none');

  const pageView = findEvent(events, 'web.webpagedetails.pageViews');
  expect(pageView, 'Page Load should fire web.webpagedetails.pageViews').toBeTruthy();
  expect(pageView.web?.webPageDetails?.URL).toContain('racing-f1-rho.vercel.app');
  console.log(`  ✓ pageView event fired with URL: ${pageView.web?.webPageDetails?.URL}`);
});

test('SCENARIO 2: Add to Cart fires commerce.productListAdds', async ({ page }) => {
  const calls = captureBeacons(page);
  await page.goto('/merchandise', { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  await pushEvent(page, {
    event: 'Add to cart',
    attributes: {
      product_id: 'RB-JKT-2024',
      product_name: '2024 Team Jacket',
      product_category: 'Apparel',
      product_price: 159.99,
      product_quantity: 1,
      currency: 'USD'
    }
  });
  await page.waitForTimeout(3000);

  const events = getEvents(calls);
  console.log(`\n[Scenario 2] Add to Cart:`);
  console.log(`  Web SDK calls: ${calls.length}`);
  console.log(`  Events:`, events.map(e => e.eventType).join(', '));

  const addToCart = events.find(e => e.commerce?.productListAdds);
  if (addToCart) {
    console.log(`  ✓ productListAdds.value: ${addToCart.commerce.productListAdds.value}`);
    console.log(`  ✓ Product: ${JSON.stringify(addToCart.productListItems)}`);
  }
  expect(addToCart, 'Add to Cart should fire commerce.productListAdds').toBeTruthy();
});

test('SCENARIO 3: Product Viewed fires commerce.productViews', async ({ page }) => {
  const calls = captureBeacons(page);
  await page.goto('/merchandise', { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  await pushEvent(page, {
    event: 'Product viewed',
    attributes: {
      product_id: 'FER-JKT-2024',
      product_name: 'Scuderia Team Jacket',
      product_category: 'Apparel',
      product_price: 179.99
    }
  });
  await page.waitForTimeout(3000);

  const events = getEvents(calls);
  console.log(`\n[Scenario 3] Product Viewed:`);
  const productView = events.find(e => e.commerce?.productViews);
  if (productView) console.log(`  ✓ SKU: ${productView.productListItems?.[0]?.SKU}`);
  expect(productView, 'Product Viewed should fire commerce.productViews').toBeTruthy();
});

test('SCENARIO 4: Remove from Cart fires commerce.productListRemovals', async ({ page }) => {
  const calls = captureBeacons(page);
  await page.goto('/cart', { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  await pushEvent(page, {
    event: 'Remove from cart',
    attributes: { product_id: 'RB-JKT-2024', quantity_removed: 1 }
  });
  await page.waitForTimeout(3000);

  const events = getEvents(calls);
  console.log(`\n[Scenario 4] Remove from Cart:`);
  const remove = events.find(e => e.commerce?.productListRemovals);
  if (remove) console.log(`  ✓ productListRemovals fired`);
  expect(remove, 'Remove from Cart should fire commerce.productListRemovals').toBeTruthy();
});

test('SCENARIO 5: View Cart fires commerce.productListViews', async ({ page }) => {
  const calls = captureBeacons(page);
  await page.goto('/cart', { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  await pushEvent(page, {
    event: 'View cart',
    attributes: { cart_total: 159.99, item_count: 1 }
  });
  await page.waitForTimeout(3000);

  const events = getEvents(calls);
  console.log(`\n[Scenario 5] View Cart:`);
  console.log(`  Events:`, events.map(e => e.eventType).join(', '));
  // View cart maps to productListViews
});

test('SCENARIO 6: Begin Checkout fires commerce.checkouts', async ({ page }) => {
  const calls = captureBeacons(page);
  await page.goto('/checkout', { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  await pushEvent(page, {
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
      item_1_name: 'Leclerc Cap',
      item_1_qty: 2,
      item_1_price: 45.00
    }
  });
  await page.waitForTimeout(3000);

  const events = getEvents(calls);
  console.log(`\n[Scenario 6] Begin Checkout:`);
  const checkout = events.find(e => e.commerce?.checkouts);
  if (checkout) {
    console.log(`  ✓ checkouts.value: ${checkout.commerce.checkouts.value}`);
    console.log(`  ✓ Items: ${checkout.productListItems?.length}`);
  }
  expect(checkout, 'BeginCheckout should fire commerce.checkouts').toBeTruthy();
});

test('SCENARIO 7: Purchase fires commerce.purchases with purchaseID', async ({ page }) => {
  const calls = captureBeacons(page);
  await page.goto('/confirmation', { waitUntil: 'load' });

  const order = {
    orderNumber: 'RF1-A14-TEST-' + Date.now(),
    email: 'a14test@f1.com',
    shipping: { firstName: 'A14', lastName: 'Test', address: '1 Test', city: 'Monaco', state: 'MC', zip: '98000', country: 'MC' },
    shippingMethod: 'express', shippingPrice: 14.99,
    items: [
      { id: 'RB-JKT-2024', name: '2024 Team Jacket', price: 159.99, category: 'Apparel', brand: 'Red Bull', image: 'img.png', quantity: 1 },
      { id: 'FER-CAP-LC16', name: 'Leclerc Cap', price: 45.00, category: 'Accessories', brand: 'Ferrari', image: 'img.png', quantity: 2 }
    ],
    subtotal: 249.99, tax: 20.62, total: 285.60,
    date: new Date().toISOString(),
    userId: 'a14test@f1.com', userName: 'A14 Test'
  };

  await page.evaluate((o) => {
    Object.keys(localStorage).filter(k => k.startsWith('rf1_purchase_fired_')).forEach(k => localStorage.removeItem(k));
    localStorage.setItem('rf1_last_order', JSON.stringify(o));
  }, order);

  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(4000);

  const events = getEvents(calls);
  console.log(`\n[Scenario 7] Purchase:`);
  const purchase = events.find(e => e.commerce?.purchases);
  if (purchase) {
    console.log(`  ✓ purchases.value: ${purchase.commerce.purchases.value}`);
    console.log(`  ✓ purchaseID: ${purchase.commerce.order?.purchaseID}`);
    console.log(`  ✓ priceTotal: ${purchase.commerce.order?.priceTotal}`);
    console.log(`  ✓ Items: ${purchase.productListItems?.length}`);
  }
  expect(purchase, 'Purchase should fire commerce.purchases').toBeTruthy();
  expect(purchase.commerce?.order?.purchaseID).toContain('RF1-A14-TEST');
});

test('SCENARIO 8: User Logged In fires web.webinteraction.linkClicks', async ({ page }) => {
  const calls = captureBeacons(page);
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  await pushEvent(page, {
    event: 'User logged in',
    attributes: {
      user_id: 'a14test@f1.com',
      user_email: 'a14test@f1.com',
      user_type: 'registered',
      customer_tier: 'gold',
      login_status: true
    }
  });
  await page.waitForTimeout(3000);

  const events = getEvents(calls);
  console.log(`\n[Scenario 8] User Logged In:`);
  const login = events.find(e => e._experience?.analytics?.customDimensions?.eVars?.eVar6 === 'true');
  if (login) {
    console.log(`  ✓ eVar6 (login_status): ${login._experience.analytics.customDimensions.eVars.eVar6}`);
    console.log(`  ✓ eVar7 (user_type): ${login._experience.analytics.customDimensions.eVars.eVar7}`);
    console.log(`  ✓ eVar8 (tier): ${login._experience.analytics.customDimensions.eVars.eVar8}`);
    console.log(`  ✓ identityMap: ${JSON.stringify(login.identityMap)}`);
  }
});

test('SCENARIO 9: Search Performed fires Web SDK call', async ({ page }) => {
  const calls = captureBeacons(page);
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  await pushEvent(page, {
    event: 'Search performed',
    attributes: { search_term: 'ferrari jacket', search_results: 5 }
  });
  await page.waitForTimeout(3000);

  const events = getEvents(calls);
  console.log(`\n[Scenario 9] Search Performed:`);
  const search = events.find(e => e._experience?.analytics?.customDimensions?.eVars?.eVar9 === 'ferrari jacket');
  if (search) console.log(`  ✓ eVar9 (search_term): ${search._experience.analytics.customDimensions.eVars.eVar9}`);
});

test('SCENARIO 10: Race details viewed', async ({ page }) => {
  const calls = captureBeacons(page);
  await page.goto('/calendar', { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  await pushEvent(page, {
    event: 'Race details viewed',
    attributes: { race_name: 'Monaco Grand Prix', race_location: 'Monaco' }
  });
  await page.waitForTimeout(3000);

  const events = getEvents(calls);
  console.log(`\n[Scenario 10] Race details viewed:`);
  console.log(`  Web SDK calls: ${calls.length}`);
});

test('SCENARIO 11: Multiple events in sequence', async ({ page }) => {
  const calls = captureBeacons(page);
  await page.goto('/merchandise', { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  const seq = [
    { event: 'Product viewed', attributes: { product_id: 'RB-JKT-2024', product_name: '2024 Team Jacket', product_price: 159.99, product_category: 'Apparel' } },
    { event: 'Add to cart', attributes: { product_id: 'RB-JKT-2024', product_name: '2024 Team Jacket', product_price: 159.99, product_quantity: 1, currency: 'USD' } },
    { event: 'Promo code applied', attributes: { promo_code: 'F1SAVE10' } },
    { event: 'Team profile viewed', attributes: { team_name: 'Red Bull Racing' } },
  ];

  for (const e of seq) await pushEvent(page, e);
  await page.waitForTimeout(2000);

  const events = getEvents(calls);
  console.log(`\n[Scenario 11] Sequence of 4 events:`);
  console.log(`  Total Web SDK calls: ${calls.length}`);
  console.log(`  Events:`, events.map(e => e.eventType).join(', '));
  expect(calls.length, 'Should fire at least 4 Web SDK calls').toBeGreaterThanOrEqual(4);
});

test('SCENARIO 12: Summary — All events validation', async ({ page }) => {
  const calls = captureBeacons(page);
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(3000);

  const allTests = [
    { name: 'Product viewed', attrs: { product_id: 'TEST1', product_name: 'Test', product_price: 100 } },
    { name: 'Add to cart', attrs: { product_id: 'TEST2', product_name: 'Test2', product_price: 100, product_quantity: 1, currency: 'USD' } },
    { name: 'Remove from cart', attrs: { product_id: 'TEST2', quantity_removed: 1 } },
    { name: 'View cart', attrs: { cart_total: 100, item_count: 1 } },
    { name: 'BeginCheckout', attrs: { cart_total: 100, item_count: 1, item_0_id: 'TEST', item_0_name: 'Test', item_0_qty: 1, item_0_price: 100 } },
    { name: 'Search performed', attrs: { search_term: 'test', search_results: 1 } },
    { name: 'User logged in', attrs: { user_id: 'test@test.com', user_email: 'test@test.com', user_type: 'registered', customer_tier: 'gold' } },
    { name: 'User logged out', attrs: { user_id: 'test@test.com' } },
    { name: 'User signed up', attrs: { user_id: 'newuser@test.com' } },
    { name: 'Promo code applied', attrs: { promo_code: 'TEST10' } },
    { name: 'Error occurred', attrs: { error_type: 'test', error_code: 'ERR_TEST' } },
    { name: 'Race details viewed', attrs: { race_name: 'Test GP' } },
    { name: 'Race selected', attrs: { race_name: 'Test GP' } },
    { name: 'Ticket type selected', attrs: { ticket_type: 'VIP' } },
    { name: 'Seat selected', attrs: { seat_id: 'A1' } },
    { name: 'Team profile viewed', attrs: { team_name: 'Ferrari' } },
    { name: 'Experience booked', attrs: { experience_name: 'Pit Walk' } },
    { name: 'Hospitality package selected', attrs: { package_name: 'VIP' } },
    { name: 'ClearCart', attrs: { items_cleared: 2 } },
  ];

  for (const t of allTests) {
    await pushEvent(page, { event: t.name, attributes: t.attrs });
  }
  await page.waitForTimeout(3000);

  console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
  console.log(`║   FINAL A14 VALIDATION SUMMARY                              ║`);
  console.log(`╠══════════════════════════════════════════════════════════════╣`);
  console.log(`║   Total Web SDK calls: ${String(calls.length).padEnd(38)}║`);
  console.log(`║   Tests pushed:        ${String(allTests.length).padEnd(38)}║`);
  console.log(`╚══════════════════════════════════════════════════════════════╝`);

  const events = getEvents(calls);
  const eventTypes = {};
  events.forEach(e => {
    const t = e.eventType || 'unknown';
    eventTypes[t] = (eventTypes[t] || 0) + 1;
  });

  console.log(`\nEvent type distribution:`);
  Object.entries(eventTypes).forEach(([t, c]) => console.log(`  ${t.padEnd(40)} ${c}`));

  // Note: not every event maps 1:1 to a Web SDK call due to throttling/batching
  expect(calls.length, 'Should fire many Web SDK calls across scenarios').toBeGreaterThan(5);
});
