// @ts-check
/**
 * GOOGLE → CLAUDE → CRAWL-OUR-URL scenario (parallel to the ChatGPT / Gemini / Perplexity ones)
 * ==============================================================================================
 * Anthropic splits its crawlers into THREE identities (developers: docs.anthropic.com):
 *   - ClaudeBot        (crawler)  — training-data collection
 *   - Claude-SearchBot (crawler)  — search indexing
 *   - Claude-User      (agent)    — USER-INITIATED fetch when you ask Claude chat to read a URL.
 *                                   This one checks /robots.txt first, then fetches the page.
 *
 * The Claude chat "browse this URL" feature sends Claude-User/1.0. That is the identity this
 * scenario proves end-to-end: prompt Claude to read our target URL, then confirm a Claude-User
 * hit reached our middleware (Vercel logs) and/or Tealium.
 *
 * Registry now includes Claude-User + Claude-SearchBot (added alongside the pre-existing
 * ClaudeBot / Claude-Web). Precheck below asserts detection before the live run.
 *
 * Run
 *   BASE_URL_MW=https://racing-f1-rho.vercel.app \
 *     npx playwright test tests/google-claude-crawl-scenario.spec.js --project=chromium --headed --workers=1
 */
const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const MW_URL = process.env.BASE_URL_MW || 'https://racing-f1-rho.vercel.app';
const TARGET_PATH = '/tickets';
const TARGET_URL = MW_URL + TARGET_PATH + '?src=claude-verify-' + Date.now();

const AUTH_DIR = path.join(__dirname, '..', 'playwright', '.auth', 'claude');
fs.mkdirSync(AUTH_DIR, { recursive: true });

test.describe.configure({ mode: 'serial' });

test('drive Google → Claude → ask to fetch our URL, then verify', async () => {
  test.setTimeout(300000);

  const context = await chromium.launchPersistentContext(AUTH_DIR, {
    headless: false,
    viewport: { width: 1280, height: 820 },
    args: ['--disable-blink-features=AutomationControlled']
  });
  const page = context.pages()[0] || (await context.newPage());

  console.log('\n[precheck] Confirming our middleware detects Claude-User…');
  const precheck = await context.request.get(MW_URL + '/', {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; Claude-User/1.0; +Claude-User@anthropic.com)' }
  });
  const h = precheck.headers();
  expect(h['x-bot-detected'], 'middleware is not detecting Claude-User — deploy the registry fix').toBe('true');
  expect(h['x-bot-name']).toBe('Claude-User');
  expect(h['x-bot-track-sent'], 'server-side track not initiated — TEALIUM_COLLECT_URL not set?').toBe('true');
  console.log(`  ✓ middleware detects Claude-User and initiated POST to ${h['x-bot-track-url']}`);
  console.log('  NOTE: this precheck line fires at test start (page=/). Do not mistake it for the');
  console.log('  real Claude crawl further down the log tail (page=/tickets).');

  // Step 1 — Google search
  console.log('\n[step 1] Navigating to google.com and searching "claude ai"…');
  await page.goto('https://www.google.com/search?q=claude+ai&hl=en', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1500);
  const consentBtn = await page.$('button:has-text("Accept all"), button:has-text("Reject all"), button[aria-label*="Accept"]');
  if (consentBtn) await consentBtn.click().catch(() => {});
  await page.waitForTimeout(800);

  console.log('[step 2] Opening the first Claude link from results…');
  const linkCandidates = ['a[href*="claude.ai"]', 'a:has-text("Claude")'];
  let opened = false;
  for (const sel of linkCandidates) {
    const link = await page.$(sel);
    if (link) { await link.click(); opened = true; break; }
  }
  if (!opened) {
    console.log('  ⚠ could not find a Claude link on the Google results page. Falling back to direct navigation.');
    await page.goto('https://claude.ai/new', { waitUntil: 'domcontentloaded', timeout: 45000 });
  }
  await page.waitForLoadState('domcontentloaded');

  console.log('\n════════════════════════════════════════════════════════════════════════');
  console.log(' MANUAL STEP: log into Claude if prompted.');
  console.log(' You have up to 2 minutes. Once you see the chat composer, do NOTHING —');
  console.log(' the test will type the prompt itself.');
  console.log(' NOTE: URL-fetching may require the web-search / browsing capability enabled');
  console.log('       on your Claude account for Claude-User to actually go fetch the page.');
  console.log('════════════════════════════════════════════════════════════════════════\n');

  // Claude's composer is a contenteditable ProseMirror div.
  const composerSel = 'div[contenteditable="true"], [role="textbox"], textarea';
  await page.waitForSelector(composerSel, { timeout: 120000 });
  console.log('[step 3] Composer detected. Typing the prompt…');

  const prompt =
    `Please fetch and read ${TARGET_URL} live using web browsing, then tell me the page title ` +
    `and the first three ticket categories listed on that page. Do not answer from memory.`;

  const composer = await page.$(composerSel);
  await composer.click();
  await composer.type(prompt, { delay: 20 });
  await page.waitForTimeout(500);
  await composer.press('Enter');

  console.log('\n[step 4] Prompt sent. Waiting up to 60s for Claude to fetch our URL…');
  await page.waitForTimeout(60000);

  console.log('\n════════════════════════════════════════════════════════════════════════');
  console.log(' VERIFICATION — check ONE of these to confirm the crawl was detected:');
  console.log('');
  console.log(' 1. Tealium Live Events:');
  console.log('       my.tealiumiq.com → EventStream → Live Events → filter tealium_event=ai_crawler_visit');
  console.log(`       Look for page_url containing ${TARGET_URL}`);
  console.log('       (profile depends on TEALIUM_COLLECT_URL: f1racing for collect.tealiumiq.com,');
  console.log('        cookieless-demo for the HTTP-API-Advanced .../cookieless-demo/rivqkx endpoint)');
  console.log('');
  console.log(' 2. Vercel logs:');
  console.log(`       vercel logs ${MW_URL} | grep bot-track`);
  console.log('       Expected: bot=Claude-User on page=/tickets, AFTER the precheck line (page=/).');
  console.log('');
  console.log(' 3. CAVEAT: Claude-User fetches /robots.txt FIRST. If you see a Claude-User hit on');
  console.log('    page=/robots.txt but NOT on /tickets, Claude read robots.txt then declined to');
  console.log('    fetch the page (or answered from context) — detection still worked.');
  console.log('════════════════════════════════════════════════════════════════════════\n');

  await context.close();
});
