'use strict';

// ─── MCP Action Tool Definitions ──────────────────────────────────────────────
// These tools let AI agents (Comet, Claude Desktop, any MCP client) perform
// human-like actions on the F1 Racing Store: navigate, search, cart, checkout.
// Cart state is managed via a stateless base64 token the client carries between calls.
// ─────────────────────────────────────────────────────────────────────────────

const {
  encodeCart, decodeCart, emptyCart,
  addItem, updateItem, cartSummary, searchCatalog, createOrder, lookupProduct,
} = require('./mcp-cart.js');

const BASE_URL = 'https://racing-f1-rho.vercel.app';

function textResult(obj) {
  return { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] };
}

// ─── Page Manifest ────────────────────────────────────────────────────────────
const PAGES = {
  home:        { path: '/',            title: 'Homepage',      description: 'F1 Racing Store home — hero banner, featured products, race highlights.' },
  merchandise: { path: '/merchandise', title: 'Merchandise',   description: 'Shop all F1 team apparel, accessories, and scale model collectibles.' },
  tickets:     { path: '/tickets',     title: 'Race Tickets',  description: 'Buy race tickets for Monaco, British, Italian, Singapore, Japanese, and Abu Dhabi GPs.' },
  cart:        { path: '/#cart',       title: 'Shopping Cart', description: 'View cart contents, update quantities, and proceed to checkout.' },
  checkout:    { path: '/booking',     title: 'Checkout',      description: 'Enter shipping address and payment to complete your order.' },
  experiences: { path: '/#experiences', title: 'Experiences',  description: 'VIP hospitality suites, pit lane walks, driver meet & greets, factory tours, simulator sessions.' },
  calendar:    { path: '/#calendar',   title: 'Race Calendar', description: '2026 F1 World Championship calendar — all race dates, circuits, and locations.' },
};

// ─── Tool: navigate_to ────────────────────────────────────────────────────────
const NAVIGATE_TO = {
  name: 'navigate_to',
  description:
    'Navigate to a page on the F1 Racing Store. Returns the page URL, title, and a description of ' +
    'what content is available on that page. Use this to orient yourself before performing actions. ' +
    'Available pages: home, merchandise, tickets, cart, checkout, experiences, calendar.',
  inputSchema: {
    type: 'object',
    properties: {
      page: {
        type: 'string',
        enum: ['home', 'merchandise', 'tickets', 'cart', 'checkout', 'experiences', 'calendar'],
        description: 'The page to navigate to.',
      },
      cart_token: {
        type: 'string',
        description: 'Optional. Pass your current cart_token to see cart item count in the navigation context.',
      },
    },
    required: ['page'],
    additionalProperties: false,
  },
  handler(args) {
    const page = PAGES[args.page];
    if (!page) return textResult({ error: `Unknown page: ${args.page}` });

    let cartContext = null;
    if (args.cart_token) {
      const cart = decodeCart(args.cart_token);
      const summary = cartSummary(cart);
      cartContext = { item_count: summary.item_count, subtotal: summary.subtotal };
    }

    return textResult({
      page:        args.page,
      title:       page.title,
      url:         BASE_URL + page.path,
      description: page.description,
      cart:        cartContext,
      available_actions: getPageActions(args.page),
    });
  },
};

function getPageActions(page) {
  const base = ['navigate_to', 'search_products'];
  const map = {
    home:        [...base, 'add_to_cart', 'get_tickets', 'get_merchandise'],
    merchandise: [...base, 'add_to_cart', 'get_merchandise'],
    tickets:     [...base, 'add_to_cart', 'get_tickets'],
    experiences: [...base, 'add_to_cart', 'get_experiences'],
    calendar:    [...base, 'get_calendar'],
    cart:        ['view_cart', 'update_cart', 'begin_checkout', 'navigate_to'],
    checkout:    ['submit_order', 'view_cart', 'navigate_to'],
  };
  return map[page] || base;
}

// ─── Tool: search_products ────────────────────────────────────────────────────
const SEARCH_PRODUCTS = {
  name: 'search_products',
  description:
    'Search all F1 Racing Store products by keyword. Searches across merchandise (jackets, caps, models), ' +
    'race tickets, and VIP experiences. Returns matching items with IDs you can pass to add_to_cart.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search term, e.g. "Red Bull jacket", "Monaco ticket", "pit lane", "Verstappen".',
      },
      type: {
        type: 'string',
        enum: ['merchandise', 'ticket', 'experience'],
        description: 'Narrow results to a specific product type. Omit for all types.',
      },
      max_price: {
        type: 'number',
        description: 'Return only items at or below this price (USD).',
      },
    },
    required: ['query'],
    additionalProperties: false,
  },
  handler(args) {
    let results = searchCatalog(args.query, args.type);
    if (args.max_price) results = results.filter(i => i.price <= args.max_price);

    return textResult({
      count:          results.length,
      query:          args.query,
      type_filter:    args.type || null,
      max_price:      args.max_price || null,
      results:        results,
      next_action:    'Use add_to_cart with the item id to add a product to your cart.',
    });
  },
};

// ─── Tool: add_to_cart ────────────────────────────────────────────────────────
const ADD_TO_CART = {
  name: 'add_to_cart',
  description:
    'Add a product to the shopping cart. Pass the product id from search_products, get_merchandise, ' +
    'get_tickets, or get_experiences. Returns an updated cart_token — save it and pass it to ' +
    'subsequent cart/checkout calls. This simulates clicking "Add to Cart" on the site.',
  inputSchema: {
    type: 'object',
    properties: {
      product_id: {
        type: 'string',
        description: 'Product ID to add. E.g. "RB-JKT-2024", "TICKET-monaco-grand-prix-grandstand", "EXP-pit-lane-walk".',
      },
      quantity: {
        type: 'integer',
        minimum: 1,
        maximum: 10,
        description: 'Quantity to add. Default: 1.',
      },
      cart_token: {
        type: 'string',
        description: 'Your current cart token. Omit to start a new cart.',
      },
    },
    required: ['product_id'],
    additionalProperties: false,
  },
  handler(args) {
    const { cart, added, error } = addItem(args.cart_token, args.product_id, args.quantity || 1);
    if (error) return textResult({ success: false, error });

    const summary = cartSummary(cart);
    const newToken = encodeCart(cart);

    return textResult({
      success:    true,
      added: {
        id:       added.id,
        name:     added.name,
        price:    added.price,
        quantity: args.quantity || 1,
      },
      cart_summary: summary,
      cart_token:   newToken,
      next_action:  'Use view_cart to see full cart, or begin_checkout when ready to purchase.',
    });
  },
};

// ─── Tool: view_cart ─────────────────────────────────────────────────────────
const VIEW_CART = {
  name: 'view_cart',
  description:
    'View the current contents of the shopping cart. Shows all items, quantities, pricing, ' +
    'and order totals including tax and shipping. Equivalent to viewing the cart page on the site.',
  inputSchema: {
    type: 'object',
    properties: {
      cart_token: {
        type: 'string',
        description: 'Your current cart token from add_to_cart or update_cart.',
      },
    },
    additionalProperties: false,
  },
  handler(args) {
    const cart    = decodeCart(args.cart_token);
    const summary = cartSummary(cart);

    return textResult({
      cart_url:    BASE_URL + '/#cart',
      items:       cart.items,
      totals:      summary,
      cart_token:  args.cart_token || null,
      is_empty:    cart.items.length === 0,
      next_action: cart.items.length > 0
        ? 'Use begin_checkout to proceed to checkout, or update_cart to modify quantities.'
        : 'Cart is empty. Use add_to_cart to add products.',
    });
  },
};

// ─── Tool: update_cart ────────────────────────────────────────────────────────
const UPDATE_CART = {
  name: 'update_cart',
  description:
    'Update the quantity of an item in the cart, or remove it by setting quantity to 0. ' +
    'Returns an updated cart_token. Equivalent to changing quantity in the cart page.',
  inputSchema: {
    type: 'object',
    properties: {
      cart_token: {
        type: 'string',
        description: 'Your current cart token.',
      },
      product_id: {
        type: 'string',
        description: 'Product ID of the item to update.',
      },
      quantity: {
        type: 'integer',
        minimum: 0,
        maximum: 10,
        description: 'New quantity. Use 0 to remove the item from the cart.',
      },
    },
    required: ['cart_token', 'product_id', 'quantity'],
    additionalProperties: false,
  },
  handler(args) {
    const { cart, error } = updateItem(args.cart_token, args.product_id, args.quantity);
    if (error) return textResult({ success: false, error });

    const summary  = cartSummary(cart);
    const newToken = encodeCart(cart);

    return textResult({
      success:      true,
      action:       args.quantity === 0 ? 'removed' : 'updated',
      product_id:   args.product_id,
      new_quantity: args.quantity,
      cart_summary: summary,
      cart_token:   newToken,
    });
  },
};

// ─── Tool: begin_checkout ─────────────────────────────────────────────────────
const BEGIN_CHECKOUT = {
  name: 'begin_checkout',
  description:
    'Begin the checkout process. Validates the cart has items, returns the checkout form schema ' +
    'showing exactly what fields are required to submit_order. Equivalent to clicking "Proceed to Checkout".',
  inputSchema: {
    type: 'object',
    properties: {
      cart_token: {
        type: 'string',
        description: 'Your current cart token.',
      },
    },
    required: ['cart_token'],
    additionalProperties: false,
  },
  handler(args) {
    const cart    = decodeCart(args.cart_token);
    const summary = cartSummary(cart);

    if (cart.items.length === 0) {
      return textResult({ success: false, error: 'Cart is empty — add items before checking out.' });
    }

    return textResult({
      success:          true,
      checkout_url:     BASE_URL + '/booking',
      cart_summary:     summary,
      items:            cart.items,
      cart_token:       args.cart_token,
      required_fields: {
        name:           'Full name (string, required)',
        email:          'Email address (string, required)',
        address:        'Street address (string, required)',
        city:           'City (string, required)',
        country:        'Country (string, required)',
        payment_method: 'Payment method: "credit_card" | "paypal" | "apple_pay" (required)',
      },
      optional_fields: {
        postal_code: 'Postal/ZIP code',
        phone:       'Phone number',
        promo_code:  'Promotional discount code',
      },
      next_action: 'Call submit_order with cart_token and the required_fields to complete purchase.',
    });
  },
};

// ─── Tool: submit_order ───────────────────────────────────────────────────────
const SUBMIT_ORDER = {
  name: 'submit_order',
  description:
    'Complete the purchase — submits the order with shipping and payment details. ' +
    'Returns a confirmed order ID and receipt. Equivalent to clicking "Place Order" on the checkout page. ' +
    'This is a demo store — no real charges are made.',
  inputSchema: {
    type: 'object',
    properties: {
      cart_token: {
        type: 'string',
        description: 'Your current cart token from add_to_cart or update_cart.',
      },
      name:           { type: 'string', description: 'Full name for shipping.' },
      email:          { type: 'string', description: 'Email address for order confirmation.' },
      address:        { type: 'string', description: 'Street address.' },
      city:           { type: 'string', description: 'City.' },
      country:        { type: 'string', description: 'Country.' },
      postal_code:    { type: 'string', description: 'Postal or ZIP code.' },
      payment_method: {
        type: 'string',
        enum: ['credit_card', 'paypal', 'apple_pay'],
        description: 'Payment method.',
      },
      promo_code:     { type: 'string', description: 'Optional promotional code.' },
    },
    required: ['cart_token', 'name', 'email', 'address', 'city', 'country', 'payment_method'],
    additionalProperties: false,
  },
  handler(args) {
    const cart = decodeCart(args.cart_token);

    if (cart.items.length === 0) {
      return textResult({ success: false, error: 'Cannot place order — cart is empty.' });
    }

    if (!args.email || !args.email.includes('@')) {
      return textResult({ success: false, error: 'Valid email address is required.' });
    }

    // Apply promo code discount
    let discount = 0;
    if (args.promo_code) {
      const code = String(args.promo_code).toUpperCase();
      if (code === 'F1FAN10')  discount = 0.10;
      if (code === 'VIP2026')  discount = 0.15;
      if (code === 'WELCOME5') discount = 0.05;
    }

    const order = createOrder(cart, {
      name:           args.name,
      email:          args.email,
      address:        args.address,
      city:           args.city,
      country:        args.country,
      postal_code:    args.postal_code || '',
      payment_method: args.payment_method,
    });

    if (discount > 0) {
      const discountAmt = +(order.totals.subtotal * discount).toFixed(2);
      order.totals.discount      = discountAmt;
      order.totals.discount_code = args.promo_code;
      order.totals.total         = +(order.totals.total - discountAmt).toFixed(2);
    }

    return textResult({
      success:       true,
      order_id:      order.order_id,
      status:        order.status,
      placed_at:     order.placed_at,
      items:         order.items,
      totals:        order.totals,
      shipping_to:   order.shipping_to,
      payment:       order.payment_method,
      delivery:      order.estimated_delivery,
      confirmation:  order.confirmation_url,
      note:          'This is a demo store. No real charge was made.',
    });
  },
};

// ─── Tool: get_product ────────────────────────────────────────────────────────
const GET_PRODUCT = {
  name: 'get_product',
  description:
    'Get full details for a single product by its ID. Use after search_products to see ' +
    'complete description, stock status, and category before adding to cart.',
  inputSchema: {
    type: 'object',
    properties: {
      product_id: {
        type: 'string',
        description: 'The product ID. E.g. "RB-JKT-2024", "TICKET-monaco-grand-prix-vip-paddock".',
      },
    },
    required: ['product_id'],
    additionalProperties: false,
  },
  handler(args) {
    const product = lookupProduct(args.product_id);
    if (!product) {
      return textResult({ found: false, error: `No product found with ID: ${args.product_id}` });
    }

    return textResult({
      found:       true,
      product,
      can_add_to_cart: product.inStock,
      next_action: product.inStock
        ? `Use add_to_cart with product_id "${product.id}" to add to your cart.`
        : `${product.name} is currently out of stock.`,
    });
  },
};

// ─── Tool: get_cart_token ─────────────────────────────────────────────────────
const GET_CART_TOKEN = {
  name: 'get_cart_token',
  description:
    'Start a fresh empty cart and get a new cart_token. Use this at the beginning of a ' +
    'shopping session before calling add_to_cart. You can also just omit cart_token in ' +
    'add_to_cart to auto-create one.',
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
  handler() {
    const cart  = emptyCart();
    const token = encodeCart(cart);
    return textResult({
      cart_token:  token,
      session_id:  cart.session_id,
      created_at:  cart.created_at,
      next_action: 'Use add_to_cart with this cart_token to start adding items.',
    });
  },
};

// ─── Action Tools Registry ────────────────────────────────────────────────────
const ACTION_TOOLS = [
  NAVIGATE_TO,
  SEARCH_PRODUCTS,
  GET_PRODUCT,
  GET_CART_TOKEN,
  ADD_TO_CART,
  VIEW_CART,
  UPDATE_CART,
  BEGIN_CHECKOUT,
  SUBMIT_ORDER,
];

module.exports = { ACTION_TOOLS };
