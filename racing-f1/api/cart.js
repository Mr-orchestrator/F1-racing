'use strict';

// ─── /api/cart — REST Cart Endpoint ──────────────────────────────────────────
// Used by both the site's frontend JS and Comet/browser agents to sync cart state.
// Cart state lives in the client-carried token (stateless).
//
// POST /api/cart  { action, cart_token?, product_id?, quantity? }
// GET  /api/cart?token=...  → view cart
// ─────────────────────────────────────────────────────────────────────────────

const {
  encodeCart, decodeCart, emptyCart,
  addItem, updateItem, cartSummary,
} = require('../lib/mcp-cart.js');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  // GET /api/cart?token=... → view cart
  if (req.method === 'GET') {
    const token = req.query.token || '';
    const cart  = decodeCart(token);
    const summary = cartSummary(cart);
    return res.status(200).json({ items: cart.items, totals: summary, cart_token: token });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use GET or POST' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  }

  const { action, cart_token, product_id, quantity } = body || {};

  switch (action) {

    case 'new': {
      const cart  = emptyCart();
      const token = encodeCart(cart);
      return res.status(200).json({ cart_token: token, items: [], totals: cartSummary(cart) });
    }

    case 'add': {
      const { cart, added, error } = addItem(cart_token, product_id, quantity || 1);
      if (error) return res.status(400).json({ error });
      const token = encodeCart(cart);
      return res.status(200).json({ cart_token: token, added, items: cart.items, totals: cartSummary(cart) });
    }

    case 'update': {
      const { cart, error } = updateItem(cart_token, product_id, quantity);
      if (error) return res.status(400).json({ error });
      const token = encodeCart(cart);
      return res.status(200).json({ cart_token: token, items: cart.items, totals: cartSummary(cart) });
    }

    case 'view': {
      const cart  = decodeCart(cart_token);
      return res.status(200).json({ cart_token, items: cart.items, totals: cartSummary(cart) });
    }

    case 'clear': {
      const cart  = emptyCart();
      const token = encodeCart(cart);
      return res.status(200).json({ cart_token: token, items: [], totals: cartSummary(cart) });
    }

    default:
      return res.status(400).json({ error: `Unknown action: ${action}. Use: new, add, update, view, clear` });
  }
}
