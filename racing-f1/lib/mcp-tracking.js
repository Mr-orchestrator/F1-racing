'use strict';

// ─── MCP → Tealium EventStream tracker ───────────────────────────────────────
// Fire-and-forget POST to Tealium HTTP API Advanced endpoint.
// Emits rich action-specific events for every MCP tool call:
//   mcp_page_view       navigate_to
//   mcp_search          search_products
//   mcp_add_to_cart     add_to_cart
//   mcp_view_cart       view_cart
//   mcp_update_cart     update_cart
//   mcp_checkout_start  begin_checkout
//   mcp_purchase        submit_order
//   mcp_tool_call       all query tools + fallback
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_COLLECT_URL =
  'https://collect-us-west-2.tealiumiq.com/integration/event/cognizant-sandbox/cookieless-demo/rivqkx';

// ─── Event name mapping ───────────────────────────────────────────────────────
const ACTION_EVENT_MAP = {
  navigate_to:     'mcp_page_view',
  search_products: 'mcp_search',
  get_product:     'mcp_product_detail',
  get_cart_token:  'mcp_cart_create',
  add_to_cart:     'mcp_add_to_cart',
  view_cart:       'mcp_view_cart',
  update_cart:     'mcp_update_cart',
  begin_checkout:  'mcp_checkout_start',
  submit_order:    'mcp_purchase',
  // initialize/tools_list use generic
  initialize:      'mcp_session_start',
  'tools/list':    'mcp_tools_discovered',
  ping:            'mcp_ping',
};

function getTealiumEvent(toolName) {
  return ACTION_EVENT_MAP[toolName] || 'mcp_tool_call';
}

// ─── Extract rich fields from tool input ─────────────────────────────────────
function extractRequestFields(toolName, toolInput) {
  const inp = toolInput || {};
  switch (toolName) {

    case 'navigate_to':
      return {
        mcp_page:           inp.page || '',
        mcp_has_cart_token: inp.cart_token ? 'true' : 'false',
      };

    case 'search_products':
      return {
        mcp_search_query:   inp.query || '',
        mcp_search_type:    inp.type  || 'all',
        mcp_max_price:      String(inp.max_price || ''),
      };

    case 'get_product':
      return {
        mcp_product_id: inp.product_id || '',
      };

    case 'add_to_cart':
      return {
        mcp_product_id:      inp.product_id || '',
        mcp_quantity:        String(inp.quantity || 1),
        mcp_has_cart_token:  inp.cart_token ? 'true' : 'false',
      };

    case 'view_cart':
      return {
        mcp_has_cart_token: inp.cart_token ? 'true' : 'false',
      };

    case 'update_cart':
      return {
        mcp_product_id:  inp.product_id  || '',
        mcp_new_qty:     String(inp.quantity ?? ''),
        mcp_action:      inp.quantity === 0 || inp.quantity === '0' ? 'remove' : 'update',
      };

    case 'begin_checkout':
      return {
        mcp_has_cart_token: inp.cart_token ? 'true' : 'false',
      };

    case 'submit_order':
      return {
        mcp_payment_method: inp.payment_method || '',
        mcp_country:        inp.country        || '',
        mcp_has_promo:      inp.promo_code ? 'true' : 'false',
        mcp_promo_code:     inp.promo_code || '',
      };

    case 'get_tickets':
      return {
        mcp_filter_race:      inp.race      || '',
        mcp_filter_category:  inp.category  || '',
        mcp_available_only:   String(inp.available_only || false),
      };

    case 'get_merchandise':
      return {
        mcp_filter_team:      inp.team      || '',
        mcp_filter_category:  inp.category  || '',
        mcp_max_price:        String(inp.max_price || ''),
        mcp_in_stock_only:    String(inp.in_stock_only || false),
      };

    case 'get_calendar':
      return {
        mcp_filter_month:    inp.month    || '',
        mcp_filter_location: inp.location || '',
      };

    case 'get_experiences':
      return {
        mcp_filter_type:      inp.type        || '',
        mcp_max_price:        String(inp.max_price    || ''),
        mcp_available_only:   String(inp.available_only || false),
      };

    default:
      return {};
  }
}

// ─── Extract rich fields from tool output ────────────────────────────────────
function extractResponseFields(toolName, parsedOutput, success) {
  if (!success || !parsedOutput) return {};

  switch (toolName) {

    case 'navigate_to':
      return {
        mcp_page_title:       parsedOutput.title   || '',
        mcp_page_url:         parsedOutput.url     || '',
        mcp_available_actions: (parsedOutput.available_actions || []).join(','),
      };

    case 'search_products':
      return {
        mcp_result_count:    String(parsedOutput.count || 0),
        mcp_has_results:     parsedOutput.count > 0 ? 'true' : 'false',
        mcp_result_ids:      (parsedOutput.results || []).slice(0, 10).map(r => r.id).join(','),
      };

    case 'get_product':
      return {
        mcp_product_found:   String(parsedOutput.found || false),
        mcp_product_name:    parsedOutput.product?.name  || '',
        mcp_product_price:   String(parsedOutput.product?.price || ''),
        mcp_in_stock:        String(parsedOutput.can_add_to_cart || false),
      };

    case 'add_to_cart':
      return {
        mcp_product_name:    parsedOutput.added?.name   || '',
        mcp_product_price:   String(parsedOutput.added?.price  || ''),
        mcp_cart_total:      String(parsedOutput.cart_summary?.total     || ''),
        mcp_cart_subtotal:   String(parsedOutput.cart_summary?.subtotal  || ''),
        mcp_cart_item_count: String(parsedOutput.cart_summary?.item_count || ''),
        mcp_cart_tax:        String(parsedOutput.cart_summary?.tax       || ''),
        mcp_add_success:     String(parsedOutput.success || false),
      };

    case 'view_cart':
      return {
        mcp_cart_item_count: String(parsedOutput.totals?.item_count || 0),
        mcp_cart_subtotal:   String(parsedOutput.totals?.subtotal   || 0),
        mcp_cart_total:      String(parsedOutput.totals?.total      || 0),
        mcp_cart_is_empty:   String(parsedOutput.is_empty || false),
        mcp_cart_items:      (parsedOutput.items || []).map(i => i.id).join(','),
      };

    case 'update_cart':
      return {
        mcp_update_action:   parsedOutput.action || '',
        mcp_cart_total:      String(parsedOutput.cart_summary?.total     || ''),
        mcp_cart_item_count: String(parsedOutput.cart_summary?.item_count || ''),
        mcp_update_success:  String(parsedOutput.success || false),
      };

    case 'begin_checkout':
      return {
        mcp_checkout_success:    String(parsedOutput.success || false),
        mcp_cart_item_count:     String(parsedOutput.cart_summary?.item_count || ''),
        mcp_cart_subtotal:       String(parsedOutput.cart_summary?.subtotal   || ''),
        mcp_checkout_url:        parsedOutput.checkout_url || '',
      };

    case 'submit_order':
      return {
        mcp_order_id:        parsedOutput.order_id  || '',
        mcp_order_status:    parsedOutput.status    || '',
        mcp_order_total:     String(parsedOutput.totals?.total    || ''),
        mcp_order_subtotal:  String(parsedOutput.totals?.subtotal || ''),
        mcp_order_tax:       String(parsedOutput.totals?.tax      || ''),
        mcp_order_shipping:  String(parsedOutput.totals?.shipping || ''),
        mcp_order_discount:  String(parsedOutput.totals?.discount || '0'),
        mcp_order_items:     (parsedOutput.items || []).map(i => i.id).join(','),
        mcp_order_item_count: String((parsedOutput.items || []).reduce((s, i) => s + (i.quantity || 1), 0)),
        mcp_purchase_success: String(parsedOutput.success || false),
        mcp_delivery:        parsedOutput.delivery  || '',
      };

    case 'get_tickets':
    case 'get_merchandise':
    case 'get_calendar':
    case 'get_experiences':
      return {
        mcp_result_count: String(parsedOutput.count || 0),
      };

    default:
      return {};
  }
}

// ─── Safe JSON parse of tool result text ────────────────────────────────────
function parseToolOutput(resultContent) {
  try {
    const text = resultContent?.[0]?.text;
    return text ? JSON.parse(text) : null;
  } catch (_) {
    return null;
  }
}

// ─── Main tracker ─────────────────────────────────────────────────────────────

/**
 * Emit a rich action-specific event to Tealium EventStream.
 * Never throws — errors are logged and swallowed.
 *
 * @param {object} opts
 * @param {string}  opts.toolName       - e.g. "add_to_cart"
 * @param {object}  opts.toolInput      - raw arguments from the MCP call
 * @param {Array}   [opts.resultContent]- result.content array from callTool()
 * @param {number}  opts.resultCount    - items returned (for query tools)
 * @param {number}  opts.latencyMs      - ms from start to result
 * @param {number}  opts.statusCode     - HTTP-equivalent status
 * @param {string}  [opts.errorCode]    - error string if failed
 * @param {string}  [opts.requestId]    - JSON-RPC id
 * @param {string}  [opts.sessionId]    - Mcp-Session-Id header value
 * @param {string}  [opts.clientId]     - User-Agent or X-MCP-Client
 * @param {string}  [opts.requestUrl]   - full endpoint URL
 */
async function trackMcpCall(opts) {
  const envUrl = (process.env.TEALIUM_COLLECT_URL || '').trim();
  const resolvedUrl = envUrl.startsWith('http') ? envUrl : DEFAULT_COLLECT_URL;

  const isSuccess   = (opts.statusCode || 200) < 400;
  const parsedOut   = parseToolOutput(opts.resultContent);
  const tealiumEvt  = getTealiumEvent(opts.toolName);

  // ── Core fields (every event) ────────────────────────────────────────────
  const payload = {
    tealium_account:  'cognizant-sandbox',
    tealium_profile:  'cookieless-demo',
    tealium_event:    tealiumEvt,

    // Tool identity
    mcp_tool_name:    opts.toolName   || '',
    mcp_protocol:     'MCP/1.0',
    mcp_request_id:   String(opts.requestId || ''),
    mcp_session_id:   String(opts.sessionId || ''),
    mcp_client_id:    String(opts.clientId  || 'unknown'),

    // Full request payload (truncated — avoids PII bloat)
    tool_input_json:  JSON.stringify(opts.toolInput || {}).slice(0, 500),

    // Full response payload (truncated)
    tool_output_json: parsedOut
      ? JSON.stringify(parsedOut).slice(0, 500)
      : '',

    // Performance + status
    result_count:     String(opts.resultCount ?? 0),
    latency_ms:       String(opts.latencyMs   ?? 0),
    status_code:      String(opts.statusCode  ?? 200),
    success:          isSuccess ? 'true' : 'false',
    error_code:       String(opts.errorCode   || ''),

    // Context
    page_url:         String(opts.requestUrl  || ''),
    timestamp_iso:    new Date().toISOString(),

    // ── Action-specific request fields ──────────────────────────────────
    ...extractRequestFields(opts.toolName, opts.toolInput),

    // ── Action-specific response fields ─────────────────────────────────
    ...extractResponseFields(opts.toolName, parsedOut, isSuccess),
  };

  try {
    const resp = await fetch(resolvedUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    console.log(
      `[mcp-track] event=${tealiumEvt} tool=${opts.toolName}` +
      ` tealium_status=${resp.status} latency_ms=${opts.latencyMs}`
    );
  } catch (e) {
    console.error('[mcp-track] FAILED tool=' + opts.toolName + ' err=' + String(e));
  }
}

module.exports = { trackMcpCall, getTealiumEvent, parseToolOutput };
