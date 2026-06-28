/**
 * ============================================
 * GRIDBOX - Core Analytics Data Layer
 * ============================================
 * 
 * gridboxLayer is the CORE DATA LAYER (single source of truth)
 * GTM processing code reads from gridboxLayer
 * 
 * Architecture:
 * ┌──────────────────────────────────────────────────────────────┐
 * │                    gridboxLayer (CORE)                        │
 * ├──────────────────────────────────────────────────────────────┤
 * │  page        │ User interactions update gridboxLayer         │
 * │  user[]      │ • gridboxLayer.event[] - all events           │
 * │  product[]   │ • gridboxLayer.product[] - product catalog    │
 * │  cart        │ • gridboxLayer.cart - shopping cart           │
 * │  transaction │ • gridboxLayer.transaction - purchases        │
 * │  event[]     │                                               │
 * ├──────────────────────────────────────────────────────────────┤
 * │  GTM Processing Code reads gridboxLayer and fires tags       │
 * └──────────────────────────────────────────────────────────────┘
 * 
 * API:
 * - gridbox.view(data)      → Updates page, pushes PageView event
 * - gridbox.link(data)      → Pushes UserEvent to event[]
 * - gridbox.addProduct(p)   → Adds to product[], pushes event
 * - gridbox.addToCart(p)    → Adds to cart.item[], pushes event
 * - gridbox.removeFromCart()→ Removes from cart, pushes event
 * - gridbox.purchase(data)  → Sets transaction, pushes event
 */

(function(window, document) {
    'use strict';

    // =========================================
    // INITIALIZE GTM DATALAYER
    // =========================================
    window.dataLayer = window.dataLayer || [];

    // =========================================
    // CD_WHITELIST - Custom Dimensions Whitelist
    // =========================================
    // Only these keys are passed through to GTM dataLayer
    const CD_WHITELIST = [
        // Product dimensions
        'product_id', 'product_name', 'product_category', 'product_price',
        'product_brand', 'product_variant', 'product_quantity', 'product_position',
        'product_list', 'product_coupon',
        // Transaction dimensions
        'transaction_id', 'transaction_total', 'transaction_revenue',
        'transaction_currency', 'transaction_tax', 'transaction_shipping',
        'transaction_coupon',
        // User dimensions
        'user_id', 'user_type', 'user_status', 'customer_tier',
        // Page dimensions
        'page_type', 'page_category', 'page_subcategory', 'page_name',
        'page_url', 'page_path', 'content_type', 'content_id',
        // Campaign dimensions
        'campaign_source', 'campaign_medium', 'campaign_name',
        'campaign_term', 'campaign_content',
        // Experience dimensions
        'experience_type', 'experience_name', 'race_name',
        'race_location', 'team_name',
        // Promo dimensions
        'promo_id', 'promo_name', 'promo_creative', 'promo_position',
        // Error dimensions
        'ga_errorMessage', 'error_type', 'error_code',
        // Auto flags
        'ga_eventClick', 'ga_eventView', 'error_counter',
        // Event metadata
        'eventValue', 'eventCategory', 'eventAction', 'eventLabel'
    ];

    // =========================================
    // COMPONENT ID CONSTANTS (Enterprise Pattern)
    // =========================================
    const COMPONENT_IDS = {
        PAGE: "PageComponent",
        PRODUCT: "ProductComponent", 
        PRODUCT_CARD: "ProductCardPres",
        CART: "CartComponent",
        CART_PAGE: "CartPageCont",
        CHECKOUT: "CheckoutComponent",
        CHECKOUT_PAGE: "CheckoutPageCont",
        AUTH: "AuthComponent",
        SEARCH: "SearchComponent",
        FILTER: "FilterComponent",
        PROMO: "PromoComponent",
        CUSTOM: "CustomComponent"
    };

    // =========================================
    // BASE EVENT CLASS (Enterprise Pattern)
    // Dynamically builds attributes from constructor params
    // =========================================
    class BaseAnalyticsEvent {
        constructor(params) {
            this.attributes = [];
            if (!params) return;
            
            // Product attributes
            params.productId && this.attributes.push({ key: "product_id", value: String(params.productId) });
            params.productName && this.attributes.push({ key: "product_name", value: String(params.productName) });
            params.productPrice && this.attributes.push({ key: "product_price", value: String(params.productPrice) });
            params.productCategory && this.attributes.push({ key: "product_category", value: String(params.productCategory) });
            params.productBrand && this.attributes.push({ key: "product_brand", value: String(params.productBrand) });
            params.productQuantity && this.attributes.push({ key: "product_quantity", value: String(params.productQuantity) });
            
            // Cart attributes
            params.cartTotal && this.attributes.push({ key: "cart_total", value: String(params.cartTotal) });
            params.itemCount && this.attributes.push({ key: "item_count", value: String(params.itemCount) });
            params.currency && this.attributes.push({ key: "currency", value: String(params.currency) });
            
            // Transaction attributes
            params.transactionId && this.attributes.push({ key: "transaction_id", value: String(params.transactionId) });
            params.transactionTotal && this.attributes.push({ key: "transaction_total", value: String(params.transactionTotal) });
            
            // User attributes
            params.userId && this.attributes.push({ key: "user_id", value: String(params.userId) });
            params.userType && this.attributes.push({ key: "user_type", value: String(params.userType) });
            
            // Quantity attributes
            params.quantity && this.attributes.push({ key: "quantity", value: String(params.quantity) });
            params.oldQuantity && this.attributes.push({ key: "old_quantity", value: String(params.oldQuantity) });
            params.newQuantity && this.attributes.push({ key: "new_quantity", value: String(params.newQuantity) });
            params.quantityRemoved && this.attributes.push({ key: "quantity_removed", value: String(params.quantityRemoved) });
            
            // Promo attributes
            params.promoCode && this.attributes.push({ key: "promo_code", value: String(params.promoCode) });
            params.promoDiscount && this.attributes.push({ key: "promo_discount", value: String(params.promoDiscount) });
            
            // Search attributes
            params.searchTerm && this.attributes.push({ key: "search_term", value: String(params.searchTerm) });
            params.searchResults && this.attributes.push({ key: "search_results", value: String(params.searchResults) });
            
            // Error attributes
            params.errorCode && this.attributes.push({ key: "error_code", value: String(params.errorCode) });
            params.errorMessage && this.attributes.push({ key: "error_message", value: String(params.errorMessage) });
            
            // Generic attributes
            params.reason && this.attributes.push({ key: "reason", value: String(params.reason) });
            params.source && this.attributes.push({ key: "source", value: String(params.source) });
            
            // Always add PageID if pageId provided
            params.pageId && this.attributes.push({ key: "PageID", value: String(params.pageId) });
        }
    }

    // =========================================
    // ANALYTICS EVENTS (Enterprise Pattern)
    // Grouped by domain/feature area
    // =========================================
    
    // PAGE EVENTS
    const PageAnalyticsEvents = {
        pageView: class extends BaseAnalyticsEvent {
            constructor(params) {
                super(params);
                this.eventInfo = {
                    key: "PageView",
                    eventName: "PageView",
                    componentId: COMPONENT_IDS.PAGE
                };
                this.category = { primaryCategory: "PageView" };
            }
        },
        pageExit: class extends BaseAnalyticsEvent {
            constructor(params) {
                super(params);
                this.eventInfo = {
                    key: "PageExit",
                    eventName: "Page exit",
                    componentId: COMPONENT_IDS.PAGE
                };
                this.category = { primaryCategory: "PageView" };
            }
        }
    };
    
    // PRODUCT EVENTS
    const ProductAnalyticsEvents = {
        productView: class extends BaseAnalyticsEvent {
            constructor(params) {
                super(params);
                this.eventInfo = {
                    key: "ProductView",
                    eventName: "Product viewed",
                    componentId: COMPONENT_IDS.PRODUCT
                };
                this.category = { primaryCategory: "Display" };
            }
        },
        productClick: class extends BaseAnalyticsEvent {
            constructor(params) {
                super(params);
                this.eventInfo = {
                    key: "ProductClick",
                    eventName: "Product clicked",
                    componentId: COMPONENT_IDS.PRODUCT_CARD
                };
                this.category = { primaryCategory: "UserEvent" };
            }
        },
        productImpression: class extends BaseAnalyticsEvent {
            constructor(params) {
                super(params);
                this.eventInfo = {
                    key: "ProductImpression",
                    eventName: "Product impression",
                    componentId: COMPONENT_IDS.PRODUCT
                };
                this.category = { primaryCategory: "Display" };
            }
        }
    };
    
    // CART EVENTS
    const CartAnalyticsEvents = {
        addToCart: class extends BaseAnalyticsEvent {
            constructor(params) {
                super(params);
                this.eventInfo = {
                    key: "AddToCart",
                    eventName: "Add to cart",
                    componentId: COMPONENT_IDS.CART
                };
                this.category = { primaryCategory: "UserEvent" };
            }
        },
        removeFromCart: class extends BaseAnalyticsEvent {
            constructor(params) {
                super(params);
                this.eventInfo = {
                    key: "RemoveFromCart",
                    eventName: "Remove from cart",
                    componentId: COMPONENT_IDS.CART
                };
                this.category = { primaryCategory: "UserEvent" };
            }
        },
        updateCartQuantity: class extends BaseAnalyticsEvent {
            constructor(params) {
                super(params);
                this.eventInfo = {
                    key: "UpdateCartQuantity",
                    eventName: "Update cart quantity",
                    componentId: COMPONENT_IDS.CART
                };
                this.category = { primaryCategory: "UserEvent" };
            }
        },
        viewCart: class extends BaseAnalyticsEvent {
            constructor(params) {
                super(params);
                this.eventInfo = {
                    key: "ViewCart",
                    eventName: "View cart",
                    componentId: COMPONENT_IDS.CART_PAGE
                };
                this.category = { primaryCategory: "UserEvent" };
            }
        },
        clearCart: class extends BaseAnalyticsEvent {
            constructor(params) {
                super(params);
                this.eventInfo = {
                    key: "ClearCart",
                    eventName: "Clear cart",
                    componentId: COMPONENT_IDS.CART
                };
                this.category = { primaryCategory: "UserEvent" };
            }
        }
    };
    
    // CHECKOUT EVENTS  
    const CheckoutAnalyticsEvents = {
        beginCheckout: class extends BaseAnalyticsEvent {
            constructor(params) {
                super(params);
                this.eventInfo = {
                    key: "BeginCheckout",
                    eventName: "Begin checkout",
                    componentId: COMPONENT_IDS.CHECKOUT
                };
                this.category = { primaryCategory: "UserEvent" };
            }
        },
        addPaymentInfo: class extends BaseAnalyticsEvent {
            constructor(params) {
                super(params);
                this.eventInfo = {
                    key: "AddPaymentInfo",
                    eventName: "Add payment info",
                    componentId: COMPONENT_IDS.CHECKOUT
                };
                this.category = { primaryCategory: "UserEvent" };
            }
        },
        addShippingInfo: class extends BaseAnalyticsEvent {
            constructor(params) {
                super(params);
                this.eventInfo = {
                    key: "AddShippingInfo",
                    eventName: "Add shipping info",
                    componentId: COMPONENT_IDS.CHECKOUT
                };
                this.category = { primaryCategory: "UserEvent" };
            }
        },
        purchase: class extends BaseAnalyticsEvent {
            constructor(params) {
                super(params);
                this.eventInfo = {
                    key: "Purchase",
                    eventName: "Purchase completed",
                    componentId: COMPONENT_IDS.CHECKOUT
                };
                this.category = { primaryCategory: "UserEvent" };
            }
        },
        purchaseFailed: class extends BaseAnalyticsEvent {
            constructor(params) {
                super(params);
                this.eventInfo = {
                    key: "PurchaseFailed",
                    eventName: "Purchase failed",
                    componentId: COMPONENT_IDS.CHECKOUT
                };
                this.category = { primaryCategory: "Error" };
            }
        }
    };
    
    // USER EVENTS
    const UserAnalyticsEvents = {
        userLogin: class extends BaseAnalyticsEvent {
            constructor(params) {
                super(params);
                this.eventInfo = {
                    key: "UserLogin",
                    eventName: "User logged in",
                    componentId: COMPONENT_IDS.AUTH
                };
                this.category = { primaryCategory: "UserEvent" };
            }
        },
        userLogout: class extends BaseAnalyticsEvent {
            constructor(params) {
                super(params);
                this.eventInfo = {
                    key: "UserLogout", 
                    eventName: "User logged out",
                    componentId: COMPONENT_IDS.AUTH
                };
                this.category = { primaryCategory: "UserEvent" };
            }
        },
        userSignup: class extends BaseAnalyticsEvent {
            constructor(params) {
                super(params);
                this.eventInfo = {
                    key: "UserSignup",
                    eventName: "User signed up",
                    componentId: COMPONENT_IDS.AUTH
                };
                this.category = { primaryCategory: "UserEvent" };
            }
        }
    };
    
    // PROMO EVENTS
    const PromoAnalyticsEvents = {
        promoApplied: class extends BaseAnalyticsEvent {
            constructor(params) {
                super(params);
                this.eventInfo = {
                    key: "PromoApplied",
                    eventName: "Promo code applied",
                    componentId: COMPONENT_IDS.PROMO
                };
                this.category = { primaryCategory: "UserEvent" };
            }
        },
        promoFailed: class extends BaseAnalyticsEvent {
            constructor(params) {
                super(params);
                this.eventInfo = {
                    key: "PromoFailed",
                    eventName: "Promo code failed",
                    componentId: COMPONENT_IDS.PROMO
                };
                this.category = { primaryCategory: "Error" };
            }
        },
        promoRemoved: class extends BaseAnalyticsEvent {
            constructor(params) {
                super(params);
                this.eventInfo = {
                    key: "PromoRemoved",
                    eventName: "Promo code removed",
                    componentId: COMPONENT_IDS.PROMO
                };
                this.category = { primaryCategory: "UserEvent" };
            }
        }
    };
    
    // SEARCH & FILTER EVENTS
    const SearchAnalyticsEvents = {
        search: class extends BaseAnalyticsEvent {
            constructor(params) {
                super(params);
                this.eventInfo = {
                    key: "Search",
                    eventName: "Search performed",
                    componentId: COMPONENT_IDS.SEARCH
                };
                this.category = { primaryCategory: "UserEvent" };
            }
        },
        filterApplied: class extends BaseAnalyticsEvent {
            constructor(params) {
                super(params);
                this.eventInfo = {
                    key: "FilterApplied",
                    eventName: "Filter applied",
                    componentId: COMPONENT_IDS.FILTER
                };
                this.category = { primaryCategory: "UserEvent" };
            }
        }
    };
    
    // CUSTOM/GENERIC EVENTS
    const CustomAnalyticsEvents = {
        customEvent: class extends BaseAnalyticsEvent {
            constructor(key, eventName, componentId, params, categoryType) {
                super(params);
                this.eventInfo = {
                    key: key,
                    eventName: eventName,
                    componentId: componentId || COMPONENT_IDS.CUSTOM
                };
                this.category = { primaryCategory: categoryType || "CustomEvent" };
            }
        },
        customMetric: class extends BaseAnalyticsEvent {
            constructor(key, eventName, componentId, params) {
                super(params);
                this.eventInfo = {
                    key: key,
                    eventName: eventName,
                    componentId: componentId || COMPONENT_IDS.CUSTOM
                };
                this.category = { primaryCategory: "CustomMetric" };
            }
        },
        errorEvent: class extends BaseAnalyticsEvent {
            constructor(params) {
                super(params);
                this.eventInfo = {
                    key: "Error",
                    eventName: "Error occurred",
                    componentId: params.componentId || COMPONENT_IDS.CUSTOM
                };
                this.category = { primaryCategory: "Error" };
            }
        },
        warningEvent: class extends BaseAnalyticsEvent {
            constructor(params) {
                super(params);
                this.eventInfo = {
                    key: "Warning",
                    eventName: "Warning occurred",
                    componentId: params.componentId || COMPONENT_IDS.CUSTOM
                };
                this.category = { primaryCategory: "Warning" };
            }
        }
    };
    
    // COMBINED GRIDBOX EVENTS OBJECT (Enterprise Pattern)
    const GridboxEvents = {
        // Component IDs
        COMPONENT_IDS: COMPONENT_IDS,
        
        // Base class for custom extensions
        BaseEvent: BaseAnalyticsEvent,
        
        // Domain-specific events
        Page: PageAnalyticsEvents,
        Product: ProductAnalyticsEvents,
        Cart: CartAnalyticsEvents,
        Checkout: CheckoutAnalyticsEvents,
        User: UserAnalyticsEvents,
        Promo: PromoAnalyticsEvents,
        Search: SearchAnalyticsEvents,
        Custom: CustomAnalyticsEvents,
        
        // Flat access for backward compatibility
        PageView: PageAnalyticsEvents.pageView,
        ProductView: ProductAnalyticsEvents.productView,
        AddToCart: CartAnalyticsEvents.addToCart,
        RemoveFromCart: CartAnalyticsEvents.removeFromCart,
        UpdateCartQuantity: CartAnalyticsEvents.updateCartQuantity,
        BeginCheckout: CheckoutAnalyticsEvents.beginCheckout,
        Purchase: CheckoutAnalyticsEvents.purchase,
        UserLogin: UserAnalyticsEvents.userLogin,
        CustomEvent: CustomAnalyticsEvents.customEvent
    };
    
    // =========================================
    // EVENT TRACK SERVICE (Enterprise Pattern)
    // =========================================
    const EventTrackService = {
        // Add custom event using event class
        addCustomEvent: function(config) {
            const event = config.context;
            if (!event || !event.eventInfo) {
                console.warn('EventTrackService: Invalid event context');
                return;
            }

            // Add timestamp and pageInstanceId
            event.eventInfo.timeStamp = getTimestamp();
            event.eventInfo.monotonicTimestamp = getMonotonicTimestamp();
            event.eventInfo.pageInstanceId = getPageInstanceId();
            event.eventInfo.pageId = event.eventInfo.pageId || window.gridboxLayer.page.pageInfo.pageID;

            // Add eventId and lifecycle
            event.eventId = generateEventId();
            event.eventIndex = getEventSequence();
            event.context = {
                anonymousId: identityState.anonymousId,
                sessionId: window.gridboxLayer.session ? window.gridboxLayer.session.sessionId : null,
                consentState: consentState
            };
            event._lifecycle = {
                status: EVENT_STATUS.FIRED,
                createdAt: getTimestamp(),
                firedAt: getTimestamp(),
                processedBy: ['EventTrackService'],
                immutable: true
            };

            // Deduplication check
            const dedupKey = generateDedupKey(event.eventInfo, event.attributes);
            if (isDuplicateEvent(dedupKey)) {
                return event;
            }

            // Push to gridboxLayer.event[]
            addToAuditBuffer(event);
            window.gridboxLayer.event.push(event);
            updateDiagnostics('eventsFired', 1);

            // Also push to dataLayer for GTM
            window.dataLayer.push({
                event: event.eventInfo.key,
                eventCategory: event.category.primaryCategory,
                eventAction: event.eventInfo.eventName,
                eventLabel: event.eventInfo.componentId,
                ...EventTrackService._flattenAttributes(event.attributes)
            });

            return event;
        },
        
        // Flatten attributes array to object for dataLayer
        _flattenAttributes: function(attributes) {
            if (!Array.isArray(attributes)) return {};
            return attributes.reduce((acc, attr) => {
                acc[attr.key] = attr.value;
                return acc;
            }, {});
        },
        
        // Create and push event in one call
        track: function(EventClass, data) {
            const event = new EventClass(data);
            return this.addCustomEvent({ context: event });
        }
    };

    // =========================================
    // CONFIGURATION OBSERVER (Enterprise Pattern)
    // Dynamic configuration with observable pattern
    // =========================================
    class ConfigurationObserver {
        constructor(configKey, defaultConfig, configService) {
            this._configKey = configKey;
            this._defaultConfig = defaultConfig;
            this._configService = configService;
            this._subscribers = [];
            this._currentConfig = { ...defaultConfig };
        }
        
        asObservable() {
            return {
                subscribe: (callback) => {
                    this._subscribers.push(callback);
                    callback(this._currentConfig);
                    return {
                        unsubscribe: () => {
                            const idx = this._subscribers.indexOf(callback);
                            if (idx > -1) this._subscribers.splice(idx, 1);
                        }
                    };
                },
                pipe: (...operators) => this.asObservable()
            };
        }
        
        next(newConfig) {
            this._currentConfig = { ...this._defaultConfig, ...newConfig };
            this._subscribers.forEach(cb => cb(this._currentConfig));
        }
        
        getValue() {
            return this._currentConfig;
        }
    }

    // =========================================
    // TRANSLATION KEYS (Enterprise Pattern)
    // Localization support for analytics labels
    // =========================================
    const TranslationKeys = {
        // Page translations
        page: {
            homePageTitle: "gridbox.page.home.title",
            productPageTitle: "gridbox.page.product.title",
            cartPageTitle: "gridbox.page.cart.title",
            checkoutPageTitle: "gridbox.page.checkout.title",
            confirmationPageTitle: "gridbox.page.confirmation.title"
        },
        // Cart translations
        cart: {
            addToCartSuccess: "gridbox.cart.addToCart.success",
            removeFromCartSuccess: "gridbox.cart.removeFromCart.success",
            updateQuantitySuccess: "gridbox.cart.updateQuantity.success",
            cartEmptyMessage: "gridbox.cart.empty.message"
        },
        // Checkout translations
        checkout: {
            beginCheckoutLabel: "gridbox.checkout.begin.label",
            purchaseSuccessLabel: "gridbox.checkout.purchase.success",
            purchaseFailedLabel: "gridbox.checkout.purchase.failed"
        },
        // User translations
        user: {
            loginSuccessLabel: "gridbox.user.login.success",
            logoutSuccessLabel: "gridbox.user.logout.success",
            signupSuccessLabel: "gridbox.user.signup.success"
        },
        // Error translations
        error: {
            genericErrorTitle: "gridbox.error.generic.title",
            networkErrorTitle: "gridbox.error.network.title",
            validationErrorTitle: "gridbox.error.validation.title"
        }
    };

    // =========================================
    // STORE PATTERN (Enterprise Pattern)
    // State management with dispatch/select
    // =========================================
    const GridboxStore = {
        _state: {
            cart: { items: [], total: 0 },
            user: { isLoggedIn: false, profile: null },
            page: { current: '', previous: '' },
            events: [],
            config: {}
        },
        _subscribers: [],
        
        // Get current state
        getState: function() {
            return { ...this._state };
        },
        
        // Select specific state slice
        select: function(selector) {
            if (typeof selector === 'function') {
                return selector(this._state);
            }
            return this._state[selector];
        },
        
        // Dispatch action to update state
        dispatch: function(action) {
            const { type, payload } = action;
            
            switch(type) {
                case 'CART_ADD_ITEM':
                    this._state.cart.items.push(payload);
                    this._state.cart.total = this._state.cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                    break;
                case 'CART_REMOVE_ITEM':
                    this._state.cart.items = this._state.cart.items.filter(item => item.id !== payload.id);
                    this._state.cart.total = this._state.cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                    break;
                case 'CART_UPDATE_QUANTITY':
                    const item = this._state.cart.items.find(i => i.id === payload.id);
                    if (item) item.quantity = payload.quantity;
                    this._state.cart.total = this._state.cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                    break;
                case 'CART_CLEAR':
                    this._state.cart = { items: [], total: 0 };
                    break;
                case 'USER_LOGIN':
                    this._state.user = { isLoggedIn: true, profile: payload };
                    break;
                case 'USER_LOGOUT':
                    this._state.user = { isLoggedIn: false, profile: null };
                    break;
                case 'PAGE_CHANGE':
                    this._state.page.previous = this._state.page.current;
                    this._state.page.current = payload;
                    break;
                case 'EVENT_PUSH':
                    this._state.events.push(payload);
                    break;
                case 'CONFIG_UPDATE':
                    this._state.config = { ...this._state.config, ...payload };
                    break;
            }
            
            // Notify subscribers
            this._subscribers.forEach(cb => cb(this._state, action));
            
            return action;
        },
        
        // Subscribe to state changes
        subscribe: function(callback) {
            this._subscribers.push(callback);
            return () => {
                const idx = this._subscribers.indexOf(callback);
                if (idx > -1) this._subscribers.splice(idx, 1);
            };
        },
        
        // Pipe operator support
        pipe: function(...operators) {
            return this;
        }
    };

    // =========================================
    // SUBSCRIPTION MANAGER (Enterprise Pattern)
    // Manages subscriptions lifecycle
    // =========================================
    class SubscriptionManager {
        constructor() {
            this._subscriptions = [];
        }
        
        add(subscription) {
            this._subscriptions.push(subscription);
            return subscription;
        }
        
        push(subscription) {
            return this.add(subscription);
        }
        
        unsubscribeAll() {
            this._subscriptions.forEach(sub => {
                if (sub && typeof sub.unsubscribe === 'function') {
                    sub.unsubscribe();
                } else if (typeof sub === 'function') {
                    sub();
                }
            });
            this._subscriptions = [];
        }
        
        destroy() {
            this.unsubscribeAll();
        }
    }

    // =========================================
    // RACING F1 SPECIFIC ANALYTICS EVENTS
    // Domain-specific events for racing app
    // =========================================
    const RacingF1ComponentIds = {
        RACE_CALENDAR: "RaceCalendarCont",
        RACE_DETAILS: "RaceDetailsPres",
        TICKET_SELECTOR: "TicketSelectorCont",
        SEAT_MAP: "SeatMapComponent",
        DRIVER_PROFILE: "DriverProfilePres",
        TEAM_PROFILE: "TeamProfilePres",
        MERCHANDISE: "MerchandiseCont",
        HOSPITALITY: "HospitalityCont",
        EXPERIENCE: "ExperienceCont"
    };

    const RacingF1AnalyticsEvents = {
        // Race Events
        raceViewed: class extends BaseAnalyticsEvent {
            constructor(params) {
                super(params);
                this.eventInfo = {
                    key: "RaceViewed",
                    eventName: "Race details viewed",
                    componentId: RacingF1ComponentIds.RACE_DETAILS
                };
                this.category = { primaryCategory: "Display" };
                params.raceName && this.attributes.push({ key: "race_name", value: String(params.raceName) });
                params.raceLocation && this.attributes.push({ key: "race_location", value: String(params.raceLocation) });
                params.raceDate && this.attributes.push({ key: "race_date", value: String(params.raceDate) });
                params.circuitName && this.attributes.push({ key: "circuit_name", value: String(params.circuitName) });
            }
        },
        
        raceSelected: class extends BaseAnalyticsEvent {
            constructor(params) {
                super(params);
                this.eventInfo = {
                    key: "RaceSelected",
                    eventName: "Race selected",
                    componentId: RacingF1ComponentIds.RACE_CALENDAR
                };
                this.category = { primaryCategory: "UserEvent" };
                params.raceName && this.attributes.push({ key: "race_name", value: String(params.raceName) });
                params.raceLocation && this.attributes.push({ key: "race_location", value: String(params.raceLocation) });
            }
        },
        
        // Ticket Events
        ticketSelected: class extends BaseAnalyticsEvent {
            constructor(params) {
                super(params);
                this.eventInfo = {
                    key: "TicketSelected",
                    eventName: "Ticket type selected",
                    componentId: RacingF1ComponentIds.TICKET_SELECTOR
                };
                this.category = { primaryCategory: "UserEvent" };
                params.ticketType && this.attributes.push({ key: "ticket_type", value: String(params.ticketType) });
                params.ticketCategory && this.attributes.push({ key: "ticket_category", value: String(params.ticketCategory) });
                params.standName && this.attributes.push({ key: "stand_name", value: String(params.standName) });
                params.ticketPrice && this.attributes.push({ key: "ticket_price", value: String(params.ticketPrice) });
            }
        },
        
        ticketAddedToCart: class extends BaseAnalyticsEvent {
            constructor(params) {
                super(params);
                this.eventInfo = {
                    key: "TicketAddedToCart",
                    eventName: "Ticket added to cart",
                    componentId: RacingF1ComponentIds.TICKET_SELECTOR
                };
                this.category = { primaryCategory: "UserEvent" };
                params.ticketType && this.attributes.push({ key: "ticket_type", value: String(params.ticketType) });
                params.raceName && this.attributes.push({ key: "race_name", value: String(params.raceName) });
                params.ticketPrice && this.attributes.push({ key: "ticket_price", value: String(params.ticketPrice) });
                params.quantity && this.attributes.push({ key: "quantity", value: String(params.quantity) });
            }
        },
        
        // Seat Map Events
        seatMapViewed: class extends BaseAnalyticsEvent {
            constructor(params) {
                super(params);
                this.eventInfo = {
                    key: "SeatMapViewed",
                    eventName: "Seat map viewed",
                    componentId: RacingF1ComponentIds.SEAT_MAP
                };
                this.category = { primaryCategory: "Display" };
                params.standName && this.attributes.push({ key: "stand_name", value: String(params.standName) });
                params.raceName && this.attributes.push({ key: "race_name", value: String(params.raceName) });
            }
        },
        
        seatSelected: class extends BaseAnalyticsEvent {
            constructor(params) {
                super(params);
                this.eventInfo = {
                    key: "SeatSelected",
                    eventName: "Seat selected",
                    componentId: RacingF1ComponentIds.SEAT_MAP
                };
                this.category = { primaryCategory: "UserEvent" };
                params.seatId && this.attributes.push({ key: "seat_id", value: String(params.seatId) });
                params.row && this.attributes.push({ key: "row", value: String(params.row) });
                params.section && this.attributes.push({ key: "section", value: String(params.section) });
                params.seatPrice && this.attributes.push({ key: "seat_price", value: String(params.seatPrice) });
            }
        },
        
        skipSeatSelection: class extends BaseAnalyticsEvent {
            constructor(params) {
                super(params);
                this.eventInfo = {
                    key: "SkipSeatSelectionClick",
                    eventName: "Click on skip seat selection button",
                    componentId: RacingF1ComponentIds.SEAT_MAP
                };
                this.category = { primaryCategory: "UserEvent" };
            }
        },
        
        // Driver/Team Events
        driverProfileViewed: class extends BaseAnalyticsEvent {
            constructor(params) {
                super(params);
                this.eventInfo = {
                    key: "DriverProfileViewed",
                    eventName: "Driver profile viewed",
                    componentId: RacingF1ComponentIds.DRIVER_PROFILE
                };
                this.category = { primaryCategory: "Display" };
                params.driverName && this.attributes.push({ key: "driver_name", value: String(params.driverName) });
                params.teamName && this.attributes.push({ key: "team_name", value: String(params.teamName) });
                params.driverNumber && this.attributes.push({ key: "driver_number", value: String(params.driverNumber) });
            }
        },
        
        teamProfileViewed: class extends BaseAnalyticsEvent {
            constructor(params) {
                super(params);
                this.eventInfo = {
                    key: "TeamProfileViewed",
                    eventName: "Team profile viewed",
                    componentId: RacingF1ComponentIds.TEAM_PROFILE
                };
                this.category = { primaryCategory: "Display" };
                params.teamName && this.attributes.push({ key: "team_name", value: String(params.teamName) });
            }
        },
        
        // Merchandise Events
        merchandiseViewed: class extends BaseAnalyticsEvent {
            constructor(params) {
                super(params);
                this.eventInfo = {
                    key: "MerchandiseViewed",
                    eventName: "Merchandise item viewed",
                    componentId: RacingF1ComponentIds.MERCHANDISE
                };
                this.category = { primaryCategory: "Display" };
                params.itemName && this.attributes.push({ key: "item_name", value: String(params.itemName) });
                params.itemCategory && this.attributes.push({ key: "item_category", value: String(params.itemCategory) });
                params.teamName && this.attributes.push({ key: "team_name", value: String(params.teamName) });
            }
        },
        
        merchandiseAddedToCart: class extends BaseAnalyticsEvent {
            constructor(params) {
                super(params);
                this.eventInfo = {
                    key: "MerchandiseAddedToCart",
                    eventName: "Merchandise added to cart",
                    componentId: RacingF1ComponentIds.MERCHANDISE
                };
                this.category = { primaryCategory: "UserEvent" };
                params.itemName && this.attributes.push({ key: "item_name", value: String(params.itemName) });
                params.itemPrice && this.attributes.push({ key: "item_price", value: String(params.itemPrice) });
                params.quantity && this.attributes.push({ key: "quantity", value: String(params.quantity) });
            }
        },
        
        // Hospitality/Experience Events
        hospitalityPackageViewed: class extends BaseAnalyticsEvent {
            constructor(params) {
                super(params);
                this.eventInfo = {
                    key: "HospitalityPackageViewed",
                    eventName: "Hospitality package viewed",
                    componentId: RacingF1ComponentIds.HOSPITALITY
                };
                this.category = { primaryCategory: "Display" };
                params.packageName && this.attributes.push({ key: "package_name", value: String(params.packageName) });
                params.packagePrice && this.attributes.push({ key: "package_price", value: String(params.packagePrice) });
                params.raceName && this.attributes.push({ key: "race_name", value: String(params.raceName) });
            }
        },
        
        hospitalityPackageSelected: class extends BaseAnalyticsEvent {
            constructor(params) {
                super(params);
                this.eventInfo = {
                    key: "HospitalityPackageSelected",
                    eventName: "Hospitality package selected",
                    componentId: RacingF1ComponentIds.HOSPITALITY
                };
                this.category = { primaryCategory: "UserEvent" };
                params.packageName && this.attributes.push({ key: "package_name", value: String(params.packageName) });
                params.packagePrice && this.attributes.push({ key: "package_price", value: String(params.packagePrice) });
            }
        },
        
        experienceBooked: class extends BaseAnalyticsEvent {
            constructor(params) {
                super(params);
                this.eventInfo = {
                    key: "ExperienceBooked",
                    eventName: "Experience booked",
                    componentId: RacingF1ComponentIds.EXPERIENCE
                };
                this.category = { primaryCategory: "UserEvent" };
                params.experienceName && this.attributes.push({ key: "experience_name", value: String(params.experienceName) });
                params.experienceType && this.attributes.push({ key: "experience_type", value: String(params.experienceType) });
                params.experiencePrice && this.attributes.push({ key: "experience_price", value: String(params.experiencePrice) });
            }
        },
        
        // Service Events (like TimeToThink pattern)
        serviceAdded: class extends BaseAnalyticsEvent {
            constructor(params) {
                super(params);
                this.eventInfo = {
                    key: "ServiceAdded",
                    eventName: "Service added",
                    componentId: params.componentId || COMPONENT_IDS.CUSTOM
                };
                this.category = { primaryCategory: "UserEvent" };
                params.serviceCode && this.attributes.push({ key: "ServiceCode", value: String(params.serviceCode) });
                params.servicePrice && this.attributes.push({ key: "ServicePrice", value: String(params.servicePrice) });
                params.serviceCurrency && this.attributes.push({ key: "ServiceCurrency", value: String(params.serviceCurrency) });
            }
        },
        
        serviceRemoved: class extends BaseAnalyticsEvent {
            constructor(params) {
                super(params);
                this.eventInfo = {
                    key: "ServiceRemoved",
                    eventName: "Service removed",
                    componentId: params.componentId || COMPONENT_IDS.CUSTOM
                };
                this.category = { primaryCategory: "UserEvent" };
                params.serviceCode && this.attributes.push({ key: "ServiceCode", value: String(params.serviceCode) });
                params.reason && this.attributes.push({ key: "Reason", value: String(params.reason) });
            }
        },
        
        // Navigation Events
        backButtonClicked: class extends BaseAnalyticsEvent {
            constructor(params) {
                super(params);
                this.eventInfo = {
                    key: "ClickPreviousStep",
                    eventName: "Back to previous step",
                    componentId: params.componentId || COMPONENT_IDS.PAGE
                };
                this.category = { primaryCategory: "UserEvent" };
            }
        },
        
        nextStepClicked: class extends BaseAnalyticsEvent {
            constructor(params) {
                super(params);
                this.eventInfo = {
                    key: "ClickNextStep",
                    eventName: "Proceed to next step",
                    componentId: params.componentId || COMPONENT_IDS.PAGE
                };
                this.category = { primaryCategory: "UserEvent" };
            }
        }
    };

    // Add Racing F1 events to GridboxEvents
    GridboxEvents.RacingF1 = RacingF1AnalyticsEvents;
    GridboxEvents.RacingF1ComponentIds = RacingF1ComponentIds;

    // =========================================
    // INITIALIZE GRIDBOX LAYER (Enterprise digitalData Format)
    // Matches exact structure from reference
    // =========================================
    window.gridboxLayer = window.gridboxLayer || {
        // Version info
        version: "2.12.0",
        libVersion: "1.1.0",
        
        // Event array - all events pushed here
        event: [],
        
        // Product array - FlightTicket, AncillaryService, etc.
        product: [],
        
        // Finished flag for booking flow
        finished: false,
        
        // Digital touchpoint metadata
        digitalTouchpoint: {
            category: {
                primaryCategory: "GridBox",
                subCategory: "Booking"
            },
            touchpointInfo: {
                language: "en",
                market: "",
                site: "",
                officeID: "",
                airlineCode: "",
                bookingFlow: "Booking",
                currency: "USD",
                sessionID: ""
            },
            version: {
                solution: "1.0.0",
                content: "1.0.0"
            }
        },
        
        // User array
        user: [{
            profile: [{
                profileInfo: {
                    OS: "",
                    deviceType: "desktop",
                    userAgent: "",
                    loginStatus: false,
                    loginPersistence: false
                },
                attributes: {
                    userType: "guest",
                    customerTier: ""
                }
            }]
        }],
        
        // Transaction data
        transaction: {
            PNR: {
                recLoc: "",
                creationDate: ""
            },
            total: {
                totalPrice: {
                    amount: 0,
                    currency: "USD"
                },
                pricePerTravellerType: [],
                priceBreakdown: {
                    baseFarePrice: {
                        amount: 0,
                        currency: ""
                    },
                    tax: {
                        totalTax: {
                            amount: 0,
                            currency: ""
                        }
                    }
                }
            },
            payment: []
        },
        
        // Search input
        searchInput: {
            category: {
                primaryCategory: ""
            },
            searchInputInfo: {
                flightDetails: [],
                dateTime: "",
                flowType: "STANDARD"
            }
        },
        
        // Page data
        page: {
            pageInfo: {
                pageID: "",
                pageName: ""
            },
            category: {
                primaryCategory: ""
            }
        },
        
        // Offer array
        offer: [],
        
        // Fare family names
        fareFamilyNames: [],
        
        // Traveller array
        traveller: [],
        
        // Cart with enterprise structure
        cart: {
            cartInfo: {
                cartID: "",
                creationDate: ""
            },
            price: {
                priceBreakdown: {
                    tax: {
                        surcharge: {
                            amount: 0,
                            currency: "USD"
                        },
                        totalTax: {
                            amount: 0,
                            currency: "USD"
                        }
                    }
                },
                totalPrice: {
                    currency: "USD",
                    amount: 0
                },
                pricePerTravellerType: []
            },
            item: []
        },
        
        // Upsell booking flow metrics
        upsellBookingFlow: {
            upsellVerticalOutbound: 0,
            upsellHorizontalOutbound: 0,
            upsellVerticalInbound: 0,
            upsellHorizontalInbound: 0,
            upsellHorizontalCart: 0
        },
        
        // Decision ID for analytics
        decisionId: ""
    };

    // =========================================
    // ALIAS: digitalData = gridboxLayer (W3C compatibility)
    // =========================================
    window.digitalData = window.gridboxLayer;

    // =========================================
    // gridbox_data - Flat data object (like utag_data)
    // =========================================
    window.gridbox_data = window.gridbox_data || {};

    // =========================================
    // A5: VERSIONED FRONTEND CONTRACT
    // =========================================
    const GB_CONTRACT_VERSION = '1.0.0';
    const GB_LIB_VERSION = '2.12.0';
    
    // =========================================
    // B5: NAMESPACE GOVERNANCE REGISTRY
    // Allowed namespaces for action_type categories
    // =========================================
    const NAMESPACE_REGISTRY = {
        'navigation': { owner: 'core', description: 'Site navigation events' },
        'ecommerce': { owner: 'commerce', description: 'E-commerce transactions' },
        'product': { owner: 'commerce', description: 'Product interactions' },
        'cart': { owner: 'commerce', description: 'Shopping cart actions' },
        'user': { owner: 'identity', description: 'User identification' },
        'promo': { owner: 'marketing', description: 'Promotion tracking' },
        'form': { owner: 'core', description: 'Form submissions' },
        'error': { owner: 'core', description: 'Error tracking' },
        'performance': { owner: 'core', description: 'Performance metrics' },
        'content': { owner: 'content', description: 'Content interactions' },
        'search': { owner: 'core', description: 'Search actions' },
        'video': { owner: 'media', description: 'Video interactions' },
        'social': { owner: 'marketing', description: 'Social sharing' }
    };
    
    // =========================================
    // A2: COMPONENT OWNERSHIP MODEL
    // Maps components to allowed namespaces
    // =========================================
    const COMPONENT_OWNERSHIP = {
        'header': ['navigation', 'search', 'user'],
        'footer': ['navigation', 'social'],
        'product-card': ['product', 'cart', 'promo'],
        'cart-widget': ['cart', 'ecommerce'],
        'checkout': ['ecommerce', 'form', 'user'],
        'newsletter': ['form', 'user'],
        'promo-banner': ['promo', 'navigation'],
        'search-box': ['search'],
        'video-player': ['video', 'content'],
        'default': ['*'] // Allows all namespaces
    };
    
    // =========================================
    // A3: CONSENT-AWARE EXECUTION GATE
    // =========================================
    const CONSENT_STATES = {
        PENDING: 'pending',
        GRANTED: 'granted',
        DENIED: 'denied',
        PARTIAL: 'partial'
    };
    
    let consentState = CONSENT_STATES.PENDING;
    let consentCategories = {
        analytics: false,
        marketing: false,
        personalization: false,
        functional: true // Always allowed
    };
    let pendingEventQueue = []; // Queue for pre-consent events
    
    function setConsent(state, categories) {
        const previousState = consentState;
        consentState = state;
        
        if (categories) {
            consentCategories = { ...consentCategories, ...categories };
        }
        
        // If consent granted, flush pending queue
        if (state === CONSENT_STATES.GRANTED && previousState === CONSENT_STATES.PENDING) {
            flushPendingEvents();
        }
        
        // Update context
        if (window.gridboxLayer && window.gridboxLayer.context) {
            window.gridboxLayer.context.consentState = consentState;
            window.gridboxLayer.context.consentCategories = consentCategories;
        }
        
        return { state: consentState, categories: consentCategories };
    }
    
    function getConsent() {
        return { state: consentState, categories: consentCategories };
    }
    
    function canFireEvent(eventCategory) {
        if (consentState === CONSENT_STATES.GRANTED) return true;
        if (consentState === CONSENT_STATES.DENIED) return false;
        if (consentState === CONSENT_STATES.PARTIAL) {
            // Check specific category
            if (eventCategory === 'Ecommerce' || eventCategory === 'ProductInteraction') {
                return consentCategories.analytics;
            }
            if (eventCategory === 'UserEvent') {
                return consentCategories.personalization;
            }
        }
        return false; // Pending state - queue event
    }
    
    function flushPendingEvents() {
        if (pendingEventQueue.length === 0) return;
        
        pendingEventQueue.forEach(function(queuedEvent) {
            queuedEvent.status = 'flushed';
            queuedEvent.flushedAt = getTimestamp();
            window.gridboxLayer.event.push(queuedEvent);
        });
        
        diagnostics.eventsFlushed += pendingEventQueue.length;
        pendingEventQueue = [];
    }
    
    // =========================================
    // B7: ANALYTICS OBSERVABILITY & DIAGNOSTICS
    // =========================================
    const diagnostics = {
        eventsCreated: 0,
        eventsFired: 0,
        eventsDropped: 0,
        eventsQueued: 0,
        eventsFlushed: 0,
        whitelistRejections: 0,
        invalidActionTypes: 0,
        schemaValidationFailures: 0,
        namespaceViolations: 0,
        componentViolations: 0,
        deduplicationHits: 0,
        consentBlocked: 0,
        errorsCaught: 0,
        degradedMode: false,
        initTime: 0,
        lastEventTime: null,
        avgProcessingTime: 0,
        totalProcessingTime: 0
    };
    
    function updateDiagnostics(metric, increment) {
        if (diagnostics.hasOwnProperty(metric)) {
            if (typeof increment === 'number') {
                diagnostics[metric] += increment;
            } else {
                diagnostics[metric] = increment;
            }
        }
        diagnostics.lastEventTime = getTimestamp();
    }
    
    function getDiagnostics() {
        return { ...diagnostics };
    }
    
    // =========================================
    // B3: SCHEMA VALIDATION LAYER
    // =========================================
    const VALIDATION_MODE = {
        STRICT: 'strict',  // Block invalid events
        WARN: 'warn',      // Log warning but allow
        OFF: 'off'         // No validation
    };
    
    let validationMode = VALIDATION_MODE.WARN;
    
    const EVENT_SCHEMAS = {
        PageView: {
            required: ['page_name', 'page_url'],
            optional: ['page_type', 'page_category', 'page_path', 'page_referrer']
        },
        Ecommerce: {
            required: ['product_id'],
            optional: ['product_name', 'product_price', 'product_category', 'quantity', 'cart_total']
        },
        UserEvent: {
            required: [],
            optional: ['user_id', 'user_type', 'event_value']
        },
        ProductInteraction: {
            required: ['product_id'],
            optional: ['product_name', 'product_price', 'product_category', 'product_brand']
        },
        Performance: {
            required: [],
            optional: ['page_load_time', 'dom_ready_time', 'server_response_time']
        }
    };
    
    function validateActionType(actionType) {
        if (!actionType || typeof actionType !== 'string') {
            updateDiagnostics('invalidActionTypes', 1);
            return { valid: false, error: 'action_type must be a non-empty string' };
        }
        
        // Must start with prefix
        if (!actionType.startsWith('gb_')) {
            updateDiagnostics('invalidActionTypes', 1);
            return { valid: false, error: 'action_type must start with gb_' };
        }
        
        // Extract parts
        const identifier = actionType.substring(3);
        let trackingPart = identifier;
        
        if (identifier.indexOf('/') !== -1) {
            trackingPart = identifier.split('/').pop();
        }
        
        const parts = trackingPart.split('_');
        if (parts.length !== 3) {
            updateDiagnostics('invalidActionTypes', 1);
            return { valid: false, error: 'action_type must have format gb_category_action_label' };
        }
        
        // Validate namespace
        const namespace = parts[0].toLowerCase();
        if (!NAMESPACE_REGISTRY[namespace] && namespace !== 'page' && namespace !== 'purchase') {
            updateDiagnostics('namespaceViolations', 1);
            return { valid: false, error: 'Unknown namespace: ' + namespace, warning: true };
        }
        
        return { valid: true, namespace: namespace, action: parts[1], label: parts[2] };
    }
    
    function validateEventSchema(category, attributes) {
        if (validationMode === VALIDATION_MODE.OFF) return { valid: true };
        
        const schema = EVENT_SCHEMAS[category];
        if (!schema) return { valid: true }; // No schema defined
        
        const attrMap = {};
        if (Array.isArray(attributes)) {
            attributes.forEach(function(attr) {
                attrMap[attr.key] = attr.value;
            });
        }
        
        const missing = [];
        schema.required.forEach(function(field) {
            if (!attrMap[field] && attrMap[field] !== 0) {
                missing.push(field);
            }
        });
        
        if (missing.length > 0) {
            updateDiagnostics('schemaValidationFailures', 1);
            return { 
                valid: validationMode !== VALIDATION_MODE.STRICT,
                error: 'Missing required fields: ' + missing.join(', ')
            };
        }
        
        return { valid: true };
    }
    
    function validateComponentOwnership(component, namespace) {
        if (!component) return { valid: true };
        
        const allowed = COMPONENT_OWNERSHIP[component] || COMPONENT_OWNERSHIP['default'];
        if (allowed.includes('*') || allowed.includes(namespace)) {
            return { valid: true };
        }
        
        updateDiagnostics('componentViolations', 1);
        return { 
            valid: false, 
            error: 'Component "' + component + '" not allowed to fire namespace "' + namespace + '"'
        };
    }
    
    // =========================================
    // B8: EVENT DEDUPLICATION STRATEGY
    // =========================================
    const DEDUP_WINDOW_MS = 500; // 500ms deduplication window
    const recentEvents = new Map(); // Map of dedup key -> timestamp
    
    function generateDedupKey(eventInfo, attributes) {
        const key = eventInfo.key || eventInfo.eventName;
        const attrStr = attributes ? attributes.map(a => a.key + ':' + a.value).sort().join('|') : '';
        return key + '::' + attrStr;
    }
    
    function isDuplicateEvent(dedupKey) {
        const now = Date.now();
        const lastTime = recentEvents.get(dedupKey);
        
        if (lastTime && (now - lastTime) < DEDUP_WINDOW_MS) {
            updateDiagnostics('deduplicationHits', 1);
            return true;
        }
        
        recentEvents.set(dedupKey, now);
        
        // Clean old entries (keep map size manageable)
        if (recentEvents.size > 100) {
            const cutoff = now - DEDUP_WINDOW_MS * 2;
            recentEvents.forEach(function(time, key) {
                if (time < cutoff) recentEvents.delete(key);
            });
        }
        
        return false;
    }
    
    // =========================================
    // B1: EVENT LIFECYCLE STATE
    // =========================================
    const EVENT_STATUS = {
        CREATED: 'created',
        VALIDATED: 'validated',
        QUEUED: 'queued',
        FIRED: 'fired',
        CONSUMED: 'consumed',
        DROPPED: 'dropped',
        FAILED: 'failed'
    };
    
    function createEventWithLifecycle(eventData) {
        const event = {
            ...eventData,
            _lifecycle: {
                status: EVENT_STATUS.CREATED,
                createdAt: getTimestamp(),
                validatedAt: null,
                firedAt: null,
                consumedAt: null,
                processedBy: [],
                immutable: false
            }
        };
        
        updateDiagnostics('eventsCreated', 1);
        return event;
    }
    
    function updateEventLifecycle(event, status, processor) {
        if (event._lifecycle && !event._lifecycle.immutable) {
            event._lifecycle.status = status;
            event._lifecycle[status + 'At'] = getTimestamp();
            
            if (processor) {
                event._lifecycle.processedBy.push(processor);
            }
            
            // Make immutable after fired
            if (status === EVENT_STATUS.FIRED || status === EVENT_STATUS.CONSUMED) {
                event._lifecycle.immutable = true;
            }

            // Single chokepoint: when an event fires, bridge it to the Adobe
            // event-driven datalayer and advance the session/sequence counters.
            if (status === EVENT_STATUS.FIRED) {
                try {
                    updateSession('event');
                    if (window.gridboxLayer && window.gridboxLayer.context && typeof event.eventIndex === 'number') {
                        window.gridboxLayer.context.eventSequence = event.eventIndex;
                    }
                    if (window.gridboxLayer && window.gridboxLayer.session) {
                        window.gridboxLayer.session.events = (window.gridboxLayer.session.events || 0) + 1;
                    }
                    pushToAdobeDataLayer(event);
                } catch (e) {}
            }
        }
        return event;
    }

    // =========================================
    // ADOBE EVENT-DRIVEN DATALAYER (ACDL) BRIDGE
    // =========================================
    // Flattens a fired GridBox event into the Adobe Client Data Layer format
    // and pushes it to window.adobeDataLayer so Adobe Launch can consume it.
    function pushToAdobeDataLayer(event) {
        if (typeof window === 'undefined') return;
        window.adobeDataLayer = window.adobeDataLayer || [];

        var eventName = (event.eventInfo && event.eventInfo.eventName) || 'gridboxEvent';

        // Flatten the GridBox attributes array ([{key,value}]) into a plain object.
        var attrs = {};
        if (Array.isArray(event.attributes)) {
            event.attributes.forEach(function(a) {
                if (a && a.key !== undefined) attrs[a.key] = a.value;
            });
        }

        var payload = {
            event: eventName,
            eventInfo: {
                eventName: eventName,
                category: event.category ? event.category.primaryCategory : undefined,
                eventIndex: event.eventIndex,
                timeStamp: event.eventInfo ? event.eventInfo.timeStamp : getTimestamp()
            },
            attributes: attrs,
            page: window.gridboxLayer ? window.gridboxLayer.page : undefined,
            user: window.gridboxLayer && window.gridboxLayer.user ? window.gridboxLayer.user[0] : undefined,
            cart: window.gridboxLayer ? window.gridboxLayer.cart : undefined,
            context: window.gridboxLayer ? window.gridboxLayer.context : undefined
        };

        // Purchase events carry the transaction snapshot.
        if (eventName === 'Purchase' && window.gridboxLayer) {
            payload.transaction = window.gridboxLayer.transaction;
        }

        window.adobeDataLayer.push(payload);

        // Broadcast to the validation dashboard (same-origin tabs/windows).
        try {
            if (typeof BroadcastChannel !== 'undefined') {
                var bc = new BroadcastChannel('rf1_analytics');
                bc.postMessage({ type: 'acdl_event', payload: payload, ts: Date.now() });
                bc.close();
            }
        } catch (e) {}
    }
    
    // =========================================
    // B2: STATE vs EVENT SEPARATION (Immutability)
    // =========================================
    function freezeEvent(event) {
        if (event._lifecycle) {
            event._lifecycle.immutable = true;
        }
        return Object.freeze(event);
    }
    
    function isEventImmutable(event) {
        return event._lifecycle && event._lifecycle.immutable;
    }
    
    // =========================================
    // B4: EVENT REPLAY & AUDIT BUFFER
    // =========================================
    const AUDIT_BUFFER_SIZE = 50;
    const auditBuffer = [];
    
    function addToAuditBuffer(event) {
        auditBuffer.unshift({
            event: JSON.parse(JSON.stringify(event)), // Deep clone
            addedAt: getTimestamp()
        });
        
        // Trim to size
        while (auditBuffer.length > AUDIT_BUFFER_SIZE) {
            auditBuffer.pop();
        }
    }
    
    function getAuditBuffer(count) {
        return auditBuffer.slice(0, count || AUDIT_BUFFER_SIZE);
    }
    
    function exportEvents(format) {
        const events = window.gridboxLayer.event.map(function(e) {
            return JSON.parse(JSON.stringify(e));
        });
        
        if (format === 'json') {
            return JSON.stringify(events, null, 2);
        }
        return events;
    }
    
    // =========================================
    // B10: TIME-SERIES EVENT ORDERING
    // =========================================
    let monotonicCounter = 0;
    let lastTimestamp = 0;
    
    function getMonotonicTimestamp() {
        const now = Date.now();
        if (now <= lastTimestamp) {
            monotonicCounter++;
        } else {
            monotonicCounter = 0;
            lastTimestamp = now;
        }
        return now + '.' + String(monotonicCounter).padStart(4, '0');
    }
    
    function getTimestamp() {
        return new Date().toISOString();
    }
    
    // =========================================
    // B6: CROSS-PLATFORM IDENTITY READINESS
    // =========================================
    const IDENTITY_TYPES = {
        ANONYMOUS: 'anonymous',
        AUTHENTICATED: 'authenticated',
        STITCHED: 'stitched'
    };
    
    let identityState = {
        type: IDENTITY_TYPES.ANONYMOUS,
        anonymousId: null,
        authenticatedId: null,
        deviceId: null,
        crossPlatformId: null,
        stitchedAt: null
    };
    
    function setIdentity(type, ids) {
        identityState.type = type;
        if (ids.anonymousId) identityState.anonymousId = ids.anonymousId;
        if (ids.authenticatedId) identityState.authenticatedId = ids.authenticatedId;
        if (ids.deviceId) identityState.deviceId = ids.deviceId;
        if (ids.crossPlatformId) identityState.crossPlatformId = ids.crossPlatformId;
        
        if (type === IDENTITY_TYPES.STITCHED) {
            identityState.stitchedAt = getTimestamp();
        }
        
        return identityState;
    }
    
    function getIdentity() {
        return { ...identityState };
    }
    
    // =========================================
    // A4: ANALYTICS PERFORMANCE BUDGET
    // =========================================
    const PERFORMANCE_BUDGET = {
        maxEventsPerPage: 100,
        maxPayloadSize: 4096, // 4KB
        maxAttributeCount: 50,
        scrollThrottleMs: 100,
        eventQueueLimit: 200
    };
    
    let performanceMetrics = {
        eventsThisPage: 0,
        totalPayloadSize: 0,
        budgetWarnings: []
    };
    
    function checkPerformanceBudget(event) {
        const warnings = [];
        
        // Check event count
        performanceMetrics.eventsThisPage++;
        if (performanceMetrics.eventsThisPage > PERFORMANCE_BUDGET.maxEventsPerPage) {
            warnings.push('Event count exceeds budget: ' + performanceMetrics.eventsThisPage);
        }
        
        // Check payload size
        const payloadSize = JSON.stringify(event).length;
        if (payloadSize > PERFORMANCE_BUDGET.maxPayloadSize) {
            warnings.push('Payload size exceeds budget: ' + payloadSize + ' bytes');
        }
        performanceMetrics.totalPayloadSize += payloadSize;
        
        // Check attribute count
        if (event.attributes && event.attributes.length > PERFORMANCE_BUDGET.maxAttributeCount) {
            warnings.push('Attribute count exceeds budget: ' + event.attributes.length);
        }
        
        // Check queue size
        if (window.gridboxLayer.event.length > PERFORMANCE_BUDGET.eventQueueLimit) {
            warnings.push('Event queue exceeds limit: ' + window.gridboxLayer.event.length);
        }
        
        if (warnings.length > 0) {
            performanceMetrics.budgetWarnings.push({
                eventId: event.eventId,
                warnings: warnings,
                time: getTimestamp()
            });
        }
        
        return { withinBudget: warnings.length === 0, warnings: warnings };
    }
    
    // =========================================
    // A6: ERROR BOUNDARY FOR ANALYTICS
    // =========================================
    function safeExecute(fn, fallback, context) {
        try {
            return fn.call(context);
        } catch (e) {
            updateDiagnostics('errorsCaught', 1);
            console.warn('[GridBox Analytics] Error caught:', e.message);
            
            // Push error event
            if (window.gridboxLayer && window.gridboxLayer.event) {
                window.gridboxLayer.event.push({
                    eventId: generateEventId(),
                    category: { primaryCategory: 'Error' },
                    eventInfo: {
                        eventName: 'AnalyticsError',
                        key: 'gb_error_internal',
                        timeStamp: getTimestamp()
                    },
                    attributes: [
                        { key: 'error_message', value: e.message },
                        { key: 'error_type', value: 'internal' }
                    ]
                });
            }
            
            return typeof fallback === 'function' ? fallback() : fallback;
        }
    }
    
    // =========================================
    // B9: GRACEFUL DEGRADATION MODE
    // =========================================
    let degradedMode = false;
    let storageAvailable = true;
    
    function checkStorageAvailability() {
        try {
            const test = '__gb_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }
    
    function enterDegradedMode(reason) {
        degradedMode = true;
        diagnostics.degradedMode = true;
        console.warn('[GridBox Analytics] Entering degraded mode:', reason);
        
        // Use in-memory fallbacks
        return {
            degraded: true,
            reason: reason,
            capabilities: {
                localStorage: storageAvailable,
                sessionStorage: checkSessionStorage(),
                cookies: navigator.cookieEnabled
            }
        };
    }
    
    function checkSessionStorage() {
        try {
            const test = '__gb_test__';
            sessionStorage.setItem(test, test);
            sessionStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }
    
    // Check storage on load
    storageAvailable = checkStorageAvailability();
    if (!storageAvailable) {
        enterDegradedMode('localStorage unavailable');
    }
    
    // =========================================
    // A1: SPA STATE AWARENESS LAYER
    // =========================================
    let currentRoute = window.location.pathname;
    let routeHistory = [];
    let spaMode = false;
    
    function initSPAObserver() {
        // Listen for popstate (browser back/forward)
        window.addEventListener('popstate', function(event) {
            handleRouteChange('popstate');
        });
        
        // Listen for hashchange
        window.addEventListener('hashchange', function(event) {
            handleRouteChange('hashchange');
        });
        
        // Intercept pushState and replaceState
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;
        
        history.pushState = function() {
            originalPushState.apply(this, arguments);
            handleRouteChange('pushState');
        };
        
        history.replaceState = function() {
            originalReplaceState.apply(this, arguments);
            handleRouteChange('replaceState');
        };
        
        spaMode = true;
    }
    
    function handleRouteChange(trigger) {
        const newRoute = window.location.pathname + window.location.hash;
        
        if (newRoute !== currentRoute) {
            const previousRoute = currentRoute;
            currentRoute = newRoute;
            
            // Add to history
            routeHistory.push({
                from: previousRoute,
                to: newRoute,
                trigger: trigger,
                timestamp: getTimestamp()
            });
            
            // Generate new page instance ID
            currentPageInstanceId = Date.now().toString();
            
            // Reset page-level metrics
            performanceMetrics.eventsThisPage = 0;
            maxScrollDepth = 0;
            pageStartTime = Date.now();
            
            // Update context
            if (window.gridboxLayer && window.gridboxLayer.context) {
                window.gridboxLayer.context.pageInstanceId = currentPageInstanceId;
                window.gridboxLayer.context.previousRoute = previousRoute;
            }
            
            // Fire SPA navigation event
            if (window.gridboxLayer) {
                window.gridboxLayer.event.push({
                    eventId: generateEventId(),
                    eventIndex: getEventSequence(),
                    category: { primaryCategory: 'PageView' },
                    eventInfo: {
                        eventName: 'SPANavigation',
                        key: 'gb_page_spa_navigation',
                        pageId: newRoute,
                        pageInstanceId: currentPageInstanceId,
                        timeStamp: getTimestamp()
                    },
                    context: {
                        anonymousId: identityState.anonymousId,
                        sessionId: window.gridboxLayer.session ? window.gridboxLayer.session.sessionId : null,
                        trigger: trigger
                    },
                    attributes: [
                        { key: 'from_route', value: previousRoute },
                        { key: 'to_route', value: newRoute },
                        { key: 'trigger', value: trigger }
                    ]
                });
            }
        }
    }
    
    function getRouteHistory() {
        return [...routeHistory];
    }
    
    // =========================================
    // A7: DEFERRED INITIALIZATION SUPPORT
    // =========================================
    const INIT_STATUS = {
        PENDING: 'pending',
        READY: 'ready',
        FAILED: 'failed'
    };
    
    let initStatus = INIT_STATUS.PENDING;
    let initCallbacks = [];
    let preInitQueue = [];
    
    function onReady(callback) {
        if (initStatus === INIT_STATUS.READY) {
            callback();
        } else {
            initCallbacks.push(callback);
        }
    }
    
    function queuePreInitEvent(method, args) {
        if (initStatus === INIT_STATUS.PENDING) {
            preInitQueue.push({ method: method, args: args, queuedAt: Date.now() });
            return true;
        }
        return false;
    }
    
    function processPreInitQueue(context) {
        preInitQueue.forEach(function(item) {
            if (typeof context[item.method] === 'function') {
                context[item.method].apply(context, item.args);
            }
        });
        preInitQueue = [];
    }
    
    function setInitStatus(status) {
        initStatus = status;
        
        if (status === INIT_STATUS.READY) {
            initCallbacks.forEach(function(cb) {
                safeExecute(cb, null);
            });
            initCallbacks = [];
        }
    }
    
    // =========================================
    // UNIQUE USER ID GENERATION
    // Persistent anonymous ID stored in localStorage
    // =========================================
    const GB_USER_ID_KEY = 'gb_anonymous_id';
    const GB_SESSION_KEY = 'gb_session';
    const GB_SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
    
    function generateUUID() {
        // Generate RFC4122-compliant UUID v4
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0;
            var v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    
    function getAnonymousId() {
        try {
            var id = localStorage.getItem(GB_USER_ID_KEY);
            if (!id) {
                id = 'anon_' + generateUUID();
                localStorage.setItem(GB_USER_ID_KEY, id);
            }
            return id;
        } catch (e) {
            // Fallback for private browsing
            return 'anon_' + generateUUID();
        }
    }
    
    // =========================================
    // SESSION MANAGEMENT
    // =========================================
    function getSession() {
        try {
            var sessionData = JSON.parse(localStorage.getItem(GB_SESSION_KEY) || '{}');
            var now = Date.now();
            
            // Check if session expired
            if (!sessionData.id || (now - sessionData.lastActivity) > GB_SESSION_TIMEOUT) {
                // Create new session
                sessionData = {
                    id: 'sess_' + generateUUID(),
                    startTime: now,
                    lastActivity: now,
                    pageViews: 0,
                    events: 0,
                    isNew: true
                };
            } else {
                sessionData.lastActivity = now;
                sessionData.isNew = false;
            }
            
            localStorage.setItem(GB_SESSION_KEY, JSON.stringify(sessionData));
            return sessionData;
        } catch (e) {
            return {
                id: 'sess_' + Date.now(),
                startTime: Date.now(),
                lastActivity: Date.now(),
                pageViews: 0,
                events: 0,
                isNew: true
            };
        }
    }
    
    function updateSession(type) {
        try {
            var sessionData = JSON.parse(localStorage.getItem(GB_SESSION_KEY) || '{}');
            sessionData.lastActivity = Date.now();
            if (type === 'pageview') sessionData.pageViews++;
            if (type === 'event') sessionData.events++;
            localStorage.setItem(GB_SESSION_KEY, JSON.stringify(sessionData));
        } catch (e) {}
    }
    
    // Initialize user and session
    const anonymousId = getAnonymousId();
    const sessionData = getSession();
    
    // =========================================
    // EVENT SEQUENCING
    // =========================================
    let eventSequence = 0;
    function getEventSequence() {
        return ++eventSequence;
    }
    
    // =========================================
    // UTM PARAMETER CAPTURE
    // =========================================
    function getUTMParameters() {
        var params = {};
        var search = window.location.search;
        if (!search) return params;
        
        var utmParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id', 'gclid', 'fbclid'];
        var urlParams = new URLSearchParams(search);
        
        utmParams.forEach(function(param) {
            var value = urlParams.get(param);
            if (value) params[param] = value;
        });
        
        // Store UTM params for session
        if (Object.keys(params).length > 0) {
            try {
                localStorage.setItem('gb_utm_params', JSON.stringify(params));
            } catch (e) {}
        } else {
            // Try to get from storage (for subsequent page views)
            try {
                var stored = localStorage.getItem('gb_utm_params');
                if (stored) params = JSON.parse(stored);
            } catch (e) {}
        }
        
        return params;
    }
    
    const utmParams = getUTMParameters();
    
    // =========================================
    // PERFORMANCE METRICS
    // =========================================
    function getPerformanceMetrics() {
        var metrics = {};
        
        if (window.performance && window.performance.timing) {
            var timing = window.performance.timing;
            var navStart = timing.navigationStart;
            
            metrics.pageLoadTime = timing.loadEventEnd - navStart;
            metrics.domReadyTime = timing.domContentLoadedEventEnd - navStart;
            metrics.dnsTime = timing.domainLookupEnd - timing.domainLookupStart;
            metrics.tcpTime = timing.connectEnd - timing.connectStart;
            metrics.serverResponseTime = timing.responseEnd - timing.requestStart;
            metrics.domInteractiveTime = timing.domInteractive - navStart;
        }
        
        // Navigation type
        if (window.performance && window.performance.navigation) {
            var navType = window.performance.navigation.type;
            metrics.navigationType = navType === 0 ? 'navigate' : 
                                    navType === 1 ? 'reload' : 
                                    navType === 2 ? 'back_forward' : 'other';
        }
        
        return metrics;
    }
    
    // =========================================
    // ENHANCED DEVICE/BROWSER DETECTION
    // =========================================
    function getDeviceInfo() {
        var ua = navigator.userAgent;
        var info = {
            userAgent: ua,
            language: navigator.language || navigator.userLanguage || 'en',
            languages: (navigator.languages || []).join(','),
            cookieEnabled: navigator.cookieEnabled,
            doNotTrack: navigator.doNotTrack === '1' || navigator.doNotTrack === 'yes',
            online: navigator.onLine,
            screenWidth: screen.width,
            screenHeight: screen.height,
            screenColorDepth: screen.colorDepth,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            devicePixelRatio: window.devicePixelRatio || 1,
            touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0
        };
        
        // OS Detection
        if (/Windows NT 10/.test(ua)) info.os = 'Windows 10';
        else if (/Windows NT 6.3/.test(ua)) info.os = 'Windows 8.1';
        else if (/Windows NT 6.2/.test(ua)) info.os = 'Windows 8';
        else if (/Windows/.test(ua)) info.os = 'Windows';
        else if (/Mac OS X ([\d_]+)/.test(ua)) info.os = 'macOS ' + RegExp.$1.replace(/_/g, '.');
        else if (/Android ([\d.]+)/.test(ua)) info.os = 'Android ' + RegExp.$1;
        else if (/iPhone OS ([\d_]+)/.test(ua)) info.os = 'iOS ' + RegExp.$1.replace(/_/g, '.');
        else if (/iPad.*OS ([\d_]+)/.test(ua)) info.os = 'iPadOS ' + RegExp.$1.replace(/_/g, '.');
        else if (/Linux/.test(ua)) info.os = 'Linux';
        else info.os = 'Unknown';
        
        // Browser Detection
        if (/Edg\/([\d.]+)/.test(ua)) info.browser = 'Edge ' + RegExp.$1;
        else if (/Chrome\/([\d.]+)/.test(ua) && !/Edg/.test(ua)) info.browser = 'Chrome ' + RegExp.$1;
        else if (/Firefox\/([\d.]+)/.test(ua)) info.browser = 'Firefox ' + RegExp.$1;
        else if (/Safari\/([\d.]+)/.test(ua) && !/Chrome/.test(ua)) info.browser = 'Safari ' + (/Version\/([\d.]+)/.test(ua) ? RegExp.$1 : '');
        else if (/MSIE ([\d.]+)/.test(ua) || /Trident/.test(ua)) info.browser = 'IE';
        else info.browser = 'Unknown';
        
        // Device Type
        if (/Mobile|Android.*Mobile|iPhone|iPod/.test(ua)) info.deviceType = 'mobile';
        else if (/iPad|Android(?!.*Mobile)|Tablet/.test(ua)) info.deviceType = 'tablet';
        else info.deviceType = 'desktop';
        
        // Bot detection
        info.isBot = /bot|crawler|spider|crawling|googlebot|bingbot|yandex|baidu/i.test(ua);
        
        return info;
    }
    
    const deviceInfo = getDeviceInfo();
    
    // =========================================
    // ENGAGEMENT TRACKING
    // =========================================
    let pageStartTime = Date.now();
    let maxScrollDepth = 0;
    let isPageVisible = true;
    let totalVisibleTime = 0;
    let lastVisibleTime = Date.now();
    
    function getTimeOnPage() {
        return Date.now() - pageStartTime;
    }
    
    function getScrollDepth() {
        var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        var docHeight = Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight
        ) - window.innerHeight;
        
        if (docHeight <= 0) return 100;
        
        var depth = Math.round((scrollTop / docHeight) * 100);
        if (depth > maxScrollDepth) maxScrollDepth = depth;
        return maxScrollDepth;
    }
    
    // Track scroll depth
    window.addEventListener('scroll', function() {
        getScrollDepth();
    }, { passive: true });
    
    // Track visibility
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            totalVisibleTime += Date.now() - lastVisibleTime;
            isPageVisible = false;
        } else {
            lastVisibleTime = Date.now();
            isPageVisible = true;
        }
    });
    
    function getEngagementMetrics() {
        return {
            timeOnPage: getTimeOnPage(),
            maxScrollDepth: maxScrollDepth,
            totalVisibleTime: isPageVisible ? totalVisibleTime + (Date.now() - lastVisibleTime) : totalVisibleTime,
            isPageVisible: isPageVisible
        };
    }
    
    // =========================================
    // HELPER: Generate unique event ID
    // =========================================
    function generateEventId() {
        return 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    // Generate cart ID in enterprise format (16 char alphanumeric)
    function generateCartId() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 16; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // =========================================
    // HELPER: Get current timestamp
    // =========================================
    function getTimestamp() {
        return new Date().toISOString();
    }

    // =========================================
    // HELPER: Get page instance ID (for SPA)
    // =========================================
    let currentPageInstanceId = Date.now().toString();
    function getPageInstanceId() {
        return currentPageInstanceId;
    }

    // =========================================
    // ANALYTICS CORE OBJECT
    // =========================================
    const GridBoxAnalytics = {
        
        // Configuration
        config: {
            debug: false,
            eventPrefix: 'gb_',
            trackAttribute: 'data-track',
            dataLayerEvent: 'retail_event'
        },

        // =========================================
        // 5. WHITELIST FILTER FUNCTION
        // =========================================
        // Iterate payload.CD
        // Only copy keys present in the whitelist
        // Drop everything else silently
        
        filterByWhitelist: function(cdObject) {
            if (!cdObject || typeof cdObject !== 'object') {
                return {};
            }
            
            const filtered = {};
            
            for (const key in cdObject) {
                if (cdObject.hasOwnProperty(key)) {
                    // Only copy keys present in the whitelist
                    if (CD_WHITELIST.indexOf(key) !== -1) {
                        filtered[key] = cdObject[key];
                    }
                    // Drop everything else silently - no logging
                }
            }
            
            return filtered;
        },

        // =========================================
        // 6. FIRE OR DROP DECISION
        // =========================================
        // fire = true ONLY if:
        //   - rf1 prefix exists
        //   - split length === 3
        // Otherwise: do nothing
        
        shouldFire: function(actionType) {
            // Check rf1 prefix exists
            if (!actionType || typeof actionType !== 'string') {
                return false;
            }
            
            if (!actionType.startsWith(this.config.eventPrefix)) {
                return false;
            }
            
            // Extract the identifier part after rf1_
            const identifier = actionType.substring(this.config.eventPrefix.length);
            
            // Handle namespace format: namespace/category_action_label
            let trackingPart = identifier;
            if (identifier.indexOf('/') !== -1) {
                trackingPart = identifier.split('/').pop();
            }
            
            // Split and check for exactly 3 parts
            const parts = trackingPart.split('_');
            
            return parts.length === 3;
        },

        // =========================================
        // 3. EVENT CALLBACK (rf1EventCallback)
        // =========================================
        // Input: action_type (string), payload object with optional CD map
        // Logic:
        //   - Process ONLY events where action_type starts with "rf1"
        //   - Split the string: category_action_label
        //   - Only proceed if exactly 3 parts exist
        //   - Normalize: replace "-" with spaces, lowercase as needed
        // Set: eventCategory, eventAction, eventLabel, eventName
        
        eventCallback: function(actionType, payload) {
            payload = payload || {};
            
            // Process ONLY events where action_type starts with "rf1"
            if (!actionType || !actionType.startsWith(this.config.eventPrefix)) {
                this.logDebug('DROPPED: action_type does not start with rf1', { actionType });
                return false;
            }
            
            // Extract the identifier part after rf1_
            const identifier = actionType.substring(this.config.eventPrefix.length);
            
            // Handle namespace format: namespace/category_action_label
            let namespace = null;
            let trackingPart = identifier;
            
            if (identifier.indexOf('/') !== -1) {
                const nsParts = identifier.split('/');
                namespace = nsParts[0];
                trackingPart = nsParts[1];
            }
            
            // Split the string: category_action_label
            const parts = trackingPart.split('_');
            
            // Only proceed if exactly 3 parts exist
            if (parts.length !== 3) {
                this.logDebug('DROPPED: split length !== 3', { actionType, parts });
                return false;
            }
            
            // Extract category, action, label
            let category = parts[0];
            let action = parts[1];
            let label = parts[2];
            
            // Normalize: replace "-" with spaces, lowercase as needed
            const normalize = function(str) {
                return str.replace(/-/g, ' ').toLowerCase();
            };
            
            const eventCategory = normalize(category);
            const eventAction = normalize(action);
            const eventLabel = normalize(label);
            const eventName = eventLabel; // Same as label
            
            // =========================================
            // 4. AUTO FLAGS (MATCH LEGACY)
            // =========================================
            let autoFlags = {};
            
            // If action contains "click" or "view":
            // set ga_eventClick or ga_eventView = "1"
            if (action.toLowerCase().indexOf('click') !== -1) {
                autoFlags.ga_eventClick = '1';
            }
            if (action.toLowerCase().indexOf('view') !== -1) {
                autoFlags.ga_eventView = '1';
            }
            
            // If payload.CD.ga_errorMessage exists:
            // set error_counter = "1"
            if (payload.CD && payload.CD.ga_errorMessage) {
                autoFlags.error_counter = '1';
            }
            
            // =========================================
            // 5. APPLY WHITELIST FILTERING
            // =========================================
            const filteredCD = this.filterByWhitelist(payload.CD || {});
            
            // =========================================
            // 6. FIRE OR DROP DECISION
            // =========================================
            const shouldFire = this.shouldFire(actionType);
            
            if (!shouldFire) {
                this.logDebug('DROPPED: fire decision failed', { actionType });
                return false;
            }
            
            // =========================================
            // 8. FINAL OUTPUT (SAME ROLE AS utag.link)
            // =========================================
            // Push ONE event object to dataLayer
            const eventObject = {
                event: this.config.dataLayerEvent,
                action_type: actionType,
                eventCategory: eventCategory,
                eventAction: eventAction,
                eventLabel: eventLabel,
                eventName: eventName,
                ...autoFlags,
                ...filteredCD
            };
            
            // Add namespace if present
            if (namespace) {
                eventObject.eventNamespace = namespace;
            }
            
            // Push to GTM dataLayer
            window.dataLayer.push(eventObject);
            
            // Push to gridboxLayer event array (W3C format with lifecycle)
            const w3cEvent = createEventWithLifecycle({
                eventId: generateEventId(),
                eventIndex: getEventSequence(),
                category: {
                    primaryCategory: "UserEvent"
                },
                eventInfo: {
                    eventName: eventName,
                    key: actionType,
                    pageId: window.gridboxLayer.page.pageInfo.pageID,
                    pageInstanceId: getPageInstanceId(),
                    timeStamp: getTimestamp(),
                    monotonicTimestamp: getMonotonicTimestamp()
                },
                context: {
                    anonymousId: identityState.anonymousId,
                    sessionId: window.gridboxLayer.session ? window.gridboxLayer.session.sessionId : null,
                    consentState: consentState,
                    consentCategories: { ...consentCategories }
                },
                attributes: [
                    { key: "eventCategory", value: eventCategory },
                    { key: "eventAction", value: eventAction },
                    { key: "eventLabel", value: eventLabel }
                ].concat(Object.keys(filteredCD).map(function(key) {
                    return { key: key, value: String(filteredCD[key]) };
                }))
            });

            // Deduplication check
            const dedupKey = generateDedupKey(w3cEvent.eventInfo, w3cEvent.attributes);
            if (isDuplicateEvent(dedupKey)) {
                updateEventLifecycle(w3cEvent, EVENT_STATUS.DROPPED, 'dedup');
                this.logDebug('DEDUPED: event dropped', { actionType, dedupKey });
                return false;
            }

            updateEventLifecycle(w3cEvent, EVENT_STATUS.FIRED, 'eventCallback');
            checkPerformanceBudget(w3cEvent);
            addToAuditBuffer(w3cEvent);
            window.gridboxLayer.event.push(Object.freeze(w3cEvent));
            updateDiagnostics('eventsFired', 1);

            this.logDebug('FIRED: retail_event pushed to dataLayer', eventObject);
            this.updateDebugPanel(eventObject, true);

            return true;
        },

        // =========================================
        // 7. LINK CALLBACK (rf1LinkCallback)
        // =========================================
        // Implements a SECOND function for special events:
        //   - Accepts category + structured payload
        //   - Manually sets: eventCategory, eventAction, eventLabel, eventValue
        //   - Adds promotion / rank / price logic
        //   - Applies the SAME whitelist filtering
        //   - Passes final payload through the SAME fire logic
        // NO bypass of validation is allowed.
        
        linkCallback: function(category, structuredPayload) {
            structuredPayload = structuredPayload || {};
            
            // Build action_type from category and action
            const action = structuredPayload.action || 'interaction';
            const label = structuredPayload.label || 'unknown';
            
            // Construct the identifier
            const identifier = category + '_' + action + '_' + label;
            const actionType = this.config.eventPrefix + identifier;
            
            // Validate through same fire logic - NO bypass of validation
            if (!this.shouldFire(actionType)) {
                this.logDebug('LINK DROPPED: fire decision failed', { actionType });
                return false;
            }
            
            // Normalize function
            const normalize = function(str) {
                return String(str).replace(/-/g, ' ').toLowerCase();
            };
            
            // Manually set event properties
            const eventCategory = normalize(category);
            const eventAction = normalize(action);
            const eventLabel = normalize(label);
            const eventValue = structuredPayload.value || null;
            
            // =========================================
            // PROMOTION / RANK / PRICE LOGIC
            // =========================================
            const promoData = {};
            
            if (structuredPayload.promotion) {
                const promo = structuredPayload.promotion;
                if (promo.id) promoData.promo_id = promo.id;
                if (promo.name) promoData.promo_name = promo.name;
                if (promo.creative) promoData.promo_creative = promo.creative;
                if (promo.position) promoData.promo_position = String(promo.position);
            }
            
            if (structuredPayload.rank !== undefined) {
                promoData.product_position = String(structuredPayload.rank);
            }
            
            if (structuredPayload.price !== undefined) {
                promoData.product_price = String(structuredPayload.price);
            }
            
            // =========================================
            // 4. AUTO FLAGS (MATCH LEGACY)
            // =========================================
            let autoFlags = {};
            
            if (action.toLowerCase().indexOf('click') !== -1) {
                autoFlags.ga_eventClick = '1';
            }
            if (action.toLowerCase().indexOf('view') !== -1) {
                autoFlags.ga_eventView = '1';
            }
            
            // Check for error message in CD
            const cd = structuredPayload.CD || {};
            if (cd.ga_errorMessage) {
                autoFlags.error_counter = '1';
            }
            
            // =========================================
            // 5. APPLY WHITELIST FILTERING
            // =========================================
            // Merge promo data with CD before filtering
            const mergedCD = { ...cd, ...promoData };
            const filteredCD = this.filterByWhitelist(mergedCD);
            
            // =========================================
            // 8. FINAL OUTPUT
            // =========================================
            const eventObject = {
                event: this.config.dataLayerEvent,
                action_type: actionType,
                eventCategory: eventCategory,
                eventAction: eventAction,
                eventLabel: eventLabel,
                eventName: eventLabel,
                ...autoFlags,
                ...filteredCD
            };
            
            // Add eventValue to filtered data if provided
            if (eventValue !== null && eventValue !== undefined) {
                filteredCD.eventValue = eventValue;
            }
            
            // Push to GTM dataLayer
            window.dataLayer.push(eventObject);
            
            // Push to gridboxLayer event array (W3C format with lifecycle)
            const w3cLinkEvent = createEventWithLifecycle({
                eventId: generateEventId(),
                eventIndex: getEventSequence(),
                category: {
                    primaryCategory: "UserEvent"
                },
                eventInfo: {
                    eventName: eventLabel || eventAction,
                    key: actionType,
                    pageId: window.gridboxLayer.page.pageInfo.pageID,
                    pageInstanceId: getPageInstanceId(),
                    timeStamp: getTimestamp(),
                    monotonicTimestamp: getMonotonicTimestamp()
                },
                context: {
                    anonymousId: identityState.anonymousId,
                    sessionId: window.gridboxLayer.session ? window.gridboxLayer.session.sessionId : null,
                    consentState: consentState,
                    consentCategories: { ...consentCategories }
                },
                attributes: [
                    { key: "eventCategory", value: eventCategory },
                    { key: "eventAction", value: eventAction },
                    { key: "eventLabel", value: eventLabel }
                ].concat(Object.keys(filteredCD).map(function(key) {
                    return { key: key, value: String(filteredCD[key]) };
                }))
            });

            // Deduplication check
            const linkDedupKey = generateDedupKey(w3cLinkEvent.eventInfo, w3cLinkEvent.attributes);
            if (isDuplicateEvent(linkDedupKey)) {
                updateEventLifecycle(w3cLinkEvent, EVENT_STATUS.DROPPED, 'dedup');
                this.logDebug('LINK DEDUPED: event dropped', { actionType, linkDedupKey });
                return false;
            }

            updateEventLifecycle(w3cLinkEvent, EVENT_STATUS.FIRED, 'linkCallback');
            checkPerformanceBudget(w3cLinkEvent);
            addToAuditBuffer(w3cLinkEvent);
            window.gridboxLayer.event.push(Object.freeze(w3cLinkEvent));
            updateDiagnostics('eventsFired', 1);

            this.logDebug('LINK FIRED: retail_event pushed to dataLayer', eventObject);
            this.updateDebugPanel(eventObject, true);

            return true;
        },

        // =========================================
        // 2. EVENT EMISSION
        // =========================================
        // When an interaction occurs, the site must emit an internal event:
        //   action_type = "rf1_" + data-track
        // NO validation happens here
        // This only forwards the raw intent
        
        emitEvent: function(trackValue, payload) {
            // Build action_type: "rf1_" + data-track
            const actionType = this.config.eventPrefix + trackValue;
            
            // NO validation happens here - only forwards the raw intent
            // Validation happens in eventCallback
            
            this.logDebug('EMIT: rf1 event', { actionType, payload });
            
            // Forward to event callback for processing
            return this.eventCallback(actionType, payload);
        },

        // =========================================
        // 1. CLICK LISTENER (data-track)
        // =========================================
        // Website elements use ONE attribute: data-track
        // Value format: <category>_<action>_<label> 
        //           OR: <namespace>/<category>_<action>_<label>
        // The attribute VALUE MAY CHANGE based on action
        
        initClickListener: function() {
            const self = this;
            const trackAttr = this.config.trackAttribute;
            
            // Use event delegation on document body
            document.addEventListener('click', function(event) {
                // Find the closest element with data-track
                const element = event.target.closest('[' + trackAttr + ']');
                
                if (!element) {
                    return;
                }
                
                // Read the data-track value
                // The value MAY CHANGE based on action
                const trackValue = element.getAttribute(trackAttr);
                
                if (!trackValue) {
                    return;
                }
                
                // Extract additional data from element if present
                const payload = {
                    CD: {}
                };
                
                // Check for product data attributes (common e-commerce pattern)
                if (element.dataset.productId) {
                    payload.CD.product_id = element.dataset.productId;
                }
                if (element.dataset.productName) {
                    payload.CD.product_name = element.dataset.productName;
                }
                if (element.dataset.productPrice) {
                    payload.CD.product_price = element.dataset.productPrice;
                }
                if (element.dataset.productCategory) {
                    payload.CD.product_category = element.dataset.productCategory;
                }
                if (element.dataset.productBrand) {
                    payload.CD.product_brand = element.dataset.productBrand;
                }
                if (element.dataset.productPosition) {
                    payload.CD.product_position = element.dataset.productPosition;
                }
                
                // Emit the rf1 event
                self.emitEvent(trackValue, payload);
                
            }, true); // Use capture phase for reliability
            
            this.logDebug('Click listener initialized');
        },

        // =========================================
        // VIEW TRACKING (for product impressions)
        // =========================================
        trackView: function(trackValue, payload) {
            // Emit view event using the same flow
            return this.emitEvent(trackValue, payload);
        },

        // =========================================
        // DEBUG UTILITIES
        // =========================================
        logDebug: function(message, data) {
            if (!this.config.debug) {
                return;
            }
            
            const timestamp = new Date().toISOString().substr(11, 12);
            const prefix = '%c[RacingF1 Analytics]';
            const style = 'color: #00f0ff; font-weight: bold;';
            
            if (data) {
                console.log(prefix, style, timestamp, message, data);
            } else {
                console.log(prefix, style, timestamp, message);
            }
        },

        updateDebugPanel: function(eventObject, fired) {
            const output = document.getElementById('debug-output');
            if (!output) return;
            
            const eventDiv = document.createElement('div');
            eventDiv.className = 'debug-event' + (fired ? '' : ' dropped');
            
            const nameDiv = document.createElement('div');
            nameDiv.className = 'debug-event-name';
            nameDiv.textContent = (fired ? '✓ ' : '✗ ') + eventObject.action_type;
            
            const dataDiv = document.createElement('div');
            dataDiv.className = 'debug-event-data';
            dataDiv.textContent = JSON.stringify(eventObject, null, 2);
            
            eventDiv.appendChild(nameDiv);
            eventDiv.appendChild(dataDiv);
            
            // Prepend to show newest first
            output.insertBefore(eventDiv, output.firstChild);
        },

        // =========================================
        // GRIDBOX.VIEW() - Page View Tracking (like utag.view)
        // =========================================
        // ONLY for SPA - manual page view tracking
        view: function(data, callback) {
            const self = this;
            data = data || {};
            
            // Merge with gridbox_data
            const mergedData = Object.assign({}, window.gridbox_data, data);
            
            // Build GTM dataLayer page view event
            const gtmPageViewEvent = {
                event: 'gridbox_page_view',
                page_name: mergedData.page_name || document.title,
                page_type: mergedData.page_type || 'general',
                page_category: mergedData.page_category || '',
                page_url: mergedData.page_url || window.location.href,
                page_path: mergedData.page_path || window.location.pathname
            };
            
            // Push to GTM dataLayer
            window.dataLayer.push(gtmPageViewEvent);
            
            // Push PageView event to gridboxLayer (W3C format with lifecycle)
            const pageViewEvent = createEventWithLifecycle({
                eventId: generateEventId(),
                eventIndex: getEventSequence(),
                category: {
                    primaryCategory: "PageView"
                },
                eventInfo: {
                    eventName: "PageView",
                    key: "gb_page_view",
                    pageId: mergedData.page_id || mergedData.page_type || "UNKNOWN",
                    pageInstanceId: getPageInstanceId(),
                    timeStamp: getTimestamp(),
                    monotonicTimestamp: getMonotonicTimestamp()
                },
                context: {
                    anonymousId: identityState.anonymousId,
                    sessionId: window.gridboxLayer.session ? window.gridboxLayer.session.sessionId : null,
                    consentState: consentState,
                    consentCategories: { ...consentCategories }
                },
                attributes: [
                    { key: "page_name", value: mergedData.page_name || document.title },
                    { key: "page_type", value: mergedData.page_type || "general" },
                    { key: "page_url", value: mergedData.page_url || window.location.href }
                ]
            });
            updateEventLifecycle(pageViewEvent, EVENT_STATUS.FIRED, 'gridbox.view');
            addToAuditBuffer(pageViewEvent);
            window.gridboxLayer.event.push(pageViewEvent);
            
            // Update page info
            window.gridboxLayer.page.pageInfo.pageID = pageViewEvent.eventInfo.pageId;
            window.gridboxLayer.page.pageInfo.pageName = mergedData.page_name || document.title;
            window.gridboxLayer.page.category.primaryCategory = mergedData.page_category || "";
            
            this.logDebug('gridbox.view() pushed to dataLayer', gtmPageViewEvent);
            
            // Execute callback if provided
            if (typeof callback === 'function') {
                callback(mergedData);
            }
            
            return this;
        },
        
        // =========================================
        // GRIDBOX.LINK() - Interaction Tracking (like utag.link)
        // =========================================
        // Fires on user interactions (clicks, form submits, etc.)
        link: function(data, callback) {
            const self = this;
            data = data || {};
            
            // Merge with gridbox_data
            const mergedData = Object.assign({}, window.gridbox_data, data);
            
            // Build event name from data
            const eventName = mergedData.event_name || mergedData.tealium_event || 'link';
            const eventCategory = mergedData.event_category || 'interaction';
            const eventAction = mergedData.event_action || 'click';
            const eventLabel = mergedData.event_label || '';
            
            // Build action_type for gridbox format
            const actionType = this.config.eventPrefix + eventCategory + '_' + eventAction + '_' + (eventLabel || 'unknown');
            
            // Filter merged data through whitelist
            const filteredData = this.filterByWhitelist(mergedData);
            
            // Build GTM dataLayer event
            const gtmLinkEvent = {
                event: 'retail_event',
                action_type: actionType,
                eventCategory: eventCategory,
                eventAction: eventAction,
                eventLabel: eventLabel,
                eventName: eventName,
                ...filteredData
            };
            
            // Push to GTM dataLayer
            window.dataLayer.push(gtmLinkEvent);
            
            // Push to gridboxLayer event array (W3C format with lifecycle)
            const linkEvent = createEventWithLifecycle({
                eventId: generateEventId(),
                eventIndex: getEventSequence(),
                category: {
                    primaryCategory: "UserEvent"
                },
                eventInfo: {
                    eventName: eventName,
                    key: actionType,
                    pageId: window.gridboxLayer.page.pageInfo.pageID,
                    pageInstanceId: getPageInstanceId(),
                    timeStamp: getTimestamp(),
                    monotonicTimestamp: getMonotonicTimestamp()
                },
                context: {
                    anonymousId: identityState.anonymousId,
                    sessionId: window.gridboxLayer.session ? window.gridboxLayer.session.sessionId : null,
                    consentState: consentState,
                    consentCategories: { ...consentCategories }
                },
                attributes: Object.keys(mergedData).map(function(key) {
                    return { key: key, value: String(mergedData[key]) };
                })
            });
            updateEventLifecycle(linkEvent, EVENT_STATUS.FIRED, 'gridbox.link');
            addToAuditBuffer(linkEvent);
            window.gridboxLayer.event.push(linkEvent);
            
            this.logDebug('gridbox.link() pushed to dataLayer', gtmLinkEvent);
            this.updateDebugPanel({ action_type: actionType, ...mergedData }, true);
            
            // Execute callback if provided
            if (typeof callback === 'function') {
                callback(mergedData);
            }
            
            return this;
        },
        
        // =========================================
        // GRIDBOX.FLATTEN() - Flatten nested object (like utag.flatten)
        // =========================================
        flatten: function(obj, prefix, result) {
            prefix = prefix || '';
            result = result || {};
            
            for (var key in obj) {
                if (obj.hasOwnProperty(key)) {
                    var newKey = prefix ? prefix + '_' + key : key;
                    
                    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                        this.flatten(obj[key], newKey, result);
                    } else if (Array.isArray(obj[key])) {
                        result[newKey] = obj[key].join(',');
                    } else {
                        result[newKey] = obj[key];
                    }
                }
            }
            
            return result;
        },

        // =========================================
        // PRODUCT MANAGEMENT
        // =========================================
        
        // Add product to gridboxLayer.product[] (Enterprise Format)
        addProduct: function(productData) {
            const productID = productData.id || productData.product_id || productData.productID || '';
            const primaryCategory = productData.category || productData.product_category || productData.categoryType || productData.type || 'Product';
            const brand = productData.brand || productData.product_brand || '';

            // Enterprise product structure
            const product = {
                category: {
                    primaryCategory: primaryCategory
                },
                productInfo: {
                    productID: productID,
                    brand: brand,
                    productDetails: {
                        // Nested product details based on category
                        [primaryCategory.toLowerCase()]: {
                            name: productData.name || productData.product_name || '',
                            brand: brand,
                            price: {
                                totalPrice: {
                                    amount: parseFloat(productData.price || productData.product_price || 0),
                                    currency: productData.currency || 'USD'
                                }
                            },
                            image: productData.image || productData.product_image || '',
                            // Include any additional details passed
                            ...productData.details
                        }
                    },
                    // Characteristics array
                    characteristics: productData.characteristics || []
                }
            };
            
            // Check if product already exists, update if so
            const existingIndex = window.gridboxLayer.product.findIndex(
                p => p.productInfo && p.productInfo.productID === productID
            );
            
            if (existingIndex >= 0) {
                window.gridboxLayer.product[existingIndex] = product;
            } else {
                window.gridboxLayer.product.push(product);
            }
            
            // Push ProductView event to gridboxLayer.event[] with lifecycle
            const productEvent = createEventWithLifecycle({
                eventId: generateEventId(),
                eventIndex: getEventSequence(),
                category: {
                    primaryCategory: "Display"
                },
                eventInfo: {
                    eventName: "Product viewed",
                    key: "ProductView",
                    componentId: productData.componentId || "ProductComponent",
                    timeStamp: getTimestamp(),
                    monotonicTimestamp: getMonotonicTimestamp(),
                    pageId: window.gridboxLayer.page.pageInfo.pageID,
                    pageInstanceId: getPageInstanceId()
                },
                context: {
                    anonymousId: identityState.anonymousId,
                    sessionId: window.gridboxLayer.session ? window.gridboxLayer.session.sessionId : null,
                    consentState: consentState
                },
                attributes: [
                    { key: "product_id", value: productID },
                    { key: "product_name", value: productData.name || productData.product_name || '' },
                    { key: "product_brand", value: brand },
                    { key: "product_category", value: primaryCategory },
                    { key: "product_price", value: String(productData.price || productData.product_price || 0) },
                    { key: "PageID", value: window.gridboxLayer.page.pageInfo.pageID }
                ]
            });
            updateEventLifecycle(productEvent, EVENT_STATUS.FIRED, 'addProduct');
            addToAuditBuffer(productEvent);
            window.gridboxLayer.event.push(productEvent);
            
            this.logDebug('Product added to gridboxLayer.product[]', product);
            this.updateDebugPanel({ event: 'ProductView', ...productData }, true);
            
            return product;
        },
        
        // Add ancillary service product (Enterprise Format)
        addAncillaryService: function(serviceData) {
            const productID = serviceData.productID || `${serviceData.serviceCode}_${serviceData.segmentID}_${serviceData.travellerID}`;
            
            const product = {
                category: {
                    primaryCategory: "AncillaryService"
                },
                productInfo: {
                    productID: productID,
                    productDetails: {
                        ancillaryService: {
                            categoryCode: serviceData.categoryCode || '',
                            categoryName: serviceData.categoryName || '',
                            serviceCode: serviceData.serviceCode || '',
                            serviceID: serviceData.serviceID || '',
                            serviceName: serviceData.serviceName || '',
                            price: {
                                totalPrice: {
                                    currency: serviceData.currency || '',
                                    amount: parseFloat(serviceData.price || 0)
                                }
                            },
                            quantity: serviceData.quantity || 1,
                            travellerID: serviceData.travellerID || '',
                            emd: serviceData.emd || '',
                            status: serviceData.status || 'selected',
                            segmentID: serviceData.segmentID || '',
                            characteristics: serviceData.characteristics || [],
                            isChargeable: serviceData.isChargeable !== false,
                            isExempted: serviceData.isExempted || false
                        }
                    },
                    characteristics: serviceData.textCharacteristics || []
                }
            };
            
            // Check if product already exists, update if so
            const existingIndex = window.gridboxLayer.product.findIndex(
                p => p.productInfo && p.productInfo.productID === productID
            );
            
            if (existingIndex >= 0) {
                window.gridboxLayer.product[existingIndex] = product;
            } else {
                window.gridboxLayer.product.push(product);
            }
            
            // Also add to cart.item[] as reference
            const cartItemRef = {
                productInfo: {
                    productID: productID,
                    quantity: serviceData.quantity || 1
                }
            };
            
            const existingCartIndex = window.gridboxLayer.cart.item.findIndex(
                i => i.productInfo && i.productInfo.productID === productID
            );
            
            if (existingCartIndex < 0) {
                window.gridboxLayer.cart.item.push(cartItemRef);
            }
            
            // Push AddAncillaryService event with lifecycle
            const serviceEvent = createEventWithLifecycle({
                eventId: generateEventId(),
                eventIndex: getEventSequence(),
                category: {
                    primaryCategory: "UserEvent"
                },
                eventInfo: {
                    eventName: "Add ancillary service",
                    key: "AddAncillaryService",
                    componentId: serviceData.componentId || "SubcategoryInputPres",
                    timeStamp: getTimestamp(),
                    monotonicTimestamp: getMonotonicTimestamp(),
                    pageId: window.gridboxLayer.page.pageInfo.pageID,
                    pageInstanceId: getPageInstanceId()
                },
                context: {
                    anonymousId: identityState.anonymousId,
                    sessionId: window.gridboxLayer.session ? window.gridboxLayer.session.sessionId : null,
                    consentState: consentState
                },
                attributes: [
                    { key: "ServiceCode", value: serviceData.serviceCode || '' },
                    { key: "ServiceValue", value: String(serviceData.quantity || 1) },
                    { key: "ServiceCategory", value: serviceData.categoryCode || '' },
                    { key: "ServiceSubcategory", value: serviceData.subcategory || (serviceData.serviceCode ? serviceData.serviceCode.toLowerCase() : '') },
                    { key: "ServiceOccurrenceGroup", value: String(serviceData.occurrenceGroup || 'true') },
                    { key: "ServicePrice", value: String(serviceData.price || 0) },
                    { key: "ServiceCurrency", value: serviceData.currency || '' },
                    { key: "PageID", value: window.gridboxLayer.page.pageInfo.pageID }
                ]
            });
            updateEventLifecycle(serviceEvent, EVENT_STATUS.FIRED, 'addAncillaryService');
            addToAuditBuffer(serviceEvent);
            window.gridboxLayer.event.push(serviceEvent);
            
            this.logDebug('Ancillary service added to gridboxLayer.product[]', product);
            
            return product;
        },

        // =========================================
        // CART MANAGEMENT (Enterprise Format)
        // cart.item[] contains references, product[] contains full details
        // =========================================
        
        // Add item to cart
        addToCart: function(productData, quantity) {
            quantity = quantity || 1;
            const productID = productData.id || productData.product_id || productData.productID || '';
            const productName = productData.name || productData.product_name || '';
            const productPrice = parseFloat(productData.price || productData.product_price || 0);
            const productCategory = productData.category || productData.product_category || productData.categoryType || 'Product';
            const productBrand = productData.brand || productData.product_brand || '';
            const currency = productData.currency || 'USD';

            // First, add/update product in product[] array
            const product = {
                category: {
                    primaryCategory: productCategory
                },
                productInfo: {
                    productID: productID,
                    brand: productBrand,
                    productDetails: {
                        [productCategory.toLowerCase()]: {
                            name: productName,
                            brand: productBrand,
                            price: {
                                totalPrice: {
                                    amount: productPrice,
                                    currency: currency
                                }
                            },
                            image: productData.image || productData.product_image || '',
                            ...productData.details
                        }
                    },
                    characteristics: productData.characteristics || []
                }
            };
            
            const existingProductIndex = window.gridboxLayer.product.findIndex(
                p => p.productInfo && p.productInfo.productID === productID
            );
            
            if (existingProductIndex >= 0) {
                window.gridboxLayer.product[existingProductIndex] = product;
            } else {
                window.gridboxLayer.product.push(product);
            }
            
            // Then add reference to cart.item[] (Enterprise format - just productID and quantity)
            const cartItemRef = {
                productInfo: {
                    productID: productID,
                    quantity: quantity
                }
            };
            
            // Check if item already in cart
            const existingCartIndex = window.gridboxLayer.cart.item.findIndex(
                i => i.productInfo && i.productInfo.productID === productID
            );
            
            if (existingCartIndex >= 0) {
                // Update quantity
                window.gridboxLayer.cart.item[existingCartIndex].productInfo.quantity += quantity;
            } else {
                // Add new item reference
                window.gridboxLayer.cart.item.push(cartItemRef);
            }
            
            // Recalculate cart totals
            this._recalculateCart();
            
            // Push AddToCart event to gridboxLayer.event[] with lifecycle
            const addToCartEvent = createEventWithLifecycle({
                eventId: generateEventId(),
                eventIndex: getEventSequence(),
                category: {
                    primaryCategory: "Ecommerce"
                },
                eventInfo: {
                    eventName: "Add to cart",
                    key: "AddToCart",
                    componentId: productData.componentId || "CartComponent",
                    timeStamp: getTimestamp(),
                    monotonicTimestamp: getMonotonicTimestamp(),
                    pageId: window.gridboxLayer.page.pageInfo.pageID,
                    pageInstanceId: getPageInstanceId()
                },
                context: {
                    anonymousId: identityState.anonymousId,
                    sessionId: window.gridboxLayer.session ? window.gridboxLayer.session.sessionId : null,
                    consentState: consentState
                },
                attributes: [
                    { key: "product_id", value: productID },
                    { key: "product_name", value: productName },
                    { key: "product_price", value: String(productPrice) },
                    { key: "product_category", value: productCategory },
                    { key: "product_quantity", value: String(quantity) },
                    { key: "cart_total", value: String(window.gridboxLayer.cart.price.totalPrice.amount) },
                    { key: "item_count", value: String(window.gridboxLayer.cart.item.length) },
                    { key: "currency", value: currency },
                    { key: "PageID", value: window.gridboxLayer.page.pageInfo.pageID }
                ]
            });
            updateEventLifecycle(addToCartEvent, EVENT_STATUS.FIRED, 'addToCart');
            addToAuditBuffer(addToCartEvent);
            window.gridboxLayer.event.push(addToCartEvent);
            
            this.logDebug('Item added to cart - product[] and cart.item[]', { product, cartItemRef });
            this.updateDebugPanel({ event: 'AddToCart', ...productData, quantity }, true);
            
            return { product, cartItemRef };
        },
        
        // Remove item from cart (Enterprise Format)
        removeFromCart: function(productId, quantity) {
            const existingIndex = window.gridboxLayer.cart.item.findIndex(
                i => i.productInfo && i.productInfo.productID === productId
            );
            
            if (existingIndex < 0) {
                this.logDebug('Product not found in cart', productId);
                return false;
            }
            
            const cartItem = window.gridboxLayer.cart.item[existingIndex];
            const currentQty = cartItem.productInfo.quantity || 1;
            
            // Get product name from product[] for event
            const product = window.gridboxLayer.product.find(p => 
                p.productInfo && p.productInfo.productID === productId
            );
            let productName = productId;
            if (product && product.productInfo.productDetails) {
                const categoryKey = (product.category.primaryCategory || '').toLowerCase();
                const details = product.productInfo.productDetails[categoryKey];
                if (details && details.name) productName = details.name;
            }
            
            if (quantity && quantity < currentQty) {
                // Reduce quantity
                cartItem.productInfo.quantity = currentQty - quantity;
            } else {
                // Remove entire item from cart
                window.gridboxLayer.cart.item.splice(existingIndex, 1);
            }
            
            // Recalculate cart totals
            this._recalculateCart();
            
            // Push RemoveFromCart event with lifecycle
            const removeEvent = createEventWithLifecycle({
                eventId: generateEventId(),
                eventIndex: getEventSequence(),
                category: {
                    primaryCategory: "Ecommerce"
                },
                eventInfo: {
                    eventName: "Remove from cart",
                    key: "RemoveFromCart",
                    componentId: "CartComponent",
                    timeStamp: getTimestamp(),
                    monotonicTimestamp: getMonotonicTimestamp(),
                    pageId: window.gridboxLayer.page.pageInfo.pageID,
                    pageInstanceId: getPageInstanceId()
                },
                context: {
                    anonymousId: identityState.anonymousId,
                    sessionId: window.gridboxLayer.session ? window.gridboxLayer.session.sessionId : null,
                    consentState: consentState
                },
                attributes: [
                    { key: "product_id", value: productId },
                    { key: "product_name", value: productName },
                    { key: "quantity_removed", value: String(quantity || currentQty) },
                    { key: "cart_total", value: String(window.gridboxLayer.cart.price.totalPrice.amount) },
                    { key: "item_count", value: String(window.gridboxLayer.cart.item.length) },
                    { key: "PageID", value: window.gridboxLayer.page.pageInfo.pageID }
                ]
            });
            updateEventLifecycle(removeEvent, EVENT_STATUS.FIRED, 'removeFromCart');
            addToAuditBuffer(removeEvent);
            window.gridboxLayer.event.push(removeEvent);
            
            this.logDebug('Item removed from cart', { productId, quantity });
            this.updateDebugPanel({ event: 'RemoveFromCart', productId, quantity }, true);
            
            return true;
        },
        
        // Update cart item quantity (Enterprise Format)
        updateCartQuantity: function(productId, newQuantity) {
            const existingIndex = window.gridboxLayer.cart.item.findIndex(
                i => i.productInfo && i.productInfo.productID === productId
            );
            
            if (existingIndex < 0) return false;
            
            const cartItem = window.gridboxLayer.cart.item[existingIndex];
            const oldQuantity = cartItem.productInfo.quantity || 1;
            cartItem.productInfo.quantity = newQuantity;
            
            this._recalculateCart();
            
            // Push UpdateCart event with lifecycle
            const updateEvent = createEventWithLifecycle({
                eventId: generateEventId(),
                eventIndex: getEventSequence(),
                category: {
                    primaryCategory: "Ecommerce"
                },
                eventInfo: {
                    eventName: "Update cart quantity",
                    key: "UpdateCartQuantity",
                    componentId: "CartComponent",
                    timeStamp: getTimestamp(),
                    monotonicTimestamp: getMonotonicTimestamp(),
                    pageId: window.gridboxLayer.page.pageInfo.pageID,
                    pageInstanceId: getPageInstanceId()
                },
                context: {
                    anonymousId: identityState.anonymousId,
                    sessionId: window.gridboxLayer.session ? window.gridboxLayer.session.sessionId : null,
                    consentState: consentState
                },
                attributes: [
                    { key: "product_id", value: productId },
                    { key: "old_quantity", value: String(oldQuantity) },
                    { key: "new_quantity", value: String(newQuantity) },
                    { key: "cart_total", value: String(window.gridboxLayer.cart.price.totalPrice.amount) },
                    { key: "PageID", value: window.gridboxLayer.page.pageInfo.pageID }
                ]
            });
            updateEventLifecycle(updateEvent, EVENT_STATUS.FIRED, 'updateCartQuantity');
            addToAuditBuffer(updateEvent);
            window.gridboxLayer.event.push(updateEvent);
            
            this.logDebug('Cart quantity updated', { productId, oldQuantity, newQuantity });
            
            return true;
        },
        
        // Clear entire cart
        clearCart: function() {
            const itemCount = window.gridboxLayer.cart.item.length;
            const cartTotal = window.gridboxLayer.cart.price.totalPrice.amount;
            
            window.gridboxLayer.cart.item = [];
            this._recalculateCart();
            
            // Push ClearCart event with lifecycle
            const clearEvent = createEventWithLifecycle({
                eventId: generateEventId(),
                eventIndex: getEventSequence(),
                category: {
                    primaryCategory: "Ecommerce"
                },
                eventInfo: {
                    eventName: "ClearCart",
                    key: "gb_cart_clear",
                    timeStamp: getTimestamp(),
                    monotonicTimestamp: getMonotonicTimestamp(),
                    pageId: window.gridboxLayer.page.pageInfo.pageID,
                    pageInstanceId: getPageInstanceId()
                },
                context: {
                    anonymousId: identityState.anonymousId,
                    sessionId: window.gridboxLayer.session ? window.gridboxLayer.session.sessionId : null,
                    consentState: consentState
                },
                attributes: [
                    { key: "items_cleared", value: String(itemCount) },
                    { key: "value_cleared", value: String(cartTotal) }
                ]
            });
            updateEventLifecycle(clearEvent, EVENT_STATUS.FIRED, 'clearCart');
            addToAuditBuffer(clearEvent);
            window.gridboxLayer.event.push(clearEvent);
            
            this.logDebug('Cart cleared', { itemCount, cartTotal });
            
            return true;
        },
        
        // Internal: Recalculate cart totals (Enterprise Format)
        // cart.item[] has references, product[] has full details
        _recalculateCart: function() {
            const cart = window.gridboxLayer.cart;
            const products = window.gridboxLayer.product;
            let totalAmount = 0;
            const currency = cart.price.totalPrice.currency || 'USD';
            
            // Calculate total from cart items referencing products
            cart.item.forEach(function(cartItem) {
                const productID = cartItem.productInfo.productID;
                const quantity = cartItem.productInfo.quantity || 1;
                
                // Find product in product[] array
                const product = products.find(p => p.productInfo && p.productInfo.productID === productID);
                
                if (product && product.productInfo.productDetails) {
                    // Get price from productDetails (handles different category structures)
                    const details = product.productInfo.productDetails;
                    const categoryKey = Object.keys(details)[0];
                    if (categoryKey && details[categoryKey] && details[categoryKey].price) {
                        const price = details[categoryKey].price.totalPrice;
                        if (price && price.amount) {
                            totalAmount += price.amount * quantity;
                        }
                    }
                }
            });
            
            // Update cart price structure (Enterprise format)
            cart.price.totalPrice.amount = totalAmount;
            cart.price.totalPrice.currency = currency;
            
            // Update pricePerTravellerType if needed
            if (cart.price.pricePerTravellerType.length === 0 && totalAmount > 0) {
                cart.price.pricePerTravellerType.push({
                    passengerTypeCode: "ADT",
                    totalPrice: {
                        currency: currency,
                        amount: totalAmount
                    }
                });
            } else if (cart.price.pricePerTravellerType.length > 0) {
                cart.price.pricePerTravellerType[0].totalPrice.amount = totalAmount;
            }
            
            // Generate cart ID if not set (Enterprise format)
            if (!cart.cartInfo.cartID && cart.item.length > 0) {
                cart.cartInfo.cartID = generateCartId();
                cart.cartInfo.creationDate = new Date().toISOString();
            }
        },
        
        // Generate cart ID in enterprise format
        _generateCartId: function() {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let result = '';
            for (let i = 0; i < 16; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return result;
        },
        
        // Get cart summary
        getCart: function() {
            return window.gridboxLayer.cart;
        },

        // =========================================
        // CHECKOUT / PURCHASE
        // =========================================
        
        // Begin checkout
        beginCheckout: function(checkoutData) {
            checkoutData = checkoutData || {};

            const cart = window.gridboxLayer.cart;
            const cartTotal = cart.price.totalPrice.amount;
            const currency = cart.price.totalPrice.currency || 'USD';

            const checkoutEvent = createEventWithLifecycle({
                eventId: generateEventId(),
                eventIndex: getEventSequence(),
                category: {
                    primaryCategory: "Ecommerce"
                },
                eventInfo: {
                    eventName: "BeginCheckout",
                    key: "gb_checkout_begin",
                    timeStamp: getTimestamp(),
                    monotonicTimestamp: getMonotonicTimestamp(),
                    pageId: window.gridboxLayer.page.pageInfo.pageID,
                    pageInstanceId: getPageInstanceId()
                },
                context: {
                    anonymousId: identityState.anonymousId,
                    sessionId: window.gridboxLayer.session ? window.gridboxLayer.session.sessionId : null,
                    consentState: consentState
                },
                attributes: [
                    { key: "cart_total", value: String(cartTotal) },
                    { key: "item_count", value: String(cart.item.length) },
                    { key: "currency", value: currency }
                ]
            });

            // Add cart items as attributes with product details from product[]
            const products = window.gridboxLayer.product;
            cart.item.forEach(function(item, index) {
                const productID = item.productInfo.productID;
                const qty = item.productInfo.quantity || 1;
                const product = products.find(function(p) {
                    return p.productInfo && p.productInfo.productID === productID;
                });
                let itemName = productID;
                let itemPrice = '0';
                if (product && product.productInfo.productDetails) {
                    const catKey = Object.keys(product.productInfo.productDetails)[0];
                    if (catKey && product.productInfo.productDetails[catKey]) {
                        itemName = product.productInfo.productDetails[catKey].name || productID;
                        if (product.productInfo.productDetails[catKey].price && product.productInfo.productDetails[catKey].price.totalPrice) {
                            itemPrice = String(product.productInfo.productDetails[catKey].price.totalPrice.amount);
                        }
                    }
                }
                checkoutEvent.attributes.push(
                    { key: "item_" + index + "_id", value: productID },
                    { key: "item_" + index + "_name", value: itemName },
                    { key: "item_" + index + "_qty", value: String(qty) },
                    { key: "item_" + index + "_price", value: itemPrice }
                );
            });

            updateEventLifecycle(checkoutEvent, EVENT_STATUS.FIRED, 'beginCheckout');
            addToAuditBuffer(checkoutEvent);
            window.gridboxLayer.event.push(checkoutEvent);
            updateDiagnostics('eventsFired', 1);

            this.logDebug('Checkout begun', checkoutEvent);
            this.updateDebugPanel({ event: 'BeginCheckout' }, true);

            return checkoutEvent;
        },
        
        // Complete purchase - updates gridboxLayer.transaction and event[]
        purchase: function(transactionData) {
            const cart = window.gridboxLayer.cart;
            const products = window.gridboxLayer.product;
            const transactionID = transactionData.orderId || transactionData.transaction_id || 'TXN_' + Date.now();
            const totalAmount = parseFloat(transactionData.total || cart.price.totalPrice.amount || 0);
            const currency = transactionData.currency || cart.price.totalPrice.currency || 'USD';

            // Build transaction items with resolved product details
            const transactionItems = cart.item.map(function(item) {
                const productID = item.productInfo.productID;
                const qty = item.productInfo.quantity || 1;
                const product = products.find(function(p) {
                    return p.productInfo && p.productInfo.productID === productID;
                });
                let itemName = productID;
                let itemPrice = 0;
                let itemCategory = '';
                if (product && product.productInfo.productDetails) {
                    const catKey = Object.keys(product.productInfo.productDetails)[0];
                    if (catKey && product.productInfo.productDetails[catKey]) {
                        itemName = product.productInfo.productDetails[catKey].name || productID;
                        itemCategory = product.category ? product.category.primaryCategory : '';
                        if (product.productInfo.productDetails[catKey].price && product.productInfo.productDetails[catKey].price.totalPrice) {
                            itemPrice = product.productInfo.productDetails[catKey].price.totalPrice.amount || 0;
                        }
                    }
                }
                return {
                    productInfo: { productID: productID, productName: itemName, quantity: qty },
                    category: itemCategory,
                    price: itemPrice
                };
            });

            // Update gridboxLayer.transaction (CORE DATA)
            window.gridboxLayer.transaction = {
                transactionID: transactionID,
                profile: {
                    profileInfo: {
                        profileID: transactionData.userId || '',
                        userName: transactionData.userName || ''
                    },
                    address: transactionData.address || {}
                },
                total: {
                    basePrice: parseFloat(transactionData.subtotal || totalAmount),
                    currency: currency,
                    shipping: parseFloat(transactionData.shipping || 0),
                    tax: parseFloat(transactionData.tax || 0),
                    transactionTotal: totalAmount
                },
                item: transactionItems,
                attributes: transactionData.attributes || {}
            };

            // Push Purchase event to gridboxLayer.event[] with lifecycle
            const purchaseEvent = createEventWithLifecycle({
                eventId: generateEventId(),
                eventIndex: getEventSequence(),
                category: {
                    primaryCategory: "Ecommerce"
                },
                eventInfo: {
                    eventName: "Purchase",
                    key: "gb_purchase_complete",
                    timeStamp: getTimestamp(),
                    monotonicTimestamp: getMonotonicTimestamp(),
                    pageId: window.gridboxLayer.page.pageInfo.pageID,
                    pageInstanceId: getPageInstanceId()
                },
                context: {
                    anonymousId: identityState.anonymousId,
                    sessionId: window.gridboxLayer.session ? window.gridboxLayer.session.sessionId : null,
                    consentState: consentState
                },
                attributes: [
                    { key: "transaction_id", value: transactionID },
                    { key: "transaction_total", value: String(totalAmount) },
                    { key: "transaction_tax", value: String(transactionData.tax || 0) },
                    { key: "transaction_shipping", value: String(transactionData.shipping || 0) },
                    { key: "currency", value: currency },
                    { key: "item_count", value: String(transactionItems.length) }
                ]
            });

            // Add item details to event attributes
            transactionItems.forEach(function(item, index) {
                purchaseEvent.attributes.push(
                    { key: "item_" + index + "_id", value: item.productInfo.productID },
                    { key: "item_" + index + "_name", value: item.productInfo.productName },
                    { key: "item_" + index + "_qty", value: String(item.productInfo.quantity) },
                    { key: "item_" + index + "_price", value: String(item.price) }
                );
            });

            updateEventLifecycle(purchaseEvent, EVENT_STATUS.FIRED, 'purchase');
            addToAuditBuffer(purchaseEvent);
            window.gridboxLayer.event.push(purchaseEvent);
            updateDiagnostics('eventsFired', 1);

            // Defer cart clear so the Purchase event finishes processing through
            // ACDL listeners + Web SDK rule before ClearCart pushes to the datalayer.
            // This prevents the XDM data element from picking ClearCart over Purchase
            // when both events fire in the same JS task.
            var self = this;
            setTimeout(function() { self.clearCart(); }, 150);

            this.logDebug('Purchase completed - gridboxLayer.transaction updated', window.gridboxLayer.transaction);
            this.updateDebugPanel({ event: 'Purchase', transactionId: transactionID }, true);

            return window.gridboxLayer.transaction;
        },
        
        // Backward compatibility alias
        setTransaction: function(transactionData) {
            return this.purchase(transactionData);
        },

        // =========================================
        // USER MANAGEMENT
        // =========================================
        
        // Set user data - updates gridboxLayer.user[]
        setUser: function(userData) {
            const user = window.gridboxLayer.user[0].profile[0];
            if (!user.profileInfo) user.profileInfo = {};
            if (!user.attributes) user.attributes = { userType: "guest", customerTier: "" };

            if (userData.id || userData.user_id) {
                user.profileInfo.profileID = userData.id || userData.user_id;
            }
            if (userData.name || userData.user_name) {
                user.profileInfo.userName = userData.name || userData.user_name;
            }
            if (userData.email) {
                user.profileInfo.email = userData.email;
            }
            if (userData.type || userData.user_type) {
                user.attributes.userType = userData.type || userData.user_type;
            }
            if (userData.tier || userData.customer_tier) {
                user.attributes.customerTier = userData.tier || userData.customer_tier;
            }
            
            user.profileInfo.loginStatus = !!(userData.id || userData.user_id);
            // loginPersistence = true means the session was RESTORED from storage (not a fresh login)
            if (userData.loginPersistence !== undefined) {
                user.profileInfo.loginPersistence = !!userData.loginPersistence;
            }
            
            // Push UserIdentified event to gridboxLayer.event[] with lifecycle
            if (user.profileInfo.profileID) {
                const loginEvent = createEventWithLifecycle({
                    eventId: generateEventId(),
                    eventIndex: getEventSequence(),
                    category: {
                        primaryCategory: "UserEvent"
                    },
                    eventInfo: {
                        eventName: "UserIdentified",
                        key: "gb_user_identified",
                        timeStamp: getTimestamp(),
                        monotonicTimestamp: getMonotonicTimestamp(),
                        pageId: window.gridboxLayer.page.pageInfo.pageID,
                        pageInstanceId: getPageInstanceId()
                    },
                    context: {
                        anonymousId: identityState.anonymousId,
                        sessionId: window.gridboxLayer.session ? window.gridboxLayer.session.sessionId : null,
                        consentState: consentState
                    },
                    attributes: [
                        { key: "user_id", value: user.profileInfo.profileID },
                        { key: "user_type", value: user.attributes.userType || '' },
                        { key: "login_status", value: "true" }
                    ]
                });
                updateEventLifecycle(loginEvent, EVENT_STATUS.FIRED, 'setUser');
                addToAuditBuffer(loginEvent);
                window.gridboxLayer.event.push(loginEvent);

                // Update identity state
                setIdentity(IDENTITY_TYPES.AUTHENTICATED, {
                    anonymousId: identityState.anonymousId,
                    authenticatedId: user.profileInfo.profileID
                });
            }
            
            this.logDebug('User data updated in gridboxLayer.user[]', user);
            
            return user;
        },
        
        // Get current user
        getUser: function() {
            return window.gridboxLayer.user[0].profile[0];
        },

        // =========================================
        // INITIALIZATION
        // =========================================
        init: function() {
            this.logDebug('Initializing GridBox Analytics Layer');
            
            // Initialize click listener
            this.initClickListener();
            
            // Expose global functions for external use
            window.gridboxAnalytics = this;
            
            // BACKWARD COMPATIBILITY: racingF1Analytics alias
            window.racingF1Analytics = this;
            
            // Global callback functions (like utag callbacks)
            window.gbEventCallback = this.eventCallback.bind(this);
            window.gbLinkCallback = this.linkCallback.bind(this);
            
            // BACKWARD COMPATIBILITY: rf1 callback aliases
            window.rf1EventCallback = this.eventCallback.bind(this);
            window.rf1LinkCallback = this.linkCallback.bind(this);
            
            // =========================================
            // EXPOSE gridbox API GLOBALLY
            // gridboxLayer is the CORE DATA LAYER
            // =========================================
            window.gridbox = window.gridbox || {};
            
            // Core tracking methods
            window.gridbox.view = this.view.bind(this);
            window.gridbox.link = this.link.bind(this);
            window.gridbox.track = this.eventCallback.bind(this);
            
            // Product management
            window.gridbox.addProduct = this.addProduct.bind(this);
            window.gridbox.addAncillaryService = this.addAncillaryService.bind(this);
            
            // Cart management
            window.gridbox.addToCart = this.addToCart.bind(this);
            window.gridbox.removeFromCart = this.removeFromCart.bind(this);
            window.gridbox.updateCartQuantity = this.updateCartQuantity.bind(this);
            window.gridbox.clearCart = this.clearCart.bind(this);
            window.gridbox.getCart = this.getCart.bind(this);
            
            // Checkout/Purchase
            window.gridbox.beginCheckout = this.beginCheckout.bind(this);
            window.gridbox.purchase = this.purchase.bind(this);
            
            // User management
            window.gridbox.setUser = this.setUser.bind(this);
            window.gridbox.getUser = this.getUser.bind(this);
            
            // Utilities
            window.gridbox.flatten = this.flatten.bind(this);
            window.gridbox.data = window.gridbox_data;
            
            // Direct access to core data layer
            window.gridbox.layer = window.gridboxLayer;
            
            // Expose utility functions
            window.gridbox.getAnonymousId = function() { return anonymousId; };
            window.gridbox.getSession = function() { return getSession(); };
            window.gridbox.getDeviceInfo = function() { return deviceInfo; };
            window.gridbox.getEngagement = getEngagementMetrics;
            window.gridbox.getPerformance = getPerformanceMetrics;
            window.gridbox.getUTMParams = function() { return utmParams; };
            
            // =========================================
            // EXPOSE ARCHITECTURE ENHANCEMENTS APIs
            // =========================================
            
            // A3: Consent Management
            window.gridbox.setConsent = setConsent;
            window.gridbox.getConsent = getConsent;
            window.gridbox.CONSENT_STATES = CONSENT_STATES;
            
            // B7: Diagnostics & Observability
            window.gridbox.getDiagnostics = getDiagnostics;
            
            // B3: Schema Validation
            window.gridbox.setValidationMode = function(mode) { validationMode = mode; };
            window.gridbox.VALIDATION_MODE = VALIDATION_MODE;
            
            // B4: Event Replay & Audit
            window.gridbox.getAuditBuffer = getAuditBuffer;
            window.gridbox.exportEvents = exportEvents;
            
            // B6: Cross-Platform Identity
            window.gridbox.setIdentity = setIdentity;
            window.gridbox.getIdentity = getIdentity;
            window.gridbox.IDENTITY_TYPES = IDENTITY_TYPES;
            
            // A1: SPA Awareness
            window.gridbox.getRouteHistory = getRouteHistory;
            
            // A7: Deferred Init
            window.gridbox.onReady = onReady;
            
            // A5: Contract Version
            window.gridbox.contractVersion = GB_CONTRACT_VERSION;
            window.gridbox.libVersion = GB_LIB_VERSION;
            
            // B5: Namespace Registry
            window.gridbox.NAMESPACES = NAMESPACE_REGISTRY;
            
            // =========================================
            // EXPOSE EVENT CLASS SYSTEM (Enterprise Pattern)
            // =========================================
            window.gridbox.Events = GridboxEvents;
            window.gridbox.eventTrackService = EventTrackService;
            
            // Shorthand for creating and pushing events
            window.gridbox.pushEvent = function(EventClass, data) {
                return EventTrackService.track(EventClass, data);
            };
            
            // Create custom event dynamically
            window.gridbox.createEvent = function(key, eventName, componentId, attributes, category) {
                return new CustomAnalyticsEvents.customEvent(key, eventName, componentId, attributes, category);
            };
            
            // =========================================
            // EXPOSE CONFIGURATION OBSERVER (Enterprise Pattern)
            // =========================================
            window.gridbox.ConfigurationObserver = ConfigurationObserver;
            window.gridbox.createConfig = function(configKey, defaultConfig) {
                return new ConfigurationObserver(configKey, defaultConfig, null);
            };
            
            // =========================================
            // EXPOSE TRANSLATION KEYS (Enterprise Pattern)
            // =========================================
            window.gridbox.TranslationKeys = TranslationKeys;
            window.gridbox.translate = function(key, args) {
                // Simple translation lookup - can be extended with i18n library
                const keys = key.split('.');
                let result = TranslationKeys;
                for (const k of keys) {
                    if (result && result[k]) {
                        result = result[k];
                    } else {
                        return key; // Return key if not found
                    }
                }
                return typeof result === 'string' ? result : key;
            };
            
            // =========================================
            // EXPOSE STORE PATTERN (Enterprise Pattern)
            // =========================================
            window.gridbox.store = GridboxStore;
            window.gridbox.dispatch = function(action) {
                return GridboxStore.dispatch(action);
            };
            window.gridbox.select = function(selector) {
                return GridboxStore.select(selector);
            };
            window.gridbox.getState = function() {
                return GridboxStore.getState();
            };
            
            // =========================================
            // EXPOSE SUBSCRIPTION MANAGER (Enterprise Pattern)
            // =========================================
            window.gridbox.SubscriptionManager = SubscriptionManager;
            window.gridbox.createSubscriptionManager = function() {
                return new SubscriptionManager();
            };
            
            // =========================================
            // EXPOSE RACING F1 ANALYTICS (Domain-specific)
            // =========================================
            window.gridbox.RacingF1 = {
                Events: RacingF1AnalyticsEvents,
                ComponentIds: RacingF1ComponentIds,
                // Shorthand methods for common F1 events
                trackRaceView: function(params) {
                    return EventTrackService.track(RacingF1AnalyticsEvents.raceViewed, params);
                },
                trackRaceSelect: function(params) {
                    return EventTrackService.track(RacingF1AnalyticsEvents.raceSelected, params);
                },
                trackTicketSelect: function(params) {
                    return EventTrackService.track(RacingF1AnalyticsEvents.ticketSelected, params);
                },
                trackTicketAddToCart: function(params) {
                    return EventTrackService.track(RacingF1AnalyticsEvents.ticketAddedToCart, params);
                },
                trackSeatMapView: function(params) {
                    return EventTrackService.track(RacingF1AnalyticsEvents.seatMapViewed, params);
                },
                trackSeatSelect: function(params) {
                    return EventTrackService.track(RacingF1AnalyticsEvents.seatSelected, params);
                },
                trackDriverView: function(params) {
                    return EventTrackService.track(RacingF1AnalyticsEvents.driverProfileViewed, params);
                },
                trackTeamView: function(params) {
                    return EventTrackService.track(RacingF1AnalyticsEvents.teamProfileViewed, params);
                },
                trackMerchandiseView: function(params) {
                    return EventTrackService.track(RacingF1AnalyticsEvents.merchandiseViewed, params);
                },
                trackMerchandiseAddToCart: function(params) {
                    return EventTrackService.track(RacingF1AnalyticsEvents.merchandiseAddedToCart, params);
                },
                trackHospitalityView: function(params) {
                    return EventTrackService.track(RacingF1AnalyticsEvents.hospitalityPackageViewed, params);
                },
                trackHospitalitySelect: function(params) {
                    return EventTrackService.track(RacingF1AnalyticsEvents.hospitalityPackageSelected, params);
                },
                trackExperienceBook: function(params) {
                    return EventTrackService.track(RacingF1AnalyticsEvents.experienceBooked, params);
                }
            };
            
            // =========================================
            // EXPOSE BASE EVENT CLASS (For custom extensions)
            // =========================================
            window.gridbox.BaseEvent = BaseAnalyticsEvent;
            window.gridbox.COMPONENT_IDS = COMPONENT_IDS;
            
            // A4: Performance Budget
            window.gridbox.PERFORMANCE_BUDGET = PERFORMANCE_BUDGET;
            
            // Update initial page info from body data attributes
            const pageType = document.body.dataset.pageType || 'general';
            const pageCategory = document.body.dataset.pageCategory || '';
            
            // Set gridbox_data defaults with enhanced data
            window.gridbox_data.page_name = document.title;
            window.gridbox_data.page_type = pageType;
            window.gridbox_data.page_category = pageCategory;
            window.gridbox_data.page_url = window.location.href;
            window.gridbox_data.page_path = window.location.pathname;
            window.gridbox_data.anonymous_id = anonymousId;
            window.gridbox_data.session_id = sessionData.id;
            
            // Add UTM params to gridbox_data
            Object.keys(utmParams).forEach(function(key) {
                window.gridbox_data[key] = utmParams[key];
            });
            
            // Update page info
            window.gridboxLayer.page.pageInfo.pageID = pageType.toUpperCase();
            window.gridboxLayer.page.pageInfo.pageName = document.title;
            window.gridboxLayer.page.pageInfo.pageURL = window.location.href;
            window.gridboxLayer.page.pageInfo.referringURL = document.referrer;
            window.gridboxLayer.page.pageInfo.language = deviceInfo.language;
            window.gridboxLayer.page.pageInfo.sysEnv = deviceInfo.deviceType;
            window.gridboxLayer.page.category.primaryCategory = pageCategory;
            window.gridboxLayer.page.category.pageType = pageType;
            
            // =========================================
            // POPULATE USER DATA WITH ENHANCED INFO
            // =========================================
            const userProfile = window.gridboxLayer.user[0].profile[0];
            
            // Set anonymous ID (unique per user, persistent)
            userProfile.profileInfo.anonymousId = anonymousId;
            // DO NOT set profileID by default - only set when user logs in via setUser()
            userProfile.profileInfo.profileID = ''; // Empty until authenticated
            
            // Session data
            userProfile.profileInfo.sessionId = sessionData.id;
            userProfile.profileInfo.isNewSession = sessionData.isNew;
            userProfile.profileInfo.sessionStartTime = new Date(sessionData.startTime).toISOString();
            
            // Enhanced device info
            userProfile.profileInfo.userAgent = deviceInfo.userAgent;
            userProfile.profileInfo.deviceType = deviceInfo.deviceType;
            userProfile.profileInfo.OS = deviceInfo.os;
            userProfile.profileInfo.browser = deviceInfo.browser;
            userProfile.profileInfo.language = deviceInfo.language;
            userProfile.profileInfo.screenResolution = deviceInfo.screenWidth + 'x' + deviceInfo.screenHeight;
            userProfile.profileInfo.viewportSize = deviceInfo.viewportWidth + 'x' + deviceInfo.viewportHeight;
            userProfile.profileInfo.touchSupport = deviceInfo.touchSupport;
            userProfile.profileInfo.cookieEnabled = deviceInfo.cookieEnabled;
            userProfile.profileInfo.doNotTrack = deviceInfo.doNotTrack;
            userProfile.profileInfo.isBot = deviceInfo.isBot;
            
            // =========================================
            // ADD SESSION OBJECT TO GRIDBOXLAYER
            // =========================================
            window.gridboxLayer.session = {
                sessionId: sessionData.id,
                isNewSession: sessionData.isNew,
                startTime: new Date(sessionData.startTime).toISOString(),
                pageViews: sessionData.pageViews,
                events: sessionData.events,
                utmParams: utmParams
            };
            
            // =========================================
            // ADD CONTEXT OBJECT FOR CURRENT STATE
            // =========================================
            window.gridboxLayer.context = {
                anonymousId: anonymousId,
                sessionId: sessionData.id,
                pageInstanceId: getPageInstanceId(),
                eventSequence: 0,
                referrer: document.referrer,
                timestamp: getTimestamp()
            };
            
            // Update session
            updateSession('pageview');
            
            // Push initial PageView event to gridboxLayer.event[] (CORE) with lifecycle
            const initialPageViewEvent = createEventWithLifecycle({
                eventId: generateEventId(),
                eventIndex: getEventSequence(),
                category: {
                    primaryCategory: "PageView"
                },
                eventInfo: {
                    eventName: "PageView",
                    key: "gb_page_view",
                    pageId: pageType.toUpperCase(),
                    pageInstanceId: getPageInstanceId(),
                    timeStamp: getTimestamp(),
                    monotonicTimestamp: getMonotonicTimestamp()
                },
                context: {
                    anonymousId: anonymousId,
                    sessionId: sessionData.id,
                    isNewSession: sessionData.isNew,
                    isBot: deviceInfo.isBot,
                    consentState: consentState,
                    consentCategories: { ...consentCategories }
                },
                attributes: [
                    { key: "page_name", value: document.title },
                    { key: "page_type", value: pageType },
                    { key: "page_category", value: pageCategory },
                    { key: "page_url", value: window.location.href },
                    { key: "page_path", value: window.location.pathname },
                    { key: "page_referrer", value: document.referrer },
                    { key: "anonymous_id", value: anonymousId },
                    { key: "session_id", value: sessionData.id },
                    { key: "is_new_session", value: String(sessionData.isNew) },
                    { key: "device_type", value: deviceInfo.deviceType },
                    { key: "browser", value: deviceInfo.browser },
                    { key: "os", value: deviceInfo.os }
                ]
            });

            // Add UTM params to event attributes
            Object.keys(utmParams).forEach(function(key) {
                initialPageViewEvent.attributes.push({ key: key, value: utmParams[key] });
            });

            updateEventLifecycle(initialPageViewEvent, EVENT_STATUS.FIRED, 'init');
            addToAuditBuffer(initialPageViewEvent);
            window.gridboxLayer.event.push(initialPageViewEvent);
            updateDiagnostics('eventsFired', 1);
            
            // Log performance metrics after page load
            const self = this;
            window.addEventListener('load', function() {
                setTimeout(function() {
                    const perfMetrics = getPerformanceMetrics();
                    if (perfMetrics.pageLoadTime > 0) {
                        const perfEvent = createEventWithLifecycle({
                            eventId: generateEventId(),
                            eventIndex: getEventSequence(),
                            category: { primaryCategory: "Performance" },
                            eventInfo: {
                                eventName: "PageLoadMetrics",
                                key: "gb_performance_pageload",
                                pageId: pageType.toUpperCase(),
                                pageInstanceId: getPageInstanceId(),
                                timeStamp: getTimestamp(),
                                monotonicTimestamp: getMonotonicTimestamp()
                            },
                            context: {
                                anonymousId: anonymousId,
                                sessionId: sessionData.id,
                                consentState: consentState
                            },
                            attributes: [
                                { key: "page_load_time", value: String(perfMetrics.pageLoadTime) },
                                { key: "dom_ready_time", value: String(perfMetrics.domReadyTime) },
                                { key: "server_response_time", value: String(perfMetrics.serverResponseTime) },
                                { key: "navigation_type", value: perfMetrics.navigationType || 'unknown' }
                            ]
                        });
                        updateEventLifecycle(perfEvent, EVENT_STATUS.FIRED, 'performance');
                        addToAuditBuffer(perfEvent);
                        window.gridboxLayer.event.push(perfEvent);
                        self.logDebug('Performance metrics captured', perfMetrics);
                    }
                }, 100);
            });
            
            // =========================================
            // INITIALIZE SPA OBSERVER (A1)
            // =========================================
            initSPAObserver();
            
            // =========================================
            // UPDATE IDENTITY STATE (B6)
            // =========================================
            identityState.anonymousId = anonymousId;
            identityState.deviceId = 'dev_' + anonymousId.split('_')[1];
            
            // =========================================
            // ADD GOVERNANCE DATA TO CONTEXT
            // =========================================
            window.gridboxLayer.context.consentState = consentState;
            window.gridboxLayer.context.contractVersion = GB_CONTRACT_VERSION;
            window.gridboxLayer.context.validationMode = validationMode;
            window.gridboxLayer.context.spaMode = spaMode;
            window.gridboxLayer.context.degradedMode = degradedMode;
            
            // =========================================
            // ADD DIAGNOSTICS OBJECT TO GRIDBOXLAYER
            // =========================================
            window.gridboxLayer.diagnostics = diagnostics;
            
            // =========================================
            // SET INIT STATUS (A7)
            // =========================================
            diagnostics.initTime = Date.now() - pageStartTime;
            setInitStatus(INIT_STATUS.READY);
            processPreInitQueue(this);
            
            this.logDebug('GridBox Analytics Ready - gridboxLayer is CORE DATA LAYER');
            this.logDebug('Contract Version:', GB_CONTRACT_VERSION);
            this.logDebug('Anonymous ID:', anonymousId);
            this.logDebug('Session ID:', sessionData.id);
            this.logDebug('Device:', deviceInfo.deviceType, deviceInfo.browser, deviceInfo.os);
            this.logDebug('SPA Mode:', spaMode);
            this.logDebug('Degraded Mode:', degradedMode);
            this.logDebug('Init Time:', diagnostics.initTime + 'ms');
            
            return this;
        }
    };

    // =========================================
    // AUTO-INITIALIZE ON DOM READY
    // =========================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            GridBoxAnalytics.init();
        });
    } else {
        GridBoxAnalytics.init();
    }

})(window, document);
