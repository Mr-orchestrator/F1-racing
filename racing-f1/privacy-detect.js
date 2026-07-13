/**
 * privacy-detect.js
 * Detects privacy browsers (Brave, Firefox strict, Safari ITP, DuckDuckGo, LibreWolf/Tor)
 * and tracks visits + interactions via first-party /api/collect proxy → Tealium EventStream.
 *
 * Strategy: same-origin sendBeacon so Brave Shields / uBlock cannot block the request.
 * No consent required — no PII collected, no cookies set.
 */
(async () => {
  const COLLECT_URL = '/api/collect';

  const base = {
    tealium_account:  'cognizant-sandbox',
    tealium_profile:  'cookieless-demo',
    tealium_event:    'privacy_browser_visit',
    page_url:         location.href,
    page_path:        location.pathname,
    page_title:       document.title,
    referrer:         document.referrer,
    timestamp_iso:    new Date().toISOString(),
    browser_name:     'unknown',
    browser_engine:   navigator.userAgentData?.platform || '',
    shields_active:   false,
    blocked_vendors:  [],
    user_agent:       navigator.userAgent,
  };

  // ── 1. Brave ──────────────────────────────────────────────────────────────
  if (navigator.brave) {
    try {
      const isBrave = await navigator.brave.isBrave();
      if (isBrave) {
        base.browser_name  = 'Brave';
        base.shields_active = true;
        base.blocked_vendors.push('brave-shields');
      }
    } catch (_) {}
  }

  // ── 2. DuckDuckGo Browser ─────────────────────────────────────────────────
  if (/DuckDuckGo/i.test(navigator.userAgent)) {
    base.browser_name  = 'DuckDuckGo';
    base.shields_active = true;
    base.blocked_vendors.push('ddg-tracking-protection');
  }

  // ── 3. Tor / LibreWolf — canvas fingerprint blocked ──────────────────────
  try {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f60';
    ctx.fillRect(0, 0, 10, 10);
    ctx.fillStyle = '#069';
    ctx.fillText('probe', 2, 8);
    const dataUrl = c.toDataURL('image/png');
    // Tor/LibreWolf return a blank canvas (all zeros)
    if (!dataUrl || dataUrl.length < 200) {
      base.shields_active = true;
      base.blocked_vendors.push('canvas-fingerprint');
      if (base.browser_name === 'unknown') base.browser_name = 'LibreWolf/Tor';
    }
  } catch (_) {
    base.shields_active = true;
    base.blocked_vendors.push('canvas-api');
  }

  // ── 4. Safari ITP — cross-site storage access blocked ────────────────────
  if (/Safari/i.test(navigator.userAgent) && !/Chrome/i.test(navigator.userAgent)) {
    base.browser_name = 'Safari';
    if (document.hasStorageAccess) {
      try {
        const hasAccess = await document.hasStorageAccess();
        if (!hasAccess) {
          base.shields_active = true;
          base.blocked_vendors.push('safari-itp');
        }
      } catch (_) {}
    }
  }

  // ── 5. Generic shield probe — fetch known tracker URL ────────────────────
  // If the request errors/aborts, shields are intercepting outbound fetches.
  if (!base.shields_active) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 150);
      await fetch(
        'https://www.google-analytics.com/collect?v=1&t=pageview&tid=UA-probe&cid=0',
        { method: 'GET', mode: 'no-cors', signal: ctrl.signal, cache: 'no-store' }
      );
      clearTimeout(timer);
    } catch (_) {
      base.shields_active = true;
      base.blocked_vendors.push('google-analytics');
      if (base.browser_name === 'unknown') base.browser_name = 'privacy-browser';
    }
  }

  // ── Only proceed if privacy browser confirmed ─────────────────────────────
  if (!base.shields_active && base.blocked_vendors.length === 0) return;

  // Fire page-visit beacon
  function beacon(payload) {
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(COLLECT_URL, blob);
    } else {
      // Fallback: synchronous XHR (edge case — very old browsers)
      const xhr = new XMLHttpRequest();
      xhr.open('POST', COLLECT_URL, false);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(JSON.stringify(payload));
    }
  }

  beacon(base);

  // ── Interaction tracking — clicks on any button / link ────────────────────
  document.addEventListener('click', function (e) {
    const el = e.target.closest('button, a, [data-track], [role="button"]');
    if (!el) return;
    beacon({
      ...base,
      tealium_event:     'privacy_browser_interaction',
      interaction_type:  'click',
      element_tag:       el.tagName.toLowerCase(),
      element_text:      (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 80),
      element_href:      el.href || '',
      element_id:        el.id || '',
      timestamp_iso:     new Date().toISOString(),
    });
  }, { passive: true });
})();
