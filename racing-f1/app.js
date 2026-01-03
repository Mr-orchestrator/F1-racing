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
        
        init: function() {
            const self = this;
            this.loadCart();
            this.updateCartCount();
            this.initAddToCartButtons();
            this.initCartPage();
            this.initCheckoutPage();
            this.initConfirmationPage();
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
                    
                    self.addItem({
                        id: productId,
                        name: productName,
                        price: parseFloat(productPrice),
                        category: productCategory,
                        image: productImage,
                        quantity: 1
                    });
                    
                    if (window.racingF1Analytics) {
                        window.racingF1Analytics.linkCallback('ecommerce-cart', {
                            action: 'click',
                            label: 'add-item',
                            value: parseFloat(productPrice),
                            price: productPrice,
                            rank: self.items.length,
                            CD: {
                                product_id: productId,
                                product_name: productName,
                                product_price: productPrice,
                                product_category: productCategory,
                                product_quantity: '1'
                            }
                        });
                    }
                    
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
            this.items = this.items.filter(i => i.id !== productId);
            this.saveCart();
            this.updateCartCount();
        },
        
        updateQuantity: function(productId, quantity) {
            const item = this.items.find(i => i.id === productId);
            if (item) {
                item.quantity = Math.max(1, quantity);
                this.saveCart();
            }
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
                    if (promoInput && promoInput.value.toUpperCase() === 'RF1SAVE10') {
                        alert('Promo code applied! 10% discount');
                        if (window.racingF1Analytics) {
                            window.racingF1Analytics.linkCallback('cart-promo', {
                                action: 'click',
                                label: 'apply-success',
                                CD: { promo_code: promoInput.value }
                            });
                        }
                    } else {
                        alert('Invalid promo code');
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
            const tax = this.getTax(subtotal);
            const total = this.getTotal(subtotal, shipping, tax);
            
            const subtotalEl = document.getElementById('cart-subtotal');
            const shippingEl = document.getElementById('cart-shipping');
            const taxEl = document.getElementById('cart-tax');
            const totalEl = document.getElementById('cart-total');
            
            if (subtotalEl) subtotalEl.textContent = '$' + subtotal.toFixed(2);
            if (shippingEl) shippingEl.textContent = '$' + shipping.toFixed(2);
            if (taxEl) taxEl.textContent = '$' + tax.toFixed(2);
            if (totalEl) totalEl.textContent = '$' + total.toFixed(2);
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
            
            if (window.racingF1Analytics) {
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
            const user = this.getCurrentUser();
            const accountLinks = document.querySelectorAll('[href="login.html"]');
            
            if (user) {
                accountLinks.forEach(function(link) {
                    link.setAttribute('title', 'Logged in as ' + user.firstName);
                });
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
