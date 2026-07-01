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
  const raw = (process.env.TEALIUM_COLLECT_URL || '').trim();
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
    try {
      const event = buildCollectEvent({
        hit,
        url: request.url,
        referer: request.headers.get('referer') || '',
        ip: request.headers.get('x-forwarded-for') || '',
        account: process.env.TEALIUM_ACCOUNT,
        profile: process.env.TEALIUM_PROFILE
      });
      // Fire-and-forget. Edge runtime keeps the request alive briefly after response for us.
      fetch(collectUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      }).catch(() => {});
      trackSent = 'true';
    } catch (_) {
      trackSent = 'error';
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
