# AI-Crawler Detection → Tealium Server-Side (Plan)

> Goal: when an AI tool (GPTBot, ClaudeBot, PerplexityBot, ChatGPT-User, agent browsers, …) crawls
> the site, identify it, **enrich the request with bot/AI attributes**, and forward to **Tealium
> server-side** so the data lands in EventStream / your warehouse alongside human traffic.

## 1. What we're detecting

Three distinct classes — each needs a different signal:

| Class | Examples | Detection signal |
|---|---|---|
| **Declared AI crawlers** | `GPTBot`, `ClaudeBot`, `Claude-Web`, `OAI-SearchBot`, `PerplexityBot`, `ChatGPT-User`, `cohere-ai`, `anthropic-ai`, `Google-Extended`, `Bytespider`, `Applebot-Extended` | User-Agent regex (server-side, deterministic) |
| **Agent browsers** (LLM driving a headless Chrome) | OpenAI Operator, Claude Computer Use, Browserbase, Browser Use, generic Playwright/Puppeteer | `navigator.webdriver === true`, Chrome DevTools Protocol fingerprints, missing `chrome.runtime`, abnormal entropy in mouse/scroll |
| **Generic bots** | curl, wget, python-requests, no-JS scrapers | UA + missing headers + no-JS hit (no client beacon ever fires) |

## 2. Where detection runs

```
            ┌─────────────────────────────────────────────┐
  request → │  Vercel Edge Middleware (middleware.ts)     │  ← SERVER-SIDE detection (UA + headers)
            │  • match UA against AI_CRAWLERS regex       │     authoritative for declared crawlers
            │  • set x-bot-* response headers             │     fires even when JS never runs
            │  • POST to Tealium Collect API (no-JS hit)  │
            └────────────────────┬────────────────────────┘
                                 │ HTML response (with bot hints in <meta>)
                                 ▼
            ┌─────────────────────────────────────────────┐
  browser → │  analytics.js (client)                      │  ← CLIENT-SIDE detection (agent browsers)
            │  • read <meta name="x-bot-*">                │
            │  • run agent-browser heuristics             │
            │  • set gridbox_data.bot_* + gridboxLayer    │
            │  • normal utag.link flow fires the event    │
            └─────────────────────────────────────────────┘
```

Two layers because each catches what the other misses:
- A **declared crawler** (GPTBot) often doesn't run JS → only the **server** sees it.
- An **agent browser** spoofs a normal UA but runs JS → only the **client** sees it.

## 3. Server-side: Vercel Edge Middleware (the primary path)

Create `middleware.ts` at the project root:

```ts
import { NextResponse } from 'next/server';
export const config = { matcher: '/((?!_next/|api/health).*)' };

const AI_CRAWLERS: { name: string; re: RegExp; vendor: string }[] = [
  { name: 'GPTBot',          re: /\bGPTBot\b/i,          vendor: 'OpenAI' },
  { name: 'OAI-SearchBot',   re: /\bOAI-SearchBot\b/i,   vendor: 'OpenAI' },
  { name: 'ChatGPT-User',    re: /\bChatGPT-User\b/i,    vendor: 'OpenAI' },
  { name: 'ClaudeBot',       re: /\bClaudeBot\b/i,       vendor: 'Anthropic' },
  { name: 'Claude-Web',      re: /\bClaude-Web\b/i,      vendor: 'Anthropic' },
  { name: 'anthropic-ai',    re: /\banthropic-ai\b/i,    vendor: 'Anthropic' },
  { name: 'PerplexityBot',   re: /\bPerplexityBot\b/i,   vendor: 'Perplexity' },
  { name: 'cohere-ai',       re: /\bcohere-ai\b/i,       vendor: 'Cohere' },
  { name: 'Google-Extended', re: /\bGoogle-Extended\b/i, vendor: 'Google' },
  { name: 'Bytespider',      re: /\bBytespider\b/i,      vendor: 'ByteDance' },
  { name: 'Applebot-Extended', re: /\bApplebot-Extended\b/i, vendor: 'Apple' }
];

export async function middleware(req: Request) {
  const ua = req.headers.get('user-agent') || '';
  const hit = AI_CRAWLERS.find((b) => b.re.test(ua));
  const res = NextResponse.next();

  if (hit) {
    res.headers.set('x-bot-detected', 'true');
    res.headers.set('x-bot-name', hit.name);
    res.headers.set('x-bot-vendor', hit.vendor);

    // Fire-and-forget POST to Tealium Collect (HTTP API) — server-side event
    const url = new URL(req.url);
    const event = {
      tealium_account: 'cognizant-sandbox',
      tealium_profile: 'f1racing',
      tealium_event:   'ai_crawler_visit',
      bot_detected:    'true',
      bot_name:        hit.name,
      bot_vendor:      hit.vendor,
      page_path:       url.pathname,
      page_url:        req.url,
      referrer:        req.headers.get('referer') || '',
      user_agent:      ua,
      ip:              req.headers.get('x-forwarded-for') || ''
    };
    fetch('https://collect.tealiumiq.com/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    }).catch(() => {/* never block the request */});
  }

  return res;
}
```

That POST is the **server-side hand-off to Tealium**. The Tealium Collect HTTP API
(`https://collect.tealiumiq.com/event`) accepts a JSON event and routes it through the profile's
EventStream — same path as a `utag.link` from the browser, but originated server-side, so it works
even when the bot never executes JS.

## 4. Client-side hooks (for agent browsers)

In `analytics.js`, before the first `gridbox.view()`:

```js
function detectAgentBrowser() {
  const signals = [];
  if (navigator.webdriver) signals.push('webdriver');
  if (!navigator.languages || navigator.languages.length === 0) signals.push('no_languages');
  if (navigator.plugins && navigator.plugins.length === 0) signals.push('no_plugins');
  if (window.chrome && !window.chrome.runtime) signals.push('chrome_no_runtime');
  // Read server hint
  const meta = document.querySelector('meta[name="x-bot-name"]');
  const declared = meta && meta.getAttribute('content');
  return {
    detected: signals.length >= 2 || !!declared,
    signals: signals.join(','),
    declared
  };
}

const bot = detectAgentBrowser();
if (bot.detected) {
  window.gridbox_data.bot_detected = 'true';
  window.gridbox_data.bot_signals  = bot.signals;
  window.gridbox_data.bot_name     = bot.declared || 'agent_browser';
  // existing analytics.js flow now naturally carries these onto every event
}
```

The middleware injects the server-side determination into the HTML as a `<meta name="x-bot-name">` tag
(or sets a cookie) so the client can read it; the heuristics above cover spoofed UAs.

## 5. Tealium side (profile work)

- **New Data Layer variable**: `bot_detected`, `bot_name`, `bot_vendor`, `bot_signals`.
- **Load Rule**: `bot_detected == 'true'` — gate it on whichever destinations you do/don't want bot
  traffic in (typically: keep them out of GA4 reporting; route to a separate "AI traffic" stream).
- **EventStream**: add `ai_crawler_visit` as an allowed event; sink to BigQuery/S3 for audit.

## 6. Validation

Add a Playwright spec that spoofs each major UA and asserts the Tealium event fires server-side:

```js
for (const ua of ['Mozilla/5.0 (compatible; GPTBot/1.0)', 'ClaudeBot/1.0', ...]) {
  test(`detects ${ua}`, async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ extraHTTPHeaders: { 'user-agent': ua } });
    const res = await ctx.get('https://racing-f1-rho.vercel.app/');
    expect(res.headers()['x-bot-detected']).toBe('true');
  });
}
```

Pair that with a Tealium Trace filter on `tealium_event == 'ai_crawler_visit'` to see the
server-side hits land in the same profile as the human traffic.

## 7. Privacy / robots.txt

This is **identification**, not blocking. If you want to *block* (some) AI crawlers, that's a
separate `robots.txt` policy:

```
User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /
```

The middleware-based detection still works for crawlers that ignore robots.txt — and gives you the
audit trail Tealium needs.

## 8. Roll-out checklist

- [ ] Add `middleware.ts` with the AI_CRAWLERS list + Collect POST.
- [ ] Add `<meta>` injection or cookie for client-side hint.
- [ ] Extend `analytics.js` with `detectAgentBrowser()` + `gridbox_data.bot_*`.
- [ ] Create Tealium DL variables + Load Rule for `bot_detected`.
- [ ] Hook EventStream destination for `ai_crawler_visit`.
- [ ] Add Playwright spec covering all UAs.
- [ ] Add `/robots.txt` policy decision.
