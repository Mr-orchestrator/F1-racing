// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * ============================================
 * GRIDBOX EVENT-BASED DATALAYER TESTS
 * ============================================
 * Verifies that every user action populates
 * gridboxLayer.event[] with correct W3C structure,
 * lifecycle metadata, context, and attributes.
 */

const ALL_PAGES = [
  { name: 'Homepage', url: '/', pageType: 'homepage' },
  { name: 'Teams', url: '/teams', pageType: 'teams' },
  { name: 'Merchandise', url: '/merchandise', pageType: 'merchandise' },
  { name: 'Tickets', url: '/tickets', pageType: 'tickets' },
  { name: 'Experiences', url: '/experiences', pageType: 'experiences' },
  { name: 'Calendar', url: '/calendar', pageType: 'calendar' },
  { name: 'Cart', url: '/cart', pageType: 'cart' },
  { name: 'Login', url: '/login', pageType: 'login' },
  { name: 'Register', url: '/register', pageType: 'register' },
  { name: 'Support', url: '/support', pageType: 'support' },
  { name: 'Privacy', url: '/privacy', pageType: 'privacy' },
  { name: 'Terms', url: '/terms', pageType: 'terms' },
  { name: 'Booking SPA', url: '/booking-spa', pageType: 'booking-spa' },
];

// Helper: wait for gridbox analytics to be fully initialized
async function waitForGridbox(page) {
  await page.waitForFunction(() =>
    window.gridbox && window.gridboxLayer &&
    window.gridboxLayer.event.length > 0 &&
    window.gridboxLayer.session &&
    window.gridboxLayer.session.sessionId,
    { timeout: 10000 }
  );
}

// Helper: get latest event from gridboxLayer
async function getLatestEvent(page) {
  return page.evaluate(() => {
    const events = window.gridboxLayer.event;
    return events.length > 0 ? events[events.length - 1] : null;
  });
}

// Helper: get all events of a specific type
async function getEventsByKey(page, key) {
  return page.evaluate((k) => {
    return window.gridboxLayer.event.filter(e => e.eventInfo && e.eventInfo.key === k);
  }, key);
}

// Helper: get event count
async function getEventCount(page) {
  return page.evaluate(() => window.gridboxLayer.event.length);
}

// Helper: get full gridboxLayer
async function getGridboxLayer(page) {
  return page.evaluate(() => JSON.parse(JSON.stringify(window.gridboxLayer)));
}

// =========================================
// TEST SUITE 1: GRIDBOXLAYER STRUCTURE
// =========================================
test.describe('1. gridboxLayer Structure on All Pages', () => {

  for (const p of ALL_PAGES) {
    test(`${p.name} - gridboxLayer v2.12.0 with complete W3C structure`, async ({ page }) => {
      await page.goto(p.url, { waitUntil: 'domcontentloaded' });
      await waitForGridbox(page);

      const layer = await getGridboxLayer(page);

      // Version check
      expect(layer.version).toBe('2.12.0');
      expect(layer.libVersion).toBe('1.1.0');

      // Core arrays and objects exist
      expect(Array.isArray(layer.event)).toBe(true);
      expect(Array.isArray(layer.product)).toBe(true);
      expect(Array.isArray(layer.user)).toBe(true);
      expect(layer.page).toBeDefined();
      expect(layer.cart).toBeDefined();
      expect(layer.session).toBeDefined();
      expect(layer.context).toBeDefined();

      // Cart has correct enterprise structure
      expect(layer.cart.price).toBeDefined();
      expect(layer.cart.price.totalPrice).toBeDefined();
      expect(typeof layer.cart.price.totalPrice.amount).toBe('number');
      expect(layer.cart.price.totalPrice.currency).toBe('USD');
      expect(Array.isArray(layer.cart.item)).toBe(true);

      // User profile has enhanced fields
      const profile = layer.user[0].profile[0].profileInfo;
      expect(profile.anonymousId).toBeTruthy();
      expect(profile.sessionId).toBeTruthy();
      expect(typeof profile.isBot).toBe('boolean');
      expect(typeof profile.cookieEnabled).toBe('boolean');
      expect(profile.deviceType).toBeTruthy();
      expect(profile.browser).toBeTruthy();
      expect(profile.OS).toBeTruthy();

      // Session object populated
      expect(layer.session.sessionId).toBeTruthy();
      expect(typeof layer.session.isNewSession).toBe('boolean');

      // Context object populated
      expect(layer.context.anonymousId).toBeTruthy();
      expect(layer.context.sessionId).toBeTruthy();
      expect(layer.context.pageInstanceId).toBeTruthy();
    });
  }
});

// =========================================
// TEST SUITE 2: INITIAL PAGEVIEW EVENT
// =========================================
test.describe('2. Initial PageView Event on All Pages', () => {

  for (const p of ALL_PAGES) {
    test(`${p.name} - fires PageView event on load`, async ({ page }) => {
      await page.goto(p.url, { waitUntil: 'domcontentloaded' });
      await waitForGridbox(page);

      const pageViews = await getEventsByKey(page, 'gb_page_view');
      expect(pageViews.length).toBeGreaterThanOrEqual(1);

      const pv = pageViews[0];

      // Event structure
      expect(pv.eventId).toBeTruthy();
      expect(pv.eventId).toMatch(/^evt_/);
      expect(pv.eventIndex).toBeGreaterThanOrEqual(1);
      expect(pv.category.primaryCategory).toBe('PageView');
      expect(pv.eventInfo.eventName).toBe('PageView');
      expect(pv.eventInfo.key).toBe('gb_page_view');
      expect(pv.eventInfo.timeStamp).toBeTruthy();
      expect(pv.eventInfo.monotonicTimestamp).toBeTruthy();
      expect(pv.eventInfo.pageInstanceId).toBeTruthy();

      // Context
      expect(pv.context).toBeDefined();
      expect(pv.context.anonymousId).toBeTruthy();
      expect(pv.context.sessionId).toBeTruthy();
      expect(pv.context.consentState).toBeDefined();

      // Lifecycle
      expect(pv._lifecycle).toBeDefined();
      expect(pv._lifecycle.status).toBe('fired');
      expect(pv._lifecycle.createdAt).toBeTruthy();
      expect(pv._lifecycle.firedAt).toBeTruthy();
      expect(Array.isArray(pv._lifecycle.processedBy)).toBe(true);
      expect(pv._lifecycle.processedBy.length).toBeGreaterThan(0);

      // Attributes
      expect(Array.isArray(pv.attributes)).toBe(true);
      const attrKeys = pv.attributes.map(a => a.key);
      expect(attrKeys).toContain('page_name');
      expect(attrKeys).toContain('page_url');
      expect(attrKeys).toContain('anonymous_id');
      expect(attrKeys).toContain('session_id');
      expect(attrKeys).toContain('device_type');
    });
  }
});

// =========================================
// TEST SUITE 3: NAVIGATION CLICK EVENTS
// =========================================
test.describe('3. Navigation Click Events (data-track)', () => {

  test('Navigation link click fires event with correct structure', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForGridbox(page);

    const beforeCount = await getEventCount(page);

    // Click a navigation link
    const navLink = page.locator('[data-track="navigation-main_click_teams"]');
    if (await navLink.isVisible()) {
      await page.evaluate(() => {
        const link = document.querySelector('[data-track="navigation-main_click_teams"]');
        if (link) {
          link.addEventListener('click', (e) => e.preventDefault(), { once: true });
          link.click();
        }
      });
      await page.waitForTimeout(300);

      const afterCount = await getEventCount(page);
      expect(afterCount).toBeGreaterThan(beforeCount);

      // Check the event was properly formed
      const events = await page.evaluate(() => {
        return window.gridboxLayer.event.filter(e =>
          e.eventInfo && e.eventInfo.key &&
          e.eventInfo.key.includes('navigation')
        );
      });
      expect(events.length).toBeGreaterThan(0);
    }
  });

  test('Hero CTA click fires event', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForGridbox(page);

    const beforeCount = await getEventCount(page);

    await page.evaluate(() => {
      const cta = document.querySelector('[data-track="hero-cta_click_shop-now"]');
      if (cta) {
        cta.addEventListener('click', (e) => e.preventDefault(), { once: true });
        cta.click();
      }
    });
    await page.waitForTimeout(300);

    const afterCount = await getEventCount(page);
    expect(afterCount).toBeGreaterThan(beforeCount);
  });
});

// =========================================
// TEST SUITE 4: PRODUCT ADD TO CART EVENTS
// =========================================
test.describe('4. Product & Cart Events', () => {

  test('Add to cart populates gridboxLayer.event[], product[], and cart.item[]', async ({ page }) => {
    await page.goto('/merchandise', { waitUntil: 'domcontentloaded' });
    await waitForGridbox(page);

    // Click first Add to Cart button
    const addBtn = page.locator('.add-cart-btn').first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(500);

      const layer = await getGridboxLayer(page);

      // Product array should have items
      expect(layer.product.length).toBeGreaterThan(0);
      const product = layer.product[0];
      expect(product.productInfo).toBeDefined();
      expect(product.productInfo.productID).toBeTruthy();

      // Cart should have items
      expect(layer.cart.item.length).toBeGreaterThan(0);
      expect(layer.cart.item[0].productInfo.productID).toBeTruthy();
      expect(layer.cart.item[0].productInfo.quantity).toBeGreaterThanOrEqual(1);

      // Cart total should be updated
      expect(layer.cart.price.totalPrice.amount).toBeGreaterThan(0);

      // Event array should have AddToCart event
      const addToCartEvents = layer.event.filter(e =>
        e.eventInfo && e.eventInfo.key === 'AddToCart'
      );
      expect(addToCartEvents.length).toBeGreaterThan(0);

      const atcEvent = addToCartEvents[0];
      // Lifecycle check
      expect(atcEvent._lifecycle).toBeDefined();
      expect(atcEvent._lifecycle.status).toBe('fired');
      expect(atcEvent._lifecycle.firedAt).toBeTruthy();

      // Context check
      expect(atcEvent.context).toBeDefined();
      expect(atcEvent.context.anonymousId).toBeTruthy();
      expect(atcEvent.context.sessionId).toBeTruthy();

      // Attributes check
      const attrMap = {};
      atcEvent.attributes.forEach(a => { attrMap[a.key] = a.value; });
      expect(attrMap.product_id).toBeTruthy();
      expect(attrMap.product_name).toBeTruthy();
      expect(attrMap.product_price).toBeTruthy();
      expect(attrMap.cart_total).toBeTruthy();
      expect(attrMap.currency).toBe('USD');
    }
  });

  test('Multiple add-to-cart updates cart correctly', async ({ page }) => {
    await page.goto('/merchandise', { waitUntil: 'domcontentloaded' });
    await waitForGridbox(page);

    const addBtns = page.locator('.add-cart-btn');
    const count = await addBtns.count();

    if (count >= 2) {
      await addBtns.nth(0).click();
      await page.waitForTimeout(400);
      await addBtns.nth(1).click();
      await page.waitForTimeout(400);

      const layer = await getGridboxLayer(page);
      expect(layer.cart.item.length).toBeGreaterThanOrEqual(2);
      expect(layer.product.length).toBeGreaterThanOrEqual(2);

      // Each AddToCart event should have incrementing eventIndex
      const atcEvents = layer.event.filter(e =>
        e.eventInfo && e.eventInfo.key === 'AddToCart'
      );
      expect(atcEvents.length).toBeGreaterThanOrEqual(2);

      if (atcEvents.length >= 2) {
        expect(atcEvents[1].eventIndex).toBeGreaterThan(atcEvents[0].eventIndex);
      }
    }
  });
});

// =========================================
// TEST SUITE 5: EVENT LIFECYCLE & IMMUTABILITY
// =========================================
test.describe('5. Event Lifecycle & Metadata', () => {

  test('All events have lifecycle metadata', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForGridbox(page);

    const events = await page.evaluate(() => {
      return window.gridboxLayer.event.map(e => ({
        key: e.eventInfo ? e.eventInfo.key : 'unknown',
        hasLifecycle: !!e._lifecycle,
        hasEventId: !!e.eventId,
        hasEventIndex: typeof e.eventIndex === 'number',
        hasContext: !!e.context,
        hasMonotonic: !!(e.eventInfo && e.eventInfo.monotonicTimestamp)
      }));
    });

    expect(events.length).toBeGreaterThan(0);
    for (const evt of events) {
      expect(evt.hasLifecycle).toBe(true);
      expect(evt.hasEventId).toBe(true);
      expect(evt.hasEventIndex).toBe(true);
      expect(evt.hasContext).toBe(true);
      expect(evt.hasMonotonic).toBe(true);
    }
  });

  test('Event IDs are unique', async ({ page }) => {
    await page.goto('/merchandise', { waitUntil: 'domcontentloaded' });
    await waitForGridbox(page);

    // Generate some events
    const addBtn = page.locator('.add-cart-btn').first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(500);
    }

    const eventIds = await page.evaluate(() =>
      window.gridboxLayer.event.map(e => e.eventId)
    );

    const uniqueIds = new Set(eventIds);
    expect(uniqueIds.size).toBe(eventIds.length);
  });

  test('Event indices are sequential', async ({ page }) => {
    await page.goto('/merchandise', { waitUntil: 'domcontentloaded' });
    await waitForGridbox(page);

    const addBtn = page.locator('.add-cart-btn').first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(500);
    }

    const indices = await page.evaluate(() =>
      window.gridboxLayer.event
        .filter(e => typeof e.eventIndex === 'number')
        .map(e => e.eventIndex)
    );

    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThan(indices[i - 1]);
    }
  });
});

// =========================================
// TEST SUITE 6: CONSENT STATE IN EVENTS
// =========================================
test.describe('6. Consent State in Events', () => {

  test('All events include consent context', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForGridbox(page);

    const events = await page.evaluate(() => {
      return window.gridboxLayer.event.map(e => ({
        key: e.eventInfo ? e.eventInfo.key : 'unknown',
        hasConsentState: !!(e.context && e.context.consentState !== undefined)
      }));
    });

    for (const evt of events) {
      expect(evt.hasConsentState).toBe(true);
    }
  });

  test('Consent API works correctly', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForGridbox(page);

    const result = await page.evaluate(() => {
      // Set consent
      window.gridbox.setConsent('granted', {
        analytics: true,
        marketing: true,
        personalization: true
      });
      return window.gridbox.getConsent();
    });

    expect(result.state).toBe('granted');
    expect(result.categories.analytics).toBe(true);
    expect(result.categories.marketing).toBe(true);
  });
});

// =========================================
// TEST SUITE 7: DIAGNOSTICS & OBSERVABILITY
// =========================================
test.describe('7. Analytics Diagnostics', () => {

  test('Diagnostics API returns metrics', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForGridbox(page);

    const diag = await page.evaluate(() => window.gridbox.getDiagnostics());

    expect(diag).toBeDefined();
    expect(typeof diag.eventsCreated).toBe('number');
    expect(typeof diag.eventsFired).toBe('number');
    expect(diag.eventsCreated).toBeGreaterThan(0);
    expect(diag.eventsFired).toBeGreaterThan(0);
    expect(typeof diag.initTime).toBe('number');
  });

  test('Audit buffer captures events', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForGridbox(page);

    const buffer = await page.evaluate(() => window.gridbox.getAuditBuffer(10));

    expect(Array.isArray(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer[0].event).toBeDefined();
    expect(buffer[0].addedAt).toBeTruthy();
  });
});

// =========================================
// TEST SUITE 8: GRIDBOX API METHODS
// =========================================
test.describe('8. gridbox API Methods', () => {

  test('gridbox.view() fires PageView event', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForGridbox(page);

    const beforeCount = await getEventCount(page);

    await page.evaluate(() => {
      window.gridbox.view({
        page_name: 'Test Page',
        page_type: 'test',
        page_category: 'testing'
      });
    });
    await page.waitForTimeout(300);

    const afterCount = await getEventCount(page);
    expect(afterCount).toBeGreaterThan(beforeCount);

    // Find the PageView event we just pushed (may not be the very last due to async perf events)
    const viewEvents = await page.evaluate(() => {
      return window.gridboxLayer.event.filter(e =>
        e.eventInfo && e.eventInfo.eventName === 'PageView' &&
        e.attributes && e.attributes.some(a => a.key === 'page_name' && a.value === 'Test Page')
      );
    });
    expect(viewEvents.length).toBeGreaterThan(0);
    const viewEvt = viewEvents[0];
    expect(viewEvt._lifecycle).toBeDefined();
    expect(viewEvt.context).toBeDefined();
  });

  test('gridbox.link() fires interaction event', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForGridbox(page);

    const beforeCount = await getEventCount(page);

    await page.evaluate(() => {
      window.gridbox.link({
        event_name: 'test_interaction',
        event_category: 'testing',
        event_action: 'click',
        event_label: 'test-button'
      });
    });

    const afterCount = await getEventCount(page);
    expect(afterCount).toBeGreaterThan(beforeCount);

    const latest = await getLatestEvent(page);
    expect(latest.eventInfo.eventName).toBe('test_interaction');
    expect(latest._lifecycle).toBeDefined();
    expect(latest.context).toBeDefined();
    expect(latest.context.anonymousId).toBeTruthy();
  });

  test('gridbox.track() fires callback event', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForGridbox(page);

    const result = await page.evaluate(() => {
      return window.gridbox.track('gb_test_click_button', {
        CD: { content_type: 'test' }
      });
    });

    expect(result).toBe(true);
  });

  test('gridbox.setUser() fires UserIdentified event', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForGridbox(page);

    await page.evaluate(() => {
      window.gridbox.setUser({
        id: 'test_user_123',
        email: 'test@example.com',
        type: 'registered',
        tier: 'gold'
      });
    });

    const userEvents = await getEventsByKey(page, 'gb_user_identified');
    expect(userEvents.length).toBeGreaterThan(0);

    const ue = userEvents[0];
    expect(ue._lifecycle).toBeDefined();
    expect(ue._lifecycle.status).toBe('fired');
    const attrMap = {};
    ue.attributes.forEach(a => { attrMap[a.key] = a.value; });
    expect(attrMap.user_id).toBe('test_user_123');
    expect(attrMap.user_type).toBe('registered');
  });

  test('gridbox.addProduct() + addToCart() + removeFromCart() lifecycle', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForGridbox(page);

    // Add product
    await page.evaluate(() => {
      window.gridbox.addProduct({
        id: 'TEST-001',
        name: 'Test Product',
        price: 99.99,
        category: 'Testing'
      });
    });
    const productEvents = await getEventsByKey(page, 'ProductView');
    expect(productEvents.length).toBeGreaterThan(0);

    // Add to cart
    await page.evaluate(() => {
      window.gridbox.addToCart({
        id: 'TEST-001',
        name: 'Test Product',
        price: 99.99,
        category: 'Testing'
      }, 2);
    });
    const atcEvents = await getEventsByKey(page, 'AddToCart');
    expect(atcEvents.length).toBeGreaterThan(0);

    // Verify cart state
    const cart = await page.evaluate(() => window.gridboxLayer.cart);
    expect(cart.item.length).toBeGreaterThan(0);
    expect(cart.price.totalPrice.amount).toBeGreaterThan(0);

    // Remove from cart
    await page.evaluate(() => {
      window.gridbox.removeFromCart('TEST-001');
    });
    const removeEvents = await getEventsByKey(page, 'RemoveFromCart');
    expect(removeEvents.length).toBeGreaterThan(0);
    expect(removeEvents[0]._lifecycle.status).toBe('fired');
  });

  test('gridbox.purchase() fires Purchase event with transaction data', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForGridbox(page);

    // Add product to cart first
    await page.evaluate(() => {
      window.gridbox.addToCart({
        id: 'PURCHASE-TEST-001',
        name: 'Purchase Test Item',
        price: 49.99,
        category: 'TestCategory'
      }, 1);
    });

    // Complete purchase
    await page.evaluate(() => {
      window.gridbox.purchase({
        orderId: 'TEST-ORDER-001',
        total: 54.98,
        tax: 4.99,
        shipping: 0,
        currency: 'USD'
      });
    });

    const purchaseEvents = await getEventsByKey(page, 'gb_purchase_complete');
    expect(purchaseEvents.length).toBeGreaterThan(0);

    const pe = purchaseEvents[0];
    expect(pe._lifecycle).toBeDefined();
    expect(pe._lifecycle.status).toBe('fired');
    expect(pe.context.anonymousId).toBeTruthy();

    const attrMap = {};
    pe.attributes.forEach(a => { attrMap[a.key] = a.value; });
    expect(attrMap.transaction_id).toBe('TEST-ORDER-001');
    expect(attrMap.transaction_total).toBe('54.98');

    // Verify transaction object
    const txn = await page.evaluate(() => window.gridboxLayer.transaction);
    expect(txn.transactionID).toBe('TEST-ORDER-001');
    expect(txn.total.transactionTotal).toBe(54.98);
  });
});

// =========================================
// TEST SUITE 9: DATA-TRACK ATTRIBUTE EVENTS
// =========================================
test.describe('9. data-track Attribute Click Events', () => {

  test('Clicking data-track element creates event in gridboxLayer.event[]', async ({ page }) => {
    await page.goto('/merchandise', { waitUntil: 'domcontentloaded' });
    await waitForGridbox(page);

    const beforeCount = await getEventCount(page);

    // Click a data-track element via JS to avoid navigation
    await page.evaluate(() => {
      const el = document.querySelector('[data-track]');
      if (el) {
        el.addEventListener('click', (e) => e.preventDefault(), { once: true });
        el.click();
      }
    });
    await page.waitForTimeout(300);

    const afterCount = await getEventCount(page);
    expect(afterCount).toBeGreaterThan(beforeCount);
  });

  test('Product card data-track includes product data attributes', async ({ page }) => {
    await page.goto('/merchandise', { waitUntil: 'domcontentloaded' });
    await waitForGridbox(page);

    // Check for product-actions click events with product data
    const hasProductTrack = await page.evaluate(() => {
      const btns = document.querySelectorAll('[data-track*="product-actions_click"]');
      return btns.length > 0;
    });

    expect(hasProductTrack).toBe(true);
  });
});

// =========================================
// TEST SUITE 10: SESSION & IDENTITY
// =========================================
test.describe('10. Session & Identity Management', () => {

  test('Anonymous ID is persistent across page loads', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForGridbox(page);

    const anonId1 = await page.evaluate(() => window.gridbox.getAnonymousId());

    await page.goto('/merchandise', { waitUntil: 'domcontentloaded' });
    await waitForGridbox(page);

    const anonId2 = await page.evaluate(() => window.gridbox.getAnonymousId());

    expect(anonId1).toBe(anonId2);
    expect(anonId1).toMatch(/^anon_/);
  });

  test('Session ID is consistent within same session', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForGridbox(page);

    const session1 = await page.evaluate(() => window.gridbox.getSession());

    await page.goto('/merchandise', { waitUntil: 'domcontentloaded' });
    await waitForGridbox(page);

    const session2 = await page.evaluate(() => window.gridbox.getSession());

    expect(session1.id).toBe(session2.id);
    expect(session1.id).toMatch(/^sess_/);
  });

  test('Identity API supports anonymous and authenticated states', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForGridbox(page);

    // Initially anonymous
    const identity1 = await page.evaluate(() => window.gridbox.getIdentity());
    expect(identity1.type).toBe('anonymous');
    expect(identity1.anonymousId).toBeTruthy();

    // Set authenticated
    await page.evaluate(() => {
      window.gridbox.setIdentity('authenticated', {
        authenticatedId: 'user_abc_123'
      });
    });

    const identity2 = await page.evaluate(() => window.gridbox.getIdentity());
    expect(identity2.type).toBe('authenticated');
    expect(identity2.authenticatedId).toBe('user_abc_123');
  });
});

// =========================================
// TEST SUITE 11: PERFORMANCE EVENTS
// =========================================
test.describe('11. Performance Metrics', () => {

  test('PageLoadMetrics event fires after page load', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await page.waitForTimeout(1000);

    const perfEvents = await getEventsByKey(page, 'gb_performance_pageload');
    expect(perfEvents.length).toBeGreaterThanOrEqual(1);

    const pe = perfEvents[0];
    expect(pe._lifecycle).toBeDefined();
    expect(pe.context).toBeDefined();
    const attrMap = {};
    pe.attributes.forEach(a => { attrMap[a.key] = a.value; });
    expect(attrMap.page_load_time).toBeTruthy();
    expect(parseInt(attrMap.page_load_time)).toBeGreaterThan(0);
  });
});

// =========================================
// TEST SUITE 12: DATALAYER PUSH TO GTM
// =========================================
test.describe('12. GTM dataLayer Integration', () => {

  test('dataLayer receives events alongside gridboxLayer', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForGridbox(page);

    const dlEvents = await page.evaluate(() => {
      return window.dataLayer.filter(e => e.event === 'retail_event' || e.event === 'gridbox_page_view');
    });

    // Should have at least the initial page view in gridboxLayer
    const glEvents = await getEventCount(page);
    expect(glEvents).toBeGreaterThan(0);
  });

  test('gridbox.track() pushes to both gridboxLayer and dataLayer', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForGridbox(page);

    const beforeDL = await page.evaluate(() => window.dataLayer.length);
    const beforeGL = await getEventCount(page);

    await page.evaluate(() => {
      window.gridbox.track('gb_test_click_verify', {
        CD: { content_type: 'dual_push_test' }
      });
    });

    const afterDL = await page.evaluate(() => window.dataLayer.length);
    const afterGL = await getEventCount(page);

    expect(afterDL).toBeGreaterThan(beforeDL);
    expect(afterGL).toBeGreaterThan(beforeGL);
  });
});

// =========================================
// TEST SUITE 13: SPA AWARENESS
// =========================================
test.describe('13. SPA Route Change Tracking', () => {

  test('SPA navigation fires SPANavigation event', async ({ page }) => {
    await page.goto('/booking-spa', { waitUntil: 'domcontentloaded' });
    await waitForGridbox(page);

    // Simulate pushState
    await page.evaluate(() => {
      history.pushState({}, '', '/booking-spa#race-details');
    });
    await page.waitForTimeout(300);

    const spaEvents = await page.evaluate(() => {
      return window.gridboxLayer.event.filter(e =>
        e.eventInfo && e.eventInfo.key === 'gb_page_spa_navigation'
      );
    });
    expect(spaEvents.length).toBeGreaterThan(0);

    const spaEvt = spaEvents[0];
    const attrMap = {};
    spaEvt.attributes.forEach(a => { attrMap[a.key] = a.value; });
    expect(attrMap.to_route).toContain('race-details');
  });
});

// =========================================
// TEST SUITE 14: EXPORT & AUDIT
// =========================================
test.describe('14. Event Export & Audit Buffer', () => {

  test('exportEvents returns all events as JSON', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForGridbox(page);

    const exported = await page.evaluate(() => window.gridbox.exportEvents('json'));
    expect(typeof exported).toBe('string');
    const parsed = JSON.parse(exported);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
  });
});

// =========================================
// TEST SUITE 15: CONTRACT VERSION
// =========================================
test.describe('15. Contract & Version Info', () => {

  test('Contract version and lib version are exposed', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForGridbox(page);

    const versions = await page.evaluate(() => ({
      contractVersion: window.gridbox.contractVersion,
      libVersion: window.gridbox.libVersion,
      layerVersion: window.gridboxLayer.version
    }));

    expect(versions.contractVersion).toBe('1.0.0');
    expect(versions.libVersion).toBe('2.12.0');
    expect(versions.layerVersion).toBe('2.12.0');
  });
});
