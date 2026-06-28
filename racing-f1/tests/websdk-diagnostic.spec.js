// @ts-check
// Web SDK Deep Diagnostic — finds out exactly why rules aren't firing.
// Run: BASE_URL=https://racing-f1-rho.vercel.app npx playwright test websdk-diagnostic --project=chromium
const { test, expect } = require('@playwright/test');

test.setTimeout(90000);

test('Deep diagnostic — what is actually published and firing', async ({ page }) => {
  const edgeCalls = [];
  const aaCalls = [];
  const allRequests = [];

  page.on('request', (req) => {
    const url = req.url();
    allRequests.push(url);
    if (url.includes('edge.adobedc.net')) {
      let postData = null;
      try { postData = req.postDataJSON(); } catch(e) {}
      edgeCalls.push({ url, postData });
    }
    if (url.includes('2o7.net') || url.includes('omtrdc.net')) {
      aaCalls.push(url);
    }
  });

  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(3000);

  // ──────────────────────────────────────────────────────
  // PART 1: What's loaded?
  // ──────────────────────────────────────────────────────
  const runtime = await page.evaluate(() => {
    const sat = window._satellite || {};
    const container = sat._container || {};
    const extensions = container.extensions || {};
    const rules = container.rules || [];
    const dataElements = container.dataElements || {};

    // List all rule names with their event types and actions
    const ruleDetails = rules.map(r => ({
      name: r.name,
      events: (r.events || []).map(e => ({
        modulePath: e.modulePath,
        settings: JSON.stringify(e.settings).substring(0, 150)
      })),
      actions: (r.actions || []).map(a => ({
        modulePath: a.modulePath,
        settings: JSON.stringify(a.settings).substring(0, 150)
      }))
    }));

    return {
      hasAlloy: typeof window.alloy === 'function',
      hasSatellite: !!window._satellite,
      buildDate: sat.buildInfo?.buildDate,
      libraryName: sat.buildInfo?.libraryName || 'unknown',
      stage: container.property?.settings?.id || 'unknown',
      extensionNames: Object.keys(extensions),
      dataElementNames: Object.keys(dataElements),
      ruleCount: rules.length,
      rules: ruleDetails,
      // Check the data element output
      xdmDataElement: (() => {
        try { return sat.getVar('XDM - ExperienceEvent'); } catch(e) { return { error: e.message }; }
      })()
    };
  });

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║   ADOBE LAUNCH RUNTIME INSPECTION                           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('  Build date:    ', runtime.buildDate);
  console.log('  alloy global:  ', runtime.hasAlloy ? '✓' : '✗');
  console.log('  _satellite:    ', runtime.hasSatellite ? '✓' : '✗');
  console.log('  Extensions:    ', runtime.extensionNames.join(', '));
  console.log('  Data Elements: ', runtime.dataElementNames.join(', '));
  console.log('  Total rules:   ', runtime.ruleCount);

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║   ALL RULES IN PUBLISHED LIBRARY                            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  runtime.rules.forEach((r, i) => {
    console.log(`\n  Rule ${i + 1}: ${r.name}`);
    console.log(`    Events:`);
    r.events.forEach(e => console.log(`      - ${e.modulePath}`));
    console.log(`    Actions:`);
    r.actions.forEach(a => console.log(`      - ${a.modulePath}`));
  });

  // ──────────────────────────────────────────────────────
  // PART 2: Identify Web SDK vs AA rules
  // ──────────────────────────────────────────────────────
  const webSdkActions = runtime.rules.filter(r =>
    r.actions.some(a => a.modulePath?.toLowerCase().includes('alloy') ||
                       a.modulePath?.toLowerCase().includes('web-sdk') ||
                       a.modulePath?.toLowerCase().includes('webexperienceplatform'))
  );

  const aaActions = runtime.rules.filter(r =>
    r.actions.some(a => a.modulePath?.toLowerCase().includes('adobe-analytics') ||
                       a.modulePath?.toLowerCase().includes('appmeasurement'))
  );

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║   RULE ACTION CLASSIFICATION                                ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`  Rules with Web SDK actions: ${webSdkActions.length}`);
  webSdkActions.forEach(r => console.log(`    ✓ ${r.name}`));
  console.log(`  Rules with AA actions:      ${aaActions.length}`);
  aaActions.forEach(r => console.log(`    ✗ ${r.name} (still firing AA Send Beacon)`));

  // ──────────────────────────────────────────────────────
  // PART 3: Test alloy directly
  // ──────────────────────────────────────────────────────
  const directTest = await page.evaluate(() => {
    if (typeof window.alloy !== 'function') return { success: false, error: 'alloy not defined' };
    return window.alloy('sendEvent', {
      xdm: {
        eventType: 'web.webpagedetails.pageViews',
        web: { webPageDetails: { name: 'Diagnostic Test', pageViews: { value: 1 } } }
      }
    }).then(() => ({ success: true }))
      .catch(err => ({ success: false, error: err.message || String(err) }));
  });

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║   DIRECT alloy("sendEvent") TEST                            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  if (directTest.success) {
    console.log('  ✓ Direct alloy call succeeded');
  } else {
    console.log('  ✗ Direct alloy call FAILED:', directTest.error);
  }

  await page.waitForTimeout(2000);

  // ──────────────────────────────────────────────────────
  // PART 4: Network analysis
  // ──────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║   NETWORK TRAFFIC                                           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`  Web SDK edge calls: ${edgeCalls.length}`);
  console.log(`  Legacy AA calls:    ${aaCalls.length}`);

  edgeCalls.forEach((c, i) => {
    const e = c.postData?.events?.[0]?.xdm;
    console.log(`\n  Edge ${i + 1}: ${e?.eventType || 'unknown'}`);
  });

  aaCalls.forEach((url, i) => {
    console.log(`\n  AA ${i + 1}: ${url.substring(0, 100)}...`);
  });

  // ──────────────────────────────────────────────────────
  // PART 5: XDM data element check
  // ──────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║   XDM DATA ELEMENT OUTPUT                                   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  if (runtime.xdmDataElement && !runtime.xdmDataElement.error) {
    console.log('  ✓ Data element resolves');
    console.log('  Output:', JSON.stringify(runtime.xdmDataElement).substring(0, 300));
  } else {
    console.log('  ✗ Data element error:', runtime.xdmDataElement?.error || 'no output');
  }

  // ──────────────────────────────────────────────────────
  // PART 6: Diagnosis & Recommendation
  // ──────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║   DIAGNOSIS                                                 ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  const issues = [];
  if (!runtime.hasAlloy) issues.push('Web SDK not loaded — extension may not be in published library');
  if (webSdkActions.length === 0) issues.push('NO rules contain Web SDK Send Event actions');
  if (aaActions.length > 0) issues.push(`${aaActions.length} rules still have AA Send Beacon actions`);
  if (edgeCalls.length === 0 && runtime.hasAlloy) issues.push('alloy exists but no edge calls — rules not firing or Send Event not configured');
  if (aaCalls.length > 0) issues.push(`AppMeasurement still firing (${aaCalls.length} calls) — AA extension still active`);
  if (directTest.success && edgeCalls.length === 0) issues.push('Manual alloy() works but rule-triggered alloy() does not — rule action misconfigured');

  if (issues.length === 0) {
    console.log('  ✓ All systems firing correctly');
  } else {
    issues.forEach(i => console.log(`  ✗ ${i}`));
  }
});
