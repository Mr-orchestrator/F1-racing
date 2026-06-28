// @ts-check
// Find which rules are causing duplicate Web SDK calls
const { test } = require('@playwright/test');

test.setTimeout(60000);

test('Identify duplicate-causing rules', async ({ page }) => {
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  const ruleAnalysis = await page.evaluate(() => {
    const container = window._satellite?._container || {};
    const rules = container.rules || [];

    // Group rules by their event trigger
    const triggerGroups = {};

    rules.forEach(rule => {
      (rule.events || []).forEach(event => {
        // Build a signature for the event trigger
        const sig = `${event.modulePath}|${JSON.stringify(event.settings || {})}`.substring(0, 200);
        if (!triggerGroups[sig]) triggerGroups[sig] = [];
        triggerGroups[sig].push({
          ruleName: rule.name,
          actions: (rule.actions || []).map(a => a.modulePath?.split('/').pop() || a.modulePath)
        });
      });
    });

    // Find triggers with multiple rules
    const duplicates = Object.entries(triggerGroups)
      .filter(([,rules]) => rules.length > 1)
      .map(([sig, rules]) => ({ trigger: sig, ruleCount: rules.length, rules }));

    return { totalRules: rules.length, duplicateGroups: duplicates };
  });

  console.log(`\nTotal rules: ${ruleAnalysis.totalRules}`);
  console.log(`Triggers shared by multiple rules: ${ruleAnalysis.duplicateGroups.length}\n`);

  ruleAnalysis.duplicateGroups.forEach((g, i) => {
    console.log(`Group ${i + 1}: ${g.ruleCount} rules share this trigger:`);
    console.log(`  Trigger: ${g.trigger.substring(0, 150)}`);
    g.rules.forEach(r => {
      console.log(`    • "${r.ruleName}" → actions: ${r.actions.join(', ')}`);
    });
    console.log('');
  });

  // Look specifically for Library Loaded duplicates (causes pageView dupes)
  const libraryLoadedRules = await page.evaluate(() => {
    const rules = window._satellite?._container?.rules || [];
    return rules.filter(r =>
      (r.events || []).some(e => e.modulePath?.includes('library-loaded') || e.modulePath?.includes('page-top'))
    ).map(r => ({
      name: r.name,
      actions: (r.actions || []).map(a => a.modulePath?.split('/').pop())
    }));
  });

  console.log(`Rules listening to "Library Loaded (Page Top)": ${libraryLoadedRules.length}`);
  libraryLoadedRules.forEach(r => console.log(`  • ${r.name}`));
});
