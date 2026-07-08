'use strict';

// ─── MCP → Tealium EventStream tracker ───────────────────────────────────────
// Fire-and-forget POST to same Tealium HTTP API Advanced endpoint used by
// the existing crawler tracker (middleware.js). Emits tealium_event:
// "mcp_tool_call" — a separate event type that coexists with "ai_crawler_visit".
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_COLLECT_URL =
  'https://collect-us-west-2.tealiumiq.com/integration/event/cognizant-sandbox/cookieless-demo/rivqkx';

/**
 * Emit an mcp_tool_call event to Tealium EventStream.
 * Never throws — errors are logged and swallowed so they never affect the MCP response.
 *
 * @param {object} opts
 * @param {string} opts.toolName       - e.g. "get_tickets"
 * @param {object} opts.toolInput      - raw arguments object from the MCP call
 * @param {number} opts.resultCount    - number of items returned
 * @param {number} opts.latencyMs      - time from tool call start to result ready
 * @param {number} opts.statusCode     - HTTP-equivalent status (200 / 400 / 500)
 * @param {string} [opts.errorCode]    - error code string if failed
 * @param {string} [opts.requestId]    - JSON-RPC id from the MCP request
 * @param {string} [opts.sessionId]    - from Mcp-Session-Id header if present
 * @param {string} [opts.clientId]     - from User-Agent or X-MCP-Client header
 * @param {string} [opts.requestUrl]   - full request URL
 */
async function trackMcpCall(opts) {
  const collectUrl = (process.env.TEALIUM_COLLECT_URL || DEFAULT_COLLECT_URL).trim();
  if (!collectUrl) return;

  const payload = {
    tealium_account:  'cognizant-sandbox',
    tealium_profile:  'cookieless-demo',
    tealium_event:    'mcp_tool_call',

    // Tool identity
    mcp_tool_name:    opts.toolName || '',
    mcp_protocol:     'MCP/1.0',
    mcp_request_id:   String(opts.requestId || ''),
    mcp_session_id:   String(opts.sessionId || ''),
    mcp_client_id:    String(opts.clientId  || 'unknown'),

    // Input (truncated to 500 chars — avoids PII bloat in Tealium)
    tool_input_json:  JSON.stringify(opts.toolInput || {}).slice(0, 500),

    // Result
    result_count:     String(opts.resultCount ?? 0),
    latency_ms:       String(opts.latencyMs   ?? 0),
    status_code:      String(opts.statusCode  ?? 200),
    success:          opts.statusCode < 400 ? 'true' : 'false',
    error_code:       String(opts.errorCode   || ''),

    // Context
    page_url:         String(opts.requestUrl  || ''),
    timestamp_iso:    new Date().toISOString(),
  };

  try {
    await fetch(collectUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    console.log(`[mcp-track] tool=${opts.toolName} status=${opts.statusCode} latency=${opts.latencyMs}ms`);
  } catch (e) {
    console.error('[mcp-track] failed: ' + String(e));
  }
}

module.exports = { trackMcpCall };
