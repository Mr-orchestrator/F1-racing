/**
 * Vercel Serverless Function — receives server-side AI-crawler events from the Edge middleware.
 *
 * Purpose: prove the full server-to-server tracking chain works end-to-end WITHOUT depending on
 * an external endpoint. When TEALIUM_COLLECT_URL points here, every crawler hit triggers a POST
 * that this function logs (visible via `vercel logs`) and — optionally — forwards to real Tealium.
 *
 * Chain: request (spoofed UA) → Edge middleware → detect → POST /api/bot-collect → log/forward → 200
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }

  // Body: Vercel already JSON-parses application/json; guard for the raw case anyway.
  let payload = req.body;
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload); } catch { payload = { raw: payload }; }
  }
  payload = payload || {};

  const receivedAt = new Date().toISOString();
  const record = {
    received_at: receivedAt,
    remote_addr: req.headers['x-forwarded-for'] || '',
    tealium_account: payload.tealium_account || '',
    tealium_profile: payload.tealium_profile || '',
    tealium_event: payload.tealium_event || '',
    bot_name: payload.bot_name || '',
    bot_vendor: payload.bot_vendor || '',
    bot_class: payload.bot_class || '',
    page_url: payload.page_url || '',
    user_agent: payload.user_agent || '',
    referrer: payload.referrer || ''
  };

  // Structured log line — grepable in `vercel logs <deployment>`.
  // eslint-disable-next-line no-console
  console.log('[bot-collect] ' + JSON.stringify(record));

  // Optional forward to REAL Tealium Collect (fire-and-forget). Set when you want a copy in the
  // Tealium profile in addition to the local audit log. Leave unset for local proof-of-concept.
  const forward = process.env.TEALIUM_COLLECT_FORWARD_URL;
  if (forward) {
    try {
      await fetch(forward, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[bot-collect] forward failed: ' + String(e));
    }
  }

  res.status(200).json({ ok: true, received_at: receivedAt, echo: record });
}
