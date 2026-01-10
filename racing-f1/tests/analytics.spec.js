// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('GridBox Analytics Layer', () => {

  test('gridboxLayer is initialized with W3C structure', async ({ page }) => {
    await page.goto('/');
    
    const gridboxLayer = await page.evaluate(() => window.gridboxLayer);
    
    expect(gridboxLayer).toBeDefined();
    expect(gridboxLayer.version).toBeDefined();
    expect(gridboxLayer.event).toBeInstanceOf(Array);
    expect(gridboxLayer.page).toBeDefined();
    expect(gridboxLayer.page.pageInfo).toBeDefined();
    expect(gridboxLayer.user).toBeInstanceOf(Array);
  });

  test('gridbox API functions are available', async ({ page }) => {
    await page.goto('/');
    
    const hasGridbox = await page.evaluate(() => {
      return typeof window.gridbox !== 'undefined' &&
             typeof window.gridbox.view === 'function' &&
             typeof window.gridbox.link === 'function' &&
             typeof window.gridbox.track === 'function';
    });
    
    expect(hasGridbox).toBe(true);
  });

  test('gridbox.link() pushes event to gridboxLayer.event', async ({ page }) => {
    await page.goto('/');
    
    const eventCount = await page.evaluate(() => {
      const before = window.gridboxLayer.event.length;
      window.gridbox.link({
        event_category: 'test',
        event_action: 'click',
        event_label: 'test-button'
      });
      return {
        before,
        after: window.gridboxLayer.event.length
      };
    });
    
    expect(eventCount.after).toBeGreaterThan(eventCount.before);
  });

  test('events have W3C structure with category and eventInfo', async ({ page }) => {
    await page.goto('/');
    
    const lastEvent = await page.evaluate(() => {
      window.gridbox.link({
        event_category: 'product',
        event_action: 'view',
        event_label: 'ticket-001'
      });
      return window.gridboxLayer.event[window.gridboxLayer.event.length - 1];
    });
    
    expect(lastEvent.category).toBeDefined();
    expect(lastEvent.category.primaryCategory).toBe('UserEvent');
    expect(lastEvent.eventInfo).toBeDefined();
    expect(lastEvent.eventInfo.timeStamp).toBeDefined();
  });

  test('events include attributes array', async ({ page }) => {
    await page.goto('/');
    
    const lastEvent = await page.evaluate(() => {
      window.gridbox.link({
        event_category: 'cart',
        event_action: 'add',
        event_label: 'product-add',
        product_id: 'PROD-001',
        price: '299.99'
      });
      return window.gridboxLayer.event[window.gridboxLayer.event.length - 1];
    });
    
    expect(lastEvent.attributes).toBeInstanceOf(Array);
    expect(lastEvent.attributes.length).toBeGreaterThan(0);
    expect(lastEvent.attributes[0]).toHaveProperty('key');
    expect(lastEvent.attributes[0]).toHaveProperty('value');
  });

  test('SPA page view tracking works', async ({ page }) => {
    await page.goto('/booking-spa.html');
    
    // Wait for initial page view
    await page.waitForTimeout(500);
    
    const events = await page.evaluate(() => {
      return window.gridboxLayer.event.filter(e => 
        e.category && e.category.primaryCategory === 'PageView'
      );
    });
    
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].eventInfo.pageId).toBe('TICKETSELECTION');
  });

  test('SPA navigation triggers new page view', async ({ page }) => {
    await page.goto('/booking-spa.html');
    
    // Select options and navigate
    await page.click('.race-option[data-race="monaco"]');
    await page.click('.ticket-type[data-type="general"]');
    await page.click('#btn-continue-to-details');
    
    await page.waitForTimeout(300);
    
    const pageViews = await page.evaluate(() => {
      return window.gridboxLayer.event.filter(e => 
        e.category && e.category.primaryCategory === 'PageView'
      );
    });
    
    // Should have at least 2 page views (initial + navigation)
    expect(pageViews.length).toBeGreaterThanOrEqual(2);
    
    // Last page view should be TRAVELERDETAILS
    const lastPageView = pageViews[pageViews.length - 1];
    expect(lastPageView.eventInfo.pageId).toBe('TRAVELERDETAILS');
  });

  test('user events tracked in SPA', async ({ page }) => {
    await page.goto('/booking-spa.html');
    
    // Perform user action
    await page.click('.race-option[data-race="monaco"]');
    
    await page.waitForTimeout(300);
    
    const userEvents = await page.evaluate(() => {
      return window.gridboxLayer.event.filter(e => 
        e.category && e.category.primaryCategory === 'UserEvent'
      );
    });
    
    expect(userEvents.length).toBeGreaterThan(0);
  });

  test('data-track attribute triggers events', async ({ page }) => {
    await page.goto('/');
    
    // Find and click an element with data-track
    const trackedElement = page.locator('[data-track]').first();
    
    if (await trackedElement.isVisible()) {
      const beforeCount = await page.evaluate(() => window.gridboxLayer.event.length);
      await trackedElement.click();
      await page.waitForTimeout(300);
      const afterCount = await page.evaluate(() => window.gridboxLayer.event.length);
      
      expect(afterCount).toBeGreaterThan(beforeCount);
    }
  });

  test('page info is updated in gridboxLayer', async ({ page }) => {
    await page.goto('/');
    
    const pageInfo = await page.evaluate(() => window.gridboxLayer.page);
    
    expect(pageInfo.pageInfo.pageName).toBeTruthy();
  });

  test('user agent info is captured', async ({ page }) => {
    await page.goto('/');
    
    const userInfo = await page.evaluate(() => 
      window.gridboxLayer.user[0].profile[0].profileInfo
    );
    
    expect(userInfo.userAgent).toBeTruthy();
    expect(userInfo.deviceType).toBeTruthy();
  });

});
