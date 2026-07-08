// @ts-check
/**
 * MCP Server tests — validates all 4 tools against the deployed endpoint.
 *
 * Layers:
 *   LAYER 1 (unit)     — tool handlers work correctly offline
 *   LAYER 2 (HTTP)     — deployed /api/mcp returns valid JSON-RPC responses (opt-in)
 *   LAYER 3 (discovery) — .well-known files and GET /api/mcp are reachable
 *
 * Run unit only:
 *   npx playwright test tests/mcp-server.spec.js --project=chromium
 *
 * Run full integration against prod:
 *   BASE_URL_MW=https://racing-f1-rho.vercel.app \
 *     npx playwright test tests/mcp-server.spec.js --project=chromium
 */
const { test, expect } = require('@playwright/test');
const { listTools, callTool } = require('../lib/mcp-tools.js');

const MW_URL = process.env.BASE_URL_MW;

// ── Helper: POST JSON-RPC to /api/mcp ─────────────────────────────────────────
async function rpc(playwright, method, params = {}) {
  const ctx = await playwright.request.newContext();
  const res = await ctx.post(MW_URL + '/api/mcp', {
    data: { jsonrpc: '2.0', id: 1, method, params },
    headers: { 'Content-Type': 'application/json' }
  });
  const status = res.status();
  const body = await res.json();
  await ctx.dispose();
  return { status, body };
}

// ════════════════════════════════════════════════════════════════════════════
// LAYER 1 — Unit: tool definitions and handlers
// ════════════════════════════════════════════════════════════════════════════

test.describe('Tool registry', () => {
  test('listTools returns 4 tools with correct structure', () => {
    const tools = listTools();
    expect(tools).toHaveLength(4);
    const names = tools.map(t => t.name);
    expect(names).toContain('get_tickets');
    expect(names).toContain('get_merchandise');
    expect(names).toContain('get_calendar');
    expect(names).toContain('get_experiences');

    for (const tool of tools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description.length).toBeGreaterThan(20);
      expect(tool.inputSchema).toMatchObject({ type: 'object' });
    }
  });

  test('unknown tool returns error', () => {
    const { result, error } = callTool('non_existent_tool', {});
    expect(result).toBeNull();
    expect(error.code).toBe(-32601);
    expect(error.message).toContain('non_existent_tool');
  });
});

// ── get_tickets ────────────────────────────────────────────────────────────────
test.describe('get_tickets', () => {
  test('returns all tickets with no filter', () => {
    const { result } = callTool('get_tickets', {});
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBeGreaterThan(5);
    expect(data.tickets).toBeInstanceOf(Array);
    expect(data.currency).toBe('USD');
    expect(data.site_url).toContain('/tickets');
  });

  test('filters by race name (partial match)', () => {
    const { result } = callTool('get_tickets', { race: 'Monaco' });
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBeGreaterThan(0);
    data.tickets.forEach(t => expect(t.race).toContain('Monaco'));
  });

  test('filters by category', () => {
    const { result } = callTool('get_tickets', { category: 'VIP Paddock' });
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBeGreaterThan(0);
    data.tickets.forEach(t => expect(t.category).toBe('VIP Paddock'));
  });

  test('available_only removes sold-out tickets', () => {
    const { result: all }  = callTool('get_tickets', {});
    const { result: avail } = callTool('get_tickets', { available_only: true });
    const allData   = JSON.parse(all.content[0].text);
    const availData = JSON.parse(avail.content[0].text);
    expect(availData.count).toBeLessThanOrEqual(allData.count);
    availData.tickets.forEach(t => expect(t.available).toBe(true));
  });

  test('each ticket has required fields', () => {
    const { result } = callTool('get_tickets', {});
    const data = JSON.parse(result.content[0].text);
    data.tickets.forEach(t => {
      expect(t.race).toBeTruthy();
      expect(t.category).toBeTruthy();
      expect(typeof t.price).toBe('number');
      expect(t.price).toBeGreaterThan(0);
      expect(typeof t.available).toBe('boolean');
    });
  });
});

// ── get_merchandise ────────────────────────────────────────────────────────────
test.describe('get_merchandise', () => {
  test('returns all items with no filter', () => {
    const { result } = callTool('get_merchandise', {});
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBeGreaterThan(5);
    expect(data.items).toBeInstanceOf(Array);
    expect(data.currency).toBe('USD');
    expect(data.site_url).toContain('/merchandise');
  });

  test('filters by team', () => {
    const { result } = callTool('get_merchandise', { team: 'Ferrari' });
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBeGreaterThan(0);
    data.items.forEach(i => expect(i.team).toContain('Ferrari'));
  });

  test('filters by category', () => {
    const { result } = callTool('get_merchandise', { category: 'Collectibles' });
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBeGreaterThan(0);
    data.items.forEach(i => expect(i.category).toBe('Collectibles'));
  });

  test('max_price filter works', () => {
    const { result } = callTool('get_merchandise', { max_price: 50 });
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBeGreaterThan(0);
    data.items.forEach(i => expect(i.price).toBeLessThanOrEqual(50));
  });

  test('in_stock_only removes out-of-stock items', () => {
    const { result } = callTool('get_merchandise', { in_stock_only: true });
    const data = JSON.parse(result.content[0].text);
    data.items.forEach(i => expect(i.inStock).toBe(true));
  });
});

// ── get_calendar ───────────────────────────────────────────────────────────────
test.describe('get_calendar', () => {
  test('returns all 6 races with no filter', () => {
    const { result } = callTool('get_calendar', {});
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(6);
    expect(data.season).toBe(2026);
    expect(data.races).toBeInstanceOf(Array);
  });

  test('filters by month name', () => {
    const { result } = callTool('get_calendar', { month: 'May' });
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBeGreaterThan(0);
    data.races.forEach(r => {
      const m = parseInt(r.date.split('-')[1], 10);
      expect(m).toBe(5); // May = month 5
    });
  });

  test('filters by location (partial)', () => {
    const { result } = callTool('get_calendar', { location: 'Japan' });
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBeGreaterThan(0);
    data.races.forEach(r => expect(r.country).toContain('Japan'));
  });

  test('each race has required fields', () => {
    const { result } = callTool('get_calendar', {});
    const data = JSON.parse(result.content[0].text);
    data.races.forEach(r => {
      expect(r.name).toBeTruthy();
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.circuit).toBeTruthy();
      expect(r.location).toBeTruthy();
    });
  });
});

// ── get_experiences ────────────────────────────────────────────────────────────
test.describe('get_experiences', () => {
  test('returns all experiences with no filter', () => {
    const { result } = callTool('get_experiences', {});
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBeGreaterThan(4);
    expect(data.experiences).toBeInstanceOf(Array);
    expect(data.currency).toBe('USD');
  });

  test('filters by type: Hospitality', () => {
    const { result } = callTool('get_experiences', { type: 'Hospitality' });
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBeGreaterThan(0);
    data.experiences.forEach(e => expect(e.type).toBe('Hospitality'));
  });

  test('filters by type: Track Access', () => {
    const { result } = callTool('get_experiences', { type: 'Track Access' });
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBeGreaterThan(0);
    data.experiences.forEach(e => expect(e.type).toBe('Track Access'));
  });

  test('max_price filter', () => {
    const { result } = callTool('get_experiences', { max_price: 500 });
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBeGreaterThan(0);
    data.experiences.forEach(e => expect(e.price).toBeLessThanOrEqual(500));
  });

  test('each experience has includes array', () => {
    const { result } = callTool('get_experiences', {});
    const data = JSON.parse(result.content[0].text);
    data.experiences.forEach(e => {
      expect(e.includes).toBeInstanceOf(Array);
      expect(e.includes.length).toBeGreaterThan(0);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// LAYER 2 — HTTP integration against deployed endpoint (opt-in)
// ════════════════════════════════════════════════════════════════════════════
test.describe('HTTP integration — deployed MCP endpoint', () => {
  test.skip(!MW_URL, 'set BASE_URL_MW=https://racing-f1-rho.vercel.app to run HTTP tests');

  test('GET /api/mcp returns server discovery info', async ({ playwright }) => {
    const ctx = await playwright.request.newContext();
    const res = await ctx.get(MW_URL + '/api/mcp');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('f1-racing-store');
    expect(body.tools).toContain('get_tickets');
    await ctx.dispose();
  });

  test('initialize returns protocol version and capabilities', async ({ playwright }) => {
    const { status, body } = await rpc(playwright, 'initialize', {
      protocolVersion: '2024-11-05',
      clientInfo: { name: 'test-client', version: '1.0' }
    });
    expect(status).toBe(200);
    expect(body.result.protocolVersion).toBeTruthy();
    expect(body.result.serverInfo.name).toBe('f1-racing-store');
    expect(body.result.capabilities.tools).toBeTruthy();
  });

  test('tools/list returns 4 tools', async ({ playwright }) => {
    const { status, body } = await rpc(playwright, 'tools/list');
    expect(status).toBe(200);
    expect(body.result.tools).toHaveLength(4);
    expect(body.result.tools.map(t => t.name)).toContain('get_tickets');
  });

  test('tools/call get_tickets — no filter', async ({ playwright }) => {
    const { status, body } = await rpc(playwright, 'tools/call', {
      name: 'get_tickets', arguments: {}
    });
    expect(status).toBe(200);
    expect(body.result.content[0].type).toBe('text');
    const data = JSON.parse(body.result.content[0].text);
    expect(data.count).toBeGreaterThan(5);
    expect(data.tickets[0].race).toBeTruthy();
  });

  test('tools/call get_tickets — Monaco filter', async ({ playwright }) => {
    const { status, body } = await rpc(playwright, 'tools/call', {
      name: 'get_tickets', arguments: { race: 'Monaco' }
    });
    expect(status).toBe(200);
    const data = JSON.parse(body.result.content[0].text);
    expect(data.count).toBeGreaterThan(0);
    data.tickets.forEach(t => expect(t.race).toContain('Monaco'));
  });

  test('tools/call get_merchandise — Ferrari', async ({ playwright }) => {
    const { status, body } = await rpc(playwright, 'tools/call', {
      name: 'get_merchandise', arguments: { team: 'Ferrari' }
    });
    expect(status).toBe(200);
    const data = JSON.parse(body.result.content[0].text);
    expect(data.count).toBeGreaterThan(0);
  });

  test('tools/call get_calendar — all races', async ({ playwright }) => {
    const { status, body } = await rpc(playwright, 'tools/call', {
      name: 'get_calendar', arguments: {}
    });
    expect(status).toBe(200);
    const data = JSON.parse(body.result.content[0].text);
    expect(data.count).toBe(6);
    expect(data.season).toBe(2026);
  });

  test('tools/call get_experiences — Hospitality', async ({ playwright }) => {
    const { status, body } = await rpc(playwright, 'tools/call', {
      name: 'get_experiences', arguments: { type: 'Hospitality' }
    });
    expect(status).toBe(200);
    const data = JSON.parse(body.result.content[0].text);
    expect(data.count).toBeGreaterThan(0);
    data.experiences.forEach(e => expect(e.type).toBe('Hospitality'));
  });

  test('unknown tool returns JSON-RPC error (not HTTP error)', async ({ playwright }) => {
    const { status, body } = await rpc(playwright, 'tools/call', {
      name: 'does_not_exist', arguments: {}
    });
    expect(status).toBe(200); // JSON-RPC errors return HTTP 200
    expect(body.error).toBeTruthy();
    expect(body.error.code).toBe(-32601);
  });

  test('ping responds with empty result', async ({ playwright }) => {
    const { status, body } = await rpc(playwright, 'ping');
    expect(status).toBe(200);
    expect(body.result).toEqual({});
  });
});

// ════════════════════════════════════════════════════════════════════════════
// LAYER 3 — Discovery endpoints
// ════════════════════════════════════════════════════════════════════════════
test.describe('Discovery — .well-known files', () => {
  test.skip(!MW_URL, 'set BASE_URL_MW to run discovery tests');

  test('/.well-known/mcp.json is reachable and valid', async ({ playwright }) => {
    const ctx = await playwright.request.newContext();
    const res = await ctx.get(MW_URL + '/.well-known/mcp.json');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.server_url).toContain('/api/mcp');
    expect(body.tools.length).toBe(4);
    await ctx.dispose();
  });

  test('/.well-known/ai-plugin.json is reachable', async ({ playwright }) => {
    const ctx = await playwright.request.newContext();
    const res = await ctx.get(MW_URL + '/.well-known/ai-plugin.json');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.name_for_model).toBe('f1_racing_store');
    await ctx.dispose();
  });

  test('/api/mcp-openapi.json is reachable', async ({ playwright }) => {
    const ctx = await playwright.request.newContext();
    const res = await ctx.get(MW_URL + '/api/mcp-openapi.json');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.openapi).toMatch(/^3\./);
    await ctx.dispose();
  });
});
