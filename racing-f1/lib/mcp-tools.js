'use strict';

// ─── MCP Tool Definitions + Handlers ─────────────────────────────────────────
// Each tool has: name, description, inputSchema (JSON Schema), and a handler.
// Handlers receive validated args and return { content: [{type, text}] } per MCP spec.
// ─────────────────────────────────────────────────────────────────────────────

const { TICKETS, MERCHANDISE, RACES, EXPERIENCES } = require('./mcp-data.js');

const BASE_URL = 'https://racing-f1-rho.vercel.app';

// ─── Helper ──────────────────────────────────────────────────────────────────
function textResult(obj) {
  return { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] };
}

function matchesFilter(value, filter) {
  if (!filter) return true;
  return String(value).toLowerCase().includes(String(filter).toLowerCase());
}

// ─── Tool: get_tickets ────────────────────────────────────────────────────────
const GET_TICKETS = {
  name: 'get_tickets',
  description:
    'Get available F1 race tickets with pricing, categories, and availability. ' +
    'Filter by race name or ticket category (General Admission, Grandstand, VIP Paddock, Pit Lane). ' +
    'Returns prices in USD.',
  inputSchema: {
    type: 'object',
    properties: {
      race: {
        type: 'string',
        description: 'Filter by race name, e.g. "Monaco", "British", "Silverstone". Partial match supported.'
      },
      category: {
        type: 'string',
        enum: ['General Admission', 'Grandstand', 'VIP Paddock', 'Pit Lane'],
        description: 'Filter by ticket category.'
      },
      available_only: {
        type: 'boolean',
        description: 'If true, return only tickets currently available for purchase. Default: false.'
      }
    },
    additionalProperties: false
  },
  handler(args) {
    let results = TICKETS;
    if (args.race)     results = results.filter(t => matchesFilter(t.race, args.race) || matchesFilter(t.location, args.race));
    if (args.category) results = results.filter(t => t.category === args.category);
    if (args.available_only) results = results.filter(t => t.available);

    return textResult({
      count:    results.length,
      currency: 'USD',
      site_url: BASE_URL + '/tickets',
      filters_applied: { race: args.race || null, category: args.category || null, available_only: args.available_only || false },
      tickets:  results
    });
  }
};

// ─── Tool: get_merchandise ────────────────────────────────────────────────────
const GET_MERCHANDISE = {
  name: 'get_merchandise',
  description:
    'Browse F1 official merchandise including team apparel, accessories, and scale model collectibles. ' +
    'Filter by team (Red Bull, Ferrari, McLaren, Mercedes) or category. ' +
    'Returns prices in USD with stock status.',
  inputSchema: {
    type: 'object',
    properties: {
      team: {
        type: 'string',
        description: 'Filter by F1 team, e.g. "Red Bull", "Ferrari", "McLaren", "Mercedes". Partial match supported.'
      },
      category: {
        type: 'string',
        enum: ['Apparel', 'Accessories', 'Collectibles'],
        description: 'Filter by product category.'
      },
      in_stock_only: {
        type: 'boolean',
        description: 'If true, return only items currently in stock. Default: false.'
      },
      max_price: {
        type: 'number',
        description: 'Return only items priced at or below this amount (USD).'
      }
    },
    additionalProperties: false
  },
  handler(args) {
    let results = MERCHANDISE;
    if (args.team)         results = results.filter(m => matchesFilter(m.team, args.team) || matchesFilter(m.brand, args.team));
    if (args.category)     results = results.filter(m => m.category === args.category);
    if (args.in_stock_only) results = results.filter(m => m.inStock);
    if (args.max_price)    results = results.filter(m => m.price <= args.max_price);

    return textResult({
      count:    results.length,
      currency: 'USD',
      site_url: BASE_URL + '/merchandise',
      filters_applied: { team: args.team || null, category: args.category || null, in_stock_only: args.in_stock_only || false, max_price: args.max_price || null },
      items: results
    });
  }
};

// ─── Tool: get_calendar ────────────────────────────────────────────────────────
const GET_CALENDAR = {
  name: 'get_calendar',
  description:
    'Get the 2026 F1 World Championship race calendar with circuit details, dates, and locations. ' +
    'Filter by month or country/location. All dates are in YYYY-MM-DD format.',
  inputSchema: {
    type: 'object',
    properties: {
      month: {
        type: 'string',
        description: 'Filter by month name or number, e.g. "April", "09", "July". Partial match supported.'
      },
      location: {
        type: 'string',
        description: 'Filter by city, country, or circuit name, e.g. "Monaco", "Japan", "Silverstone". Partial match supported.'
      }
    },
    additionalProperties: false
  },
  handler(args) {
    let results = RACES;

    if (args.month) {
      const monthNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
      const q = String(args.month).toLowerCase();
      const monthIdx = monthNames.findIndex(m => m.startsWith(q.slice(0, 3)));
      results = results.filter(r => {
        if (monthIdx >= 0) {
          // match by month number (1-indexed)
          return parseInt(r.date.split('-')[1], 10) === monthIdx + 1;
        }
        return matchesFilter(r.date, q);
      });
    }

    if (args.location) {
      results = results.filter(r =>
        matchesFilter(r.location, args.location) ||
        matchesFilter(r.country,  args.location) ||
        matchesFilter(r.circuit,  args.location) ||
        matchesFilter(r.name,     args.location)
      );
    }

    return textResult({
      count:    results.length,
      season:   2026,
      site_url: BASE_URL + '/calendar',
      filters_applied: { month: args.month || null, location: args.location || null },
      races: results
    });
  }
};

// ─── Tool: get_experiences ────────────────────────────────────────────────────
const GET_EXPERIENCES = {
  name: 'get_experiences',
  description:
    'Get VIP F1 experiences including paddock hospitality suites, pit lane walks, ' +
    'driver meet & greets, factory tours, and simulator sessions. ' +
    'Filter by experience type. Returns prices in USD.',
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['Hospitality', 'Track Access', 'Exclusive'],
        description: 'Filter by experience type.'
      },
      max_price: {
        type: 'number',
        description: 'Return only experiences priced at or below this amount (USD).'
      },
      available_only: {
        type: 'boolean',
        description: 'If true, return only experiences currently available. Default: false.'
      }
    },
    additionalProperties: false
  },
  handler(args) {
    let results = EXPERIENCES;
    if (args.type)           results = results.filter(e => e.type === args.type);
    if (args.max_price)      results = results.filter(e => e.price <= args.max_price);
    if (args.available_only) results = results.filter(e => e.available);

    return textResult({
      count:    results.length,
      currency: 'USD',
      site_url: BASE_URL + '/experiences',
      filters_applied: { type: args.type || null, max_price: args.max_price || null, available_only: args.available_only || false },
      experiences: results
    });
  }
};

// ─── Registry ─────────────────────────────────────────────────────────────────
const TOOLS = [GET_TICKETS, GET_MERCHANDISE, GET_CALENDAR, GET_EXPERIENCES];
const TOOL_MAP = Object.fromEntries(TOOLS.map(t => [t.name, t]));

/**
 * List all tools in MCP tools/list format.
 */
function listTools() {
  return TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
}

/**
 * Call a tool by name with args.
 * Returns { result, error } — error is null on success.
 */
function callTool(name, args) {
  const tool = TOOL_MAP[name];
  if (!tool) {
    return { result: null, error: { code: -32601, message: `Unknown tool: ${name}` } };
  }
  try {
    return { result: tool.handler(args || {}), error: null };
  } catch (e) {
    return { result: null, error: { code: -32603, message: 'Tool execution error: ' + String(e) } };
  }
}

module.exports = { listTools, callTool, TOOLS };
