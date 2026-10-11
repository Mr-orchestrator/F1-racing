/**
 * Adobe Web SDK Bridge
 * Solves the real migration problems between AppMeasurement and Web SDK:
 *
 *  1. Purchase double-count guard during dual-tag overlap phase
 *  2. Consent-gated sendEvent queue — no hits before CMP resolves
 *  3. productListItems from adobeDataLayer.getState(), not item_0_* flat pattern
 *  4. Email SHA-256 hashing before identityMap (never raw PII to Edge)
 *  5. ECID + crmId co-presentation on login for RTCDP identity stitching
 *  6. AJO proposition display notification after renderDecisions
 *
 * Usage: loaded before Tags / alloy fires, after cookieconsent-init.js.
 * Exposes window.__adobeBridge for Tags custom-code data elements.
 */
(function (window) {
    'use strict';

    // ─── 1. PURCHASE DEDUP GUARD ───────────────────────────────────────────────
    // AppMeasurement (s.t) and alloy sendEvent can both fire on confirmation.
    // AA server-side purchaseID dedup has a 3-min window and is not guaranteed
    // cross-request when both fire within the same second.
    // We own the dedup in the browser: set a sessionStorage flag the moment
    // AppMeasurement fires so the Web SDK rule skips the duplicate.
    //
    // Problem source: https://experienceleaguecommunities.adobe.com/t5/adobe-analytics-questions/
    //   purchase-event-double-counting-after-web-sdk-migration/
    var PurchaseDedup = {
        _key: 'f1_purchase_fired',

        // Called by the AppMeasurement doPlugins / beforeSend hook
        markAppMeasurementFired: function (transactionId) {
            if (!transactionId) return;
            try {
                sessionStorage.setItem(this._key, String(transactionId));
            } catch (e) { /* private browsing */ }
        },

        // Called by the Tags Web SDK "Purchase" rule BEFORE alloy sendEvent.
        // Returns true → skip the alloy call (AppMeasurement already sent it).
        shouldSkipWebSDK: function (transactionId) {
            if (!transactionId) return false;
            try {
                return sessionStorage.getItem(this._key) === String(transactionId);
            } catch (e) {
                return false;
            }
        },

        // Called after Web SDK purchase fires so AppMeasurement won't fire again.
        markWebSDKFired: function (transactionId) {
            if (!transactionId) return;
            try {
                sessionStorage.setItem(this._key, String(transactionId));
            } catch (e) { /* private browsing */ }
        },

        clear: function () {
            try { sessionStorage.removeItem(this._key); } catch (e) { /* ok */ }
        }
    };

    // ─── 2. CONSENT-GATED EVENT QUEUE ─────────────────────────────────────────
    // Problem: alloy('sendEvent') called on Library Loaded fires before the
    // cookieconsent CMP resolves. Data lands in AEP before any consent signal.
    // Fix: queue sendEvent calls; flush only after 'analytics' consent granted.
    // If denied: discard the queue, call alloy('setConsent', {general:'out'}).
    //
    // Problem source: https://experienceleaguecommunities.adobe.com/t5/adobe-experience-platform/
    //   web-sdk-sends-data-before-consent-is-collected/
    var ConsentQueue = {
        _queue: [],
        _resolved: false,
        _granted: false,

        // Wrap alloy sendEvent. Queues if consent not yet resolved.
        sendEvent: function (payload) {
            if (this._resolved) {
                if (this._granted) this._send(payload);
                return;
            }
            this._queue.push(payload);
        },

        // Called by cookieconsent-init.js onChange / onFirstConsent
        resolve: function (analyticsGranted) {
            this._resolved = true;
            this._granted = !!analyticsGranted;

            if (!analyticsGranted) {
                // User denied — tell alloy, discard queue
                if (window.alloy) {
                    window.alloy('setConsent', { consent: [{ standard: 'Adobe', version: '2.0', value: { general: 'out' } }] });
                }
                this._queue = [];
                return;
            }

            // User granted — tell alloy then flush queue in order
            if (window.alloy) {
                window.alloy('setConsent', { consent: [{ standard: 'Adobe', version: '2.0', value: { general: 'in' } }] })
                    .then(function () {
                        ConsentQueue._flush();
                    });
            } else {
                // alloy not loaded yet — flush once it is
                document.addEventListener('alloy:loaded', function () {
                    ConsentQueue._flush();
                });
            }
        },

        _flush: function () {
            var q = this._queue.splice(0);
            for (var i = 0; i < q.length; i++) {
                this._send(q[i]);
            }
        },

        _send: function (payload) {
            if (window.alloy) {
                window.alloy('sendEvent', payload).catch(function (err) {
                    console.warn('[AdobeBridge] sendEvent failed:', err);
                });
            }
        }
    };

    // ─── 3. productListItems BUILDER ──────────────────────────────────────────
    // Problem: Tags data elements read item_0_id / item_1_id flat attributes
    // from the triggering push event. Multi-item carts are incomplete because
    // only the last item's attributes are in the event payload.
    // Fix: read the full cart from adobeDataLayer.getState().cart.item[].
    //
    // Problem source: https://experienceleaguecommunities.adobe.com/t5/adobe-analytics-questions/
    //   productlistitems-only-shows-last-added-item-in-web-sdk/
    var ProductListBuilder = {
        // Build XDM productListItems[] from ACDL computed state (not push payload)
        fromCartState: function () {
            var dl = window.adobeDataLayer;
            if (!dl || typeof dl.getState !== 'function') {
                return this._fromFlatAttrs();
            }
            var state = dl.getState();
            var items = (state && state.cart && state.cart.item) ? state.cart.item : [];
            return items.map(function (it) {
                var info = it.productInfo || {};
                var rawPrice = it.price;
                var unitPrice = 0;
                if (rawPrice !== null && rawPrice !== undefined) {
                    unitPrice = (typeof rawPrice === 'object' && rawPrice.amount !== undefined)
                        ? parseFloat(rawPrice.amount)
                        : parseFloat(rawPrice);
                }
                if (!unitPrice && info.price) unitPrice = parseFloat(info.price);
                var qty = parseInt(info.quantity || it.quantity || 1);
                return {
                    SKU: String(info.productID || it.product_id || ''),
                    name: String(info.productName || it.product_name || ''),
                    quantity: qty,
                    priceTotal: parseFloat((unitPrice * qty).toFixed(2)),
                    currencyCode: 'USD',
                    productCategories: it.category ? [{ categoryID: String(it.category) }] : []
                };
            }).filter(function (it) { return it.SKU; });
        },

        // Fallback: build from item_0_* flat attributes on the triggering event
        // (legacy pattern — only use when ACDL getState is not available)
        _fromFlatAttrs: function () {
            var dl = window.adobeDataLayer || [];
            var last = dl[dl.length - 1] || {};
            var attrs = last.attributes || {};
            var count = parseInt(attrs.item_count) || 0;
            var items = [];
            for (var i = 0; i < count; i++) {
                var id = attrs['item_' + i + '_id'];
                if (!id) continue;
                var qty = parseInt(attrs['item_' + i + '_qty']) || 1;
                var price = parseFloat(attrs['item_' + i + '_price']) || 0;
                items.push({
                    SKU: String(id),
                    name: String(attrs['item_' + i + '_name'] || ''),
                    quantity: qty,
                    priceTotal: parseFloat((price * qty).toFixed(2)),
                    currencyCode: 'USD'
                });
            }
            return items;
        }
    };

    // ─── 4. EMAIL SHA-256 HASHING ──────────────────────────────────────────────
    // Problem: xdm-data-element-FINAL.js sets identityMap.Email with raw plaintext
    // email. Adobe Edge rejects raw PII with a 400 and the identity is dropped.
    // Even when not rejected, raw email in AEP violates DULE I1 labelling.
    // Fix: hash client-side with SubtleCrypto before every identityMap set.
    //
    // Returns a Promise<string> (hex SHA-256).
    var IdentityHelper = {
        hashEmail: function (email) {
            if (!email) return Promise.resolve('');
            var normalised = String(email).trim().toLowerCase();
            if (!window.crypto || !window.crypto.subtle) {
                // SubtleCrypto unavailable (insecure context / old Safari)
                // Do NOT fall back to sending raw email — return empty string.
                console.warn('[AdobeBridge] SubtleCrypto unavailable; email identity not set.');
                return Promise.resolve('');
            }
            var data = new TextEncoder().encode(normalised);
            return window.crypto.subtle.digest('SHA-256', data).then(function (buf) {
                return Array.prototype.map.call(new Uint8Array(buf), function (b) {
                    return ('0' + b.toString(16)).slice(-2);
                }).join('');
            });
        },

        // Build identityMap for a login/signup event.
        // Requires BOTH crmId (profile primary key) and hashed email.
        // ECID is set automatically by alloy — do not include it here.
        //
        // Problem: setting only Email namespace on login means RTCDP can't stitch
        // the ECID-anonymous pre-auth session to the crmId profile because there is
        // no shared key. crmId + ECID must appear in the SAME sendEvent for the
        // private identity graph to merge them.
        buildLoginIdentityMap: function (crmId, emailHash) {
            var map = {};
            if (crmId) {
                map['crmId'] = [{ id: String(crmId), primary: true, authenticatedState: 'authenticated' }];
            }
            if (emailHash) {
                map['Email_LC_SHA256'] = [{ id: emailHash, primary: false, authenticatedState: 'authenticated' }];
            }
            // ECID is auto-merged by alloy — returning map without it is correct.
            return map;
        },

        buildLogoutIdentityMap: function (crmId) {
            if (!crmId) return {};
            return {
                'crmId': [{ id: String(crmId), primary: true, authenticatedState: 'loggedOut' }]
            };
        }
    };

    // ─── 5. AJO PROPOSITION DISPLAY NOTIFICATION ──────────────────────────────
    // Problem: after alloy('sendEvent', {renderDecisions: true}) resolves,
    // the propositions must be acknowledged with a decisioning.propositionDisplay
    // event. Without this: AJO journey step "Message displayed" never increments,
    // frequency caps don't decrement, message impression metrics are zero.
    //
    // Problem source: https://experienceleaguecommunities.adobe.com/t5/adobe-journey-optimizer/
    //   web-in-app-message-not-tracked-impression-always-zero/
    var AJOTracker = {
        // Call this in the alloy('sendEvent') .then() handler when renderDecisions=true
        notifyDisplay: function (propositions) {
            if (!propositions || !propositions.length || !window.alloy) return;

            // Filter to propositions that were actually rendered (scope = web surface)
            var displayed = propositions.filter(function (p) {
                return p && p.renderAttempted;
            });
            if (!displayed.length) return;

            window.alloy('sendEvent', {
                xdm: {
                    eventType: 'decisioning.propositionDisplay',
                    _experience: {
                        decisioning: {
                            propositions: displayed.map(function (p) {
                                return { id: p.id, scope: p.scope, scopeDetails: p.scopeDetails };
                            }),
                            propositionEventType: { display: 1 }
                        }
                    }
                }
            }).catch(function (err) {
                console.warn('[AdobeBridge] propositionDisplay failed:', err);
            });
        },

        // Call on CTA click inside an AJO in-app message
        notifyInteract: function (proposition, itemId) {
            if (!proposition || !window.alloy) return;
            window.alloy('sendEvent', {
                xdm: {
                    eventType: 'decisioning.propositionInteract',
                    _experience: {
                        decisioning: {
                            propositions: [{ id: proposition.id, scope: proposition.scope, scopeDetails: proposition.scopeDetails }],
                            propositionEventType: { interact: 1 }
                        }
                    }
                }
            }).catch(function (err) {
                console.warn('[AdobeBridge] propositionInteract failed:', err);
            });
        }
    };

    // ─── 6. DATASTREAM ENVIRONMENT SWITCHER ───────────────────────────────────
    // Problem: alloy is configured with a single datastreamId in the Web SDK
    // extension. When Tags Dev library is loaded on prod URL (debug mode),
    // it sends to the prod datastream. Conversely, staging URLs accidentally
    // write to dev dataset.
    // Fix: override datastreamId at runtime via alloy('configure') based on
    // the Tags environment embed code that was loaded.
    //
    // Problem source: https://experienceleaguecommunities.adobe.com/t5/adobe-analytics-questions/
    //   web-sdk-hitting-wrong-datastream-in-qa-environment/
    var DatastreamRouter = {
        DATASTREAM_IDS: {
            prod: '', // set via window.__adobeBridge.config.DATASTREAM_IDS.prod = '...'
            dev:  ''  // set via window.__adobeBridge.config.DATASTREAM_IDS.dev  = '...'
        },

        // Detect which Tags embed code is loaded (Production vs Dev/Staging)
        // by inspecting the Launch script src.
        detectEnvironment: function () {
            var scripts = document.querySelectorAll('script[src*="assets.adobedtm.com"]');
            for (var i = 0; i < scripts.length; i++) {
                var src = scripts[i].src || '';
                if (src.indexOf('/launch-') !== -1) {
                    // Production embed contains no environment suffix
                    if (src.indexOf('staging') === -1 && src.indexOf('development') === -1) return 'prod';
                    if (src.indexOf('staging') !== -1) return 'staging';
                    if (src.indexOf('development') !== -1) return 'dev';
                }
            }
            // Tealium-only site — infer from hostname
            var host = window.location.hostname;
            if (host === 'racing-f1.vercel.app' || host.indexOf('.vercel.app') === -1) return 'prod';
            return 'dev';
        },

        // Apply the correct datastreamId to alloy BEFORE any sendEvent fires.
        // Must be called after alloy is loaded and before Library Loaded rule.
        applyToAlloy: function () {
            var env = this.detectEnvironment();
            var id = (env === 'prod') ? this.DATASTREAM_IDS.prod : this.DATASTREAM_IDS.dev;
            if (id && window.alloy) {
                window.alloy('configure', { datastreamId: id }).catch(function () { /* already configured */ });
            }
            return env;
        }
    };

    // ─── 7. MERCHANDISING EVAR MIGRATION ──────────────────────────────────────
    // Problem: Legacy AA used s.products with merchandising eVars (eVar binding
    // syntax: "eVar21=Red|eVar22=XL"). Web SDK has no equivalent — the XDM
    // Commerce Details schema has no product-level eVar fields.
    // Fix: use the _experience.analytics.productListItems[].*.customDimensions
    // (unofficial) OR store product-level data in the tenant namespace
    // _f1racingstore.productListItems[] and map in XDM Prep rules.
    // This helper stamps per-item custom fields for the datastream XDM Prep rule.
    var MerchandisingHelper = {
        // Stamp product-level custom dimensions onto each XDM productListItem.
        // The datastream XDM Prep rule maps these to the AA product string.
        stampProductDimensions: function (productListItems, itemAttributes) {
            if (!productListItems || !productListItems.length) return productListItems;
            return productListItems.map(function (item, idx) {
                var extra = (itemAttributes && itemAttributes[idx]) || {};
                // Preserve standard fields, add _f1racingstore product extensions
                return Object.assign({}, item, {
                    _f1racingstore: {
                        raceName: String(extra.raceName || extra.race_name || ''),
                        ticketType: String(extra.ticketType || extra.ticket_type || ''),
                        standName: String(extra.standName || extra.stand_name || ''),
                        seatSection: String(extra.seatSection || extra.section || ''),
                        teamName: String(extra.teamName || extra.team_name || ''),
                        merchandiseVariant: String(extra.variant || '')
                    }
                });
            });
        }
    };

    // ─── PUBLIC API ────────────────────────────────────────────────────────────
    window.__adobeBridge = {
        purchase:       PurchaseDedup,
        consent:        ConsentQueue,
        products:       ProductListBuilder,
        identity:       IdentityHelper,
        ajo:            AJOTracker,
        datastream:     DatastreamRouter,
        merchandising:  MerchandisingHelper,

        // Convenience: Tags custom-code data element calls this to get
        // a consent-gated sendEvent function it should use instead of
        // calling alloy() directly.
        getSendEvent: function () {
            return ConsentQueue.sendEvent.bind(ConsentQueue);
        }
    };

    // ─── WIRE CONSENT BRIDGE TO COOKIECONSENT ─────────────────────────────────
    // cookieconsent-init.js fires window.ccOnConsent(categories) when resolved.
    // We hijack that callback to feed our ConsentQueue.
    var _origOnConsent = window.ccOnConsent;
    window.ccOnConsent = function (categories) {
        var analyticsGranted = Array.isArray(categories)
            ? categories.indexOf('analytics') !== -1
            : !!categories;
        ConsentQueue.resolve(analyticsGranted);
        if (typeof _origOnConsent === 'function') _origOnConsent(categories);
    };

    // If consent was already resolved before this script loaded (cached decision),
    // read the stored cookieconsent state and flush immediately.
    try {
        var stored = localStorage.getItem('cc_cookie');
        if (stored) {
            var parsed = JSON.parse(stored);
            var cats = parsed.categories || [];
            if (cats.length) {
                ConsentQueue.resolve(cats.indexOf('analytics') !== -1);
            }
        }
    } catch (e) { /* localStorage blocked in private mode */ }

}(window));
