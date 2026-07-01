// @ts-check
/**
 * GOOGLE → CHATGPT → CRAWL-OUR-URL scenario
 * ==========================================
 * Semi-interactive Playwright test. Launches a HEADED browser with a persistent user-data
 * directory so your Google/ChatGPT login carries across runs.
 *
 * Flow it drives:
 *   1. Open google.com → search "chatgpt" → click the first ChatGPT result
 *   2. Pause for you to log in (ChatGPT auth) — first run only, then it's remembered
 *   3. Type the prompt asking ChatGPT to browse our URL
 *   4. Wait for the crawl to happen (ChatGPT's browsing tool hits our middleware)
 *   5. Print exactly how to verify: Tealium Live Events + i.gif logs + Vercel logs
 *
 * Run
 *   BASE_URL_MW=https://racing-f1-rho.vercel.app \
 *     npx playwright test tests/google-chatgpt-crawl-scenario.spec.js --project=chromium --headed --workers=1
 *
 * First run: 30-60s for you to log in. Session persists in ./playwright/.auth for next time.
 */
const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const MW_URL = process.env.BASE_URL_MW || 'https://racing-f1-rho.vercel.app';
const TARGET_PATH = '/tickets';
const TARGET_URL = MW_URL + TARGET_PATH + '?src=chatgpt-verify-' + Date.now();

// Persistent auth state (survives runs so you don't re-login every time)
const AUTH_DIR = path.join(__dirname, '..', 'playwright', '.auth', 'chatgpt');
fs.mkdirSync(AUTH_DIR, { recursive: true });

test.describe.configure({ mode: 'serial' });

test('drive Google → ChatGPT → ask to crawl our URL, then verify', async () => {
  test.setTimeout(360000); // 6 minutes total

  // Launch a persistent-context browser. This looks/behaves like your normal Chrome, so
  // Google/ChatGPT are much less likely to block it as a bot.
  const context = await chromium.launchPersistentContext(AUTH_DIR, {
    headless: false, // must be headed for anti-bot to accept
    viewport: { width: 1280, height: 820 },
    args: ['--disable-blink-features=AutomationControlled']
  });
  const page = context.pages()[0] || (await context.newPage());

  // Prove our own crawler-detection pipe is up BEFORE we drive ChatGPT — if this fails,
  // don't waste time on the browser flow.
  console.log('\n[precheck] Confirming our middleware detects ChatGPT-User…');
  const precheck = await context.request.get(MW_URL + '/', {
    headers: { 'user-agent': 'Mozilla/5.0 AppleWebKit/537.36 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)' }
  });
  const h = precheck.headers();
  expect(h['x-bot-detected'], 'middleware is not detecting ChatGPT-User — investigate before running ChatGPT flow').toBe('true');
  expect(h['x-bot-name']).toBe('ChatGPT-User');
  expect(h['x-bot-track-sent'], 'server-side track not initiated — TEALIUM_COLLECT_URL not set?').toBe('true');
  console.log(`  ✓ middleware detects ChatGPT-User and initiated POST to ${h['x-bot-track-url']}`);

  // Step 1 — Google search
  console.log('\n[step 1] Navigating to google.com and searching "chatgpt"…');
  await page.goto('https://www.google.com/search?q=chatgpt&hl=en', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1500);
  // Google's consent banner (EU) — best-effort click
  const consentBtn = await page.$('button:has-text("Accept all"), button:has-text("Reject all"), button[aria-label*="Accept"]');
  if (consentBtn) await consentBtn.click().catch(() => {});
  await page.waitForTimeout(800);

  // Click the first ChatGPT result (try known selectors, fall back to text match)
  console.log('[step 2] Opening the first ChatGPT link from results…');
  const linkCandidates = [
    'a[href*="chat.openai.com"]',
    'a[href*="chatgpt.com"]',
    'a:has-text("ChatGPT")'
  ];
  let opened = false;
  for (const sel of linkCandidates) {
    const link = await page.$(sel);
    if (link) { await link.click(); opened = true; break; }
  }
  if (!opened) {
    console.log('  ⚠ could not find a ChatGPT link on the Google results page. Falling back to direct navigation.');
    await page.goto('https://chatgpt.com', { waitUntil: 'domcontentloaded', timeout: 45000 });
  }
  await page.waitForLoadState('domcontentloaded');

  // Step 3 — pause for login if needed
  console.log('\n════════════════════════════════════════════════════════════════════════');
  console.log(' MANUAL STEP: log into ChatGPT if the login page is showing.');
  console.log(' You have up to 3 minutes. Once you see the chat composer, do NOTHING —');
  console.log(' the test will type the prompt itself.');
  console.log('════════════════════════════════════════════════════════════════════════\n');

  // Wait for the composer to appear (either #prompt-textarea or a contenteditable input)
  const composerSel = 'textarea#prompt-textarea, [contenteditable="true"][id*="prompt"], div[role="textbox"]';
  await page.waitForSelector(composerSel, { timeout: 180000 });
  console.log('[step 3] Composer detected. Typing the prompt…');

  const prompt =
    `Please open the URL ${TARGET_URL} using your web browsing tool, ` +
    `read the page, and tell me the page title plus the first three ticket categories. ` +
    `Do not answer from memory — use browsing.`;

  const composer = await page.$(composerSel);
  await composer.click();
  await composer.type(prompt, { delay: 20 });
  await page.waitForTimeout(500);
  // Send: Enter (most reliable across ChatGPT versions)
  await composer.press('Enter');

  // Step 4 — wait for ChatGPT to actually browse (30-60s typical)
  console.log('\n[step 4] Prompt sent. Waiting up to 90s for ChatGPT to browse our URL…');
  await page.waitForTimeout(90000);

  // Step 5 — post-crawl verification instructions
  console.log('\n════════════════════════════════════════════════════════════════════════');
  console.log(' VERIFICATION — check ONE of these to confirm the crawl was detected:');
  console.log('');
  console.log(' 1. Tealium Live Events (if TEALIUM_COLLECT_URL points at collect.tealiumiq.com):');
  console.log('       my.tealiumiq.com → EventStream → Live Events → filter tealium_event=ai_crawler_visit');
  console.log(`       You should see one event with page_url containing ${TARGET_URL}`);
  console.log('');
  console.log(' 2. Vercel logs (self-hosted receiver):');
  console.log(`       vercel logs ${MW_URL} | grep bot-collect | tail -5`);
  console.log('       Expected: a [bot-collect] line with bot_name=ChatGPT-User (or OAI-SearchBot / GPTBot)');
  console.log('');
  console.log(' 3. Manual curl (proves the pipe end-to-end):');
  console.log(`       curl -A "ChatGPT-User/1.0" ${TARGET_URL}`);
  console.log(`       → X-Bot-Track-Sent: true confirms the POST fired`);
  console.log('════════════════════════════════════════════════════════════════════════\n');

  await context.close();
});
