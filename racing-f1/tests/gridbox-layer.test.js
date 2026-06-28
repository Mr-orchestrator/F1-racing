/**
 * GridboxLayer Unit Tests
 * Tests for W3C-compliant data layer operations
 */

// Mock browser environment
const mockWindow = {
    gridboxLayer: null,
    dataLayer: [],
    digitalData: null,
    localStorage: {
        store: {},
        getItem: function(key) { return this.store[key] || null; },
        setItem: function(key, value) { this.store[key] = value; },
        removeItem: function(key) { delete this.store[key]; },
        clear: function() { this.store = {}; }
    },
    location: { href: 'http://localhost/test', pathname: '/test', search: '' },
    document: { referrer: '', title: 'Test Page' },
    navigator: { userAgent: 'Test Agent', language: 'en-US' },
    screen: { width: 1920, height: 1080 }
};

// Test utilities
const TestRunner = {
    passed: 0,
    failed: 0,
    results: [],
    
    assert: function(condition, message) {
        if (condition) {
            this.passed++;
            this.results.push({ status: 'PASS', message: message });
            console.log('✓ PASS:', message);
        } else {
            this.failed++;
            this.results.push({ status: 'FAIL', message: message });
            console.error('✗ FAIL:', message);
        }
    },
    
    assertEqual: function(actual, expected, message) {
        const condition = JSON.stringify(actual) === JSON.stringify(expected);
        if (!condition) {
            console.error('  Expected:', expected);
            console.error('  Actual:', actual);
        }
        this.assert(condition, message);
    },
    
    assertExists: function(value, message) {
        this.assert(value !== undefined && value !== null, message);
    },
    
    assertArray: function(value, message) {
        this.assert(Array.isArray(value), message);
    },
    
    reset: function() {
        this.passed = 0;
        this.failed = 0;
        this.results = [];
    },
    
    summary: function() {
        console.log('\n========================================');
        console.log('TEST SUMMARY');
        console.log('========================================');
        console.log('Passed:', this.passed);
        console.log('Failed:', this.failed);
        console.log('Total:', this.passed + this.failed);
        console.log('========================================\n');
        return { passed: this.passed, failed: this.failed };
    }
};

// =========================================
// TEST SUITES
// =========================================

function testGridboxLayerInitialization() {
    console.log('\n--- Test: GridboxLayer Initialization ---');
    
    // Check gridboxLayer exists
    TestRunner.assertExists(window.gridboxLayer, 'gridboxLayer should exist');
    
    // Check version
    TestRunner.assertExists(window.gridboxLayer.version, 'gridboxLayer.version should exist');
    
    // Check core arrays/objects exist
    TestRunner.assertArray(window.gridboxLayer.event, 'gridboxLayer.event should be array');
    TestRunner.assertArray(window.gridboxLayer.product, 'gridboxLayer.product should be array');
    TestRunner.assertArray(window.gridboxLayer.user, 'gridboxLayer.user should be array');
    TestRunner.assertExists(window.gridboxLayer.cart, 'gridboxLayer.cart should exist');
    TestRunner.assertExists(window.gridboxLayer.page, 'gridboxLayer.page should exist');
    TestRunner.assertExists(window.gridboxLayer.transaction, 'gridboxLayer.transaction should exist');
    
    // Check cart structure (W3C format)
    TestRunner.assertExists(window.gridboxLayer.cart.cartInfo, 'cart.cartInfo should exist');
    TestRunner.assertExists(window.gridboxLayer.cart.price, 'cart.price should exist');
    TestRunner.assertArray(window.gridboxLayer.cart.item, 'cart.item should be array');
    TestRunner.assertExists(window.gridboxLayer.cart.price.priceBreakdown, 'cart.price.priceBreakdown should exist');
    TestRunner.assertExists(window.gridboxLayer.cart.price.totalPrice, 'cart.price.totalPrice should exist');
    
    // Check digitalData alias
    TestRunner.assertEqual(window.digitalData, window.gridboxLayer, 'digitalData should be alias for gridboxLayer');
}

function testAddProduct() {
    console.log('\n--- Test: Add Product ---');
    
    const initialProductCount = window.gridboxLayer.product.length;
    const initialEventCount = window.gridboxLayer.event.length;
    
    // Add a product
    window.gridbox.addProduct({
        id: 'TEST_PROD_001',
        name: 'Test Product',
        price: 99.99,
        category: 'Test Category',
        brand: 'Test Brand'
    });
    
    // Check product was added
    TestRunner.assertEqual(
        window.gridboxLayer.product.length, 
        initialProductCount + 1, 
        'Product count should increase by 1'
    );
    
    // Check product structure
    const addedProduct = window.gridboxLayer.product.find(p => p.productInfo.productID === 'TEST_PROD_001');
    TestRunner.assertExists(addedProduct, 'Added product should exist in product[]');
    TestRunner.assertEqual(addedProduct.productInfo.productName, 'Test Product', 'Product name should match');
    TestRunner.assertEqual(addedProduct.price.basePrice, 99.99, 'Product price should match');
    TestRunner.assertEqual(addedProduct.category.primaryCategory, 'Test Category', 'Product category should match');
    
    // Check event was pushed
    TestRunner.assert(
        window.gridboxLayer.event.length > initialEventCount, 
        'Event should be pushed for ProductView'
    );
    
    // Check event structure (W3C format)
    const lastEvent = window.gridboxLayer.event[window.gridboxLayer.event.length - 1];
    TestRunner.assertExists(lastEvent.category, 'Event should have category');
    TestRunner.assertExists(lastEvent.eventInfo, 'Event should have eventInfo');
    TestRunner.assertExists(lastEvent.eventInfo.componentId, 'Event should have componentId');
    TestRunner.assertArray(lastEvent.attributes, 'Event should have attributes array');
    TestRunner.assertEqual(lastEvent.eventInfo.key, 'ProductView', 'Event key should be ProductView');
}

function testAddToCart() {
    console.log('\n--- Test: Add To Cart ---');
    
    const initialCartItemCount = window.gridboxLayer.cart.item.length;
    const initialEventCount = window.gridboxLayer.event.length;
    
    // Add item to cart
    window.gridbox.addToCart({
        id: 'CART_ITEM_001',
        name: 'Cart Test Item',
        price: 49.99,
        category: 'Cart Category'
    }, 2);
    
    // Check item was added to cart
    TestRunner.assertEqual(
        window.gridboxLayer.cart.item.length, 
        initialCartItemCount + 1, 
        'Cart item count should increase by 1'
    );
    
    // Check cart item structure
    const cartItem = window.gridboxLayer.cart.item.find(i => i.productInfo.productID === 'CART_ITEM_001');
    TestRunner.assertExists(cartItem, 'Cart item should exist');
    TestRunner.assertEqual(cartItem.quantity, 2, 'Cart item quantity should be 2');
    TestRunner.assertEqual(cartItem.price.basePrice, 49.99, 'Cart item price should match');
    
    // Check cart totals were recalculated
    TestRunner.assert(window.gridboxLayer.cart.price.cartTotal > 0, 'Cart total should be > 0');
    TestRunner.assert(window.gridboxLayer.cart.price.totalPrice.amount > 0, 'Cart totalPrice.amount should be > 0');
    
    // Check cartInfo was generated
    TestRunner.assertExists(window.gridboxLayer.cart.cartInfo.cartID, 'cartInfo.cartID should be generated');
    TestRunner.assertExists(window.gridboxLayer.cart.cartInfo.creationDate, 'cartInfo.creationDate should be set');
    
    // Check AddToCart event was pushed
    TestRunner.assert(
        window.gridboxLayer.event.length > initialEventCount, 
        'AddToCart event should be pushed'
    );
    
    // Check event structure
    const lastEvent = window.gridboxLayer.event[window.gridboxLayer.event.length - 1];
    TestRunner.assertEqual(lastEvent.eventInfo.key, 'AddToCart', 'Event key should be AddToCart');
    TestRunner.assertEqual(lastEvent.category.primaryCategory, 'UserEvent', 'Event category should be UserEvent');
    TestRunner.assertExists(lastEvent.eventInfo.componentId, 'AddToCart event should have componentId');
}

function testUpdateCartQuantity() {
    console.log('\n--- Test: Update Cart Quantity ---');
    
    // First add an item
    window.gridbox.addToCart({
        id: 'UPDATE_QTY_ITEM',
        name: 'Quantity Test Item',
        price: 25.00,
        category: 'Test'
    }, 1);
    
    const initialEventCount = window.gridboxLayer.event.length;
    
    // Update quantity
    window.gridbox.updateCartQuantity('UPDATE_QTY_ITEM', 5);
    
    // Check quantity was updated
    const cartItem = window.gridboxLayer.cart.item.find(i => i.productInfo.productID === 'UPDATE_QTY_ITEM');
    TestRunner.assertEqual(cartItem.quantity, 5, 'Cart item quantity should be updated to 5');
    
    // Check event was pushed
    TestRunner.assert(
        window.gridboxLayer.event.length > initialEventCount, 
        'UpdateCartQuantity event should be pushed'
    );
    
    const lastEvent = window.gridboxLayer.event[window.gridboxLayer.event.length - 1];
    TestRunner.assertEqual(lastEvent.eventInfo.key, 'UpdateCartQuantity', 'Event key should be UpdateCartQuantity');
}

function testRemoveFromCart() {
    console.log('\n--- Test: Remove From Cart ---');
    
    // First add an item
    window.gridbox.addToCart({
        id: 'REMOVE_ITEM',
        name: 'Remove Test Item',
        price: 15.00,
        category: 'Test'
    }, 1);
    
    const initialCartItemCount = window.gridboxLayer.cart.item.length;
    const initialEventCount = window.gridboxLayer.event.length;
    
    // Remove item
    window.gridbox.removeFromCart('REMOVE_ITEM');
    
    // Check item was removed
    const removedItem = window.gridboxLayer.cart.item.find(i => i.productInfo.productID === 'REMOVE_ITEM');
    TestRunner.assert(!removedItem, 'Removed item should not exist in cart');
    
    // Check event was pushed
    TestRunner.assert(
        window.gridboxLayer.event.length > initialEventCount, 
        'RemoveFromCart event should be pushed'
    );
    
    const lastEvent = window.gridboxLayer.event[window.gridboxLayer.event.length - 1];
    TestRunner.assertEqual(lastEvent.eventInfo.key, 'RemoveFromCart', 'Event key should be RemoveFromCart');
    TestRunner.assertEqual(lastEvent.category.primaryCategory, 'UserEvent', 'Event category should be UserEvent');
}

function testEventStructure() {
    console.log('\n--- Test: Event Structure (W3C Compliance) ---');
    
    // Push a custom event using track
    window.gridbox.track('gb_test_event', {
        CD: {
            test_key: 'test_value',
            another_key: 'another_value'
        }
    });
    
    const lastEvent = window.gridboxLayer.event[window.gridboxLayer.event.length - 1];
    
    // Check W3C required fields
    TestRunner.assertExists(lastEvent.category, 'Event must have category');
    TestRunner.assertExists(lastEvent.category.primaryCategory, 'Event must have category.primaryCategory');
    TestRunner.assertExists(lastEvent.eventInfo, 'Event must have eventInfo');
    TestRunner.assertExists(lastEvent.eventInfo.eventName, 'Event must have eventInfo.eventName');
    TestRunner.assertExists(lastEvent.eventInfo.timeStamp, 'Event must have eventInfo.timeStamp');
    TestRunner.assertExists(lastEvent.eventInfo.pageId, 'Event must have eventInfo.pageId');
    TestRunner.assertExists(lastEvent.eventInfo.pageInstanceId, 'Event must have eventInfo.pageInstanceId');
    TestRunner.assertArray(lastEvent.attributes, 'Event must have attributes array');
    
    // Check attributes format
    if (lastEvent.attributes.length > 0) {
        const attr = lastEvent.attributes[0];
        TestRunner.assertExists(attr.key, 'Attribute must have key');
        TestRunner.assertExists(attr.value, 'Attribute must have value');
    }
}

function testCartPriceCalculation() {
    console.log('\n--- Test: Cart Price Calculation ---');
    
    // Clear cart first
    window.gridbox.clearCart();
    
    // Add items with known prices
    window.gridbox.addToCart({ id: 'CALC_1', name: 'Item 1', price: 100.00, category: 'Test' }, 2); // 200
    window.gridbox.addToCart({ id: 'CALC_2', name: 'Item 2', price: 50.00, category: 'Test' }, 1);  // 50
    
    const cart = window.gridboxLayer.cart;
    
    // Base price should be 250
    TestRunner.assertEqual(cart.price.basePrice, 250, 'Base price should be 250');
    
    // Tax should be 10% (default taxRate)
    const expectedTax = 250 * 0.1;
    TestRunner.assertEqual(cart.price.priceBreakdown.tax.totalTax.amount, expectedTax, 'Tax should be 25');
    
    // Total should include tax
    const expectedTotal = 250 + expectedTax;
    TestRunner.assertEqual(cart.price.priceWithTax, expectedTotal, 'Price with tax should be 275');
    
    // W3C totalPrice should match
    TestRunner.assertEqual(cart.price.totalPrice.amount, cart.price.cartTotal, 'totalPrice.amount should match cartTotal');
}

function testUserDataStructure() {
    console.log('\n--- Test: User Data Structure ---');
    
    // Check user array exists
    TestRunner.assertArray(window.gridboxLayer.user, 'user should be array');
    TestRunner.assert(window.gridboxLayer.user.length > 0, 'user array should have at least one entry');
    
    // Check profile structure
    const userProfile = window.gridboxLayer.user[0];
    TestRunner.assertArray(userProfile.profile, 'user[0].profile should be array');
    
    const profileInfo = userProfile.profile[0].profileInfo;
    TestRunner.assertExists(profileInfo, 'profileInfo should exist');
    
    // profileID should be empty by default (only set for logged-in users)
    TestRunner.assertEqual(profileInfo.profileID, '', 'profileID should be empty for anonymous users');
    
    // anonymousId should exist
    TestRunner.assertExists(profileInfo.anonymousId, 'anonymousId should exist');
}

function testSetUser() {
    console.log('\n--- Test: Set User (Login) ---');
    
    const initialEventCount = window.gridboxLayer.event.length;
    
    // Set user (simulating login)
    window.gridbox.setUser({
        id: 'USER_123',
        name: 'Test User',
        email: 'test@example.com',
        type: 'premium'
    });
    
    const profileInfo = window.gridboxLayer.user[0].profile[0].profileInfo;
    
    // Check user data was set
    TestRunner.assertEqual(profileInfo.profileID, 'USER_123', 'profileID should be set after login');
    TestRunner.assertEqual(profileInfo.userName, 'Test User', 'userName should be set');
    TestRunner.assertEqual(profileInfo.email, 'test@example.com', 'email should be set');
    TestRunner.assertEqual(profileInfo.loginStatus, true, 'loginStatus should be true');
    
    // Check event was pushed
    TestRunner.assert(
        window.gridboxLayer.event.length > initialEventCount,
        'UserLogin event should be pushed'
    );
}

function testEventClassPattern() {
    console.log('\n--- Test: Enterprise Event Class Pattern ---');
    
    // Check GridboxEvents is exposed
    TestRunner.assertExists(window.gridbox.Events, 'gridbox.Events should exist');
    TestRunner.assertExists(window.gridbox.eventTrackService, 'gridbox.eventTrackService should exist');
    
    // Check COMPONENT_IDS constants
    TestRunner.assertExists(window.gridbox.Events.COMPONENT_IDS, 'Events.COMPONENT_IDS should exist');
    TestRunner.assertExists(window.gridbox.Events.COMPONENT_IDS.CART, 'COMPONENT_IDS.CART should exist');
    TestRunner.assertExists(window.gridbox.Events.COMPONENT_IDS.PRODUCT, 'COMPONENT_IDS.PRODUCT should exist');
    
    // Check BaseEvent class
    TestRunner.assertExists(window.gridbox.Events.BaseEvent, 'Events.BaseEvent class should exist');
    
    // Check domain-grouped event objects
    TestRunner.assertExists(window.gridbox.Events.Page, 'Events.Page should exist');
    TestRunner.assertExists(window.gridbox.Events.Product, 'Events.Product should exist');
    TestRunner.assertExists(window.gridbox.Events.Cart, 'Events.Cart should exist');
    TestRunner.assertExists(window.gridbox.Events.Checkout, 'Events.Checkout should exist');
    TestRunner.assertExists(window.gridbox.Events.User, 'Events.User should exist');
    TestRunner.assertExists(window.gridbox.Events.Promo, 'Events.Promo should exist');
    TestRunner.assertExists(window.gridbox.Events.Search, 'Events.Search should exist');
    TestRunner.assertExists(window.gridbox.Events.Custom, 'Events.Custom should exist');
    
    // Check flat access for backward compatibility
    TestRunner.assertExists(window.gridbox.Events.PageView, 'Events.PageView should exist');
    TestRunner.assertExists(window.gridbox.Events.ProductView, 'Events.ProductView should exist');
    TestRunner.assertExists(window.gridbox.Events.AddToCart, 'Events.AddToCart should exist');
    TestRunner.assertExists(window.gridbox.Events.RemoveFromCart, 'Events.RemoveFromCart should exist');
    TestRunner.assertExists(window.gridbox.Events.Purchase, 'Events.Purchase should exist');
    TestRunner.assertExists(window.gridbox.Events.CustomEvent, 'Events.CustomEvent should exist');
    
    // Test creating an event via domain group (enterprise pattern)
    const addToCartEvent = new window.gridbox.Events.Cart.addToCart({
        productId: 'PROD_001',
        productName: 'Test Product',
        productPrice: 99.99,
        productCategory: 'Electronics',
        quantity: 2,
        cartTotal: 199.98,
        pageId: 'CART'
    });
    
    // Check event structure matches enterprise pattern
    TestRunner.assertExists(addToCartEvent.eventInfo, 'Event should have eventInfo');
    TestRunner.assertExists(addToCartEvent.category, 'Event should have category');
    TestRunner.assertArray(addToCartEvent.attributes, 'Event should have attributes array');
    
    // Check eventInfo structure
    TestRunner.assertEqual(addToCartEvent.eventInfo.key, 'AddToCart', 'eventInfo.key should be AddToCart');
    TestRunner.assertEqual(addToCartEvent.eventInfo.componentId, 'CartComponent', 'eventInfo.componentId should exist');
    TestRunner.assertEqual(addToCartEvent.category.primaryCategory, 'UserEvent', 'category.primaryCategory should be UserEvent');
    
    // Check attributes were built dynamically by BaseEvent
    const productIdAttr = addToCartEvent.attributes.find(a => a.key === 'product_id');
    TestRunner.assertExists(productIdAttr, 'Should have product_id attribute');
    TestRunner.assertEqual(productIdAttr.value, 'PROD_001', 'product_id value should match');
    
    // Check PageID was added
    const pageIdAttr = addToCartEvent.attributes.find(a => a.key === 'PageID');
    TestRunner.assertExists(pageIdAttr, 'Should have PageID attribute');
    TestRunner.assertEqual(pageIdAttr.value, 'CART', 'PageID value should match');
}

function testEventTrackService() {
    console.log('\n--- Test: EventTrackService ---');
    
    const initialEventCount = window.gridboxLayer.event.length;
    
    // Use eventTrackService with Custom.customEvent (enterprise pattern)
    const customEvent = new window.gridbox.Events.Custom.customEvent(
        'TestCustomEvent',
        'Test custom event fired',
        'TestComponent',
        { productId: 'TEST_123', cartTotal: 50 },
        'CustomMetric'
    );
    
    window.gridbox.eventTrackService.addCustomEvent({ context: customEvent });
    
    // Check event was pushed
    TestRunner.assert(
        window.gridboxLayer.event.length > initialEventCount,
        'Custom event should be pushed via eventTrackService'
    );
    
    // Check event has required fields added by service
    const lastEvent = window.gridboxLayer.event[window.gridboxLayer.event.length - 1];
    TestRunner.assertExists(lastEvent.eventId, 'Event should have eventId added');
    TestRunner.assertExists(lastEvent.eventInfo.timeStamp, 'Event should have timeStamp added');
    TestRunner.assertExists(lastEvent.eventInfo.pageInstanceId, 'Event should have pageInstanceId added');
    
    // Test pushEvent shorthand with domain-grouped event
    const initialCount2 = window.gridboxLayer.event.length;
    window.gridbox.pushEvent(window.gridbox.Events.Product.productView, {
        productId: 'VIEW_PROD',
        productName: 'Viewed Product',
        productPrice: 50,
        productCategory: 'Books',
        pageId: 'PDP'
    });
    
    TestRunner.assert(
        window.gridboxLayer.event.length > initialCount2,
        'pushEvent shorthand should work with domain events'
    );
    
    // Test with flat access (backward compatibility)
    const initialCount3 = window.gridboxLayer.event.length;
    window.gridbox.pushEvent(window.gridbox.Events.AddToCart, {
        productId: 'CART_PROD',
        productName: 'Cart Product',
        productPrice: 75,
        cartTotal: 75,
        pageId: 'CART'
    });
    
    TestRunner.assert(
        window.gridboxLayer.event.length > initialCount3,
        'pushEvent should work with flat access events'
    );
}

function testCreateEventDynamic() {
    console.log('\n--- Test: Create Event Dynamically ---');
    
    const initialEventCount = window.gridboxLayer.event.length;
    
    // Create event using createEvent helper
    const dynamicEvent = window.gridbox.createEvent(
        'DynamicTestEvent',
        'Dynamic event created',
        'DynamicComponent',
        [
            { key: 'dynamic_key', value: 'dynamic_value' }
        ],
        'CustomEvent'
    );
    
    TestRunner.assertExists(dynamicEvent.eventInfo, 'Dynamic event should have eventInfo');
    TestRunner.assertEqual(dynamicEvent.eventInfo.key, 'DynamicTestEvent', 'Event key should match');
    TestRunner.assertEqual(dynamicEvent.category.primaryCategory, 'CustomEvent', 'Category should match');
    
    // Push it
    window.gridbox.eventTrackService.addCustomEvent({ context: dynamicEvent });
    
    TestRunner.assert(
        window.gridboxLayer.event.length > initialEventCount,
        'Dynamic event should be pushed'
    );
}

// =========================================
// ENTERPRISE PATTERN TESTS
// =========================================

function testConfigurationObserver() {
    console.log('\n--- Test: ConfigurationObserver (Enterprise Pattern) ---');
    
    // Check ConfigurationObserver is exposed
    TestRunner.assertExists(window.gridbox.ConfigurationObserver, 'gridbox.ConfigurationObserver should exist');
    TestRunner.assertExists(window.gridbox.createConfig, 'gridbox.createConfig should exist');
    
    // Create a config observer
    const defaultConfig = { theme: 'dark', language: 'en' };
    const configObserver = window.gridbox.createConfig('testConfig', defaultConfig);
    
    TestRunner.assertExists(configObserver, 'ConfigObserver should be created');
    TestRunner.assertExists(configObserver.asObservable, 'ConfigObserver should have asObservable method');
    TestRunner.assertExists(configObserver.next, 'ConfigObserver should have next method');
    TestRunner.assertExists(configObserver.getValue, 'ConfigObserver should have getValue method');
    
    // Test getValue
    const currentConfig = configObserver.getValue();
    TestRunner.assertEqual(currentConfig.theme, 'dark', 'Default theme should be dark');
    TestRunner.assertEqual(currentConfig.language, 'en', 'Default language should be en');
    
    // Test next (update config)
    configObserver.next({ theme: 'light' });
    const updatedConfig = configObserver.getValue();
    TestRunner.assertEqual(updatedConfig.theme, 'light', 'Theme should be updated to light');
    TestRunner.assertEqual(updatedConfig.language, 'en', 'Language should remain en');
}

function testTranslationKeys() {
    console.log('\n--- Test: TranslationKeys (Enterprise Pattern) ---');
    
    // Check TranslationKeys is exposed
    TestRunner.assertExists(window.gridbox.TranslationKeys, 'gridbox.TranslationKeys should exist');
    TestRunner.assertExists(window.gridbox.translate, 'gridbox.translate should exist');
    
    // Check translation key structure
    TestRunner.assertExists(window.gridbox.TranslationKeys.page, 'TranslationKeys.page should exist');
    TestRunner.assertExists(window.gridbox.TranslationKeys.cart, 'TranslationKeys.cart should exist');
    TestRunner.assertExists(window.gridbox.TranslationKeys.checkout, 'TranslationKeys.checkout should exist');
    TestRunner.assertExists(window.gridbox.TranslationKeys.user, 'TranslationKeys.user should exist');
    TestRunner.assertExists(window.gridbox.TranslationKeys.error, 'TranslationKeys.error should exist');
    
    // Check specific keys
    TestRunner.assertExists(window.gridbox.TranslationKeys.cart.addToCartSuccess, 'cart.addToCartSuccess key should exist');
    TestRunner.assertExists(window.gridbox.TranslationKeys.checkout.purchaseSuccessLabel, 'checkout.purchaseSuccessLabel key should exist');
}

function testGridboxStore() {
    console.log('\n--- Test: GridboxStore (Enterprise Pattern) ---');
    
    // Check store is exposed
    TestRunner.assertExists(window.gridbox.store, 'gridbox.store should exist');
    TestRunner.assertExists(window.gridbox.dispatch, 'gridbox.dispatch should exist');
    TestRunner.assertExists(window.gridbox.select, 'gridbox.select should exist');
    TestRunner.assertExists(window.gridbox.getState, 'gridbox.getState should exist');
    
    // Test getState
    const state = window.gridbox.getState();
    TestRunner.assertExists(state.cart, 'State should have cart');
    TestRunner.assertExists(state.user, 'State should have user');
    TestRunner.assertExists(state.page, 'State should have page');
    
    // Test dispatch CART_ADD_ITEM
    window.gridbox.dispatch({
        type: 'CART_ADD_ITEM',
        payload: { id: 'TEST_ITEM', price: 100, quantity: 2 }
    });
    
    const updatedState = window.gridbox.getState();
    TestRunner.assert(updatedState.cart.items.length > 0, 'Cart should have items after dispatch');
    TestRunner.assertEqual(updatedState.cart.total, 200, 'Cart total should be 200');
    
    // Test dispatch CART_CLEAR
    window.gridbox.dispatch({ type: 'CART_CLEAR' });
    const clearedState = window.gridbox.getState();
    TestRunner.assertEqual(clearedState.cart.items.length, 0, 'Cart should be empty after clear');
    TestRunner.assertEqual(clearedState.cart.total, 0, 'Cart total should be 0 after clear');
    
    // Test select with function
    window.gridbox.dispatch({
        type: 'USER_LOGIN',
        payload: { id: 'USER_1', name: 'Test User' }
    });
    const isLoggedIn = window.gridbox.select(s => s.user.isLoggedIn);
    TestRunner.assertEqual(isLoggedIn, true, 'User should be logged in');
    
    // Cleanup
    window.gridbox.dispatch({ type: 'USER_LOGOUT' });
}

function testSubscriptionManager() {
    console.log('\n--- Test: SubscriptionManager (Enterprise Pattern) ---');
    
    // Check SubscriptionManager is exposed
    TestRunner.assertExists(window.gridbox.SubscriptionManager, 'gridbox.SubscriptionManager should exist');
    TestRunner.assertExists(window.gridbox.createSubscriptionManager, 'gridbox.createSubscriptionManager should exist');
    
    // Create a subscription manager
    const subManager = window.gridbox.createSubscriptionManager();
    TestRunner.assertExists(subManager, 'SubscriptionManager should be created');
    TestRunner.assertExists(subManager.add, 'SubscriptionManager should have add method');
    TestRunner.assertExists(subManager.push, 'SubscriptionManager should have push method');
    TestRunner.assertExists(subManager.unsubscribeAll, 'SubscriptionManager should have unsubscribeAll method');
    TestRunner.assertExists(subManager.destroy, 'SubscriptionManager should have destroy method');
    
    // Test adding subscriptions
    let callCount = 0;
    const mockSub = {
        unsubscribe: function() { callCount++; }
    };
    
    subManager.add(mockSub);
    subManager.push(mockSub);
    
    // Test unsubscribeAll
    subManager.unsubscribeAll();
    TestRunner.assertEqual(callCount, 2, 'Both subscriptions should be unsubscribed');
}

function testRacingF1Events() {
    console.log('\n--- Test: Racing F1 Analytics Events ---');
    
    // Check RacingF1 is exposed
    TestRunner.assertExists(window.gridbox.RacingF1, 'gridbox.RacingF1 should exist');
    TestRunner.assertExists(window.gridbox.RacingF1.Events, 'gridbox.RacingF1.Events should exist');
    TestRunner.assertExists(window.gridbox.RacingF1.ComponentIds, 'gridbox.RacingF1.ComponentIds should exist');
    
    // Check component IDs
    TestRunner.assertExists(window.gridbox.RacingF1.ComponentIds.RACE_CALENDAR, 'RACE_CALENDAR component ID should exist');
    TestRunner.assertExists(window.gridbox.RacingF1.ComponentIds.TICKET_SELECTOR, 'TICKET_SELECTOR component ID should exist');
    TestRunner.assertExists(window.gridbox.RacingF1.ComponentIds.SEAT_MAP, 'SEAT_MAP component ID should exist');
    
    // Check event classes exist
    TestRunner.assertExists(window.gridbox.RacingF1.Events.raceViewed, 'raceViewed event should exist');
    TestRunner.assertExists(window.gridbox.RacingF1.Events.raceSelected, 'raceSelected event should exist');
    TestRunner.assertExists(window.gridbox.RacingF1.Events.ticketSelected, 'ticketSelected event should exist');
    TestRunner.assertExists(window.gridbox.RacingF1.Events.ticketAddedToCart, 'ticketAddedToCart event should exist');
    TestRunner.assertExists(window.gridbox.RacingF1.Events.seatMapViewed, 'seatMapViewed event should exist');
    TestRunner.assertExists(window.gridbox.RacingF1.Events.seatSelected, 'seatSelected event should exist');
    TestRunner.assertExists(window.gridbox.RacingF1.Events.driverProfileViewed, 'driverProfileViewed event should exist');
    TestRunner.assertExists(window.gridbox.RacingF1.Events.merchandiseViewed, 'merchandiseViewed event should exist');
    TestRunner.assertExists(window.gridbox.RacingF1.Events.hospitalityPackageViewed, 'hospitalityPackageViewed event should exist');
    
    // Check shorthand methods exist
    TestRunner.assertExists(window.gridbox.RacingF1.trackRaceView, 'trackRaceView shorthand should exist');
    TestRunner.assertExists(window.gridbox.RacingF1.trackTicketSelect, 'trackTicketSelect shorthand should exist');
    TestRunner.assertExists(window.gridbox.RacingF1.trackSeatSelect, 'trackSeatSelect shorthand should exist');
    
    // Test creating a Racing F1 event
    const raceEvent = new window.gridbox.RacingF1.Events.raceViewed({
        raceName: 'Monaco Grand Prix',
        raceLocation: 'Monte Carlo',
        raceDate: '2024-05-26',
        circuitName: 'Circuit de Monaco',
        pageId: 'RACE_DETAILS'
    });
    
    TestRunner.assertExists(raceEvent.eventInfo, 'Race event should have eventInfo');
    TestRunner.assertEqual(raceEvent.eventInfo.key, 'RaceViewed', 'Event key should be RaceViewed');
    TestRunner.assertEqual(raceEvent.eventInfo.componentId, 'RaceDetailsPres', 'Event componentId should match');
    TestRunner.assertArray(raceEvent.attributes, 'Event should have attributes array');
    
    // Check race-specific attributes were added
    const raceNameAttr = raceEvent.attributes.find(a => a.key === 'race_name');
    TestRunner.assertExists(raceNameAttr, 'Should have race_name attribute');
    TestRunner.assertEqual(raceNameAttr.value, 'Monaco Grand Prix', 'race_name should match');
    
    // Test shorthand method pushes event
    const initialEventCount = window.gridboxLayer.event.length;
    window.gridbox.RacingF1.trackTicketSelect({
        ticketType: 'VIP',
        ticketCategory: 'Grandstand',
        standName: 'K Stand',
        ticketPrice: 500,
        pageId: 'TICKET_PAGE'
    });
    
    TestRunner.assert(
        window.gridboxLayer.event.length > initialEventCount,
        'trackTicketSelect should push event to gridboxLayer.event[]'
    );
}

function testBaseEventClass() {
    console.log('\n--- Test: BaseEvent Class (For Custom Extensions) ---');
    
    // Check BaseEvent is exposed
    TestRunner.assertExists(window.gridbox.BaseEvent, 'gridbox.BaseEvent should exist');
    TestRunner.assertExists(window.gridbox.COMPONENT_IDS, 'gridbox.COMPONENT_IDS should exist');
    
    // Test creating custom event extending BaseEvent
    class MyCustomEvent extends window.gridbox.BaseEvent {
        constructor(params) {
            super(params);
            this.eventInfo = {
                key: 'MyCustomEvent',
                eventName: 'My custom event',
                componentId: 'MyComponent'
            };
            this.category = { primaryCategory: 'CustomEvent' };
            // Add custom attribute
            params.customField && this.attributes.push({ key: 'custom_field', value: String(params.customField) });
        }
    }
    
    const customEvent = new MyCustomEvent({
        productId: 'PROD_1',
        productName: 'Test Product',
        customField: 'custom_value',
        pageId: 'CUSTOM_PAGE'
    });
    
    TestRunner.assertExists(customEvent.eventInfo, 'Custom event should have eventInfo');
    TestRunner.assertEqual(customEvent.eventInfo.key, 'MyCustomEvent', 'Event key should be MyCustomEvent');
    TestRunner.assertArray(customEvent.attributes, 'Custom event should have attributes');
    
    // Check base attributes were added
    const productIdAttr = customEvent.attributes.find(a => a.key === 'product_id');
    TestRunner.assertExists(productIdAttr, 'Should have product_id from base class');
    
    // Check custom attribute was added
    const customAttr = customEvent.attributes.find(a => a.key === 'custom_field');
    TestRunner.assertExists(customAttr, 'Should have custom_field attribute');
    TestRunner.assertEqual(customAttr.value, 'custom_value', 'custom_field value should match');
}

// =========================================
// RUN ALL TESTS
// =========================================

function runAllTests() {
    console.log('========================================');
    console.log('GRIDBOXLAYER UNIT TESTS');
    console.log('========================================');
    
    TestRunner.reset();
    
    // Run test suites
    testGridboxLayerInitialization();
    testAddProduct();
    testAddToCart();
    testUpdateCartQuantity();
    testRemoveFromCart();
    testEventStructure();
    testCartPriceCalculation();
    testUserDataStructure();
    testSetUser();
    
    // Enterprise Event Class Pattern Tests
    testEventClassPattern();
    testEventTrackService();
    testCreateEventDynamic();
    
    // Enterprise Pattern Tests
    testConfigurationObserver();
    testTranslationKeys();
    testGridboxStore();
    testSubscriptionManager();
    testRacingF1Events();
    testBaseEventClass();
    
    // Print summary
    return TestRunner.summary();
}

// Export for browser or Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runAllTests, TestRunner };
} else if (typeof window !== 'undefined') {
    window.GridboxLayerTests = { runAllTests, TestRunner };
}
