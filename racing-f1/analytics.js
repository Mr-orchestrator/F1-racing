/**
 * ============================================
 * GRIDBOX - Analytics Data Layer
 * ============================================
 * 
 * Enterprise-grade digitalData event push implementation:
 * - gridbox.view() for page views (like utag.view)
 * - gridbox.link() for interactions (like utag.link)
 * - digitalData object (W3C Customer Experience Digital Data Layer)
 * - Event flattening and processing
 * - data-track attribute binding
 * - Callback functions for GTM integration
 * 
 * Architecture:
 * ┌──────────────────────────────────────────────────────────────┐
 * │                         GRIDBOX                              │
 * ├──────────────────────────────────────────────────────────────┤
 * │  digitalData (W3C) │ gridboxLayer   │  dataLayer (GTM)      │
 * │  ├─ page           │ (GridBox)      │  (GTM/GA4 only)       │
 * │  ├─ user           │ ├─ events[]    │  ├─ pushed by GridBox │
 * │  ├─ product        │ └─ tracking    │  └─ consumed by tags  │
 * │  ├─ cart           │                │                       │
 * │  ├─ transaction    │                │                       │
 * │  └─ event[]        │                │                       │
 * └──────────────────────────────────────────────────────────────┘
 */

(function(window, document) {
    'use strict';

    // =========================================
    // INITIALIZE LAYERS
    // =========================================
    // GridBox Layer - Our internal tracking layer
    window.gridboxLayer = window.gridboxLayer || [];
    
    // GTM dataLayer - Separate for GTM/GA4 tags
    window.dataLayer = window.dataLayer || [];
    
    // W3C Customer Experience Digital Data Layer (like lhgData/digitalData)
    window.digitalData = window.digitalData || {
        page: {
            pageInfo: {
                pageId: '',
                pageName: document.title,
                pageURL: window.location.href,
                referringURL: document.referrer,
                language: document.documentElement.lang || 'en',
                sysEnv: navigator.userAgent.indexOf('Mobile') > -1 ? 'mobile' : 'desktop'
            },
            category: {
                primaryCategory: '',
                subCategory: '',
                pageType: ''
            },
            attributes: {}
        },
        user: [{
            profile: [{
                profileInfo: {
                    profileID: '',
                    userName: '',
                    email: ''
                },
                attributes: {
                    loggedIn: false,
                    userType: 'guest',
                    customerTier: ''
                }
            }]
        }],
        product: [],
        cart: {
            cartID: '',
            price: {
                basePrice: 0,
                currency: 'USD',
                taxRate: 0.1,
                shipping: 0,
                cartTotal: 0
            },
            item: []
        },
        transaction: {
            transactionID: '',
            profile: {
                profileInfo: {},
                address: {}
            },
            total: {
                basePrice: 0,
                currency: 'USD',
                transactionTotal: 0
            },
            item: []
        },
        event: [],
        component: [],
        version: '1.0'
    };

    // =========================================
    // gridbox_data - Flat data object (like utag_data)
    // =========================================
    window.gridbox_data = window.gridbox_data || {};

    // =========================================
    // ANALYTICS CORE OBJECT
    // =========================================
    const GridBoxAnalytics = {
        
        // Configuration
        config: {
            debug: true,
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
            
            // Push to both layers
            window.gridboxLayer.push(eventObject);  // Internal tracking
            window.dataLayer.push(eventObject);      // For GTM/GA4
            
            this.logDebug('FIRED: retail_event', eventObject);
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
            
            // Add eventValue only if provided
            if (eventValue !== null && eventValue !== undefined) {
                eventObject.eventValue = eventValue;
            }
            
            // Push to both layers
            window.gridboxLayer.push(eventObject);  // Internal tracking
            window.dataLayer.push(eventObject);      // For GTM/GA4
            
            this.logDebug('LINK FIRED: retail_event', eventObject);
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
        // Fires on page load, updates digitalData and pushes to dataLayer
        view: function(data, callback) {
            const self = this;
            data = data || {};
            
            // Merge with gridbox_data
            const mergedData = Object.assign({}, window.gridbox_data, data);
            
            // Flatten digitalData into rf1_data format
            this.flattenDigitalData(mergedData);
            
            // Update digitalData page info
            if (mergedData.page_name) {
                window.digitalData.page.pageInfo.pageName = mergedData.page_name;
            }
            if (mergedData.page_type) {
                window.digitalData.page.category.pageType = mergedData.page_type;
            }
            if (mergedData.page_category) {
                window.digitalData.page.category.primaryCategory = mergedData.page_category;
            }
            
            // Push page_view event to digitalData.event
            const eventObj = {
                eventInfo: {
                    eventName: 'page_view',
                    eventAction: 'view',
                    eventTimestamp: new Date().toISOString()
                },
                attributes: mergedData
            };
            window.digitalData.event.push(eventObj);
            
            // Push to both layers
            const pageViewEvent = {
                event: 'gridbox_page_view',
                page_name: mergedData.page_name || document.title,
                page_type: mergedData.page_type || '',
                page_category: mergedData.page_category || '',
                page_url: window.location.href,
                page_path: window.location.pathname,
                ...mergedData
            };
            window.gridboxLayer.push(pageViewEvent);  // Internal tracking
            window.dataLayer.push(pageViewEvent);      // For GTM/GA4
            
            this.logDebug('gridbox.view() fired', mergedData);
            
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
            
            // Push to digitalData.event
            const eventObj = {
                eventInfo: {
                    eventName: eventName,
                    eventAction: eventAction,
                    eventCategory: eventCategory,
                    eventLabel: eventLabel,
                    eventTimestamp: new Date().toISOString()
                },
                attributes: mergedData
            };
            window.digitalData.event.push(eventObj);
            
            // Build action_type for gridbox format
            const actionType = this.config.eventPrefix + eventCategory + '_' + eventAction + '_' + (eventLabel || 'unknown');
            
            // Push to both layers
            const linkEvent = {
                event: this.config.dataLayerEvent,
                action_type: actionType,
                event_name: eventName,
                event_category: eventCategory,
                event_action: eventAction,
                event_label: eventLabel,
                ...mergedData
            };
            window.gridboxLayer.push(linkEvent);  // Internal tracking
            window.dataLayer.push(linkEvent);      // For GTM/GA4
            
            this.logDebug('gridbox.link() fired', { actionType, mergedData });
            this.updateDebugPanel({ action_type: actionType, ...mergedData }, true);
            
            // Execute callback if provided
            if (typeof callback === 'function') {
                callback(mergedData);
            }
            
            return this;
        },
        
        // =========================================
        // FLATTEN DIGITALDATA (like teal.flattenObject)
        // =========================================
        flattenDigitalData: function(targetObj) {
            const dd = window.digitalData;
            
            // Flatten page info
            if (dd.page && dd.page.pageInfo) {
                targetObj.page_name = targetObj.page_name || dd.page.pageInfo.pageName;
                targetObj.page_url = targetObj.page_url || dd.page.pageInfo.pageURL;
                targetObj.page_referrer = targetObj.page_referrer || dd.page.pageInfo.referringURL;
                targetObj.page_language = targetObj.page_language || dd.page.pageInfo.language;
            }
            if (dd.page && dd.page.category) {
                targetObj.page_type = targetObj.page_type || dd.page.category.pageType;
                targetObj.page_category = targetObj.page_category || dd.page.category.primaryCategory;
            }
            
            // Flatten user info
            if (dd.user && dd.user[0] && dd.user[0].profile && dd.user[0].profile[0]) {
                const profile = dd.user[0].profile[0];
                targetObj.user_id = targetObj.user_id || profile.profileInfo.profileID;
                targetObj.user_name = targetObj.user_name || profile.profileInfo.userName;
                targetObj.user_logged_in = targetObj.user_logged_in || profile.attributes.loggedIn;
                targetObj.user_type = targetObj.user_type || profile.attributes.userType;
            }
            
            // Flatten cart info
            if (dd.cart) {
                targetObj.cart_id = targetObj.cart_id || dd.cart.cartID;
                targetObj.cart_total = targetObj.cart_total || dd.cart.price.cartTotal;
                targetObj.cart_currency = targetObj.cart_currency || dd.cart.price.currency;
                if (dd.cart.item && dd.cart.item.length > 0) {
                    targetObj.cart_items = dd.cart.item.length;
                    targetObj.product_id = dd.cart.item.map(function(i) { return i.productInfo.productID; });
                    targetObj.product_name = dd.cart.item.map(function(i) { return i.productInfo.productName; });
                    targetObj.product_quantity = dd.cart.item.map(function(i) { return i.quantity; });
                    targetObj.product_price = dd.cart.item.map(function(i) { return i.price.basePrice; });
                }
            }
            
            return targetObj;
        },
        
        // =========================================
        // DIGITALDATA EVENT PUSH
        // =========================================
        pushDigitalDataEvent: function(eventName, eventInfo) {
            const eventObj = {
                eventInfo: {
                    eventName: eventName,
                    eventAction: eventInfo.action || 'interaction',
                    eventLabel: eventInfo.label || '',
                    eventCategory: eventInfo.category || 'general',
                    eventTimestamp: new Date().toISOString(),
                    eventPoints: eventInfo.points || 0
                },
                category: {
                    primaryCategory: eventInfo.primaryCategory || 'interaction'
                },
                attributes: eventInfo.attributes || {}
            };
            
            window.digitalData.event.push(eventObj);
            this.logDebug('digitalData.event pushed', eventObj);
            
            return eventObj;
        },
        
        // Update digitalData page info
        updatePageInfo: function(pageData) {
            if (pageData.pageName) window.digitalData.page.pageInfo.pageName = pageData.pageName;
            if (pageData.pageType) window.digitalData.page.category.primaryCategory = pageData.pageType;
            if (pageData.pageCategory) window.digitalData.page.category.subCategory = pageData.pageCategory;
            Object.assign(window.digitalData.page.attributes, pageData.attributes || {});
        },
        
        // Update digitalData user info
        updateUserInfo: function(userData) {
            const profile = window.digitalData.user[0].profile[0];
            if (userData.userId) profile.profileInfo.profileID = userData.userId;
            if (userData.userName) profile.profileInfo.userName = userData.userName;
            if (userData.loggedIn !== undefined) profile.attributes.loggedIn = userData.loggedIn;
            if (userData.userType) profile.attributes.userType = userData.userType;
            Object.assign(profile.attributes, userData.attributes || {});
        },
        
        // Update digitalData cart
        updateCart: function(cartData) {
            if (cartData.cartId) window.digitalData.cart.cartID = cartData.cartId;
            if (cartData.items) {
                window.digitalData.cart.item = cartData.items.map(function(item, index) {
                    return {
                        productInfo: {
                            productID: item.id,
                            productName: item.name,
                            productImage: item.image || ''
                        },
                        category: {
                            primaryCategory: item.category || 'general'
                        },
                        quantity: item.quantity || 1,
                        price: {
                            basePrice: item.price,
                            currency: 'USD'
                        },
                        linkedProduct: [],
                        attributes: {
                            position: index + 1
                        }
                    };
                });
            }
            if (cartData.totals) {
                Object.assign(window.digitalData.cart.price, cartData.totals);
            }
        },
        
        // Set transaction data
        setTransaction: function(transactionData) {
            window.digitalData.transaction = {
                transactionID: transactionData.orderId,
                profile: {
                    profileInfo: {
                        profileID: transactionData.userId || '',
                        userName: transactionData.email || ''
                    },
                    address: transactionData.shipping || {}
                },
                total: {
                    basePrice: transactionData.subtotal,
                    currency: 'USD',
                    taxRate: 0.1,
                    shipping: transactionData.shippingCost,
                    transactionTotal: transactionData.total
                },
                item: transactionData.items || []
            };
            
            // Also push to both layers
            const purchaseEvent = {
                event: 'purchase',
                ecommerce: {
                    transaction_id: transactionData.orderId,
                    value: transactionData.total,
                    tax: transactionData.tax,
                    shipping: transactionData.shippingCost,
                    currency: 'USD',
                    items: (transactionData.items || []).map(function(item, index) {
                        return {
                            item_id: item.id,
                            item_name: item.name,
                            item_category: item.category,
                            price: item.price,
                            quantity: item.quantity,
                            index: index
                        };
                    })
                }
            };
            window.gridboxLayer.push(purchaseEvent);  // Internal tracking
            window.dataLayer.push(purchaseEvent);      // For GTM/GA4
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
            
            // Global callback functions (like utag callbacks)
            window.gbEventCallback = this.eventCallback.bind(this);
            window.gbLinkCallback = this.linkCallback.bind(this);
            
            // =========================================
            // EXPOSE gridbox.view() and gridbox.link() GLOBALLY
            // (like utag.view and utag.link)
            // =========================================
            window.gridbox = window.gridbox || {};
            window.gridbox.view = this.view.bind(this);
            window.gridbox.link = this.link.bind(this);
            window.gridbox.data = window.gridbox_data;
            window.gridbox.flatten = this.flattenDigitalData.bind(this);
            window.gridbox.track = this.eventCallback.bind(this);
            
            // Update initial page info from body data attributes
            const pageType = document.body.dataset.pageType || 'general';
            const pageCategory = document.body.dataset.pageCategory || '';
            
            window.digitalData.page.pageInfo.pageId = pageType.toUpperCase();
            window.digitalData.page.pageInfo.pageName = document.title;
            window.digitalData.page.category.pageType = pageType;
            window.digitalData.page.category.primaryCategory = pageCategory;
            
            // Set gridbox_data defaults (like utag_data)
            window.gridbox_data.page_name = document.title;
            window.gridbox_data.page_type = pageType;
            window.gridbox_data.page_category = pageCategory;
            window.gridbox_data.page_url = window.location.href;
            window.gridbox_data.page_path = window.location.pathname;
            
            // Auto-fire page view (like utag auto page view)
            this.view(window.gridbox_data);
            
            this.logDebug('GridBox Analytics Ready');
            this.logDebug('gridbox.view() and gridbox.link() available globally');
            this.logDebug('digitalData:', window.digitalData);
            this.logDebug('gridbox_data:', window.gridbox_data);
            
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
