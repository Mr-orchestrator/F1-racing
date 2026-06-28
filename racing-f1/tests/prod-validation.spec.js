// @ts-check
// Production validation: verifies GTM, Adobe Launch, and the GridBox/Adobe
// datalayers on the deployed Vercel site. Run against prod with:
//   BASE_URL=https://racing-f1-rho.vercel.app npx playwright test prod-validation --project=chromium
const { test, expect } = require('@playwright/test');

const GTM_ID = 'GTM-5BMV9KLC';
const ADOBE_LAUNCH_HOST = 'assets.adobedtm.com';

// Collect tag-manager network responses so we can assert what actually loaded.
function trackTagRequests(page) {
  const responses = [];
  page.on('response', (res) => {
    const url = res.url();
    if (url.includes('googletagmanager.com') || url.includes(ADOBE_LAUNCH_HOST) || url.includes('google-analytics.com')) {
      responses.push({ url, status: res.status() });
    }
  });
  return responses;
}

test.describe('GTM (Google Tag Manager)', () => {
  test('GTM container script loads and dataLayer is initialized', async ({ page }) => {
    const tags = trackTagRequests(page);
    await page.goto('/', { waitUntil: 'networkidle' });

    // dataLayer exists and carries the gtm.js bootstrap event
    const dl = await page.evaluate(() => {
      return {
        isArray: Array.isArray(window.dataLayer),
        hasGtmStart: (window.dataLayer || []).some((e) => e && e['gtm.start']),
        gtmObject: typeof window.google_tag_manager,
        containerLoaded: !!(window.google_tag_manager && window.google_tag_manager['GTM-5BMV9KLC']),
      };
    });
    expect(dl.isArray, 'window.dataLayer should be an array').toBeTruthy();
    expect(dl.hasGtmStart, 'dataLayer should contain the gtm.start bootstrap event').toBeTruthy();
    expect(dl.containerLoaded, `GTM container ${GTM_ID} should be loaded`).toBeTruthy();

    const gtmReq = tags.find((t) => t.url.includes('gtm.js'));
    expect(gtmReq, 'gtm.js network request should have been made').toBeTruthy();
    expect(gtmReq.status, 'gtm.js should return 200').toBe(200);
  });
});

test.describe('Adobe Launch (Tags) runtime', () => {
  test('Adobe Launch embed script is reachable (not a 404 placeholder)', async ({ page }) => {
    const tags = trackTagRequests(page);
    await page.goto('/', { waitUntil: 'networkidle' });

    const launchReq = tags.find((t) => t.url.includes(ADOBE_LAUNCH_HOST));
    expect(launchReq, 'an Adobe Launch script request should have been made').toBeTruthy();
    // If this fails with 404 the embed code points to a non-existent Launch property.
    expect(launchReq.status, `Adobe Launch script ${launchReq && launchReq.url} should return 200 — a 404 means the embed is a placeholder property`).toBe(200);
  });

  test('_satellite (Launch runtime) is defined', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    // Launch defines window._satellite once its library loads.
    const hasSatellite = await page.evaluate(() => typeof window._satellite !== 'undefined');
    expect(hasSatellite, 'window._satellite should be defined once Adobe Launch loads').toBeTruthy();
  });
});

test.describe('Adobe Client Data Layer (adobeDataLayer)', () => {
  test('adobeDataLayer is an array and carries page-view context', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const adl = await page.evaluate(() => {
      const arr = window.adobeDataLayer || [];
      const last = arr[arr.length - 1] || {};
      return {
        isArray: Array.isArray(window.adobeDataLayer),
        length: arr.length,
        sampleEvent: last.event || null,
        hasPage: !!last.page,
        hasUser: !!last.user,
      };
    });
    expect(adl.isArray, 'adobeDataLayer should be an array').toBeTruthy();
    expect(adl.length, 'adobeDataLayer should have at least one pushed event').toBeGreaterThan(0);
    expect(adl.hasPage, 'pushed events should carry page context').toBeTruthy();
  });
});

test.describe('GridBox datalayer (gridboxLayer / digitalData)', () => {
  test('gridboxLayer is populated with page, user and cart on home', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const gb = await page.evaluate(() => {
      const g = window.gridboxLayer || {};
      const p = g.page && g.page.pageInfo ? g.page.pageInfo : {};
      const profile = g.user && g.user[0] && g.user[0].profile && g.user[0].profile[0] ? g.user[0].profile[0] : {};
      return {
        present: !!window.gridboxLayer,
        digitalDataAlias: window.digitalData === window.gridboxLayer,
        pageName: p.pageName || '',
        pageType: g.page && g.page.category ? g.page.category.pageType : '',
        hasProfileInfo: !!profile.profileInfo,
        hasAttributes: !!profile.attributes,
        cartIsObject: !!g.cart && typeof g.cart === 'object',
      };
    });
    expect(gb.present, 'window.gridboxLayer should exist').toBeTruthy();
    expect(gb.digitalDataAlias, 'window.digitalData should alias gridboxLayer').toBeTruthy();
    expect(gb.pageName.length, 'pageInfo.pageName should be populated').toBeGreaterThan(0);
    expect(gb.hasProfileInfo, 'user profile.profileInfo should exist').toBeTruthy();
    expect(gb.hasAttributes, 'user profile.attributes should exist').toBeTruthy();
  });
});

test.describe('E-commerce datalayer events on prod', () => {
  test('add-to-cart on merchandise mirrors to adobeDataLayer with full attributes', async ({ page }) => {
    await page.goto('/merchandise', { waitUntil: 'networkidle' });

    // Clear any prior cart state for a deterministic run.
    await page.evaluate(() => { try { localStorage.removeItem('rf1_cart'); window.gridbox && window.gridbox.clearCart && window.gridbox.clearCart(); } catch (e) {} });

    const before = await page.evaluate(() => (window.adobeDataLayer || []).length);

    const addBtn = page.locator('.add-cart-btn').first();
    await expect(addBtn, 'merchandise should render add-to-cart buttons').toBeVisible();
    await addBtn.click();

    // Wait for the new event(s) to land in the adobeDataLayer.
    await expect.poll(async () => page.evaluate((b) => (window.adobeDataLayer || []).length - b, before)).toBeGreaterThan(0);

    const result = await page.evaluate((b) => {
      const pushed = (window.adobeDataLayer || []).slice(b);
      const addEvt = pushed.find((p) => /add to cart/i.test(p.event || ''));
      return {
        events: pushed.map((p) => p.event),
        addFound: !!addEvt,
        addAttrs: addEvt ? Object.keys(addEvt.attributes || {}) : [],
        hasPage: addEvt ? !!addEvt.page : false,
        hasCart: addEvt ? !!addEvt.cart : false,
      };
    }, before);

    expect(result.addFound, `an add-to-cart event should fire (got: ${result.events.join(', ')})`).toBeTruthy();
    expect(result.addAttrs).toEqual(expect.arrayContaining(['product_id', 'product_name', 'product_price']));
    expect(result.hasPage, 'add-to-cart event should carry page context').toBeTruthy();
    expect(result.hasCart, 'add-to-cart event should carry cart snapshot').toBeTruthy();
  });

  test('wishlist + search header controls exist on a content page', async ({ page }) => {
    await page.goto('/merchandise', { waitUntil: 'networkidle' });
    await expect(page.locator('[data-track="header-actions_click_wishlist"]')).toBeVisible();
    await expect(page.locator('[data-track="header-actions_click_search"]')).toBeVisible();
    // Injected card controls
    expect(await page.locator('.wishlist-btn').count()).toBeGreaterThan(0);
    expect(await page.locator('.quick-view-btn').count()).toBeGreaterThan(0);
  });
});

test.describe('Footer legal links resolve (no dead "#")', () => {
  test('Privacy and Terms footer links point to real pages', async ({ page }) => {
    await page.goto('/cart', { waitUntil: 'networkidle' });
    const privacyHref = await page.getAttribute('[data-track="footer-legal_click_privacy"]', 'href');
    const termsHref = await page.getAttribute('[data-track="footer-legal_click_terms"]', 'href');
    expect(privacyHref).toContain('privacy');
    expect(termsHref).toContain('terms');
  });
});
