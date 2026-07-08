/**
 * F1 Racing Store — MCP Server (JSON-RPC 2.0 over HTTP)
 *
 * Implements the Model Context Protocol (MCP) Streamable HTTP transport.
 * Any MCP-compatible client (Claude Desktop, ChatGPT, Cursor, etc.) can
 * connect by pointing at:  https://racing-f1-rho.vercel.app/api/mcp
 *
 * Supported MCP methods:
 *   initialize          → server info + capabilities
 *   tools/list          → 4 tool definitions
 *   tools/call          → execute a tool + fire Tealium mcp_tool_call event
 *
 * Auth: optional. Set MCP_API_KEY env var to require Bearer / X-API-Key header.
 *       Leave unset for public access (read-only catalog — no PII exposed).
 *
 * IMPORTANT: This endpoint is intentionally outside the existing crawler-
 * detection middleware (middleware.js matcher excludes /api/). It has its
 * own separate Tealium tracking via lib/mcp-tracking.js.
 */

const { listTools, callTool } = require('../lib/mcp-tools.js');
const { trackMcpCall }        = require('../lib/mcp-tracking.js');

const SERVER_INFO = {
  name:        'f1-racing-store',
  version:     '1.0.0',
  description: 'F1 Racing Store — query tickets, merchandise, race calendar, and VIP experiences',
};

const CAPABILITIES = {
  tools: { listChanged: false },
};

// ─── CORS headers (allow all MCP clients) ─────────────────────────────────────
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-API-Key, Mcp-Session-Id, X-MCP-Client');
  res.setHeader('Access-Control-Max-Age', '86400');
}

// ─── Optional API key auth ─────────────────────────────────────────────────────
function isAuthorized(req) {
  const requiredKey = (process.env.MCP_API_KEY || '').trim();
  if (!requiredKey) return true; // no key configured → public access

  const authHeader = req.headers['authorization'] || '';
  const apiKeyHeader = req.headers['x-api-key'] || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  return bearer === requiredKey || apiKeyHeader === requiredKey;
}

// ─── JSON-RPC helpers ──────────────────────────────────────────────────────────
function rpcOk(id, result)  { return { jsonrpc: '2.0', id, result }; }
function rpcErr(id, code, message) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

// ─── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  setCors(res);

  // CORS preflight
  if (req.method === 'OPTIONS') return res.status(204).end();

  // Discovery ping: GET /api/mcp → return server info
  if (req.method === 'GET') {
    return res.status(200).json({
      ...SERVER_INFO,
      protocol:    'MCP/1.0',
      transport:   'http',
      endpoint:    'https://racing-f1-rho.vercel.app/api/mcp',
      tools_count: listTools().length,
      tools:       listTools().map(t => t.name),
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json(rpcErr(null, -32700, 'Method not allowed — use POST'));
  }

  // Auth
  if (!isAuthorized(req)) {
    res.setHeader('WWW-Authenticate', 'Bearer realm="F1 Racing Store MCP"');
    return res.status(401).json(rpcErr(null, -32001, 'Unauthorized — provide a valid API key'));
  }

  // Parse body (Vercel auto-parses application/json)
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch {
      return res.status(400).json(rpcErr(null, -32700, 'Parse error — invalid JSON'));
    }
  }
  if (!body || body.jsonrpc !== '2.0' || !body.method) {
    return res.status(400).json(rpcErr(body?.id ?? null, -32600, 'Invalid JSON-RPC 2.0 request'));
  }

  const { id, method, params = {} } = body;

  // Context for tracking
  const sessionId  = req.headers['mcp-session-id'] || req.headers['x-mcp-session-id'] || '';
  const clientId   = req.headers['x-mcp-client'] || req.headers['user-agent'] || 'unknown';
  const requestUrl = `https://racing-f1-rho.vercel.app/api/mcp`;

  // ── Method routing ────────────────────────────────────────────────────────
  switch (method) {

    // initialize: client announces itself, server returns info + capabilities
    case 'initialize':
      return res.status(200).json(rpcOk(id, {
        protocolVersion: '2024-11-05',
        serverInfo:      SERVER_INFO,
        capabilities:    CAPABILITIES,
      }));

    // notifications/initialized: client confirms init — acknowledge silently
    case 'notifications/initialized':
      return res.status(200).end();

    // tools/list: return all tool definitions
    case 'tools/list':
      return res.status(200).json(rpcOk(id, { tools: listTools() }));

    // tools/call: execute a tool and emit Tealium event
    case 'tools/call': {
      const toolName = params.name;
      const toolArgs = params.arguments || {};

      if (!toolName) {
        return res.status(400).json(rpcErr(id, -32602, 'Missing params.name'));
      }

      const start = Date.now();
      const { result, error } = callTool(toolName, toolArgs);
      const latencyMs = Date.now() - start;

      if (error) {
        // Track failed call to Tealium (fire-and-forget, don't await)
        trackMcpCall({
          toolName, toolInput: toolArgs, resultCount: 0, latencyMs,
          statusCode: 404, errorCode: String(error.code),
          requestId: id, sessionId, clientId, requestUrl,
        }).catch(() => {});

        return res.status(200).json(rpcErr(id, error.code, error.message));
      }

      // Count items returned (for Tealium metric)
      let resultCount = 0;
      try {
        const parsed = JSON.parse(result.content[0].text);
        resultCount = parsed.count || 0;
      } catch (_) {}

      // Track to Tealium EventStream (fire-and-forget)
      const collectUrl = (process.env.TEALIUM_COLLECT_URL ||
        'https://collect-us-west-2.tealiumiq.com/integration/event/cognizant-sandbox/cookieless-demo/rivqkx').trim();
      trackMcpCall({
        toolName, toolInput: toolArgs, resultCount, latencyMs,
        statusCode: 200, errorCode: '',
        requestId: id, sessionId, clientId, requestUrl,
      }).catch(() => {});

      // Proof headers — same pattern as x-bot-track-sent in middleware.js
      // Lets Playwright / curl verify tracking fired without needing Vercel log access
      res.setHeader('x-mcp-track-sent', 'true');
      res.setHeader('x-mcp-track-url',  collectUrl);
      res.setHeader('x-mcp-tool-name',  toolName);
      res.setHeader('x-mcp-result-count', String(resultCount));

      return res.status(200).json(rpcOk(id, result));
    }

    // ping: liveness check
    case 'ping':
      return res.status(200).json(rpcOk(id, {}));

    default:
      return res.status(200).json(rpcErr(id, -32601, `Method not found: ${method}`));
  }
}
