// @ts-check
/**
 * MCP Action Tools — End-to-End Test
 *
 * Tests the full agentic purchase funnel via MCP:
 *   navigate_to → search_products → add_to_cart → view_cart → begin_checkout → submit_order
 *
 * Also verifies query tools still work alongside action tools (no regressions).
 *
 * Run: npx playwright test tests/mcp-actions.spec.js --project=chromium
 */

const { test, expect } = require('@playwright/test');

const MCP_URL = process.env.MCP_URL || 'https://racing-f1-rho.vercel.app/api/mcp';

// ─── Helper ───────────────────────────────────────────────────────────────────
async function mcp(page, method, params = {}) {
  const body = { jsonrpc: '2.0', id: Math.random(), method, params };
  const res = await page.evaluate(async ([url, payload]) => {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { status: r.status, body: await r.json() };
  }, [MCP_URL, body]);
  return res;
}

async function callTool(page, name, args = {}) {
  return mcp(page, 'tools/call', { name, arguments: args });
}

function parsed(res) {
  const text = res.body?.result?.content?.[0]?.text;
  if (!text) throw new Error('No content in response: ' + JSON.stringify(res.body));
  return JSON.parse(text);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('MCP Action Tools — Full Purchase Funnel', () => {
  let page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto(MCP_URL.replace('/api/mcp', '/'));
  });

  test.afterAll(async () => {
    await page.close();
  });

  // ── Discovery ────────────────────────────────────────────────────────────

  test('tools/list returns 13 tools including action tools', async () => {
    const res = await mcp(page, 'tools/list');
    expect(res.status).toBe(200);
    const tools = res.body.result.tools;
    const names = tools.map(t => t.name);

    // Action tools present
    expect(names).toContain('navigate_to');
    expect(names).toContain('search_products');
    expect(names).toContain('add_to_cart');
    expect(names).toContain('view_cart');
    expect(names).toContain('update_cart');
    expect(names).toContain('begin_checkout');
    expect(names).toContain('submit_order');
    expect(names).toContain('get_cart_token');
    expect(names).toContain('get_product');

    // Query tools still present (no regression)
    expect(names).toContain('get_tickets');
    expect(names).toContain('get_merchandise');
    expect(names).toContain('get_calendar');
    expect(names).toContain('get_experiences');

    expect(tools.length).toBeGreaterThanOrEqual(13);
  });

  // ── navigate_to ──────────────────────────────────────────────────────────

  test('navigate_to: returns URL and available actions for merchandise page', async () => {
    const res = await callTool(page, 'navigate_to', { page: 'merchandise' });
    const data = parsed(res);

    expect(data.page).toBe('merchandise');
    expect(data.url).toContain('racing-f1');
    expect(data.title).toBe('Merchandise');
    expect(Array.isArray(data.available_actions)).toBe(true);
    expect(data.available_actions).toContain('add_to_cart');
  });

  test('navigate_to: shows cart item count when cart_token provided', async () => {
    // First create a cart with one item
    const addRes = await callTool(page, 'add_to_cart', { product_id: 'RB-JKT-2024', quantity: 1 });
    const addData = parsed(addRes);
    const cartToken = addData.cart_token;

    const res = await callTool(page, 'navigate_to', { page: 'cart', cart_token: cartToken });
    const data = parsed(res);

    expect(data.cart).not.toBeNull();
    expect(data.cart.item_count).toBeGreaterThan(0);
  });

  // ── search_products ──────────────────────────────────────────────────────

  test('search_products: finds Red Bull jacket', async () => {
    const res = await callTool(page, 'search_products', { query: 'Red Bull jacket' });
    const data = parsed(res);

    expect(data.count).toBeGreaterThan(0);
    const jacket = data.results.find(r => r.id === 'RB-JKT-2024');
    expect(jacket).toBeDefined();
    expect(jacket.name).toContain('Jacket');
  });

  test('search_products: finds Monaco ticket', async () => {
    const res = await callTool(page, 'search_products', { query: 'Monaco', type: 'ticket' });
    const data = parsed(res);

    expect(data.count).toBeGreaterThan(0);
    data.results.forEach(r => {
      expect(r.id).toMatch(/TICKET-monaco/i);
    });
  });

  test('search_products: max_price filter works', async () => {
    const res = await callTool(page, 'search_products', { query: 'cap', max_price: 50 });
    const data = parsed(res);

    data.results.forEach(r => {
      expect(r.price).toBeLessThanOrEqual(50);
    });
  });

  // ── get_product ──────────────────────────────────────────────────────────

  test('get_product: returns full detail for RB-JKT-2024', async () => {
    const res = await callTool(page, 'get_product', { product_id: 'RB-JKT-2024' });
    const data = parsed(res);

    expect(data.found).toBe(true);
    expect(data.product.id).toBe('RB-JKT-2024');
    expect(data.product.price).toBe(159.99);
    expect(data.can_add_to_cart).toBe(true);
  });

  test('get_product: returns not-found for invalid ID', async () => {
    const res = await callTool(page, 'get_product', { product_id: 'FAKE-999' });
    const data = parsed(res);
    expect(data.found).toBe(false);
  });

  // ── get_cart_token ────────────────────────────────────────────────────────

  test('get_cart_token: returns a usable token', async () => {
    const res = await callTool(page, 'get_cart_token');
    const data = parsed(res);

    expect(typeof data.cart_token).toBe('string');
    expect(data.cart_token.length).toBeGreaterThan(10);
    expect(data.session_id).toBeDefined();
  });

  // ── add_to_cart ───────────────────────────────────────────────────────────

  test('add_to_cart: adds Red Bull jacket, returns cart_token', async () => {
    const res = await callTool(page, 'add_to_cart', {
      product_id: 'RB-JKT-2024',
      quantity: 1,
    });
    const data = parsed(res);

    expect(data.success).toBe(true);
    expect(data.added.id).toBe('RB-JKT-2024');
    expect(data.added.price).toBe(159.99);
    expect(typeof data.cart_token).toBe('string');
    expect(data.cart_summary.item_count).toBe(1);
    expect(data.cart_summary.subtotal).toBe(159.99);
  });

  test('add_to_cart: rejects out-of-stock item', async () => {
    // MER-MOD-W15 is out of stock
    const res = await callTool(page, 'add_to_cart', { product_id: 'MER-MOD-W15' });
    const data = parsed(res);
    expect(data.success).toBe(false);
    expect(data.error).toContain('out of stock');
  });

  test('add_to_cart: accumulates items across calls using cart_token', async () => {
    const res1 = await callTool(page, 'add_to_cart', { product_id: 'RB-JKT-2024', quantity: 1 });
    const token1 = parsed(res1).cart_token;

    const res2 = await callTool(page, 'add_to_cart', {
      product_id: 'FER-CAP-LC16',
      quantity: 2,
      cart_token: token1,
    });
    const data2 = parsed(res2);

    expect(data2.cart_summary.item_count).toBe(3); // 1 jacket + 2 caps
    expect(data2.cart_summary.subtotal).toBeCloseTo(159.99 + 45.00 * 2, 1);
  });

  // ── view_cart ─────────────────────────────────────────────────────────────

  test('view_cart: shows correct items and totals', async () => {
    const addRes = await callTool(page, 'add_to_cart', { product_id: 'MCL-MOD-38', quantity: 1 });
    const token  = parsed(addRes).cart_token;

    const res  = await callTool(page, 'view_cart', { cart_token: token });
    const data = parsed(res);

    expect(data.is_empty).toBe(false);
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.totals.shipping).toBe(9.99);
    expect(data.totals.tax).toBeGreaterThan(0);
    expect(data.totals.total).toBeGreaterThan(data.totals.subtotal);
  });

  test('view_cart: empty cart when no token', async () => {
    const res  = await callTool(page, 'view_cart', {});
    const data = parsed(res);
    expect(data.is_empty).toBe(true);
    expect(data.items.length).toBe(0);
    expect(data.totals.shipping).toBe(0);
  });

  // ── update_cart ───────────────────────────────────────────────────────────

  test('update_cart: changes quantity', async () => {
    const addRes = await callTool(page, 'add_to_cart', { product_id: 'RB-CAP-MV1', quantity: 1 });
    const token  = parsed(addRes).cart_token;

    const res  = await callTool(page, 'update_cart', { cart_token: token, product_id: 'RB-CAP-MV1', quantity: 3 });
    const data = parsed(res);

    expect(data.success).toBe(true);
    expect(data.new_quantity).toBe(3);
    expect(data.cart_summary.subtotal).toBeCloseTo(39.99 * 3, 1);
  });

  test('update_cart: quantity=0 removes item', async () => {
    const addRes = await callTool(page, 'add_to_cart', { product_id: 'MER-CAP-LH44', quantity: 1 });
    const token  = parsed(addRes).cart_token;

    const res  = await callTool(page, 'update_cart', { cart_token: token, product_id: 'MER-CAP-LH44', quantity: 0 });
    const data = parsed(res);

    expect(data.success).toBe(true);
    expect(data.action).toBe('removed');
    expect(data.cart_summary.item_count).toBe(0);
  });

  // ── begin_checkout ────────────────────────────────────────────────────────

  test('begin_checkout: returns required field schema', async () => {
    const addRes = await callTool(page, 'add_to_cart', { product_id: 'RB-JKT-2024', quantity: 1 });
    const token  = parsed(addRes).cart_token;

    const res  = await callTool(page, 'begin_checkout', { cart_token: token });
    const data = parsed(res);

    expect(data.success).toBe(true);
    expect(data.required_fields).toHaveProperty('name');
    expect(data.required_fields).toHaveProperty('email');
    expect(data.required_fields).toHaveProperty('payment_method');
    expect(data.cart_summary.subtotal).toBe(159.99);
  });

  test('begin_checkout: fails on empty cart', async () => {
    const res  = await callTool(page, 'begin_checkout', { cart_token: '' });
    const data = parsed(res);
    expect(data.success).toBe(false);
    expect(data.error).toContain('empty');
  });

  // ── submit_order — Full Funnel ─────────────────────────────────────────────

  test('FULL FUNNEL: search → add → checkout → confirm order', async () => {
    // Step 1: Search
    const searchRes = await callTool(page, 'search_products', { query: 'Ferrari jacket' });
    const searchData = parsed(searchRes);
    expect(searchData.count).toBeGreaterThan(0);
    const productId = searchData.results[0].id;

    // Step 2: Add to cart
    const addRes = await callTool(page, 'add_to_cart', { product_id: productId, quantity: 1 });
    const addData = parsed(addRes);
    expect(addData.success).toBe(true);
    const cartToken = addData.cart_token;

    // Step 3: Begin checkout
    const checkRes = await callTool(page, 'begin_checkout', { cart_token: cartToken });
    const checkData = parsed(checkRes);
    expect(checkData.success).toBe(true);

    // Step 4: Submit order
    const orderRes = await callTool(page, 'submit_order', {
      cart_token:     cartToken,
      name:           'Ayrton Senna',
      email:          'ayrton@f1test.com',
      address:        'Rua México 98',
      city:           'São Paulo',
      country:        'Brazil',
      payment_method: 'credit_card',
    });
    const orderData = parsed(orderRes);

    expect(orderData.success).toBe(true);
    expect(orderData.order_id).toMatch(/^RF1-/);
    expect(orderData.status).toBe('confirmed');
    expect(orderData.shipping_to.email).toBe('ayrton@f1test.com');
    expect(orderData.totals.total).toBeGreaterThan(orderData.totals.subtotal);
  });

  test('submit_order: promo code F1FAN10 applies 10% discount', async () => {
    const addRes  = await callTool(page, 'add_to_cart', { product_id: 'MCL-JKT-2024', quantity: 1 });
    const token   = parsed(addRes).cart_token;

    const orderRes = await callTool(page, 'submit_order', {
      cart_token:     token,
      name:           'Lewis Hamilton',
      email:          'lh44@test.com',
      address:        '44 Stevenage Rd',
      city:           'London',
      country:        'UK',
      payment_method: 'paypal',
      promo_code:     'F1FAN10',
    });
    const data = parsed(orderRes);

    expect(data.success).toBe(true);
    expect(data.totals.discount).toBeCloseTo(169.99 * 0.10, 1);
    expect(data.totals.discount_code).toBe('F1FAN10');
  });

  test('submit_order: fails with invalid email', async () => {
    const addRes = await callTool(page, 'add_to_cart', { product_id: 'RB-CAP-MV1', quantity: 1 });
    const token  = parsed(addRes).cart_token;

    const orderRes = await callTool(page, 'submit_order', {
      cart_token:     token,
      name:           'Max',
      email:          'not-an-email',
      address:        '1 Red Bull Ring',
      city:           'Spielberg',
      country:        'Austria',
      payment_method: 'credit_card',
    });
    const data = parsed(orderRes);
    expect(data.success).toBe(false);
    expect(data.error).toContain('email');
  });

  // ── Query tools regression ────────────────────────────────────────────────

  test('get_tickets still works (regression check)', async () => {
    const res  = await callTool(page, 'get_tickets', { race: 'Monaco', available_only: true });
    const data = parsed(res);
    expect(data.count).toBeGreaterThan(0);
    data.tickets.forEach(t => expect(t.available).toBe(true));
  });

  test('get_merchandise still works (regression check)', async () => {
    const res  = await callTool(page, 'get_merchandise', { team: 'McLaren' });
    const data = parsed(res);
    expect(data.count).toBeGreaterThan(0);
  });
});
