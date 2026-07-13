/**
 * api/collect.js — First-party Tealium proxy
 *
 * Accepts POST from privacy-detect.js (via navigator.sendBeacon).
 * Forwards the payload to Tealium HTTP API Advanced unchanged.
 * Same-origin so Brave Shields / uBlock cannot block it.
 */

const TEALIUM_URL =
  process.env.TEALIUM_COLLECT_URL ||
  'https://collect-us-west-2.tealiumiq.com/integration/event/cognizant-sandbox/cookieless-demo/rivqkx';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    // sendBeacon sends Content-Type: application/json or text/plain depending on Blob type
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) {}
    }

    const payload = typeof body === 'object' ? body : {};
    const json = JSON.stringify(payload);

    // Forward to Tealium — fire and forget from user's perspective
    const tRes = await fetch(TEALIUM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: json,
    });

    console.log(`[privacy-collect] tealium_event=${payload.tealium_event} browser=${payload.browser_name} status=${tRes.status}`);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[privacy-collect] error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
