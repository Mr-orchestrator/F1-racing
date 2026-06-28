// @ts-check
// Test if single page load fires multiple pageView calls (REAL duplicates)
const { test } = require('@playwright/test');

test.setTimeout(60000);

const isWebSdkCall = (url) => /\.data\.adobedc\.net\/ee\//.test(url) ||
                              /edge\.adobedc\.net\/ee\//.test(url) ||
                              /demdex\.net\/ee\//.test(url);

test('Single page load — count pageView calls', async ({ page }) => {
  const allCalls = [];
  page.on('request', (req) => {
    const url = req.url();
    if (isWebSdkCall(url)) {
      let postData = null;
      try { postData = req.postDataJSON(); } catch(e) {}
      allCalls.push({ url, postData, ts: Date.now() });
    }
  });

  console.log('\n=== Loading HOME page ONLY (no navigation) ===');
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(5000);

  // Count pageView calls
  const pageViewCalls = allCalls.filter(c =>
    (c.postData?.events || []).some(e => e.xdm?.eventType === 'web.webpagedetails.pageViews')
  );

  console.log(`\nTotal Web SDK calls on single home load: ${allCalls.length}`);
  console.log(`Total pageView calls: ${pageViewCalls.length}`);

  if (pageViewCalls.length > 1) {
    console.log(`\n⚠️  REAL DUPLICATES — 1 page load fired ${pageViewCalls.length} pageViews:\n`);
    pageViewCalls.forEach((c, i) => {
      const e = c.postData.events[0].xdm;
      console.log(`  Call ${i + 1}:`);
      console.log(`    URL:       ${e.web?.webPageDetails?.URL}`);
      console.log(`    Page Name: ${e.web?.webPageDetails?.name}`);
      console.log(`    Timestamp: ${e.timestamp}`);
      console.log(`    Browser ts: ${c.ts}`);
    });
  } else {
    console.log(`\n✓ Single pageView per page load (no duplicates)`);
  }

  // Check adobeDataLayer for any events
  const dl = await page.evaluate(() => (window.adobeDataLayer || []).map(e => e.event).filter(Boolean));
  console.log(`\nadobeDataLayer events: ${JSON.stringify(dl)}`);
});

test('Repeat — Navigate to /merchandise after 5 sec wait', async ({ page }) => {
  const allCalls = [];
  page.on('request', (req) => {
    const url = req.url();
    if (isWebSdkCall(url)) {
      let postData = null;
      try { postData = req.postDataJSON(); } catch(e) {}
      allCalls.push({ url, postData, ts: Date.now() });
    }
  });

  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(5000);
  const homePageViews = allCalls.filter(c =>
    (c.postData?.events || []).some(e => e.xdm?.eventType === 'web.webpagedetails.pageViews')
  ).length;

  console.log(`\nHome page → ${homePageViews} pageView calls`);

  await page.goto('/merchandise', { waitUntil: 'load' });
  await page.waitForTimeout(5000);
  const totalPageViews = allCalls.filter(c =>
    (c.postData?.events || []).some(e => e.xdm?.eventType === 'web.webpagedetails.pageViews')
  ).length;

  console.log(`After /merchandise nav → total pageView calls: ${totalPageViews}`);
  console.log(`Merchandise page added: ${totalPageViews - homePageViews} pageView calls`);

  if ((totalPageViews - homePageViews) > 1) {
    console.log(`\n⚠️  /merchandise page fires ${totalPageViews - homePageViews} pageViews — DUPLICATE`);
  } else {
    console.log(`\n✓ Each page load = 1 pageView (expected)`);
  }
});
