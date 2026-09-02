/**
 * Vercel Edge Middleware
 *
 * Two responsibilities on every HTML page request:
 *
 *  1. AI Crawler Detection (server-side, zero client JS)
 *     Reads User-Agent → matches against known AI crawler signatures →
 *     fires a fire-and-forget POST to /api/bot-collect for Tealium ingestion.
 *
 *  2. Nonce-based CSP (Solution 1)
 *     Generates a cryptographically random nonce per request → injects it
 *     into every <script> tag → sets Content-Security-Policy header.
 *     'unsafe-inline' is kept as IE11 fallback only; modern browsers ignore
 *     it when a nonce is present (CSP Level 2+).
 */

// ── AI Crawler signatures ──────────────────────────────────────────────────
const AI_CRAWLERS = [
  { name: 'GPTBot',               re: /\bGPTBot\b/i,               vendor: 'OpenAI',      class: 'crawler' },
  { name: 'OAI-SearchBot',        re: /\bOAI-SearchBot\b/i,        vendor: 'OpenAI',      class: 'crawler' },
  { name: 'ChatGPT-User',         re: /\bChatGPT-User\b/i,         vendor: 'OpenAI',      class: 'agent'   },
  { name: 'ClaudeBot',            re: /\bClaudeBot\b/i,            vendor: 'Anthropic',   class: 'crawler' },
  { name: 'Claude-User',          re: /\bClaude-User\b/i,          vendor: 'Anthropic',   class: 'agent'   },
  { name: 'Claude-SearchBot',     re: /\bClaude-SearchBot\b/i,     vendor: 'Anthropic',   class: 'crawler' },
  { name: 'anthropic-ai',         re: /\banthropic-ai\b/i,         vendor: 'Anthropic',   class: 'crawler' },
  { name: 'PerplexityBot',        re: /\bPerplexityBot\b/i,        vendor: 'Perplexity',  class: 'crawler' },
  { name: 'Perplexity-User',      re: /\bPerplexity-User\b/i,      vendor: 'Perplexity',  class: 'agent'   },
  { name: 'cohere-ai',            re: /\bcohere-ai\b/i,            vendor: 'Cohere',      class: 'crawler' },
  { name: 'Google-Extended',      re: /\bGoogle-Extended\b/i,      vendor: 'Google',      class: 'crawler' },
  { name: 'Gemini-Deep-Research', re: /\bGemini-Deep-Research\b/i, vendor: 'Google',      class: 'agent'   },
  { name: 'Bytespider',           re: /\bBytespider\b/i,           vendor: 'ByteDance',   class: 'crawler' },
  { name: 'Applebot-Extended',    re: /\bApplebot-Extended\b/i,    vendor: 'Apple',       class: 'crawler' },
  { name: 'Meta-ExternalAgent',   re: /\bMeta-ExternalAgent\b/i,   vendor: 'Meta',        class: 'crawler' },
  { name: 'Diffbot',              re: /\bDiffbot\b/i,              vendor: 'Diffbot',     class: 'crawler' },
  { name: 'CCBot',                re: /\bCCBot\b/i,                vendor: 'CommonCrawl', class: 'crawler' },
];

function detectAICrawler(ua) {
  if (!ua) return null;
  for (const bot of AI_CRAWLERS) {
    if (bot.re.test(ua)) return bot;
  }
  return null;
}

export const config = {
  matcher: [
    '/((?!api/|_vercel/|.*\\.(?:css|js|png|jpg|jpeg|svg|ico|woff2?|ttf|gif|webp|json|txt|xml)).*)'
  ]
};

export default async function middleware(request) {
  const url = new URL(request.url);

  // ── Guard: skip internal re-fetches to avoid infinite loops ──────────────
  if (request.headers.get('x-nonce-middleware') === '1') {
    return new Response(null, { status: 404 });
  }

  // ── 1. AI Crawler Detection ───────────────────────────────────────────────
  const ua = request.headers.get('user-agent') || '';
  const crawler = detectAICrawler(ua);

  if (crawler) {
    // Fire-and-forget — never block the page response waiting for this
    const collectUrl = new URL('/api/bot-collect', request.url).toString();
    const payload = {
      tealium_account:      'cognizant-sandbox',
      tealium_profile:      'f1racing',
      tealium_event:        'ai_crawler_visit',
      crawl_agent_detected: 'true',
      crawl_agent_name:     crawler.name,
      crawl_agent_vendor:   crawler.vendor,
      crawl_agent_class:    crawler.class,
      page_url:             request.url,
      page_path:            url.pathname,
      referrer:             request.headers.get('referer') || '',
      user_agent:           ua,
      ip:                   request.headers.get('x-forwarded-for') || '',
      timestamp_iso:        new Date().toISOString()
    };

    // waitUntil-style: no await — response continues immediately
    fetch(collectUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-nonce-middleware': '1' },
      body:    JSON.stringify(payload)
    }).catch(() => {});
  }

  // ── 2. Nonce Generation ───────────────────────────────────────────────────
  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);
  const nonce = btoa(String.fromCharCode(...randomBytes));

  // ── 3. Fetch original static HTML from Vercel's origin ───────────────────
  let originalResponse;
  try {
    originalResponse = await fetch(request.url, {
      headers: {
        ...Object.fromEntries(request.headers.entries()),
        'x-nonce-middleware': '1'
      },
      redirect: 'follow'
    });
  } catch {
    return;
  }

  // ── 4. Pass through non-HTML responses unchanged ──────────────────────────
  const contentType = originalResponse.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return originalResponse;
  }

  // ── 5. Inject nonce into ALL <script> tags ────────────────────────────────
  // Both inline and external src= scripts need the nonce because strict-dynamic
  // disables host allowlists — external <script src=""> are blocked without it.
  let html = await originalResponse.text();
  html = html.replace(/<script([^>]*)>/gi, (match, attrs) => {
    if (/\bnonce\s*=/i.test(attrs)) return match;
    return `<script${attrs} nonce="${nonce}">`;
  });

  // ── 6. Build CSP header ───────────────────────────────────────────────────
  const csp = [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline'` +
      " https://www.googletagmanager.com" +
      " https://www.google-analytics.com" +
      " https://assets.adobedtm.com" +
      " https://tags.tiqcdn.com" +
      " https://*.tiqcdn.com" +
      " https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self'" +
      " https://www.google-analytics.com" +
      " https://region1.google-analytics.com" +
      " https://region1.analytics.google.com" +
      " https://www.googletagmanager.com" +
      " https://assets.adobedtm.com" +
      " https://*.adobedc.net" +
      " https://*.demdex.net" +
      " https://*.omtrdc.net" +
      " https://tags.tiqcdn.com" +
      " https://*.tiqcdn.com" +
      " https://collect.tealiumiq.com" +
      " https://*.tealiumiq.com" +
      " https://cdn.jsdelivr.net",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-src https://www.googletagmanager.com https://*.demdex.net",
    "report-uri /api/csp-report"
  ].join('; ');

  // ── 7. Build and return response ──────────────────────────────────────────
  const responseHeaders = new Headers(originalResponse.headers);
  responseHeaders.set('Content-Security-Policy', csp);
  responseHeaders.set('Content-Type', 'text/html; charset=utf-8');
  responseHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  responseHeaders.set('Surrogate-Control', 'no-store');
  responseHeaders.set('x-csp-nonce', nonce);
  // Expose detected crawler in response header for debugging/logging
  if (crawler) {
    responseHeaders.set('x-crawler-detected', `${crawler.name} (${crawler.vendor})`);
  }

  return new Response(html, {
    status:     originalResponse.status,
    statusText: originalResponse.statusText,
    headers:    responseHeaders
  });
}
