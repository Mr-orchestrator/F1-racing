/**
 * Vercel Edge Middleware — AI-crawler detection at the request edge.
 *
 * Two things happen for every request whose User-Agent matches a known AI crawler:
 *   1. Response gets x-bot-detected / x-bot-name / x-bot-vendor / x-bot-class headers.
 *      (visible via `curl -I`; consumed by tests and downstream tooling.)
 *   2. A server-side `ai_crawler_visit` event is POSTed to the Tealium Collect HTTP API
 *      — fire-and-forget, never blocks the request. Configured via TEALIUM_COLLECT_URL env
 *      var (unset = detection headers only; the POST is skipped).
 *
 * For non-crawler requests: pass through unmodified (zero overhead).
 */
import { next } from '@vercel/edge';
import { detectAICrawler, buildCollectEvent } from './lib/bot-detection.js';

// Run on all page requests. Skip only /api/ (our own server-side receiver — no recursion) and
// /_next/ (build artefacts). Static assets go through too — cheap: humans fall through to next()
// in <1ms and only crawlers pay the POST cost. Catches crawlers hitting individual asset URLs.
export const config = { matcher: '/((?!api/|_next/).*)' };

export default async function middleware(request) {
  const ua = request.headers.get('user-agent') || '';
  const hit = detectAICrawler(ua);
  if (!hit) return next(); // fast-path: humans go straight through

  // Accept absolute URL (e.g. Tealium Collect) or a leading-slash path for a same-origin
  // receiver like the self-hosted /api/bot-collect. Never throw out of the middleware.
  //
  // Default: Tealium "HTTP API - Advanced" data source endpoint. This URL encodes
  // account / profile / data-source-key directly in the path
  // (/integration/event/<account>/<profile>/<datasource>), so routing to EventStream is
  // determined by the URL itself — no body-level tealium_account/profile needed. Complex JSON
  // objects POSTed here are auto-flattened (key paths lowercased + underscore-joined). Success
  // response is HTTP 204. Override with the TEALIUM_COLLECT_URL env var if needed.
  const DEFAULT_COLLECT_URL =
    'https://collect-us-west-2.tealiumiq.com/integration/event/cognizant-sandbox/cookieless-demo/rivqkx';
  const raw = (process.env.TEALIUM_COLLECT_URL || DEFAULT_COLLECT_URL).trim();
  let collectUrl = '';
  let trackPath = '';
  try {
    if (raw.startsWith('/')) {
      const origin = new URL(request.url).origin;
      collectUrl = origin + raw;
      trackPath = raw;
    } else if (raw) {
      collectUrl = raw;
      trackPath = raw;
    }
  } catch (_) { /* keep collectUrl empty */ }

  let trackSent = 'false';
  if (collectUrl) {
    const event = buildCollectEvent({
      hit,
      url: request.url,
      referer: request.headers.get('referer') || '',
      ip: request.headers.get('x-forwarded-for') || '',
      account: process.env.TEALIUM_ACCOUNT,
      profile: process.env.TEALIUM_PROFILE,
      dataSourceKey: (process.env.TEALIUM_DATA_SOURCE_KEY || '').trim()
    });
    // AWAITED (not fire-and-forget): this is a single small POST that only happens on bot
    // traffic (rare), and awaiting lets us log the real response status from Tealium/receiver
    // in Vercel's function logs — the proof that the event actually reached its destination.
    try {
      const resp = await fetch(collectUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      });
      trackSent = 'true';
      // eslint-disable-next-line no-console
      console.log(`[bot-track] bot=${hit.name} dest=${collectUrl} status=${resp.status} page=${event.page_path}`);
    } catch (e) {
      trackSent = 'error';
      // eslint-disable-next-line no-console
      console.log(`[bot-track] ERROR bot=${hit.name} dest=${collectUrl} error=${String(e)}`);
    }
  }

  return next({
    headers: {
      'x-bot-detected':    'true',
      'x-bot-name':        hit.name,
      'x-bot-vendor':      hit.vendor,
      'x-bot-class':       hit.class,
      'x-bot-track-sent':  trackSent,   // 'true' when POST fired | 'false' when env unset | 'error'
      'x-bot-track-url':   trackPath    // e.g. '/api/bot-collect' or the full URL
    }
  });
}
