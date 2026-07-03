// @ts-check
/**
 * CLAUDE.AI → BROWSE OUR URL scenario
 * =====================================
 * Fixes vs original:
 *  1. Goes DIRECTLY to claude.ai/new — skips unreliable Google search step
 *  2. Explicitly clicks the Search/Browse tool button BEFORE typing (forces tool activation)
 *  3. Stronger prompt wording that names the tool explicitly
 *  4. Waits for Claude's response to contain ticket content before closing
 *  5. Logs Claude's actual response text for debugging
 *  6. Falls back to direct URL navigation if composer not found quickly
 *
 * Claude-User UA behavior:
 *   - Checks /robots.txt first (strict — aborts if 404, we now return 200 Allow: /)
 *   - Then fetches the actual page
 *   - So you'll see TWO [bot-track] lines: page=/robots.txt then page=/tickets
 *
 * Run
 *   BASE_URL_MW=https://racing-f1-rho.vercel.app \
 *     npx playwright test tests/google-claude-crawl-scenario.spec.js --project=chromium --headed --workers=1
 */
const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const MW_URL = process.env.BASE_URL_MW || 'https://racing-f1-rho.vercel.app';
const TARGET_URL = MW_URL + '/tickets?src=claude-verify-' + Date.now();

const AUTH_DIR = path.join(__dirname, '..', 'playwright', '.auth', 'claude');
fs.mkdirSync(AUTH_DIR, { recursive: true });

test.describe.configure({ mode: 'serial' });

test('Claude.ai → browse our URL → verify Claude-User hit middleware', async () => {
  test.setTimeout(300000);

  const context = await chromium.launchPersistentContext(AUTH_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled']
  });
  const page = context.pages()[0] || (await context.newPage());

  // ── PRECHECK: confirm middleware detects Claude-User before we even open the browser ──
  console.log('\n[precheck] Confirming middleware detects Claude-User on prod…');
  const precheck = await context.request.get(MW_URL + '/', {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; Claude-User/1.0; +Claude-User@anthropic.com)' }
  });
  const h = precheck.headers();
  expect(h['x-crawl-agent-detected'], 'middleware not detecting Claude-User — check lib/bot-detection.js').toBe('true');
  expect(h['x-crawl-agent-track-sent'], 'TEALIUM_COLLECT_URL not set or POST failed').toBe('true');
  console.log(`  ✓ Claude-User detected, track sent to ${h['x-crawl-agent-track-url']}`);

  // ── STEP 1: Go directly to claude.ai (skip Google search — it's unreliable) ──
  console.log('\n[step 1] Navigating directly to claude.ai/new…');
  await page.goto('https://claude.ai/new', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);

  // ── STEP 2: Handle login if needed (persistent auth saves session after first run) ──
  const isLoginPage = page.url().includes('login') || page.url().includes('auth');
  if (isLoginPage) {
    console.log('\n════════════════════════════════════════════════════════════════════════');
    console.log(' MANUAL STEP: Log into Claude.ai now.');
    console.log(' You have 3 minutes. After login, wait for the chat composer to appear.');
    console.log(' Session will be saved — future runs skip this step.');
    console.log('════════════════════════════════════════════════════════════════════════\n');
    // Wait for redirect away from login
    await page.waitForURL(url => !url.toString().includes('login') && !url.toString().includes('auth'), { timeout: 180000 });
    await page.waitForTimeout(2000);
  }

  // ── STEP 3: Wait for the composer ──
  console.log('[step 2] Waiting for chat composer…');
  const composerSel = [
    'div[contenteditable="true"]',
    '[data-testid="chat-input"]',
    'div.ProseMirror',
    '[role="textbox"]',
    'textarea'
  ].join(', ');

  await page.waitForSelector(composerSel, { timeout: 60000 });
  await page.waitForTimeout(1000);
  console.log('  ✓ Composer found');

  // ── STEP 4: Click the Search/Browse tool button to activate web browsing ──
  console.log('[step 3] Looking for Search / Browse tool button to activate…');
  const toolButtonSels = [
    'button[aria-label*="Search"]',
    'button[aria-label*="Browse"]',
    'button[aria-label*="Web"]',
    'button[title*="Search"]',
    'button[title*="Browse"]',
    '[data-testid*="search"]',
    '[data-testid*="tool"]',
    'button:has-text("Search")',
    'button:has-text("Browse")'
  ];

  let toolActivated = false;
  for (const sel of toolButtonSels) {
    const btn = await page.$(sel);
    if (btn) {
      await btn.click();
      await page.waitForTimeout(800);
      console.log(`  ✓ Clicked tool button: ${sel}`);
      toolActivated = true;
      break;
    }
  }
  if (!toolActivated) {
    console.log('  ⚠ No explicit tool button found — Claude may auto-enable browsing from prompt.');
    console.log('    If fetch still fails, manually click the search icon in the composer toolbar.');
  }

  // ── STEP 5: Type the prompt with explicit tool instruction ──
  console.log(`\n[step 4] Typing prompt… target: ${TARGET_URL}`);
  const prompt =
    `Use your web search and browsing tool to fetch this URL right now: ${TARGET_URL}\n\n` +
    `Tell me:\n` +
    `1. The exact page title\n` +
    `2. The first three ticket category names and their prices\n\n` +
    `Important: fetch it live — do NOT answer from memory or training data. ` +
    `This page has live pricing that changes. Use browsing.`;

  const composer = await page.$(composerSel);
  await composer.click();
  await page.waitForTimeout(300);

  // Use keyboard.type for more reliable input on contenteditable divs
  await page.keyboard.type(prompt, { delay: 15 });
  await page.waitForTimeout(600);

  // Submit — try Enter key, fall back to send button
  const sendBtn = await page.$('button[aria-label*="Send"], button[type="submit"], button:has-text("Send")');
  if (sendBtn) {
    await sendBtn.click();
    console.log('  ✓ Clicked Send button');
  } else {
    await page.keyboard.press('Enter');
    console.log('  ✓ Pressed Enter to send');
  }

  // ── STEP 6: Wait for Claude to fetch and respond ──
  console.log('\n[step 5] Waiting up to 90s for Claude to browse the URL and respond…');
  console.log('         Watch Terminal 1 (vercel logs) for:');
  console.log(`         [bot-track] bot=Claude-User ... page=/robots.txt`);
  console.log(`         [bot-track] bot=Claude-User ... page=/tickets`);

  // Wait for response to appear — look for ticket content in the page
  let responseFound = false;
  for (let i = 0; i < 18; i++) {
    await page.waitForTimeout(5000);
    const bodyText = await page.evaluate(() => document.body.innerText);
    if (
      bodyText.includes('General Admission') ||
      bodyText.includes('Grandstand') ||
      bodyText.includes('VIP Paddock') ||
      bodyText.includes('Race Tickets') ||
      bodyText.includes('$450') ||
      bodyText.includes('$890')
    ) {
      console.log('\n  ✅ Claude responded with ticket content — browsing WORKED!');
      responseFound = true;

      // Print what Claude said
      const msgs = await page.$$eval(
        '[data-testid="message-content"], .claude-message, [class*="assistant"] p, [class*="response"] p',
        els => els.slice(-5).map(e => e.innerText).join('\n')
      );
      if (msgs) console.log('\n  Claude response preview:\n', msgs.slice(0, 500));
      break;
    }
    process.stdout.write(`  waiting… ${(i + 1) * 5}s\r`);
  }

  if (!responseFound) {
    console.log('\n  ⚠ Claude did not return ticket content in 90s.');
    console.log('  Possible reasons:');
    console.log('  1. Browsing tool not enabled — check for search icon in claude.ai composer toolbar');
    console.log('  2. Claude answered from memory (ignored the fetch instruction)');
    console.log('  3. Claude is still typing — check the browser window');
    console.log('  Check Vercel logs for Claude-User hits regardless:');
    console.log(`    vercel logs https://racing-f1-rho.vercel.app`);
  }

  console.log('\n════════════════════════════════════════════════════════════════════════');
  console.log(' VERIFICATION:');
  console.log(' Vercel portal → racing-f1 → Logs → search: bot-track');
  console.log(' Expected lines (two per Claude session):');
  console.log('   [bot-track] bot=Claude-User ... page=/robots.txt   ← pre-check');
  console.log('   [bot-track] bot=Claude-User ... page=/tickets       ← actual fetch');
  console.log('');
  console.log(' Tealium: my.tealiumiq.com → cookieless-demo → EventStream → Live Events');
  console.log('   filter: tealium_event = ai_crawler_visit');
  console.log(`   look for: page_url contains ${TARGET_URL}`);
  console.log('════════════════════════════════════════════════════════════════════════\n');

  await page.waitForTimeout(5000);
  await context.close();
});
