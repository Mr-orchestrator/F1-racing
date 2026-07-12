'use strict';

// ─── Stateless Cart Token Engine ─────────────────────────────────────────────
// Cart state is encoded into a base64 token that the MCP client carries.
// No server-side storage needed — fully stateless, works on Vercel serverless.
// Token is just base64(JSON) — not encrypted, but this is a demo store.
// ─────────────────────────────────────────────────────────────────────────────

const { MERCHANDISE, TICKETS, EXPERIENCES } = require('./mcp-data.js');

// Build a flat lookup of all purchasable items by ID
function buildCatalog() {
  const map = {};

  MERCHANDISE.forEach(item => {
    map[item.id] = {
      id:       item.id,
      name:     item.name,
      price:    item.price,
      category: item.category,
      team:     item.team || null,
      inStock:  item.inStock,
      type:     'merchandise',
    };
  });

  // Tickets: generate deterministic IDs like TICKET-monaco-grandstand
  TICKETS.forEach(ticket => {
    const id = 'TICKET-' +
      ticket.race.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') +
      '-' + ticket.category.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (!map[id]) {
      map[id] = {
        id,
        name:      ticket.race + ' — ' + ticket.category,
        price:     ticket.price,
        category:  ticket.category,
        race:      ticket.race,
        date:      ticket.date,
        inStock:   ticket.available,
        type:      'ticket',
      };
    }
  });

  // Experiences
  EXPERIENCES.forEach(exp => {
    const id = 'EXP-' + exp.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    map[id] = {
      id,
      name:    exp.name,
      price:   exp.price,
      type:    exp.type,
      inStock: exp.available,
      itemType: 'experience',
    };
  });

  return map;
}

const CATALOG = buildCatalog();

// ─── Cart Token ───────────────────────────────────────────────────────────────

/**
 * Encode a cart object to a base64 token string.
 * @param {object} cart  { items: [{id, name, price, quantity}], session_id }
 */
function encodeCart(cart) {
  const payload = JSON.stringify(cart);
  return Buffer.from(payload).toString('base64url');
}

/**
 * Decode a cart token back to a cart object.
 * Returns an empty cart on invalid/missing token.
 */
function decodeCart(token) {
  if (!token) return emptyCart();
  try {
    const payload = Buffer.from(token, 'base64url').toString('utf8');
    const cart = JSON.parse(payload);
    if (!cart || !Array.isArray(cart.items)) return emptyCart();
    return cart;
  } catch (_) {
    return emptyCart();
  }
}

function emptyCart() {
  return {
    items:      [],
    session_id: Math.random().toString(36).slice(2, 10),
    created_at: new Date().toISOString(),
  };
}

// ─── Cart Operations ──────────────────────────────────────────────────────────

/**
 * Look up a product by ID across all catalog types.
 * Supports partial matching for convenience (e.g. "RB-JKT" finds RB-JKT-2024).
 */
function lookupProduct(productId) {
  if (!productId) return null;

  // Exact match first
  if (CATALOG[productId]) return CATALOG[productId];

  // Case-insensitive partial match
  const q = String(productId).toLowerCase();
  const keys = Object.keys(CATALOG);
  const match = keys.find(k => k.toLowerCase().includes(q));
  return match ? CATALOG[match] : null;
}

/**
 * Add an item to the cart. Returns { cart, added, error }.
 */
function addItem(token, productId, quantity = 1) {
  const cart = decodeCart(token);
  const product = lookupProduct(productId);

  if (!product) {
    return { cart, added: null, error: `Product not found: ${productId}` };
  }
  if (!product.inStock) {
    return { cart, added: null, error: `${product.name} is currently out of stock` };
  }

  const qty = Math.max(1, Math.min(10, parseInt(quantity, 10) || 1));

  const existing = cart.items.find(i => i.id === product.id);
  if (existing) {
    existing.quantity = Math.min(10, existing.quantity + qty);
    existing.line_total = +(existing.price * existing.quantity).toFixed(2);
  } else {
    cart.items.push({
      id:         product.id,
      name:       product.name,
      price:      product.price,
      quantity:   qty,
      line_total: +(product.price * qty).toFixed(2),
      type:       product.type || product.itemType || 'merchandise',
    });
  }

  cart.updated_at = new Date().toISOString();
  return { cart, added: product, error: null };
}

/**
 * Update quantity of an item. quantity = 0 removes the item.
 */
function updateItem(token, productId, quantity) {
  const cart = decodeCart(token);

  if (quantity === 0 || quantity === '0') {
    cart.items = cart.items.filter(i => i.id !== productId);
  } else {
    const item = cart.items.find(i => i.id === productId);
    if (!item) return { cart, error: `Item ${productId} not in cart` };
    item.quantity  = Math.max(1, Math.min(10, parseInt(quantity, 10) || 1));
    item.line_total = +(item.price * item.quantity).toFixed(2);
  }

  cart.updated_at = new Date().toISOString();
  return { cart, error: null };
}

/**
 * Compute cart summary totals.
 */
function cartSummary(cart) {
  const subtotal  = cart.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const shipping  = cart.items.length > 0 ? 9.99 : 0;
  const tax       = +(subtotal * 0.0825).toFixed(2);
  const total     = +(subtotal + shipping + tax).toFixed(2);
  return {
    item_count: cart.items.reduce((s, i) => s + i.quantity, 0),
    subtotal:   +subtotal.toFixed(2),
    shipping,
    tax,
    total,
    currency:   'USD',
  };
}

/**
 * Search catalog by keyword across name, team, race, category, type.
 * Each word in the query is matched independently (AND logic across words).
 */
function searchCatalog(query, type) {
  const words = String(query || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  let items = Object.values(CATALOG);

  if (type) items = items.filter(i => (i.type || i.itemType || '').toLowerCase() === type.toLowerCase());

  if (words.length > 0) {
    items = items.filter(item => {
      const searchable = [item.id, item.name, item.team, item.race, item.category, item.type, item.itemType]
        .filter(Boolean).map(f => String(f).toLowerCase()).join(' ');
      return words.every(word => searchable.includes(word));
    });
  }

  return items;
}

// ─── Order Generation ─────────────────────────────────────────────────────────

/**
 * Generate a mock order confirmation from a cart + checkout form.
 */
function createOrder(cart, checkoutData) {
  const summary = cartSummary(cart);
  const orderId = 'RF1-' + Date.now().toString(36).toUpperCase() +
    '-' + Math.random().toString(36).slice(2, 6).toUpperCase();

  return {
    order_id:       orderId,
    status:         'confirmed',
    placed_at:      new Date().toISOString(),
    items:          cart.items,
    totals:         summary,
    shipping_to: {
      name:    checkoutData.name    || 'Guest Customer',
      email:   checkoutData.email   || '',
      address: checkoutData.address || '',
      city:    checkoutData.city    || '',
      country: checkoutData.country || '',
    },
    payment_method: checkoutData.payment_method || 'credit_card',
    estimated_delivery: '5-7 business days',
    tracking_available: true,
    confirmation_url: `https://racing-f1-rho.vercel.app/?order=${orderId}`,
  };
}

module.exports = {
  CATALOG,
  encodeCart,
  decodeCart,
  emptyCart,
  addItem,
  updateItem,
  cartSummary,
  searchCatalog,
  createOrder,
  lookupProduct,
};
