/**
 * ============================================
 * RACING F1 - Application JavaScript
 * ============================================
 * 
 * UI interactions and example usage of the analytics layer
 */

(function(window, document) {
    'use strict';

    // =========================================
    // DEBUG PANEL CONTROLS
    // =========================================
    const DebugPanel = {
        init: function() {
            const toggleBtn = document.getElementById('toggle-debug');
            const panel = document.getElementById('debug-panel');
            const clearBtn = document.getElementById('clear-debug');
            
            if (toggleBtn && panel) {
                toggleBtn.addEventListener('click', function() {
                    panel.classList.toggle('active');
                    toggleBtn.textContent = panel.classList.contains('active') 
                        ? 'Hide Debug' 
                        : 'Debug';
                });
            }
            
            if (clearBtn) {
                clearBtn.addEventListener('click', function() {
                    const output = document.getElementById('debug-output');
                    if (output) {
                        output.innerHTML = '';
                    }
                });
            }
        }
    };

    // =========================================
    // PRODUCT FILTER INTERACTIONS
    // =========================================
    const ProductFilter = {
        init: function() {
            const filterBtns = document.querySelectorAll('.filter-btn');
            
            filterBtns.forEach(function(btn) {
                btn.addEventListener('click', function() {
                    // Remove active from all
                    filterBtns.forEach(function(b) {
                        b.classList.remove('active');
                    });
                    // Add active to clicked
                    btn.classList.add('active');
                });
            });
        }
    };

    // =========================================
    // NEWSLETTER FORM
    // =========================================
    const Newsletter = {
        init: function() {
            const form = document.querySelector('.newsletter-form');
            
            if (form) {
                form.addEventListener('submit', function(e) {
                    e.preventDefault();
                    
                    const email = form.querySelector('input[type="email"]').value;
                    
                    // Use link callback for form submission (special interaction)
                    if (window.racingF1Analytics) {
                        window.racingF1Analytics.linkCallback('newsletter-form', {
                            action: 'submit',
                            label: 'signup',
                            CD: {
                                content_type: 'newsletter',
                                user_type: 'subscriber'
                            }
                        });
                    }
                    
                    // Show success message
                    alert('Thank you for subscribing!');
                    form.reset();
                });
            }
        }
    };

    // =========================================
    // CART MANAGEMENT (localStorage persistence)
    // =========================================
    const Cart = {
        storageKey: 'rf1_cart',
        discountRate: 0,
        appliedPromo: null,

        init: function() {
            const self = this;
            this.loadCart();
            this.hydrateGridboxLayer();
            this.updateCartCount();
            this.initAddToCartButtons();
            this.initTicketBookingButtons();
            this.initCartPage();
            this.initCheckoutPage();
            this.initConfirmationPage();
        },

        // Rebuild the in-memory gridboxLayer from the persisted cart so the
        // data layer stays consistent across page loads. gridboxLayer is reset
        // on every navigation, so without this the cart would appear empty
        // (and syncFromGridboxLayer would wipe the saved cart).
        hydrateGridboxLayer: function() {
            if (!window.gridboxLayer || !window.gridboxLayer.cart) return;
            if (!this.items || this.items.length === 0) return;
            // Only hydrate a fresh/empty data layer; never clobber live state.
            if (window.gridboxLayer.cart.item.length > 0) return;

            this.items.forEach(function(item) {
                const category = item.category || 'Product';
                const brand = item.brand || '';
                window.gridboxLayer.product.push({
                    category: { primaryCategory: category },
                    productInfo: {
                        productID: item.id,
                        brand: brand,
                        productDetails: {
                            [category.toLowerCase()]: {
                                name: item.name,
                                brand: brand,
                                price: { totalPrice: { amount: item.price, currency: 'USD' } },
                                image: item.image
                            }
                        },
                        characteristics: []
                    }
                });
                window.gridboxLayer.cart.item.push({
                    productInfo: { productID: item.id, quantity: item.quantity }
                });
            });

            const subtotal = this.getSubtotal();
            const tax = this.getTax(subtotal);
            window.gridboxLayer.cart.price.totalPrice.amount = parseFloat((subtotal + tax).toFixed(2));
            window.gridboxLayer.cart.price.priceBreakdown.tax.totalTax.amount = parseFloat(tax.toFixed(2));
            if (!window.gridboxLayer.cart.cartInfo.cartID) {
                window.gridboxLayer.cart.cartInfo.cartID = 'rf1_' + Date.now();
                window.gridboxLayer.cart.cartInfo.creationDate = new Date().toISOString();
            }
        },
        
        loadCart: function() {
            try {
                const saved = localStorage.getItem(this.storageKey);
                this.items = saved ? JSON.parse(saved) : [];
            } catch (e) {
                this.items = [];
            }
        },
        
        saveCart: function() {
            localStorage.setItem(this.storageKey, JSON.stringify(this.items));
        },
        
        initAddToCartButtons: function() {
            const self = this;
            const addCartBtns = document.querySelectorAll('.add-cart-btn');
            
            addCartBtns.forEach(function(btn) {
                btn.addEventListener('click', function(e) {
                    const productId = btn.dataset.productId;
                    const productName = btn.dataset.productName;
                    const productPrice = btn.dataset.productPrice;
                    const productCategory = btn.dataset.productCategory;
                    const productImage = btn.dataset.productImage || 'Gemini_Generated_Image_1uzlq31uzlq31uzl.png';
                    // Brand isn't on the button, so read it from the card markup.
                    const card = btn.closest('.product-card');
                    const brandEl = card ? card.querySelector('.product-brand') : null;
                    const productBrand = btn.dataset.productBrand || (brandEl ? brandEl.textContent.trim() : '');

                    if (!window.gridbox) return;
                    
                    // STEP 1: Track click event in gridboxLayer.event[]
                    window.gridbox.track('gb_product_add_to_cart_click', {
                        CD: {
                            product_id: productId,
                            product_name: productName,
                            product_price: productPrice,
                            product_category: productCategory,
                            click_element: 'add-to-cart-button'
                        }
                    });
                    
                    // STEP 2: Add product to gridboxLayer.product[]
                    window.gridbox.addProduct({
                        id: productId,
                        product_id: productId,
                        name: productName,
                        product_name: productName,
                        price: productPrice,
                        product_price: productPrice,
                        category: productCategory,
                        product_category: productCategory,
                        brand: productBrand,
                        product_brand: productBrand,
                        image: productImage,
                        product_image: productImage
                    });

                    // STEP 3: Add to cart in gridboxLayer.cart
                    window.gridbox.addToCart({
                        id: productId,
                        product_id: productId,
                        name: productName,
                        product_name: productName,
                        price: productPrice,
                        product_price: productPrice,
                        category: productCategory,
                        product_category: productCategory,
                        brand: productBrand,
                        product_brand: productBrand,
                        image: productImage,
                        product_image: productImage
                    }, 1);
                    
                    // Sync local cart from gridboxLayer
                    self.syncFromGridboxLayer();
                    self.updateCartCount();
                    
                    btn.textContent = 'Added!';
                    btn.style.background = 'linear-gradient(135deg, #39ff14 0%, #00f0ff 100%)';
                    
                    setTimeout(function() {
                        btn.textContent = 'Add to Cart';
                        btn.style.background = '';
                    }, 1500);
                });
            });
        },
        
        initTicketBookingButtons: function() {
            const self = this;
            
            // Handle all ticket booking buttons with data-track attributes
            const ticketBtns = document.querySelectorAll('[data-track*="ticket-actions_click_book"]');
            
            ticketBtns.forEach(function(btn) {
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    
                    // Get race information from closest race-detail-card
                    const raceCard = btn.closest('.race-detail-card');
                    const raceId = raceCard ? raceCard.id : '';
                    const raceName = raceCard ? raceCard.querySelector('h3')?.textContent : '';
                    const ticketType = btn.closest('.ticket-option')?.querySelector('.ticket-type')?.textContent || '';
                    const ticketPrice = btn.closest('.ticket-option')?.querySelector('.ticket-price')?.textContent || '';
                    
                    // Create product data for ticket
                    const productId = 'TICKET-' + raceId.toUpperCase() + '-' + ticketType.toUpperCase().replace(/\s+/g, '-');
                    const productName = raceName + ' - ' + ticketType;
                    const productPrice = ticketPrice.replace(/[$,]/g, '');
                    const productCategory = 'Race Tickets';
                    
                    if (!window.gridbox) return;
                    
                    // STEP 1: Track ticket selection event
                    window.gridbox.track('gb_ticket_add_to_cart_click', {
                        CD: {
                            product_id: productId,
                            product_name: productName,
                            product_price: productPrice,
                            product_category: productCategory,
                            race_name: raceName,
                            ticket_type: ticketType,
                            click_element: 'ticket-book-button'
                        }
                    });
                    
                    // STEP 2: Add ticket to gridboxLayer.product[]
                    window.gridbox.addProduct({
                        id: productId,
                        product_id: productId,
                        name: productName,
                        product_name: productName,
                        price: productPrice,
                        product_price: productPrice,
                        category: productCategory,
                        product_category: productCategory,
                        image: 'Gemini_Generated_Image_1uzlq31uzlq31uzl.png',
                        product_image: 'Gemini_Generated_Image_1uzlq31uzlq31uzl.png'
                    });
                    
                    // STEP 3: Add ticket to cart in gridboxLayer.cart
                    window.gridbox.addToCart({
                        id: productId,
                        product_id: productId,
                        name: productName,
                        product_name: productName,
                        price: productPrice,
                        product_price: productPrice,
                        category: productCategory,
                        product_category: productCategory,
                        image: 'Gemini_Generated_Image_1uzlq31uzlq31uzl.png',
                        product_image: 'Gemini_Generated_Image_1uzlq31uzlq31uzl.png'
                    }, 1);
                    
                    // Sync local cart from gridboxLayer
                    self.syncFromGridboxLayer();
                    self.updateCartCount();
                    
                    // Update button state
                    const originalText = btn.textContent;
                    btn.textContent = 'Added to Cart!';
                    btn.style.background = 'linear-gradient(135deg, #39ff14 0%, #00f0ff 100%)';
                    btn.disabled = true;
                    
                    setTimeout(function() {
                        btn.textContent = originalText;
                        btn.style.background = '';
                        btn.disabled = false;
                    }, 2000);
                    
                    console.log('Ticket added to cart:', { productId, productName, productPrice });
                });
            });
        },
        
        syncFromGridboxLayer: function() {
            if (window.gridboxLayer && window.gridboxLayer.cart && window.gridboxLayer.cart.item) {
                const products = window.gridboxLayer.product || [];
                
                this.items = window.gridboxLayer.cart.item.map(function(cartItem) {
                    // Cart item has reference: { productInfo: { productID, quantity } }
                    const productID = cartItem.productInfo ? cartItem.productInfo.productID : '';
                    const quantity = cartItem.productInfo ? (cartItem.productInfo.quantity || 1) : 1;
                    
                    // Find full product details in product[] array
                    const product = products.find(function(p) {
                        return p.productInfo && p.productInfo.productID === productID;
                    });
                    
                    // Extract data from product[] using the correct structure
                    let name = productID;
                    let price = 0;
                    let category = '';
                    let brand = '';
                    let image = 'Gemini_Generated_Image_1uzlq31uzlq31uzl.png';

                    if (product) {
                        category = product.category ? product.category.primaryCategory : '';
                        brand = (product.productInfo && product.productInfo.brand) || '';

                        // Get details from productDetails (keyed by category lowercase)
                        if (product.productInfo && product.productInfo.productDetails) {
                            const categoryKey = category.toLowerCase();
                            const details = product.productInfo.productDetails[categoryKey];
                            if (details) {
                                name = details.name || productID;
                                if (details.price && details.price.totalPrice) {
                                    price = details.price.totalPrice.amount || 0;
                                }
                                image = details.image || image;
                                brand = brand || details.brand || '';
                            }
                        }
                    }

                    return {
                        id: productID,
                        name: name,
                        price: price,
                        category: category,
                        brand: brand,
                        image: image,
                        quantity: quantity
                    };
                });
                this.saveCart();
                console.log('Cart synced from gridboxLayer:', this.items);
                console.log('gridboxLayer.product count:', products.length);
                console.log('gridboxLayer.cart.item count:', window.gridboxLayer.cart.item.length);
            }
        },
        
        addItem: function(item) {
            const existing = this.items.find(i => i.id === item.id);
            if (existing) {
                existing.quantity += 1;
            } else {
                this.items.push(item);
            }
            this.saveCart();
            console.log('Cart updated:', this.items);
        },
        
        removeItem: function(productId) {
            // Use gridbox.removeFromCart() API
            if (window.gridbox && window.gridbox.removeFromCart) {
                window.gridbox.removeFromCart(productId);
            }
            this.syncFromGridboxLayer();
            this.updateCartCount();
        },
        
        updateQuantity: function(productId, quantity) {
            // Use gridbox.updateCartQuantity() API
            if (window.gridbox && window.gridbox.updateCartQuantity) {
                window.gridbox.updateCartQuantity(productId, quantity);
            }
            this.syncFromGridboxLayer();
        },
        
        getSubtotal: function() {
            return this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        },
        
        getTax: function(subtotal) {
            return subtotal * 0.1;
        },
        
        getTotal: function(subtotal, shipping, tax) {
            return subtotal + shipping + tax;
        },
        
        updateCartCount: function() {
            const countEls = document.querySelectorAll('.cart-count');
            const totalItems = this.items.reduce((sum, item) => sum + item.quantity, 0);
            
            countEls.forEach(function(el) {
                el.textContent = totalItems;
                el.style.transform = 'scale(1.3)';
                setTimeout(function() {
                    el.style.transform = '';
                }, 200);
            });
        },
        
        initCartPage: function() {
            const self = this;
            const cartItemsList = document.getElementById('cart-items-list');
            const emptyCart = document.getElementById('empty-cart');
            const cartContent = document.getElementById('cart-content');
            
            if (!cartItemsList) return;
            
            // Sync from gridboxLayer on page load
            this.syncFromGridboxLayer();
            
            if (this.items.length === 0) {
                if (emptyCart) emptyCart.style.display = 'block';
                if (cartContent) cartContent.style.display = 'none';
                return;
            }
            
            if (emptyCart) emptyCart.style.display = 'none';
            if (cartContent) cartContent.style.display = 'block';
            
            this.renderCartItems();
            this.updateCartSummary(9.99);
            
            const applyPromo = document.getElementById('apply-promo');
            if (applyPromo) {
                applyPromo.addEventListener('click', function() {
                    const promoInput = document.getElementById('promo-input');
                    const feedback = document.getElementById('promo-feedback');
                    const code = promoInput ? promoInput.value.trim().toUpperCase() : '';
                    const codes = { 'RF1SAVE10': 0.10, 'RACE20': 0.20 };
                    const shippingInput = document.querySelector('input[name="shipping"]:checked');
                    const shippingPrice = shippingInput ? parseFloat(shippingInput.dataset.price) : 9.99;
                    const showFeedback = function(msg, ok) {
                        if (!feedback) return;
                        feedback.textContent = msg;
                        feedback.style.display = '';
                        feedback.style.color = ok ? 'var(--success, #22c55e)' : 'var(--primary-red, #e10600)';
                    };
                    if (codes[code]) {
                        self.discountRate = codes[code];
                        self.appliedPromo = code;
                        self.updateCartSummary(shippingPrice);
                        showFeedback('Promo "' + code + '" applied: ' + (codes[code] * 100) + '% off', true);
                        if (window.racingF1Analytics) {
                            window.racingF1Analytics.linkCallback('cart-promo', {
                                action: 'click',
                                label: 'apply-success',
                                CD: { promo_code: code, discount_rate: String(codes[code]) }
                            });
                        }
                    } else {
                        self.discountRate = 0;
                        self.appliedPromo = null;
                        self.updateCartSummary(shippingPrice);
                        showFeedback('Invalid promo code', false);
                        if (window.racingF1Analytics) {
                            window.racingF1Analytics.linkCallback('cart-promo', {
                                action: 'click',
                                label: 'apply-failed',
                                CD: { promo_code: code }
                            });
                        }
                    }
                });
            }
        },
        
        renderCartItems: function() {
            const self = this;
            const cartItemsList = document.getElementById('cart-items-list');
            if (!cartItemsList) return;
            
            cartItemsList.innerHTML = this.items.map(function(item) {
                return `
                    <div class="cart-item" data-id="${item.id}">
                        <div class="cart-item-image">
                            <img src="${item.image}" alt="${item.name}">
                        </div>
                        <div class="cart-item-details">
                            <h4>${item.name}</h4>
                            <p class="item-category">${item.category}</p>
                            <p class="item-price">$${item.price.toFixed(2)}</p>
                        </div>
                        <div class="cart-item-actions">
                            <div class="quantity-control">
                                <button class="qty-minus" data-id="${item.id}">-</button>
                                <span>${item.quantity}</span>
                                <button class="qty-plus" data-id="${item.id}">+</button>
                            </div>
                            <button class="remove-item" data-id="${item.id}">Remove</button>
                        </div>
                    </div>
                `;
            }).join('');
            
            cartItemsList.querySelectorAll('.qty-minus').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    const id = btn.dataset.id;
                    const item = self.items.find(i => i.id === id);
                    if (item && item.quantity > 1) {
                        self.updateQuantity(id, item.quantity - 1);
                        self.renderCartItems();
                        self.updateCartSummary(9.99);
                        self.updateCartCount();
                    }
                });
            });
            
            cartItemsList.querySelectorAll('.qty-plus').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    const id = btn.dataset.id;
                    const item = self.items.find(i => i.id === id);
                    if (item) {
                        self.updateQuantity(id, item.quantity + 1);
                        self.renderCartItems();
                        self.updateCartSummary(9.99);
                        self.updateCartCount();
                    }
                });
            });
            
            cartItemsList.querySelectorAll('.remove-item').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    const id = btn.dataset.id;
                    self.removeItem(id);
                    if (self.items.length === 0) {
                        document.getElementById('empty-cart').style.display = 'block';
                        document.getElementById('cart-content').style.display = 'none';
                    } else {
                        self.renderCartItems();
                        self.updateCartSummary(9.99);
                    }
                });
            });
        },
        
        updateCartSummary: function(shipping) {
            const subtotal = this.getSubtotal();
            const discount = subtotal * (this.discountRate || 0);
            const discountedSubtotal = subtotal - discount;
            const tax = this.getTax(discountedSubtotal);
            const total = this.getTotal(discountedSubtotal, shipping, tax);

            const subtotalEl = document.getElementById('cart-subtotal');
            const shippingEl = document.getElementById('cart-shipping');
            const taxEl = document.getElementById('cart-tax');
            const totalEl = document.getElementById('cart-total');
            const discountRow = document.getElementById('cart-discount-row');
            const discountEl = document.getElementById('cart-discount');

            if (subtotalEl) subtotalEl.textContent = '$' + subtotal.toFixed(2);
            if (shippingEl) shippingEl.textContent = '$' + shipping.toFixed(2);
            if (taxEl) taxEl.textContent = '$' + tax.toFixed(2);
            if (totalEl) totalEl.textContent = '$' + total.toFixed(2);
            if (discountRow && discountEl) {
                if (discount > 0) {
                    discountRow.style.display = '';
                    discountEl.textContent = '-$' + discount.toFixed(2);
                } else {
                    discountRow.style.display = 'none';
                }
            }
        },
        
        initCheckoutPage: function() {
            const self = this;
            const checkoutItems = document.getElementById('checkout-items');
            const checkoutForm = document.getElementById('checkout-form');
            
            if (!checkoutItems) return;
            
            if (this.items.length === 0) {
                window.location.href = 'cart.html';
                return;
            }
            
            checkoutItems.innerHTML = this.items.map(function(item) {
                return `
                    <div class="checkout-item">
                        <img src="${item.image}" alt="${item.name}">
                        <div class="checkout-item-info">
                            <h4>${item.name}</h4>
                            <span class="qty">Qty: ${item.quantity}</span>
                        </div>
                        <span class="checkout-item-price">$${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                `;
            }).join('');
            
            this.updateCheckoutSummary(9.99);

            // Fire BeginCheckout now that the cart is hydrated into the datalayer.
            if (window.gridbox && window.gridbox.beginCheckout) {
                window.gridbox.beginCheckout({});
            }

            const shippingInputs = document.querySelectorAll('input[name="shipping"]');
            shippingInputs.forEach(function(input) {
                input.addEventListener('change', function() {
                    const shippingPrice = parseFloat(input.dataset.price);
                    self.updateCheckoutSummary(shippingPrice);
                });
            });
            
            if (checkoutForm) {
                checkoutForm.addEventListener('submit', function(e) {
                    e.preventDefault();
                    self.processOrder(checkoutForm);
                });
            }
        },
        
        updateCheckoutSummary: function(shipping) {
            const subtotal = this.getSubtotal();
            const tax = this.getTax(subtotal);
            const total = this.getTotal(subtotal, shipping, tax);
            
            const subtotalEl = document.getElementById('checkout-subtotal');
            const shippingEl = document.getElementById('checkout-shipping');
            const taxEl = document.getElementById('checkout-tax');
            const totalEl = document.getElementById('checkout-total');
            
            if (subtotalEl) subtotalEl.textContent = '$' + subtotal.toFixed(2);
            if (shippingEl) shippingEl.textContent = '$' + shipping.toFixed(2);
            if (taxEl) taxEl.textContent = '$' + tax.toFixed(2);
            if (totalEl) totalEl.textContent = '$' + total.toFixed(2);
        },
        
        processOrder: function(form) {
            const self = this;
            const formData = new FormData(form);
            const shippingInput = document.querySelector('input[name="shipping"]:checked');
            const shippingPrice = shippingInput ? parseFloat(shippingInput.dataset.price) : 9.99;
            
            const subtotal = this.getSubtotal();
            const tax = this.getTax(subtotal);
            const total = this.getTotal(subtotal, shippingPrice, tax);
            
            const orderNumber = 'RF1-2024-' + Math.random().toString(36).substring(2, 8).toUpperCase();
            
            const orderData = {
                orderNumber: orderNumber,
                email: formData.get('email'),
                shipping: {
                    firstName: formData.get('shipFirstName'),
                    lastName: formData.get('shipLastName'),
                    address: formData.get('shipAddress'),
                    city: formData.get('shipCity'),
                    state: formData.get('shipState'),
                    zip: formData.get('shipZip'),
                    country: formData.get('shipCountry')
                },
                shippingMethod: shippingInput ? shippingInput.value : 'standard',
                shippingPrice: shippingPrice,
                items: this.items,
                subtotal: subtotal,
                tax: tax,
                total: total,
                date: new Date().toISOString()
            };
            
            localStorage.setItem('rf1_last_order', JSON.stringify(orderData));

            // Populate gridboxLayer.transaction and fire the Purchase event.
            // gridbox.purchase() also clears the datalayer cart.
            const currentUser = Auth.getCurrentUser();
            if (window.gridbox && window.gridbox.purchase) {
                window.gridbox.purchase({
                    orderId: orderNumber,
                    total: total,
                    subtotal: subtotal,
                    tax: tax,
                    shipping: shippingPrice,
                    currency: 'USD',
                    userId: currentUser ? currentUser.email : '',
                    userName: currentUser ? (currentUser.firstName + ' ' + currentUser.lastName) : '',
                    address: orderData.shipping
                });
            } else if (window.racingF1Analytics) {
                window.racingF1Analytics.linkCallback('ecommerce-purchase', {
                    action: 'submit',
                    label: 'order-complete',
                    value: total,
                    CD: {
                        transaction_id: orderNumber,
                        transaction_revenue: total.toFixed(2),
                        transaction_tax: tax.toFixed(2),
                        transaction_shipping: shippingPrice.toFixed(2),
                        product_quantity: this.items.reduce((sum, i) => sum + i.quantity, 0).toString()
                    }
                });
            }

            localStorage.removeItem(this.storageKey);
            this.items = [];

            window.location.href = 'confirmation.html';
        },
        
        initConfirmationPage: function() {
            const orderNumberEl = document.getElementById('order-number');
            if (!orderNumberEl) return;
            
            try {
                const orderData = JSON.parse(localStorage.getItem('rf1_last_order'));
                if (!orderData) return;
                
                orderNumberEl.textContent = orderData.orderNumber;
                
                const orderDateEl = document.getElementById('order-date');
                if (orderDateEl) {
                    orderDateEl.textContent = new Date(orderData.date).toLocaleDateString('en-US', {
                        year: 'numeric', month: 'long', day: 'numeric'
                    });
                }
                
                const confItems = document.getElementById('confirmation-items');
                if (confItems) {
                    confItems.innerHTML = orderData.items.map(function(item) {
                        return `
                            <div class="confirmation-item">
                                <span>${item.name} x ${item.quantity}</span>
                                <span>$${(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                        `;
                    }).join('');
                }
                
                const confSubtotal = document.getElementById('conf-subtotal');
                const confShipping = document.getElementById('conf-shipping');
                const confTax = document.getElementById('conf-tax');
                const confTotal = document.getElementById('conf-total');
                
                if (confSubtotal) confSubtotal.textContent = '$' + orderData.subtotal.toFixed(2);
                if (confShipping) confShipping.textContent = '$' + orderData.shippingPrice.toFixed(2);
                if (confTax) confTax.textContent = '$' + orderData.tax.toFixed(2);
                if (confTotal) confTotal.textContent = '$' + orderData.total.toFixed(2);
                
                const shippingAddress = document.getElementById('shipping-address');
                if (shippingAddress && orderData.shipping) {
                    shippingAddress.innerHTML = `
                        ${orderData.shipping.firstName} ${orderData.shipping.lastName}<br>
                        ${orderData.shipping.address}<br>
                        ${orderData.shipping.city}, ${orderData.shipping.state} ${orderData.shipping.zip}<br>
                        ${orderData.shipping.country}
                    `;
                }
                
                const confEmail = document.getElementById('conf-email');
                if (confEmail) confEmail.textContent = orderData.email;
                
                const deliveryDate = document.getElementById('delivery-date');
                if (deliveryDate) {
                    const days = orderData.shippingMethod === 'overnight' ? '1' : 
                                 orderData.shippingMethod === 'express' ? '2-3' : '5-7';
                    deliveryDate.textContent = days + ' business days';
                }
                
            } catch (e) {
                console.error('Error loading order data:', e);
            }
        },
        
        clearCart: function() {
            this.items = [];
            this.saveCart();
            this.updateCartCount();
        }
    };
    
    // =========================================
    // AUTHENTICATION
    // =========================================
    const Auth = {
        storageKey: 'rf1_user',
        
        init: function() {
            this.initLoginForm();
            this.initRegisterForm();
            this.updateAuthUI();
        },
        
        initLoginForm: function() {
            const self = this;
            const loginForm = document.getElementById('login-form');
            
            if (!loginForm) return;
            
            loginForm.addEventListener('submit', function(e) {
                e.preventDefault();
                
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                const errorEl = document.getElementById('login-error');
                
                if (!email || !password) {
                    errorEl.textContent = 'Please fill in all fields';
                    errorEl.style.display = 'block';
                    return;
                }
                
                const users = JSON.parse(localStorage.getItem('rf1_users') || '[]');
                const user = users.find(u => u.email === email);
                
                if (!user || user.password !== password) {
                    errorEl.textContent = 'Invalid email or password';
                    errorEl.style.display = 'block';
                    
                    if (window.racingF1Analytics) {
                        window.racingF1Analytics.linkCallback('login-form', {
                            action: 'submit',
                            label: 'login-failed',
                            CD: { error_type: 'invalid_credentials' }
                        });
                    }
                    return;
                }
                
                localStorage.setItem(self.storageKey, JSON.stringify({
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    favoriteTeam: user.favoriteTeam
                }));
                
                if (window.gridbox && window.gridbox.setUser) {
                    window.gridbox.setUser({
                        id: user.email,
                        name: user.firstName + ' ' + user.lastName,
                        email: user.email,
                        type: 'registered'
                    });
                }

                if (window.racingF1Analytics) {
                    window.racingF1Analytics.linkCallback('login-form', {
                        action: 'submit',
                        label: 'login-success',
                        CD: { user_type: 'registered' }
                    });
                }

                alert('Welcome back, ' + user.firstName + '!');
                window.location.href = 'index.html';
            });
        },
        
        initRegisterForm: function() {
            const self = this;
            const registerForm = document.getElementById('register-form');
            
            if (!registerForm) return;
            
            registerForm.addEventListener('submit', function(e) {
                e.preventDefault();
                
                const firstName = document.getElementById('firstName').value;
                const lastName = document.getElementById('lastName').value;
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                const confirmPassword = document.getElementById('confirmPassword').value;
                const favoriteTeam = document.getElementById('favoriteTeam').value;
                const terms = document.getElementById('terms').checked;
                const errorEl = document.getElementById('register-error');
                
                if (!firstName || !lastName || !email || !password) {
                    errorEl.textContent = 'Please fill in all required fields';
                    errorEl.style.display = 'block';
                    return;
                }
                
                if (password !== confirmPassword) {
                    errorEl.textContent = 'Passwords do not match';
                    errorEl.style.display = 'block';
                    return;
                }
                
                if (password.length < 8) {
                    errorEl.textContent = 'Password must be at least 8 characters';
                    errorEl.style.display = 'block';
                    return;
                }
                
                if (!terms) {
                    errorEl.textContent = 'Please accept the terms and conditions';
                    errorEl.style.display = 'block';
                    return;
                }
                
                const users = JSON.parse(localStorage.getItem('rf1_users') || '[]');
                
                if (users.find(u => u.email === email)) {
                    errorEl.textContent = 'An account with this email already exists';
                    errorEl.style.display = 'block';
                    return;
                }
                
                const newUser = {
                    firstName: firstName,
                    lastName: lastName,
                    email: email,
                    password: password,
                    favoriteTeam: favoriteTeam,
                    createdAt: new Date().toISOString()
                };
                
                users.push(newUser);
                localStorage.setItem('rf1_users', JSON.stringify(users));
                
                localStorage.setItem(self.storageKey, JSON.stringify({
                    email: newUser.email,
                    firstName: newUser.firstName,
                    lastName: newUser.lastName,
                    favoriteTeam: newUser.favoriteTeam
                }));
                
                if (window.gridbox && window.gridbox.setUser) {
                    window.gridbox.setUser({
                        id: newUser.email,
                        name: firstName + ' ' + lastName,
                        email: newUser.email,
                        type: 'new'
                    });
                }

                if (window.racingF1Analytics) {
                    window.racingF1Analytics.linkCallback('register-form', {
                        action: 'submit',
                        label: 'signup-success',
                        CD: {
                            user_type: 'new',
                            favorite_team: favoriteTeam
                        }
                    });
                }

                alert('Welcome to Racing F1, ' + firstName + '!');
                window.location.href = 'index.html';
            });
        },
        
        updateAuthUI: function() {
            const self = this;
            const user = this.getCurrentUser();
            const accountLinks = document.querySelectorAll('[href="login.html"]');

            if (user) {
                accountLinks.forEach(function(link) {
                    link.setAttribute('title', 'Logged in as ' + user.firstName + ' — click to log out');
                    link.setAttribute('data-track', 'header-actions_click_logout');
                    link.setAttribute('href', '#');
                    link.addEventListener('click', function(e) {
                        e.preventDefault();
                        self.logout();
                    });
                });

                // Re-hydrate the datalayer user on every page so a logged-in
                // visitor is not reported as a guest after navigation.
                if (window.gridbox && window.gridbox.setUser) {
                    window.gridbox.setUser({
                        id: user.email,
                        name: (user.firstName || '') + ' ' + (user.lastName || ''),
                        email: user.email,
                        type: 'registered'
                    });
                }
            }
        },
        
        getCurrentUser: function() {
            try {
                return JSON.parse(localStorage.getItem(this.storageKey));
            } catch (e) {
                return null;
            }
        },
        
        logout: function() {
            localStorage.removeItem(this.storageKey);
            if (window.racingF1Analytics) {
                window.racingF1Analytics.linkCallback('header-actions', {
                    action: 'click',
                    label: 'logout-success'
                });
            }
            window.location.href = 'index.html';
        }
    };

    // =========================================
    // PROMOTION TRACKING EXAMPLES
    // =========================================
    const PromoTracking = {
        init: function() {
            // Track promotion views on page load
            this.trackPromoImpressions();
            
            // Track experience card clicks with promotion data
            this.initExperienceTracking();
        },
        
        trackPromoImpressions: function() {
            const promoCards = document.querySelectorAll('.experience-card');
            
            promoCards.forEach(function(card, index) {
                // Use Intersection Observer for view tracking
                const observer = new IntersectionObserver(function(entries) {
                    entries.forEach(function(entry) {
                        if (entry.isIntersecting) {
                            const cardTitle = card.querySelector('h3');
                            const promoName = cardTitle ? cardTitle.textContent : 'Unknown Experience';
                            
                            if (window.racingF1Analytics) {
                                window.racingF1Analytics.linkCallback('promotion-banner', {
                                    action: 'view',
                                    label: 'experience-impression',
                                    promotion: {
                                        id: 'EXP-' + (index + 1),
                                        name: promoName,
                                        creative: 'experience-card',
                                        position: index + 1
                                    },
                                    CD: {
                                        experience_type: 'vip',
                                        experience_name: promoName,
                                        content_type: 'promotion'
                                    }
                                });
                            }
                            
                            // Only track once
                            observer.unobserve(card);
                        }
                    });
                }, { threshold: 0.5 });
                
                observer.observe(card);
            });
        },
        
        initExperienceTracking: function() {
            const enquireBtns = document.querySelectorAll('[data-track*="experience-actions"]');
            
            enquireBtns.forEach(function(btn) {
                btn.addEventListener('click', function() {
                    const card = btn.closest('.experience-card');
                    if (!card) return;
                    
                    const titleEl = card.querySelector('h3');
                    const priceEl = card.querySelector('.experience-price');
                    
                    const experienceName = titleEl ? titleEl.textContent : 'Unknown';
                    const priceText = priceEl ? priceEl.textContent : '';
                    const priceMatch = priceText.match(/[\d,]+/);
                    const price = priceMatch ? priceMatch[0].replace(',', '') : '0';
                    
                    // Enhanced tracking via linkCallback
                    if (window.racingF1Analytics) {
                        window.racingF1Analytics.linkCallback('experience-booking', {
                            action: 'click',
                            label: 'enquire-form',
                            value: parseInt(price),
                            price: price,
                            CD: {
                                experience_type: card.classList.contains('premium') ? 'premium' : 'standard',
                                experience_name: experienceName,
                                product_price: price,
                                content_type: 'experience'
                            }
                        });
                    }
                });
            });
        }
    };

    // =========================================
    // RACE TICKET TRACKING
    // =========================================
    const RaceTracking = {
        init: function() {
            const raceCards = document.querySelectorAll('.race-card');
            
            raceCards.forEach(function(card) {
                const bookBtn = card.querySelector('[data-track*="race-actions"]');
                
                if (bookBtn) {
                    bookBtn.addEventListener('click', function() {
                        const raceTitle = card.querySelector('h3');
                        const raceCircuit = card.querySelector('.race-circuit');
                        const priceEl = card.querySelector('.race-price');
                        
                        const raceName = raceTitle ? raceTitle.textContent : 'Unknown Race';
                        const location = raceCircuit ? raceCircuit.textContent : 'Unknown';
                        const price = priceEl ? priceEl.textContent.replace('€', '') : '0';
                        
                        if (window.racingF1Analytics) {
                            window.racingF1Analytics.linkCallback('race-tickets', {
                                action: 'click',
                                label: 'book-now',
                                value: parseInt(price),
                                price: price,
                                CD: {
                                    race_name: raceName,
                                    race_location: location,
                                    product_price: price,
                                    content_type: 'race-ticket',
                                    page_type: 'tickets'
                                }
                            });
                        }
                    });
                }
            });
        }
    };

    // =========================================
    // EXAMPLE: ERROR TRACKING
    // =========================================
    const ErrorTracking = {
        init: function() {
            // Global error handler
            window.addEventListener('error', function(event) {
                if (window.racingF1Analytics) {
                    window.racingF1Analytics.linkCallback('error-tracking', {
                        action: 'view',
                        label: 'javascript-error',
                        CD: {
                            ga_errorMessage: event.message,
                            error_type: 'javascript',
                            error_code: 'JS_ERROR'
                        }
                    });
                }
            });
        },
        
        // Method to manually track errors
        trackError: function(errorMessage, errorType, errorCode) {
            if (window.racingF1Analytics) {
                window.racingF1Analytics.linkCallback('error-tracking', {
                    action: 'view',
                    label: 'application-error',
                    CD: {
                        ga_errorMessage: errorMessage,
                        error_type: errorType || 'application',
                        error_code: errorCode || 'APP_ERROR'
                    }
                });
            }
        }
    };

    // =========================================
    // SMOOTH SCROLL FOR ANCHOR LINKS
    // =========================================
    const SmoothScroll = {
        init: function() {
            document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
                anchor.addEventListener('click', function(e) {
                    const targetId = this.getAttribute('href');
                    if (targetId === '#') return;
                    
                    const target = document.querySelector(targetId);
                    if (target) {
                        e.preventDefault();
                        target.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start'
                        });
                    }
                });
            });
        }
    };

    // =========================================
    // HEADER SCROLL EFFECT
    // =========================================
    const HeaderEffect = {
        init: function() {
            const header = document.querySelector('.header');
            if (!header) return;
            
            let lastScroll = 0;
            
            window.addEventListener('scroll', function() {
                const currentScroll = window.pageYOffset;
                
                if (currentScroll > 100) {
                    header.style.background = 'rgba(10, 10, 10, 0.98)';
                } else {
                    header.style.background = 'rgba(10, 10, 10, 0.95)';
                }
                
                lastScroll = currentScroll;
            });
        }
    };

    // =========================================
    // SHARED OVERLAY STYLES (injected once)
    // =========================================
    const OverlayStyles = {
        injected: false,
        inject: function() {
            if (this.injected) return;
            this.injected = true;
            const css = `
            .rf1-overlay { position: fixed; inset: 0; background: rgba(10,10,10,0.85); backdrop-filter: blur(6px); z-index: 9999; display: flex; align-items: flex-start; justify-content: center; opacity: 0; pointer-events: none; transition: opacity .25s ease; }
            .rf1-overlay.open { opacity: 1; pointer-events: auto; }
            .rf1-search-box { width: min(680px, 92vw); margin-top: 12vh; }
            .rf1-search-box input { width: 100%; padding: 18px 22px; font-size: 1.25rem; background: #141414; color: #fff; border: 2px solid #e10600; border-radius: 10px; outline: none; font-family: inherit; }
            .rf1-search-results { margin-top: 14px; max-height: 50vh; overflow-y: auto; }
            .rf1-search-result { display: flex; gap: 14px; align-items: center; padding: 12px 14px; background: #141414; border-radius: 8px; margin-bottom: 8px; color: #fff; text-decoration: none; border: 1px solid #222; transition: border-color .2s; }
            .rf1-search-result:hover { border-color: #e10600; }
            .rf1-search-result img { width: 52px; height: 52px; object-fit: cover; border-radius: 6px; }
            .rf1-search-empty { color: #999; padding: 16px; text-align: center; }
            .rf1-modal { width: min(760px, 94vw); margin-top: 8vh; background: #121212; border: 1px solid #2a2a2a; border-radius: 14px; overflow: hidden; display: grid; grid-template-columns: 1fr 1fr; box-shadow: 0 30px 80px rgba(0,0,0,.6); }
            .rf1-modal-img { background: #1c1c1c; display: flex; align-items: center; justify-content: center; }
            .rf1-modal-img img { width: 100%; height: 100%; object-fit: cover; }
            .rf1-modal-body { padding: 28px; color: #fff; }
            .rf1-modal-brand { color: #e10600; text-transform: uppercase; letter-spacing: 1px; font-size: .8rem; font-weight: 700; }
            .rf1-modal-name { font-size: 1.6rem; margin: 8px 0 14px; font-family: 'Orbitron', sans-serif; }
            .rf1-modal-price { font-size: 1.5rem; font-weight: 700; margin-bottom: 22px; }
            .rf1-modal-actions { display: flex; gap: 12px; }
            .rf1-modal-close { position: absolute; top: 20px; right: 24px; background: none; border: none; color: #fff; font-size: 2rem; cursor: pointer; line-height: 1; }
            .rf1-wishlist-panel { position: fixed; top: 0; right: 0; height: 100vh; width: min(380px, 90vw); background: #121212; border-left: 1px solid #2a2a2a; z-index: 10000; transform: translateX(100%); transition: transform .3s ease; color: #fff; display: flex; flex-direction: column; }
            .rf1-wishlist-panel.open { transform: translateX(0); }
            .rf1-wishlist-header { padding: 20px; border-bottom: 1px solid #2a2a2a; display: flex; justify-content: space-between; align-items: center; font-family: 'Orbitron', sans-serif; }
            .rf1-wishlist-items { flex: 1; overflow-y: auto; padding: 12px; }
            .rf1-wishlist-item { display: flex; gap: 12px; align-items: center; padding: 10px; border-radius: 8px; background: #1a1a1a; margin-bottom: 8px; }
            .rf1-wishlist-item img { width: 48px; height: 48px; object-fit: cover; border-radius: 6px; }
            .rf1-wishlist-item .rf1-wl-remove { margin-left: auto; background: none; border: none; color: #e10600; cursor: pointer; font-size: 1.2rem; }
            .rf1-wishlist-empty { color: #999; text-align: center; padding: 40px 20px; }
            .rf1-card-actions { position: absolute; top: 10px; right: 10px; display: flex; flex-direction: column; gap: 8px; z-index: 3; }
            .rf1-card-actions .wishlist-btn, .rf1-card-actions .quick-view-btn { width: 36px; height: 36px; border-radius: 50%; border: none; background: rgba(20,20,20,0.85); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background .2s, transform .2s; padding: 0; }
            .rf1-card-actions .wishlist-btn:hover, .rf1-card-actions .quick-view-btn:hover { background: #e10600; transform: scale(1.08); }
            .wishlist-btn.active svg { fill: #e10600; stroke: #e10600; }
            .rf1-wl-badge { position: absolute; top: -6px; right: -6px; background: #e10600; color: #fff; border-radius: 50%; min-width: 16px; height: 16px; font-size: 10px; display: flex; align-items: center; justify-content: center; padding: 0 4px; }
            @media (max-width: 600px) { .rf1-modal { grid-template-columns: 1fr; } .rf1-modal-img { max-height: 220px; } }
            `;
            const style = document.createElement('style');
            style.id = 'rf1-overlay-styles';
            style.textContent = css;
            document.head.appendChild(style);
        }
    };

    // =========================================
    // PRODUCT SEARCH
    // =========================================
    const Search = {
        init: function() {
            const btn = document.querySelector('[data-track="header-actions_click_search"]');
            if (!btn) return;
            OverlayStyles.inject();

            const overlay = document.createElement('div');
            overlay.className = 'rf1-overlay';
            overlay.innerHTML = `
                <div class="rf1-search-box">
                    <input type="text" placeholder="Search products..." aria-label="Search products" />
                    <div class="rf1-search-results"></div>
                </div>`;
            document.body.appendChild(overlay);

            const input = overlay.querySelector('input');
            const results = overlay.querySelector('.rf1-search-results');
            const self = this;

            const open = function() {
                overlay.classList.add('open');
                setTimeout(function() { input.focus(); }, 50);
                if (window.gridbox) window.gridbox.track('gb_search_open', { CD: { source: 'header' } });
            };
            const close = function() { overlay.classList.remove('open'); input.value = ''; results.innerHTML = ''; };

            btn.addEventListener('click', function(e) { e.preventDefault(); open(); });
            overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
            document.addEventListener('keydown', function(e) { if (e.key === 'Escape') close(); });

            input.addEventListener('input', function() {
                const q = input.value.trim().toLowerCase();
                if (!q) { results.innerHTML = ''; return; }
                const matches = self.getCatalog().filter(function(p) {
                    return p.name.toLowerCase().indexOf(q) > -1 || p.brand.toLowerCase().indexOf(q) > -1 || p.category.toLowerCase().indexOf(q) > -1;
                });
                if (window.gridbox) window.gridbox.track('gb_search_query', { CD: { query: q, results: String(matches.length) } });
                if (matches.length === 0) { results.innerHTML = '<div class="rf1-search-empty">No products found for "' + q + '"</div>'; return; }
                results.innerHTML = matches.map(function(p) {
                    return '<a class="rf1-search-result" href="' + p.href + '">' +
                        '<img src="' + p.image + '" alt=""><div><div style="font-weight:600">' + p.name + '</div>' +
                        '<div style="color:#999;font-size:.85rem">' + p.brand + ' &middot; $' + p.price + '</div></div></a>';
                }).join('');
            });
        },
        // Build a catalog from product cards on the page; fall back to a static list.
        getCatalog: function() {
            const cards = document.querySelectorAll('.product-card');
            if (cards.length > 0) {
                return Array.prototype.map.call(cards, function(card) {
                    const btn = card.querySelector('.add-cart-btn');
                    const brandEl = card.querySelector('.product-brand');
                    const nameEl = card.querySelector('.product-name');
                    const priceEl = card.querySelector('.current-price');
                    const imgEl = card.querySelector('img');
                    return {
                        id: btn ? btn.dataset.productId : '',
                        name: (nameEl ? nameEl.textContent : (btn ? btn.dataset.productName : '')).trim(),
                        brand: brandEl ? brandEl.textContent.trim() : '',
                        category: btn ? (btn.dataset.productCategory || '') : '',
                        price: btn ? btn.dataset.productPrice : (priceEl ? priceEl.textContent.replace('$', '') : ''),
                        image: imgEl ? imgEl.getAttribute('src') : '',
                        href: 'merchandise.html'
                    };
                });
            }
            return [
                { id: 'RB-JKT-2024', name: '2024 Team Jacket', brand: 'Red Bull Racing', category: 'Apparel', price: '159.99', image: 'Gemini_Generated_Image_1uzlq31uzlq31uzl.png', href: 'merchandise.html' },
                { id: 'FER-CAP', name: 'Ferrari Team Cap', brand: 'Scuderia Ferrari', category: 'Accessories', price: '49.99', image: 'Gemini_Generated_Image_1uzlq31uzlq31uzl.png', href: 'merchandise.html' }
            ];
        }
    };

    // =========================================
    // WISHLIST
    // =========================================
    const Wishlist = {
        storageKey: 'rf1_wishlist',
        items: [],
        panel: null,
        init: function() {
            OverlayStyles.inject();
            this.load();
            this.buildPanel();
            this.bindHeaderButton();
            this.bindProductButtons();
            this.updateBadge();
        },
        load: function() {
            try { this.items = JSON.parse(localStorage.getItem(this.storageKey) || '[]'); }
            catch (e) { this.items = []; }
        },
        save: function() { localStorage.setItem(this.storageKey, JSON.stringify(this.items)); },
        has: function(id) { return this.items.some(function(i) { return i.id === id; }); },
        toggle: function(product) {
            const idx = this.items.findIndex(function(i) { return i.id === product.id; });
            let added;
            if (idx >= 0) { this.items.splice(idx, 1); added = false; }
            else { this.items.push(product); added = true; }
            this.save();
            this.updateBadge();
            this.renderPanel();
            if (window.gridbox) {
                window.gridbox.track(added ? 'gb_wishlist_add' : 'gb_wishlist_remove', {
                    CD: { product_id: product.id, product_name: product.name }
                });
            }
            return added;
        },
        bindHeaderButton: function() {
            const btn = document.querySelector('[data-track="header-actions_click_wishlist"]');
            if (!btn) return;
            btn.style.position = 'relative';
            const self = this;
            btn.addEventListener('click', function(e) { e.preventDefault(); self.openPanel(); });
        },
        bindProductButtons: function() {
            const self = this;
            document.querySelectorAll('.wishlist-btn').forEach(function(btn) {
                const card = btn.closest('.product-card');
                if (!card) return;
                const cartBtn = card.querySelector('.add-cart-btn');
                const product = self.productFromCard(card, cartBtn);
                if (self.has(product.id)) btn.classList.add('active');
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    const added = self.toggle(product);
                    btn.classList.toggle('active', added);
                });
            });
        },
        productFromCard: function(card, cartBtn) {
            const brandEl = card.querySelector('.product-brand');
            const nameEl = card.querySelector('.product-name');
            const priceEl = card.querySelector('.current-price');
            const imgEl = card.querySelector('img');
            return {
                id: cartBtn ? cartBtn.dataset.productId : (nameEl ? nameEl.textContent.trim() : ''),
                name: (nameEl ? nameEl.textContent : (cartBtn ? cartBtn.dataset.productName : '')).trim(),
                brand: brandEl ? brandEl.textContent.trim() : '',
                price: cartBtn ? cartBtn.dataset.productPrice : (priceEl ? priceEl.textContent.replace('$', '') : ''),
                category: cartBtn ? (cartBtn.dataset.productCategory || '') : '',
                image: imgEl ? imgEl.getAttribute('src') : ''
            };
        },
        buildPanel: function() {
            const panel = document.createElement('div');
            panel.className = 'rf1-wishlist-panel';
            panel.innerHTML = `
                <div class="rf1-wishlist-header"><span>Wishlist</span><button class="rf1-modal-close" style="position:static;font-size:1.6rem">&times;</button></div>
                <div class="rf1-wishlist-items"></div>`;
            document.body.appendChild(panel);
            this.panel = panel;
            const self = this;
            panel.querySelector('.rf1-modal-close').addEventListener('click', function() { self.closePanel(); });
        },
        openPanel: function() { this.renderPanel(); this.panel.classList.add('open'); },
        closePanel: function() { this.panel.classList.remove('open'); },
        renderPanel: function() {
            if (!this.panel) return;
            const list = this.panel.querySelector('.rf1-wishlist-items');
            if (this.items.length === 0) { list.innerHTML = '<div class="rf1-wishlist-empty">Your wishlist is empty.</div>'; return; }
            const self = this;
            list.innerHTML = this.items.map(function(p) {
                return '<div class="rf1-wishlist-item" data-id="' + p.id + '">' +
                    '<img src="' + p.image + '" alt=""><div><div style="font-weight:600">' + p.name + '</div>' +
                    '<div style="color:#999;font-size:.85rem">$' + p.price + '</div></div>' +
                    '<button class="rf1-wl-remove" aria-label="Remove">&times;</button></div>';
            }).join('');
            list.querySelectorAll('.rf1-wl-remove').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    const id = btn.closest('.rf1-wishlist-item').dataset.id;
                    const product = self.items.find(function(i) { return i.id === id; });
                    if (product) self.toggle(product);
                    document.querySelectorAll('.product-card').forEach(function(card) {
                        const cartBtn = card.querySelector('.add-cart-btn');
                        if (cartBtn && cartBtn.dataset.productId === id) {
                            const wb = card.querySelector('.wishlist-btn');
                            if (wb) wb.classList.remove('active');
                        }
                    });
                });
            });
        },
        updateBadge: function() {
            const btn = document.querySelector('[data-track="header-actions_click_wishlist"]');
            if (!btn) return;
            let badge = btn.querySelector('.rf1-wl-badge');
            if (this.items.length === 0) { if (badge) badge.remove(); return; }
            if (!badge) { badge = document.createElement('span'); badge.className = 'rf1-wl-badge'; btn.appendChild(badge); }
            badge.textContent = this.items.length;
        }
    };

    // =========================================
    // PRODUCT CARD ENHANCER
    // Injects wishlist + quick-view trigger buttons into each product card so
    // the Wishlist and QuickView modules have controls to bind to. Runs before
    // those modules. Skips cards that already have the buttons (idempotent).
    // =========================================
    const ProductCardEnhancer = {
        init: function() {
            const cards = document.querySelectorAll('.product-card');
            cards.forEach(function(card) {
                const imgWrap = card.querySelector('.product-image') || card;
                if (imgWrap.querySelector('.rf1-card-actions')) return;
                const actions = document.createElement('div');
                actions.className = 'rf1-card-actions';
                const wl = document.createElement('button');
                wl.className = 'wishlist-btn';
                wl.type = 'button';
                wl.setAttribute('aria-label', 'Add to wishlist');
                wl.setAttribute('data-track', 'product-actions_click_wishlist');
                wl.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>';
                const qv = document.createElement('button');
                qv.className = 'quick-view-btn';
                qv.type = 'button';
                qv.setAttribute('aria-label', 'Quick view');
                qv.setAttribute('data-track', 'product-actions_click_quick-view');
                qv.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>';
                actions.appendChild(wl);
                actions.appendChild(qv);
                imgWrap.style.position = imgWrap.style.position || 'relative';
                imgWrap.appendChild(actions);
            });
        }
    };

    // =========================================
    // QUICK VIEW
    // =========================================
    const QuickView = {
        modal: null,
        init: function() {
            const btns = document.querySelectorAll('.quick-view-btn');
            if (btns.length === 0) return;
            OverlayStyles.inject();
            this.buildModal();
            const self = this;
            btns.forEach(function(btn) {
                const card = btn.closest('.product-card');
                if (!card) return;
                btn.addEventListener('click', function(e) { e.preventDefault(); self.open(card); });
            });
        },
        buildModal: function() {
            const overlay = document.createElement('div');
            overlay.className = 'rf1-overlay';
            overlay.innerHTML = `
                <div class="rf1-modal" style="position:relative">
                    <button class="rf1-modal-close" aria-label="Close">&times;</button>
                    <div class="rf1-modal-img"><img src="" alt=""></div>
                    <div class="rf1-modal-body">
                        <div class="rf1-modal-brand"></div>
                        <h3 class="rf1-modal-name"></h3>
                        <div class="rf1-modal-price"></div>
                        <div class="rf1-modal-actions">
                            <button class="btn btn-primary rf1-qv-add">Add to Cart</button>
                        </div>
                    </div>
                </div>`;
            document.body.appendChild(overlay);
            this.modal = overlay;
            const self = this;
            overlay.querySelector('.rf1-modal-close').addEventListener('click', function() { self.close(); });
            overlay.addEventListener('click', function(e) { if (e.target === overlay) self.close(); });
            document.addEventListener('keydown', function(e) { if (e.key === 'Escape') self.close(); });
        },
        open: function(card) {
            const brandEl = card.querySelector('.product-brand');
            const nameEl = card.querySelector('.product-name');
            const priceEl = card.querySelector('.current-price');
            const imgEl = card.querySelector('img');
            const cartBtn = card.querySelector('.add-cart-btn');

            this.modal.querySelector('.rf1-modal-img img').src = imgEl ? imgEl.getAttribute('src') : '';
            this.modal.querySelector('.rf1-modal-brand').textContent = brandEl ? brandEl.textContent.trim() : '';
            this.modal.querySelector('.rf1-modal-name').textContent = nameEl ? nameEl.textContent.trim() : '';
            this.modal.querySelector('.rf1-modal-price').textContent = priceEl ? priceEl.textContent.trim() : '';

            // Reuse the card's real add-to-cart handler so tracking stays identical.
            const addBtn = this.modal.querySelector('.rf1-qv-add');
            const self = this;
            addBtn.onclick = function() {
                if (cartBtn) cartBtn.click();
                self.close();
            };

            this.modal.classList.add('open');
            if (window.gridbox && cartBtn) {
                window.gridbox.track('gb_quick_view', {
                    CD: { product_id: cartBtn.dataset.productId, product_name: cartBtn.dataset.productName }
                });
            }
        },
        close: function() { this.modal.classList.remove('open'); }
    };

    // =========================================
    // INITIALIZE ALL MODULES
    // =========================================
    function init() {
        DebugPanel.init();
        ProductFilter.init();
        Newsletter.init();
        Cart.init();
        Auth.init();
        PromoTracking.init();
        RaceTracking.init();
        ErrorTracking.init();
        SmoothScroll.init();
        HeaderEffect.init();
        Search.init();
        ProductCardEnhancer.init();
        Wishlist.init();
        QuickView.init();
        
        console.log('%cRacing F1 App Initialized', 'color: #e10600; font-weight: bold; font-size: 14px;');
        
        // Log example usage
        console.log('%cAnalytics Layer Active', 'color: #00f0ff; font-weight: bold;');
        console.log('Access via: window.racingF1Analytics');
        console.log('Callback functions: window.rf1EventCallback, window.rf1LinkCallback');
    }

    // =========================================
    // DOM READY
    // =========================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // =========================================
    // EXPOSE MODULES GLOBALLY FOR DEBUGGING
    // =========================================
    window.RacingF1App = {
        Cart: Cart,
        Auth: Auth,
        ErrorTracking: ErrorTracking,
        PromoTracking: PromoTracking
    };

})(window, document);


// =========================================
// EXAMPLE USAGE DOCUMENTATION
// =========================================
/*

============================================
EXAMPLE 1: Basic Click Tracking (Automatic)
============================================
Any element with data-identifier-track will be automatically tracked:

<button data-identifier-track="products-section_click_view-all">
    View All
</button>

Result in dataLayer:
{
    event: "retail_event",
    action_type: "b2t_products-section_click_view-all",
    eventCategory: "products section",
    eventAction: "click",
    eventLabel: "view all",
    eventName: "view all",
    ga_eventClick: "1"
}


============================================
EXAMPLE 2: Click with Product Data
============================================
Add data attributes for enhanced tracking:

<button data-identifier-track="product-actions_click_add-to-cart"
        data-product-id="RB-JKT-2024"
        data-product-name="2024 Team Jacket"
        data-product-price="159.99"
        data-product-category="Apparel">
    Add to Cart
</button>

Result in dataLayer:
{
    event: "retail_event",
    action_type: "b2t_product-actions_click_add-to-cart",
    eventCategory: "product actions",
    eventAction: "click",
    eventLabel: "add to cart",
    eventName: "add to cart",
    ga_eventClick: "1",
    product_id: "RB-JKT-2024",
    product_name: "2024 Team Jacket",
    product_price: "159.99",
    product_category: "Apparel"
}


============================================
EXAMPLE 3: Using linkCallback for Special Events
============================================
For enhanced tracking with promotions/pricing:

window.racingF1Analytics.linkCallback('ecommerce-cart', {
    action: 'click',
    label: 'add-item',
    value: 159.99,
    price: '159.99',
    rank: 1,
    promotion: {
        id: 'PROMO-2024',
        name: 'Summer Sale',
        creative: 'banner-hero',
        position: 1
    },
    CD: {
        product_id: 'RB-JKT-2024',
        product_name: '2024 Team Jacket',
        product_category: 'Apparel'
    }
});

Result in dataLayer:
{
    event: "retail_event",
    action_type: "b2t_ecommerce-cart_click_add-item",
    eventCategory: "ecommerce cart",
    eventAction: "click",
    eventLabel: "add item",
    eventName: "add item",
    eventValue: 159.99,
    ga_eventClick: "1",
    product_id: "RB-JKT-2024",
    product_name: "2024 Team Jacket",
    product_category: "Apparel",
    product_price: "159.99",
    product_position: "1",
    promo_id: "PROMO-2024",
    promo_name: "Summer Sale",
    promo_creative: "banner-hero",
    promo_position: "1"
}


============================================
EXAMPLE 4: Error Tracking
============================================

window.racingF1Analytics.linkCallback('error-tracking', {
    action: 'view',
    label: 'form-validation',
    CD: {
        ga_errorMessage: 'Invalid email format',
        error_type: 'validation',
        error_code: 'EMAIL_INVALID'
    }
});

Result in dataLayer:
{
    event: "retail_event",
    action_type: "b2t_error-tracking_view_form-validation",
    eventCategory: "error tracking",
    eventAction: "view",
    eventLabel: "form validation",
    eventName: "form validation",
    ga_eventView: "1",
    error_counter: "1",
    ga_errorMessage: "Invalid email format",
    error_type: "validation",
    error_code: "EMAIL_INVALID"
}


============================================
EXAMPLE 5: View Tracking
============================================

window.racingF1Analytics.trackView('product-card_view_ferrari-cap', {
    CD: {
        product_id: 'FER-CAP-LC16',
        product_name: 'Leclerc Signature Cap',
        product_category: 'Accessories'
    }
});


============================================
FIRE/DROP DECISION EXAMPLES
============================================

WILL FIRE (3 parts after split):
- "navigation-main_click_book-flight" ✓
- "shop/products-grid_view_item-impression" ✓

WILL DROP (not 3 parts):
- "navigation_click" ✗ (only 2 parts)
- "navigation_main_click_button_extra" ✗ (5 parts)
- "single-value" ✗ (only 1 part)


============================================
WHITELIST FILTERING EXAMPLES
============================================

Input CD:
{
    product_id: "ABC123",          // ✓ Whitelisted
    product_name: "Test Product",   // ✓ Whitelisted
    secret_data: "hidden",          // ✗ Not whitelisted (dropped)
    internal_id: "12345",           // ✗ Not whitelisted (dropped)
    ga_errorMessage: "Error msg"    // ✓ Whitelisted
}

Output (filtered):
{
    product_id: "ABC123",
    product_name: "Test Product",
    ga_errorMessage: "Error msg"
}

*/
