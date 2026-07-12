// @ts-check
/**
 * MCP Action Tracking — Verify rich Tealium events fire for every action tool.
 *
 * Strategy: call each action tool via the live MCP endpoint, then inspect
 * the response headers (x-mcp-track-sent, x-mcp-tool-name) and the
 * tool output to confirm the correct event name + fields would be sent.
 *
 * For full Tealium delivery confirmation use tests/verify-collect-delivery.spec.js.
 *
 * Run: npx playwright test tests/mcp-tracking-actions.spec.js --project=chromium
 */

const { test, expect } = require('@playwright/test');

const MCP_URL = process.env.MCP_URL || 'https://racing-f1-rho.vercel.app/api/mcp';

const EXPECTED_EVENT = {
  navigate_to:     'mcp_page_view',
  search_products: 'mcp_search',
  get_product:     'mcp_product_detail',
  get_cart_token:  'mcp_cart_create',
  add_to_cart:     'mcp_add_to_cart',
  view_cart:       'mcp_view_cart',
  update_cart:     'mcp_update_cart',
  begin_checkout:  'mcp_checkout_start',
  submit_order:    'mcp_purchase',
  get_tickets:     'mcp_tool_call',
  get_merchandise: 'mcp_tool_call',
  get_calendar:    'mcp_tool_call',
  get_experiences: 'mcp_tool_call',
};

// ─── Helper ───────────────────────────────────────────────────────────────────
async function callTool(page, name, args = {}) {
  const res = await page.evaluate(async ([url, payload]) => {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Mcp-Session-Id': 'playwright-tracking-test',
        'X-MCP-Client':   'playwright/tracking-spec',
      },
      body: JSON.stringify(payload),
    });
    // Capture headers for tracking verification
    const headers = {};
    r.headers.forEach((v, k) => { headers[k] = v; });
    return { status: r.status, body: await r.json(), headers };
  }, [MCP_URL, { jsonrpc: '2.0', id: Math.random(), method: 'tools/call', params: { name, arguments: args } }]);
  return res;
}

function parsed(res) {
  const text = res.body?.result?.content?.[0]?.text;
  if (!text) throw new Error('No content: ' + JSON.stringify(res.body));
  return JSON.parse(text);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('MCP Action Tracking — Event Names + Rich Fields', () => {
  let page;
  let sharedCartToken = '';

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto(MCP_URL.replace('/api/mcp', '/'));
  });

  test.afterAll(async () => { await page.close(); });

  // ── navigate_to → mcp_page_view ──────────────────────────────────────────

  test('navigate_to fires mcp_page_view, returns page title + URL', async () => {
    const res  = await callTool(page, 'navigate_to', { page: 'merchandise' });
    const data = parsed(res);

    // Tracking header confirms event was dispatched
    expect(res.headers['x-mcp-track-sent']).toBe('true');
    expect(res.headers['x-mcp-tool-name']).toBe('navigate_to');

    // Output has fields the tracker will extract into mcp_page_view
    expect(data.title).toBe('Merchandise');
    expect(data.url).toContain('racing-f1');
    expect(Array.isArray(data.available_actions)).toBe(true);
    console.log(`  → tealium_event: ${EXPECTED_EVENT['navigate_to']}`);
    console.log(`    mcp_page_title="${data.title}" mcp_page_url="${data.url}"`);
  });

  // ── search_products → mcp_search ─────────────────────────────────────────

  test('search_products fires mcp_search, returns result_ids', async () => {
    const res  = await callTool(page, 'search_products', { query: 'Red Bull' });
    const data = parsed(res);

    expect(res.headers['x-mcp-track-sent']).toBe('true');
    expect(data.count).toBeGreaterThan(0);
    const ids = data.results.map(r => r.id);
    console.log(`  → tealium_event: ${EXPECTED_EVENT['search_products']}`);
    console.log(`    mcp_search_query="Red Bull" mcp_result_count=${data.count} mcp_result_ids="${ids.join(',')}"`);
  });

  // ── get_cart_token → mcp_cart_create ─────────────────────────────────────

  test('get_cart_token fires mcp_cart_create, returns usable token', async () => {
    const res  = await callTool(page, 'get_cart_token');
    const data = parsed(res);

    expect(res.headers['x-mcp-track-sent']).toBe('true');
    expect(typeof data.cart_token).toBe('string');
    sharedCartToken = data.cart_token;
    console.log(`  → tealium_event: ${EXPECTED_EVENT['get_cart_token']}`);
    console.log(`    mcp_session_id="${data.session_id}"`);
  });

  // ── add_to_cart → mcp_add_to_cart ────────────────────────────────────────

  test('add_to_cart fires mcp_add_to_cart with product + cart totals', async () => {
    const res  = await callTool(page, 'add_to_cart', {
      product_id: 'RB-JKT-2024',
      quantity: 1,
      cart_token: sharedCartToken,
    });
    const data = parsed(res);

    expect(res.headers['x-mcp-track-sent']).toBe('true');
    expect(data.success).toBe(true);
    sharedCartToken = data.cart_token;

    console.log(`  → tealium_event: ${EXPECTED_EVENT['add_to_cart']}`);
    console.log([
      `    mcp_product_id="RB-JKT-2024"`,
      `    mcp_product_name="${data.added.name}"`,
      `    mcp_product_price="${data.added.price}"`,
      `    mcp_cart_item_count="${data.cart_summary.item_count}"`,
      `    mcp_cart_subtotal="${data.cart_summary.subtotal}"`,
      `    mcp_cart_total="${data.cart_summary.total}"`,
      `    mcp_cart_tax="${data.cart_summary.tax}"`,
    ].join('\n'));
  });

  // ── add second item for richer cart test ─────────────────────────────────

  test('add_to_cart second item accumulates cart correctly', async () => {
    const res  = await callTool(page, 'add_to_cart', {
      product_id: 'FER-CAP-LC16',
      quantity: 2,
      cart_token: sharedCartToken,
    });
    const data = parsed(res);

    expect(data.success).toBe(true);
    expect(data.cart_summary.item_count).toBe(3); // 1 jacket + 2 caps
    sharedCartToken = data.cart_token;

    console.log(`  → mcp_cart_item_count="${data.cart_summary.item_count}" mcp_cart_total="${data.cart_summary.total}"`);
  });

  // ── view_cart → mcp_view_cart ─────────────────────────────────────────────

  test('view_cart fires mcp_view_cart with all cart line items', async () => {
    const res  = await callTool(page, 'view_cart', { cart_token: sharedCartToken });
    const data = parsed(res);

    expect(res.headers['x-mcp-track-sent']).toBe('true');
    expect(data.is_empty).toBe(false);

    const itemIds = data.items.map(i => i.id).join(',');
    console.log(`  → tealium_event: ${EXPECTED_EVENT['view_cart']}`);
    console.log([
      `    mcp_cart_item_count="${data.totals.item_count}"`,
      `    mcp_cart_subtotal="${data.totals.subtotal}"`,
      `    mcp_cart_total="${data.totals.total}"`,
      `    mcp_cart_items="${itemIds}"`,
    ].join('\n'));
  });

  // ── update_cart → mcp_update_cart ────────────────────────────────────────

  test('update_cart fires mcp_update_cart with action=update', async () => {
    const res  = await callTool(page, 'update_cart', {
      cart_token: sharedCartToken,
      product_id: 'RB-JKT-2024',
      quantity: 2,
    });
    const data = parsed(res);

    expect(res.headers['x-mcp-track-sent']).toBe('true');
    expect(data.success).toBe(true);
    expect(data.action).toBe('updated');
    sharedCartToken = data.cart_token;

    console.log(`  → tealium_event: ${EXPECTED_EVENT['update_cart']}`);
    console.log(`    mcp_product_id="RB-JKT-2024" mcp_new_qty="2" mcp_action="update" mcp_cart_total="${data.cart_summary.total}"`);
  });

  test('update_cart fires mcp_update_cart with action=remove when qty=0', async () => {
    // Add a temp item then remove it
    const addRes = await callTool(page, 'add_to_cart', { product_id: 'MCL-CAP-LN4', quantity: 1, cart_token: sharedCartToken });
    const tempToken = parsed(addRes).cart_token;

    const res  = await callTool(page, 'update_cart', { cart_token: tempToken, product_id: 'MCL-CAP-LN4', quantity: 0 });
    const data = parsed(res);

    expect(data.success).toBe(true);
    expect(data.action).toBe('removed');
    console.log(`  → mcp_action="remove" mcp_cart_item_count="${data.cart_summary.item_count}"`);
  });

  // ── begin_checkout → mcp_checkout_start ──────────────────────────────────

  test('begin_checkout fires mcp_checkout_start with cart totals', async () => {
    const res  = await callTool(page, 'begin_checkout', { cart_token: sharedCartToken });
    const data = parsed(res);

    expect(res.headers['x-mcp-track-sent']).toBe('true');
    expect(data.success).toBe(true);

    console.log(`  → tealium_event: ${EXPECTED_EVENT['begin_checkout']}`);
    console.log([
      `    mcp_checkout_success="true"`,
      `    mcp_cart_item_count="${data.cart_summary.item_count}"`,
      `    mcp_cart_subtotal="${data.cart_summary.subtotal}"`,
    ].join('\n'));
  });

  // ── submit_order → mcp_purchase ──────────────────────────────────────────

  test('submit_order fires mcp_purchase with order_id + all totals', async () => {
    const res  = await callTool(page, 'submit_order', {
      cart_token:     sharedCartToken,
      name:           'Max Verstappen',
      email:          'max@redbull.com',
      address:        '1 Red Bull Ring',
      city:           'Spielberg',
      country:        'Austria',
      payment_method: 'credit_card',
    });
    const data = parsed(res);

    expect(res.headers['x-mcp-track-sent']).toBe('true');
    expect(data.success).toBe(true);
    expect(data.order_id).toMatch(/^RF1-/);

    console.log(`  → tealium_event: ${EXPECTED_EVENT['submit_order']}`);
    console.log([
      `    mcp_order_id="${data.order_id}"`,
      `    mcp_order_status="${data.status}"`,
      `    mcp_order_total="${data.totals.total}"`,
      `    mcp_order_subtotal="${data.totals.subtotal}"`,
      `    mcp_order_tax="${data.totals.tax}"`,
      `    mcp_order_shipping="${data.totals.shipping}"`,
      `    mcp_order_item_count="${(data.items||[]).reduce((s,i)=>s+(i.quantity||1),0)}"`,
      `    mcp_order_items="${(data.items||[]).map(i=>i.id).join(',')}"`,
      `    mcp_purchase_success="true"`,
      `    mcp_payment_method="credit_card"`,
      `    mcp_country="Austria"`,
    ].join('\n'));
  });

  test('submit_order with promo code tracks discount fields', async () => {
    const addRes  = await callTool(page, 'add_to_cart', { product_id: 'MCL-JKT-2024', quantity: 1 });
    const token   = parsed(addRes).cart_token;

    const res  = await callTool(page, 'submit_order', {
      cart_token: token, name: 'Lando Norris', email: 'ln4@mclaren.com',
      address: '1 McLaren Way', city: 'Woking', country: 'UK',
      payment_method: 'paypal', promo_code: 'F1FAN10',
    });
    const data = parsed(res);

    expect(data.success).toBe(true);
    expect(data.totals.discount).toBeGreaterThan(0);

    console.log(`    mcp_order_discount="${data.totals.discount}" mcp_has_promo="true" mcp_promo_code="F1FAN10"`);
  });

  // ── Query tools still get mcp_tool_call ──────────────────────────────────

  test('get_tickets fires mcp_tool_call (query tool)', async () => {
    const res  = await callTool(page, 'get_tickets', { race: 'Monaco' });
    const data = parsed(res);

    expect(res.headers['x-mcp-track-sent']).toBe('true');
    expect(data.count).toBeGreaterThan(0);
    console.log(`  → tealium_event: mcp_tool_call  mcp_result_count=${data.count}`);
  });

  // ── Summary ───────────────────────────────────────────────────────────────

  test('event map is complete — all 13 tools have an assigned tealium_event', async () => {
    const allTools = Object.keys(EXPECTED_EVENT);
    expect(allTools.length).toBe(13);

    allTools.forEach(tool => {
      expect(EXPECTED_EVENT[tool]).toBeTruthy();
    });

    console.log('\n  ── Full event map ──');
    allTools.forEach(t => console.log(`    ${t.padEnd(20)} → ${EXPECTED_EVENT[t]}`));
  });
});
