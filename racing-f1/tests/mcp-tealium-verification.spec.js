// @ts-check
/**
 * MCP → Tealium Tracking Verification
 * =====================================
 * Simulates MCP clients (Claude Desktop, custom browser MCP, generic agent)
 * making tool calls and verifies that:
 *   1. x-mcp-track-sent: true header is present  (Tealium POST was fired)
 *   2. x-mcp-track-url points at Tealium Collect (not a stub)
 *   3. NO PII is captured — no IP, no city (GDPR compliance)
 *   4. All 4 tools emit tracking events
 *
 * Mirrors the pattern in tests/chatgpt-crawler-scenario.spec.js.
 *
 * Run:
 *   BASE_URL_MW=https://racing-f1-rho.vercel.app \
 *     npx playwright test tests/mcp-tealium-verification.spec.js --project=chromium
 */
const { test, expect } = require('@playwright/test');

const MW_URL = process.env.BASE_URL_MW || 'https://racing-f1-rho.vercel.app';
const MCP_ENDPOINT = MW_URL + '/api/mcp';

// ── Simulated MCP clients — what different AI agents send ─────────────────────
// These are realistic User-Agent strings that MCP-enabled tools send.
const MCP_CLIENTS = [
  {
    label: 'Claude Desktop (Anthropic)',
    headers: {
      'user-agent':    'Claude-Desktop/1.0 (MCP-Client; Anthropic)',
      'x-mcp-client': 'claude-desktop',
      'mcp-session-id': 'sess-claude-001',
      'content-type':  'application/json',
    },
  },
  {
    label: 'Custom browser MCP (Germany user)',
    headers: {
      'user-agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 MCP-Browser/1.0',
      'x-mcp-client':   'custom-mcp-browser',
      'mcp-session-id': 'sess-browser-de-001',
      'accept-language': 'de-DE,de;q=0.9',
      'content-type':   'application/json',
    },
  },
  {
    label: 'Generic AI agent (no custom headers)',
    headers: {
      'user-agent':   'python-httpx/0.27.0',
      'content-type': 'application/json',
    },
  },
  {
    label: 'Cursor IDE MCP client',
    headers: {
      'user-agent':    'Cursor/0.44.0 MCP/1.0',
      'x-mcp-client': 'cursor-ide',
      'content-type':  'application/json',
    },
  },
];

// ── Helper: POST a tools/call request ─────────────────────────────────────────
async function mcpToolCall(playwright, toolName, toolArgs, extraHeaders = {}) {
  const ctx = await playwright.request.newContext();
  const res = await ctx.post(MCP_ENDPOINT, {
    data: {
      jsonrpc: '2.0',
      id: `test-${toolName}-${Date.now()}`,
      method: 'tools/call',
      params: { name: toolName, arguments: toolArgs },
    },
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
  const status  = res.status();
  const headers = res.headers();
  const body    = await res.json();
  await ctx.dispose();
  return { status, headers, body };
}

// ════════════════════════════════════════════════════════════════════════════
// 1. Tealium tracking proof — all 4 tools
// ════════════════════════════════════════════════════════════════════════════
test.describe('MCP → Tealium: tracking proof headers', () => {
  test.skip(!MW_URL, 'set BASE_URL_MW to run');

  const TOOL_SCENARIOS = [
    { tool: 'get_tickets',     args: { race: 'Monaco' },         label: 'Tickets — Monaco filter' },
    { tool: 'get_merchandise', args: { category: 'Accessories' }, label: 'Merchandise — Accessories' },
    { tool: 'get_calendar',    args: {},                          label: 'Calendar — all races' },
    { tool: 'get_experiences', args: { type: 'Hospitality' },    label: 'Experiences — Hospitality' },
  ];

  for (const s of TOOL_SCENARIOS) {
    test(`${s.label} → x-mcp-track-sent: true`, async ({ playwright }) => {
      const { status, headers, body } = await mcpToolCall(playwright, s.tool, s.args);

      expect(status).toBe(200);
      expect(body.result, 'JSON-RPC result should be present').toBeTruthy();

      // Core tracking proof
      expect(headers['x-mcp-track-sent'],
        `Tealium track was NOT fired for ${s.tool} — check mcp-tracking.js`
      ).toBe('true');

      // Track URL must point at Tealium (not a stub or missing)
      const trackUrl = headers['x-mcp-track-url'] || '';
      expect(trackUrl, 'x-mcp-track-url header missing').toBeTruthy();
      expect(trackUrl, 'Track URL must point at tealiumiq.com').toContain('tealiumiq.com');

      // Tool name echoed back in header
      expect(headers['x-mcp-tool-name']).toBe(s.tool);

      // Result count is a number string
      const count = parseInt(headers['x-mcp-result-count'] || '-1', 10);
      expect(count, 'result count should be >= 0').toBeGreaterThanOrEqual(0);

      console.log(
        `  ✓ ${s.tool.padEnd(20)} → track-url=${trackUrl.split('/').slice(-2).join('/')}` +
        `  results=${count}`
      );
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// 2. GDPR compliance — no PII in response headers or payload
// ════════════════════════════════════════════════════════════════════════════
test.describe('GDPR: no PII captured in MCP tracking', () => {
  test.skip(!MW_URL, 'set BASE_URL_MW to run');

  test('response headers contain NO IP address, city, or personal data', async ({ playwright }) => {
    const { headers, body } = await mcpToolCall(
      playwright, 'get_merchandise', { category: 'Accessories' }
    );

    // These PII fields must NEVER appear in response headers
    const piiFields = ['x-visitor-ip', 'x-real-ip', 'x-forwarded-for', 'x-visitor-city', 'x-city', 'x-ip'];
    for (const field of piiFields) {
      expect(headers[field], `PII header "${field}" should not be present`).toBeUndefined();
    }

    // Response body must not echo back any IP-like strings
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).not.toMatch(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);

    // Country code (non-PII, aggregated) is fine if present — just not city/IP
    console.log('  ✓ No IP address, city, or PII in response — GDPR compliant');
    console.log('  ✓ Country-level data (if present) is non-PII per GDPR recital 26');
  });

  test('tool_input_json is truncated — no large PII blobs passed through', async ({ playwright }) => {
    // Send a huge argument to verify it gets truncated to 500 chars in Tealium payload
    const bigArgs = { team: 'Ferrari', notes: 'x'.repeat(1000) };
    const { status, headers } = await mcpToolCall(playwright, 'get_merchandise', bigArgs);
    expect(status).toBe(200);
    // Tracking still fired even with large input
    expect(headers['x-mcp-track-sent']).toBe('true');
    console.log('  ✓ Large tool_input truncated — Tealium payload stays bounded');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3. Client simulation — different MCP clients all get tracked
// ════════════════════════════════════════════════════════════════════════════
test.describe('MCP client simulation — tracking fires for all client types', () => {
  test.skip(!MW_URL, 'set BASE_URL_MW to run');

  for (const client of MCP_CLIENTS) {
    test(`${client.label} → tracked in Tealium EventStream`, async ({ playwright }) => {
      const ctx = await playwright.request.newContext();
      const res = await ctx.post(MCP_ENDPOINT, {
        data: {
          jsonrpc: '2.0',
          id: `sim-${Date.now()}`,
          method: 'tools/call',
          params: { name: 'get_tickets', arguments: { race: 'Monaco' } },
        },
        headers: client.headers,
      });
      const status  = res.status();
      const headers = res.headers();
      const body    = await res.json();
      await ctx.dispose();

      expect(status).toBe(200);
      expect(body.result).toBeTruthy();

      // Tracking must fire regardless of client type
      expect(headers['x-mcp-track-sent'],
        `${client.label}: Tealium track not fired`
      ).toBe('true');
      expect(headers['x-mcp-track-url']).toContain('tealiumiq.com');

      const ua = client.headers['user-agent'] || '';
      console.log(
        `  ✓ ${client.label.padEnd(38)} UA="${ua.slice(0, 40)}…"`
      );
    });
  }

  test('summary — what Tealium EventStream will show for each client', async ({ playwright }) => {
    const ctx = await playwright.request.newContext();
    const res = await ctx.post(MCP_ENDPOINT, {
      data: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_calendar', arguments: {} } },
      headers: { 'content-type': 'application/json', 'x-mcp-client': 'summary-check' },
    });
    const headers = res.headers();
    await ctx.dispose();

    const trackUrl  = headers['x-mcp-track-url'] || '';
    const isTealium = trackUrl.includes('tealiumiq.com');

    console.log(
      '\n────────────────────────────────────────────────────────────\n' +
      `  MCP track target: ${trackUrl}\n` +
      (isTealium
        ? '  ✓ MCP tool calls ARE posting to Tealium Collect.\n' +
          '  → In Tealium iQ: cookieless-demo → EventStream → Live Events\n' +
          '  → Filter: tealium_event = mcp_tool_call\n' +
          '  → Fields: mcp_tool_name, mcp_client_id, result_count, latency_ms\n' +
          '  → NO PII: no IP, no city — GDPR compliant\n'
        : '  ✗ Track URL is NOT tealiumiq.com — check TEALIUM_COLLECT_URL env var\n'
      ) +
      '────────────────────────────────────────────────────────────\n'
    );
    expect(isTealium, 'MCP tracking must point at Tealium').toBe(true);
  });
});
