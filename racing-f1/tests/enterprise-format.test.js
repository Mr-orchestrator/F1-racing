// =========================================
// ENTERPRISE DIGITALDATA FORMAT UNIT TESTS
// Tests gridboxLayer matches exact enterprise structure
// =========================================

const EnterpriseFormatTests = {
    passed: 0,
    failed: 0,
    results: [],
    
    // Assert helpers
    assert: function(condition, message) {
        if (condition) {
            this.passed++;
            this.results.push({ status: 'PASS', message });
            console.log('✅ PASS:', message);
        } else {
            this.failed++;
            this.results.push({ status: 'FAIL', message });
            console.error('❌ FAIL:', message);
        }
    },
    
    assertEqual: function(actual, expected, message) {
        const pass = actual === expected;
        if (!pass) {
            message += ` (expected: ${expected}, got: ${actual})`;
        }
        this.assert(pass, message);
    },
    
    assertExists: function(value, message) {
        this.assert(value !== undefined && value !== null, message);
    },
    
    assertArray: function(value, message) {
        this.assert(Array.isArray(value), message);
    },
    
    assertObject: function(value, message) {
        this.assert(typeof value === 'object' && value !== null && !Array.isArray(value), message);
    },
    
    reset: function() {
        this.passed = 0;
        this.failed = 0;
        this.results = [];
        // Reset gridboxLayer for fresh tests
        if (window.gridboxLayer) {
            window.gridboxLayer.event = [];
            window.gridboxLayer.product = [];
            window.gridboxLayer.cart.item = [];
            window.gridboxLayer.cart.price.totalPrice.amount = 0;
            window.gridboxLayer.cart.cartInfo.cartID = '';
            window.gridboxLayer.offer = [];
            window.gridboxLayer.traveller = [];
            window.gridboxLayer.fareFamilyNames = [];
        }
    },
    
    summary: function() {
        console.log('\n========================================');
        console.log(`TOTAL: ${this.passed + this.failed} | PASSED: ${this.passed} | FAILED: ${this.failed}`);
        console.log('========================================\n');
        return { passed: this.passed, failed: this.failed, results: this.results };
    }
};

// =========================================
// TEST: gridboxLayer Base Structure
// =========================================
function testGridboxLayerBaseStructure() {
    console.log('\n--- Test: gridboxLayer Base Structure ---');
    
    const gl = window.gridboxLayer;
    
    // Version fields
    EnterpriseFormatTests.assertExists(gl.version, 'gridboxLayer.version should exist');
    EnterpriseFormatTests.assertExists(gl.libVersion, 'gridboxLayer.libVersion should exist');
    
    // Core arrays
    EnterpriseFormatTests.assertArray(gl.event, 'gridboxLayer.event should be array');
    EnterpriseFormatTests.assertArray(gl.product, 'gridboxLayer.product should be array');
    EnterpriseFormatTests.assertArray(gl.offer, 'gridboxLayer.offer should be array');
    EnterpriseFormatTests.assertArray(gl.fareFamilyNames, 'gridboxLayer.fareFamilyNames should be array');
    EnterpriseFormatTests.assertArray(gl.traveller, 'gridboxLayer.traveller should be array');
    
    // Core objects
    EnterpriseFormatTests.assertObject(gl.digitalTouchpoint, 'gridboxLayer.digitalTouchpoint should be object');
    EnterpriseFormatTests.assertObject(gl.transaction, 'gridboxLayer.transaction should be object');
    EnterpriseFormatTests.assertObject(gl.searchInput, 'gridboxLayer.searchInput should be object');
    EnterpriseFormatTests.assertObject(gl.page, 'gridboxLayer.page should be object');
    EnterpriseFormatTests.assertObject(gl.cart, 'gridboxLayer.cart should be object');
    EnterpriseFormatTests.assertObject(gl.upsellBookingFlow, 'gridboxLayer.upsellBookingFlow should be object');
    
    // User array structure
    EnterpriseFormatTests.assertArray(gl.user, 'gridboxLayer.user should be array');
    EnterpriseFormatTests.assertExists(gl.user[0], 'gridboxLayer.user[0] should exist');
    EnterpriseFormatTests.assertArray(gl.user[0].profile, 'gridboxLayer.user[0].profile should be array');
    
    // Finished flag
    EnterpriseFormatTests.assertEqual(typeof gl.finished, 'boolean', 'gridboxLayer.finished should be boolean');
    
    // Decision ID
    EnterpriseFormatTests.assertEqual(typeof gl.decisionId, 'string', 'gridboxLayer.decisionId should be string');
}

// =========================================
// TEST: digitalTouchpoint Structure
// =========================================
function testDigitalTouchpointStructure() {
    console.log('\n--- Test: digitalTouchpoint Structure ---');
    
    const dt = window.gridboxLayer.digitalTouchpoint;
    
    // Category
    EnterpriseFormatTests.assertObject(dt.category, 'digitalTouchpoint.category should be object');
    EnterpriseFormatTests.assertExists(dt.category.primaryCategory, 'digitalTouchpoint.category.primaryCategory should exist');
    EnterpriseFormatTests.assertExists(dt.category.subCategory, 'digitalTouchpoint.category.subCategory should exist');
    
    // TouchpointInfo
    EnterpriseFormatTests.assertObject(dt.touchpointInfo, 'digitalTouchpoint.touchpointInfo should be object');
    EnterpriseFormatTests.assertExists(dt.touchpointInfo.language, 'touchpointInfo.language should exist');
    EnterpriseFormatTests.assertExists(dt.touchpointInfo.bookingFlow, 'touchpointInfo.bookingFlow should exist');
    EnterpriseFormatTests.assertExists(dt.touchpointInfo.currency, 'touchpointInfo.currency should exist');
    
    // Version
    EnterpriseFormatTests.assertObject(dt.version, 'digitalTouchpoint.version should be object');
    EnterpriseFormatTests.assertExists(dt.version.solution, 'version.solution should exist');
    EnterpriseFormatTests.assertExists(dt.version.content, 'version.content should exist');
}

// =========================================
// TEST: Transaction Structure
// =========================================
function testTransactionStructure() {
    console.log('\n--- Test: Transaction Structure ---');
    
    const tx = window.gridboxLayer.transaction;
    
    // PNR
    EnterpriseFormatTests.assertObject(tx.PNR, 'transaction.PNR should be object');
    EnterpriseFormatTests.assertEqual(typeof tx.PNR.recLoc, 'string', 'PNR.recLoc should be string');
    EnterpriseFormatTests.assertEqual(typeof tx.PNR.creationDate, 'string', 'PNR.creationDate should be string');
    
    // Total
    EnterpriseFormatTests.assertObject(tx.total, 'transaction.total should be object');
    EnterpriseFormatTests.assertObject(tx.total.totalPrice, 'total.totalPrice should be object');
    EnterpriseFormatTests.assertExists(tx.total.totalPrice.amount, 'totalPrice.amount should exist');
    EnterpriseFormatTests.assertExists(tx.total.totalPrice.currency, 'totalPrice.currency should exist');
    
    // PriceBreakdown
    EnterpriseFormatTests.assertObject(tx.total.priceBreakdown, 'total.priceBreakdown should be object');
    EnterpriseFormatTests.assertObject(tx.total.priceBreakdown.baseFarePrice, 'priceBreakdown.baseFarePrice should be object');
    EnterpriseFormatTests.assertObject(tx.total.priceBreakdown.tax, 'priceBreakdown.tax should be object');
    
    // Payment
    EnterpriseFormatTests.assertArray(tx.payment, 'transaction.payment should be array');
}

// =========================================
// TEST: Cart Structure (Enterprise Format)
// =========================================
function testCartStructure() {
    console.log('\n--- Test: Cart Structure (Enterprise Format) ---');
    
    const cart = window.gridboxLayer.cart;
    
    // CartInfo
    EnterpriseFormatTests.assertObject(cart.cartInfo, 'cart.cartInfo should be object');
    EnterpriseFormatTests.assertEqual(typeof cart.cartInfo.cartID, 'string', 'cartInfo.cartID should be string');
    EnterpriseFormatTests.assertEqual(typeof cart.cartInfo.creationDate, 'string', 'cartInfo.creationDate should be string');
    
    // Price structure
    EnterpriseFormatTests.assertObject(cart.price, 'cart.price should be object');
    EnterpriseFormatTests.assertObject(cart.price.priceBreakdown, 'price.priceBreakdown should be object');
    EnterpriseFormatTests.assertObject(cart.price.priceBreakdown.tax, 'priceBreakdown.tax should be object');
    EnterpriseFormatTests.assertObject(cart.price.priceBreakdown.tax.surcharge, 'tax.surcharge should be object');
    EnterpriseFormatTests.assertObject(cart.price.priceBreakdown.tax.totalTax, 'tax.totalTax should be object');
    
    // TotalPrice
    EnterpriseFormatTests.assertObject(cart.price.totalPrice, 'price.totalPrice should be object');
    EnterpriseFormatTests.assertExists(cart.price.totalPrice.currency, 'totalPrice.currency should exist');
    EnterpriseFormatTests.assertEqual(typeof cart.price.totalPrice.amount, 'number', 'totalPrice.amount should be number');
    
    // PricePerTravellerType
    EnterpriseFormatTests.assertArray(cart.price.pricePerTravellerType, 'price.pricePerTravellerType should be array');
    
    // Item array
    EnterpriseFormatTests.assertArray(cart.item, 'cart.item should be array');
}

// =========================================
// TEST: Page Structure
// =========================================
function testPageStructure() {
    console.log('\n--- Test: Page Structure ---');
    
    const page = window.gridboxLayer.page;
    
    // PageInfo
    EnterpriseFormatTests.assertObject(page.pageInfo, 'page.pageInfo should be object');
    EnterpriseFormatTests.assertEqual(typeof page.pageInfo.pageID, 'string', 'pageInfo.pageID should be string');
    EnterpriseFormatTests.assertEqual(typeof page.pageInfo.pageName, 'string', 'pageInfo.pageName should be string');
    
    // Category
    EnterpriseFormatTests.assertObject(page.category, 'page.category should be object');
    EnterpriseFormatTests.assertEqual(typeof page.category.primaryCategory, 'string', 'category.primaryCategory should be string');
}

// =========================================
// TEST: User Structure
// =========================================
function testUserStructure() {
    console.log('\n--- Test: User Structure ---');
    
    const user = window.gridboxLayer.user[0];
    
    EnterpriseFormatTests.assertArray(user.profile, 'user.profile should be array');
    
    const profileInfo = user.profile[0].profileInfo;
    EnterpriseFormatTests.assertObject(profileInfo, 'profileInfo should be object');
    EnterpriseFormatTests.assertEqual(typeof profileInfo.OS, 'string', 'profileInfo.OS should be string');
    EnterpriseFormatTests.assertEqual(typeof profileInfo.deviceType, 'string', 'profileInfo.deviceType should be string');
    EnterpriseFormatTests.assertEqual(typeof profileInfo.userAgent, 'string', 'profileInfo.userAgent should be string');
    EnterpriseFormatTests.assertEqual(typeof profileInfo.loginStatus, 'boolean', 'profileInfo.loginStatus should be boolean');
    EnterpriseFormatTests.assertEqual(typeof profileInfo.loginPersistence, 'boolean', 'profileInfo.loginPersistence should be boolean');
}

// =========================================
// TEST: addProduct Creates Correct Structure (F1 Merchandise)
// =========================================
function testAddProductStructure() {
    console.log('\n--- Test: addProduct Creates Correct Structure (F1 Apparel) ---');
    
    // Add F1 merchandise product
    window.gridbox.addProduct({
        id: 'RB-JKT-2024',
        name: '2024 Team Jacket',
        price: 159.99,
        currency: 'USD',
        categoryType: 'Apparel',
        details: {
            brand: 'Red Bull Racing',
            sku: 'RB-JKT-2024',
            size: 'M',
            color: 'Navy Blue'
        }
    });
    
    // Check product was added to product[]
    const product = window.gridboxLayer.product.find(p => 
        p.productInfo && p.productInfo.productID === 'RB-JKT-2024'
    );
    
    EnterpriseFormatTests.assertExists(product, 'Product should be added to product[]');
    
    // Check structure
    EnterpriseFormatTests.assertObject(product.category, 'product.category should be object');
    EnterpriseFormatTests.assertEqual(product.category.primaryCategory, 'Apparel', 'primaryCategory should be Apparel');
    
    EnterpriseFormatTests.assertObject(product.productInfo, 'product.productInfo should be object');
    EnterpriseFormatTests.assertEqual(product.productInfo.productID, 'RB-JKT-2024', 'productID should match');
    
    EnterpriseFormatTests.assertObject(product.productInfo.productDetails, 'productDetails should be object');
    
    // Check nested details
    const details = product.productInfo.productDetails.apparel;
    EnterpriseFormatTests.assertExists(details, 'productDetails.apparel should exist');
    EnterpriseFormatTests.assertEqual(details.name, '2024 Team Jacket', 'name should match');
    EnterpriseFormatTests.assertObject(details.price, 'price should be object');
    EnterpriseFormatTests.assertObject(details.price.totalPrice, 'totalPrice should be object');
    EnterpriseFormatTests.assertEqual(details.price.totalPrice.amount, 159.99, 'price amount should match');
    EnterpriseFormatTests.assertEqual(details.price.totalPrice.currency, 'USD', 'currency should match');
    
    // Check event was pushed
    const productEvent = window.gridboxLayer.event.find(e => 
        e.eventInfo && e.eventInfo.key === 'ProductView'
    );
    EnterpriseFormatTests.assertExists(productEvent, 'ProductView event should be pushed');
}

// =========================================
// TEST: Add Race Ticket Creates Correct Structure
// =========================================
function testAddRaceTicketStructure() {
    console.log('\n--- Test: Add Race Ticket Creates Correct Structure ---');
    
    // Add a race ticket product
    window.gridbox.addProduct({
        id: 'MONACO-GP-VIP-2024',
        name: 'Monaco GP VIP Package',
        price: 2499.99,
        currency: 'USD',
        categoryType: 'RaceTicket',
        details: {
            raceName: 'Monaco Grand Prix',
            raceDate: '2024-05-26',
            circuit: 'Circuit de Monaco',
            grandstand: 'K Stand',
            ticketType: 'VIP',
            includes: ['Paddock Access', 'Pit Lane Walk', 'Driver Meet']
        }
    });
    
    // Check product was added
    const product = window.gridboxLayer.product.find(p => 
        p.productInfo && p.productInfo.productID === 'MONACO-GP-VIP-2024'
    );
    
    EnterpriseFormatTests.assertExists(product, 'RaceTicket should be added to product[]');
    EnterpriseFormatTests.assertEqual(product.category.primaryCategory, 'RaceTicket', 'primaryCategory should be RaceTicket');
    
    // Check raceticket details
    const ticketDetails = product.productInfo.productDetails.raceticket;
    EnterpriseFormatTests.assertExists(ticketDetails, 'productDetails.raceticket should exist');
    EnterpriseFormatTests.assertEqual(ticketDetails.name, 'Monaco GP VIP Package', 'name should match');
    EnterpriseFormatTests.assertEqual(ticketDetails.price.totalPrice.amount, 2499.99, 'price should match');
    EnterpriseFormatTests.assertEqual(ticketDetails.price.totalPrice.currency, 'USD', 'currency should match');
    
    // Check event was pushed
    const productEvent = window.gridboxLayer.event.find(e => 
        e.eventInfo && e.eventInfo.key === 'ProductView'
    );
    EnterpriseFormatTests.assertExists(productEvent, 'ProductView event should be pushed');
}

// =========================================
// TEST: addToCart Creates Product and Cart Reference (F1 Merchandise)
// =========================================
function testAddToCartCreatesProductAndReference() {
    console.log('\n--- Test: addToCart Creates Product and Cart Reference ---');
    
    // Add F1 merchandise to cart
    window.gridbox.addToCart({
        id: 'FER-CAP-2024',
        name: 'Scuderia Ferrari Cap',
        price: 39.99,
        currency: 'USD',
        categoryType: 'Accessories'
    }, 2);
    
    // Check product was added to product[]
    const product = window.gridboxLayer.product.find(p => 
        p.productInfo && p.productInfo.productID === 'FER-CAP-2024'
    );
    EnterpriseFormatTests.assertExists(product, 'Product should be added to product[]');
    EnterpriseFormatTests.assertEqual(product.category.primaryCategory, 'Accessories', 'Category should be Accessories');
    
    // Check cart.item[] has reference (not full product data)
    const cartItem = window.gridboxLayer.cart.item.find(i => 
        i.productInfo && i.productInfo.productID === 'FER-CAP-2024'
    );
    EnterpriseFormatTests.assertExists(cartItem, 'Cart.item should have reference');
    EnterpriseFormatTests.assertEqual(cartItem.productInfo.productID, 'FER-CAP-2024', 'Cart item productID should match');
    EnterpriseFormatTests.assertEqual(cartItem.productInfo.quantity, 2, 'Cart item quantity should be 2');
    
    // Cart item should NOT have full product data (enterprise pattern)
    EnterpriseFormatTests.assert(!cartItem.productInfo.productDetails, 'Cart item should NOT have productDetails (reference only)');
    EnterpriseFormatTests.assert(!cartItem.price, 'Cart item should NOT have price (reference only)');
    
    // Check event was pushed
    const addToCartEvent = window.gridboxLayer.event.find(e => 
        e.eventInfo && e.eventInfo.key === 'AddToCart'
    );
    EnterpriseFormatTests.assertExists(addToCartEvent, 'AddToCart event should be pushed');
}

// =========================================
// TEST: Event Structure Matches Enterprise Format
// =========================================
function testEventStructureMatchesEnterprise() {
    console.log('\n--- Test: Event Structure Matches Enterprise Format ---');
    
    // Get the last event
    const event = window.gridboxLayer.event[window.gridboxLayer.event.length - 1];
    
    // Category
    EnterpriseFormatTests.assertObject(event.category, 'event.category should be object');
    EnterpriseFormatTests.assertExists(event.category.primaryCategory, 'category.primaryCategory should exist');
    
    // EventInfo
    EnterpriseFormatTests.assertObject(event.eventInfo, 'event.eventInfo should be object');
    EnterpriseFormatTests.assertExists(event.eventInfo.key, 'eventInfo.key should exist');
    EnterpriseFormatTests.assertExists(event.eventInfo.eventName, 'eventInfo.eventName should exist');
    EnterpriseFormatTests.assertExists(event.eventInfo.timeStamp, 'eventInfo.timeStamp should exist');
    EnterpriseFormatTests.assertExists(event.eventInfo.pageId, 'eventInfo.pageId should exist');
    EnterpriseFormatTests.assertExists(event.eventInfo.pageInstanceId, 'eventInfo.pageInstanceId should exist');
    
    // Attributes
    EnterpriseFormatTests.assertArray(event.attributes, 'event.attributes should be array');
    
    // Check attributes have key-value structure
    if (event.attributes.length > 0) {
        const attr = event.attributes[0];
        EnterpriseFormatTests.assertExists(attr.key, 'attribute should have key');
        EnterpriseFormatTests.assertExists(attr.value, 'attribute should have value');
    }
    
    // Check PageID attribute exists
    const pageIdAttr = event.attributes.find(a => a.key === 'PageID');
    EnterpriseFormatTests.assertExists(pageIdAttr, 'Event should have PageID attribute');
}

// =========================================
// TEST: Cart Total Calculation (F1 Merchandise)
// =========================================
function testCartTotalCalculation() {
    console.log('\n--- Test: Cart Total Calculation ---');
    
    // Clear and add fresh items
    window.gridboxLayer.cart.item = [];
    window.gridboxLayer.product = [];
    
    // Add F1 merchandise items
    window.gridbox.addToCart({ id: 'MER-PLO-2024', name: 'Mercedes Team Polo', price: 79.99, currency: 'USD', categoryType: 'Apparel' }, 1);
    window.gridbox.addToCart({ id: 'MCL-CAP-2024', name: 'McLaren Papaya Cap', price: 34.99, currency: 'USD', categoryType: 'Accessories' }, 2);
    
    // Check total is calculated correctly (79.99*1 + 34.99*2 = 149.97)
    const total = window.gridboxLayer.cart.price.totalPrice.amount;
    EnterpriseFormatTests.assertEqual(total, 149.97, 'Cart total should be 149.97 (79.99 + 34.99*2)');
    
    // Check cart ID was generated
    EnterpriseFormatTests.assert(window.gridboxLayer.cart.cartInfo.cartID.length > 0, 'Cart ID should be generated');
    EnterpriseFormatTests.assert(window.gridboxLayer.cart.cartInfo.creationDate.length > 0, 'Cart creation date should be set');
}

// =========================================
// TEST: Multiple F1 Merchandise Products
// =========================================
function testMultipleF1Products() {
    console.log('\n--- Test: Multiple F1 Merchandise Products ---');
    
    // Clear previous
    window.gridboxLayer.product = [];
    window.gridboxLayer.cart.item = [];
    
    // Add multiple F1 merchandise products
    const products = [
        { id: 'RB-JKT-2024', name: '2024 Red Bull Team Jacket', price: 159.99, category: 'Apparel', brand: 'Red Bull Racing' },
        { id: 'MER-PLO-2024', name: 'Mercedes Team Polo Shirt', price: 79.99, category: 'Apparel', brand: 'Mercedes-AMG' },
        { id: 'FER-CAP-2024', name: 'Scuderia Ferrari Cap', price: 39.99, category: 'Accessories', brand: 'Scuderia Ferrari' },
        { id: 'MCL-MOD-2024', name: 'McLaren MCL38 Model Car', price: 89.99, category: 'Collectibles', brand: 'McLaren Racing' }
    ];
    
    products.forEach(p => {
        window.gridbox.addToCart({
            id: p.id,
            name: p.name,
            price: p.price,
            currency: 'USD',
            categoryType: p.category,
            details: { brand: p.brand }
        }, 1);
    });
    
    // Check all products were added
    EnterpriseFormatTests.assertEqual(window.gridboxLayer.product.length, 4, 'Should have 4 products');
    
    // Check all cart references were added
    EnterpriseFormatTests.assertEqual(window.gridboxLayer.cart.item.length, 4, 'Should have 4 cart items');
    
    // Check different categories
    const apparelProduct = window.gridboxLayer.product.find(p => 
        p.category.primaryCategory === 'Apparel'
    );
    EnterpriseFormatTests.assertExists(apparelProduct, 'Should have Apparel product');
    
    const accessoriesProduct = window.gridboxLayer.product.find(p => 
        p.category.primaryCategory === 'Accessories'
    );
    EnterpriseFormatTests.assertExists(accessoriesProduct, 'Should have Accessories product');
    
    const collectiblesProduct = window.gridboxLayer.product.find(p => 
        p.category.primaryCategory === 'Collectibles'
    );
    EnterpriseFormatTests.assertExists(collectiblesProduct, 'Should have Collectibles product');
}

// =========================================
// TEST: SearchInput Structure
// =========================================
function testSearchInputStructure() {
    console.log('\n--- Test: SearchInput Structure ---');
    
    const si = window.gridboxLayer.searchInput;
    
    EnterpriseFormatTests.assertObject(si.category, 'searchInput.category should be object');
    EnterpriseFormatTests.assertEqual(typeof si.category.primaryCategory, 'string', 'primaryCategory should be string');
    
    EnterpriseFormatTests.assertObject(si.searchInputInfo, 'searchInput.searchInputInfo should be object');
    EnterpriseFormatTests.assertArray(si.searchInputInfo.flightDetails, 'flightDetails should be array');
    EnterpriseFormatTests.assertEqual(typeof si.searchInputInfo.flowType, 'string', 'flowType should be string');
}

// =========================================
// TEST: UpsellBookingFlow Structure
// =========================================
function testUpsellBookingFlowStructure() {
    console.log('\n--- Test: UpsellBookingFlow Structure ---');
    
    const ubf = window.gridboxLayer.upsellBookingFlow;
    
    EnterpriseFormatTests.assertObject(ubf, 'upsellBookingFlow should be object');
    EnterpriseFormatTests.assertEqual(typeof ubf.upsellVerticalOutbound, 'number', 'upsellVerticalOutbound should be number');
    EnterpriseFormatTests.assertEqual(typeof ubf.upsellHorizontalOutbound, 'number', 'upsellHorizontalOutbound should be number');
    EnterpriseFormatTests.assertEqual(typeof ubf.upsellVerticalInbound, 'number', 'upsellVerticalInbound should be number');
    EnterpriseFormatTests.assertEqual(typeof ubf.upsellHorizontalInbound, 'number', 'upsellHorizontalInbound should be number');
    EnterpriseFormatTests.assertEqual(typeof ubf.upsellHorizontalCart, 'number', 'upsellHorizontalCart should be number');
}

// =========================================
// TEST: Event Push with Enterprise Event Classes
// =========================================
function testEventClassPush() {
    console.log('\n--- Test: Event Class Push ---');
    
    const initialCount = window.gridboxLayer.event.length;
    
    // Push using eventTrackService (enterprise pattern)
    const customEvent = new window.gridbox.Events.Custom.customEvent(
        'TestEnterpriseEvent',
        'Test enterprise event push',
        'TestComponent',
        { productId: 'PROD_123', cartTotal: 500 },
        'CustomMetric'
    );
    
    window.gridbox.eventTrackService.addCustomEvent({ context: customEvent });
    
    EnterpriseFormatTests.assert(
        window.gridboxLayer.event.length > initialCount,
        'Event should be pushed via eventTrackService'
    );
    
    const lastEvent = window.gridboxLayer.event[window.gridboxLayer.event.length - 1];
    EnterpriseFormatTests.assertEqual(lastEvent.eventInfo.key, 'TestEnterpriseEvent', 'Event key should match');
    EnterpriseFormatTests.assertEqual(lastEvent.category.primaryCategory, 'CustomMetric', 'Category should match');
}

// =========================================
// TEST: Full E2E Flow - Add, Update, Remove
// =========================================
function testFullE2EFlow() {
    console.log('\n--- Test: Full E2E Flow (Add → Update → Remove) ---');
    
    // Reset
    window.gridboxLayer.product = [];
    window.gridboxLayer.cart.item = [];
    window.gridboxLayer.event = [];
    
    // STEP 1: Add products to cart
    window.gridbox.addToCart({
        id: 'RB-JKT-2024',
        name: '2024 Red Bull Team Jacket',
        price: 159.99,
        currency: 'USD',
        categoryType: 'Apparel'
    }, 1);
    
    window.gridbox.addToCart({
        id: 'FER-CAP-2024',
        name: 'Scuderia Ferrari Cap',
        price: 39.99,
        currency: 'USD',
        categoryType: 'Accessories'
    }, 2);
    
    // Verify products added
    EnterpriseFormatTests.assertEqual(window.gridboxLayer.product.length, 2, 'E2E: Should have 2 products after add');
    EnterpriseFormatTests.assertEqual(window.gridboxLayer.cart.item.length, 2, 'E2E: Should have 2 cart items after add');
    
    // Verify cart total (159.99 + 39.99*2 = 239.97)
    EnterpriseFormatTests.assertEqual(
        window.gridboxLayer.cart.price.totalPrice.amount, 
        239.97, 
        'E2E: Cart total should be 239.97 after add'
    );
    
    // STEP 2: Update quantity
    window.gridbox.updateCartQuantity('FER-CAP-2024', 3);
    
    // Verify quantity updated
    const capItem = window.gridboxLayer.cart.item.find(i => i.productInfo.productID === 'FER-CAP-2024');
    EnterpriseFormatTests.assertEqual(capItem.productInfo.quantity, 3, 'E2E: Cap quantity should be 3 after update');
    
    // Verify cart total recalculated (159.99 + 39.99*3 = 279.96)
    EnterpriseFormatTests.assertEqual(
        window.gridboxLayer.cart.price.totalPrice.amount, 
        279.96, 
        'E2E: Cart total should be 279.96 after update'
    );
    
    // STEP 3: Remove one item
    window.gridbox.removeFromCart('RB-JKT-2024');
    
    // Verify item removed from cart (but product stays in product[])
    EnterpriseFormatTests.assertEqual(window.gridboxLayer.cart.item.length, 1, 'E2E: Should have 1 cart item after remove');
    EnterpriseFormatTests.assertEqual(window.gridboxLayer.product.length, 2, 'E2E: Should still have 2 products after remove');
    
    // Verify cart total (39.99*3 = 119.97)
    EnterpriseFormatTests.assertEqual(
        window.gridboxLayer.cart.price.totalPrice.amount, 
        119.97, 
        'E2E: Cart total should be 119.97 after remove'
    );
    
    // STEP 4: Verify events pushed
    const addEvents = window.gridboxLayer.event.filter(e => e.eventInfo && e.eventInfo.key === 'AddToCart');
    EnterpriseFormatTests.assertEqual(addEvents.length, 2, 'E2E: Should have 2 AddToCart events');
    
    const updateEvents = window.gridboxLayer.event.filter(e => e.eventInfo && e.eventInfo.key === 'UpdateCartQuantity');
    EnterpriseFormatTests.assertEqual(updateEvents.length, 1, 'E2E: Should have 1 UpdateCartQuantity event');
    
    const removeEvents = window.gridboxLayer.event.filter(e => e.eventInfo && e.eventInfo.key === 'RemoveFromCart');
    EnterpriseFormatTests.assertEqual(removeEvents.length, 1, 'E2E: Should have 1 RemoveFromCart event');
}

// =========================================
// TEST: Website Product Data Correlation
// =========================================
function testWebsiteProductCorrelation() {
    console.log('\n--- Test: Website Product Data Correlation ---');
    
    // Reset
    window.gridboxLayer.product = [];
    window.gridboxLayer.cart.item = [];
    
    // Simulate adding product from merchandise.html (exact data attributes)
    const websiteProducts = [
        { id: 'RB-JKT-2024', name: '2024 Team Jacket', price: 159.99, category: 'Apparel' },
        { id: 'MER-PLO-2024', name: 'Team Polo Shirt', price: 79.99, category: 'Apparel' },
        { id: 'FER-CAP-LC16', name: 'Leclerc Signature Cap', price: 45.00, category: 'Accessories' },
        { id: 'MCL-MOD-38', name: 'MCL38 1:18 Scale Model', price: 249.99, category: 'Collectibles' }
    ];
    
    websiteProducts.forEach(p => {
        window.gridbox.addToCart({
            id: p.id,
            name: p.name,
            price: p.price,
            currency: 'USD',
            categoryType: p.category
        }, 1);
    });
    
    // Verify all products correlate
    EnterpriseFormatTests.assertEqual(window.gridboxLayer.product.length, 4, 'Correlation: Should have 4 products');
    
    // Check each product has correct category
    const apparelProducts = window.gridboxLayer.product.filter(p => p.category.primaryCategory === 'Apparel');
    EnterpriseFormatTests.assertEqual(apparelProducts.length, 2, 'Correlation: Should have 2 Apparel products');
    
    const accessoriesProducts = window.gridboxLayer.product.filter(p => p.category.primaryCategory === 'Accessories');
    EnterpriseFormatTests.assertEqual(accessoriesProducts.length, 1, 'Correlation: Should have 1 Accessories product');
    
    const collectiblesProducts = window.gridboxLayer.product.filter(p => p.category.primaryCategory === 'Collectibles');
    EnterpriseFormatTests.assertEqual(collectiblesProducts.length, 1, 'Correlation: Should have 1 Collectibles product');
    
    // Verify cart total matches expected (159.99 + 79.99 + 45.00 + 249.99 = 534.97)
    EnterpriseFormatTests.assertEqual(
        window.gridboxLayer.cart.price.totalPrice.amount,
        534.97,
        'Correlation: Cart total should be 534.97'
    );
}

// =========================================
// TEST: Cart Sync Function Compatibility
// =========================================
function testCartSyncCompatibility() {
    console.log('\n--- Test: Cart Sync Compatibility with app.js ---');
    
    // Reset
    window.gridboxLayer.product = [];
    window.gridboxLayer.cart.item = [];
    
    // Add products
    window.gridbox.addToCart({
        id: 'MER-CAP-LH44',
        name: 'Hamilton Cap',
        price: 42.00,
        currency: 'USD',
        categoryType: 'Accessories'
    }, 2);
    
    // Simulate what app.js syncFromGridboxLayer does
    const products = window.gridboxLayer.product || [];
    const syncedItems = window.gridboxLayer.cart.item.map(function(cartItem) {
        const productID = cartItem.productInfo ? cartItem.productInfo.productID : '';
        const quantity = cartItem.productInfo ? (cartItem.productInfo.quantity || 1) : 1;
        
        const product = products.find(function(p) {
            return p.productInfo && p.productInfo.productID === productID;
        });
        
        let name = '';
        let price = 0;
        let category = '';
        
        if (product) {
            category = product.category ? product.category.primaryCategory : '';
            if (product.productInfo && product.productInfo.productDetails) {
                const categoryKey = category.toLowerCase();
                const details = product.productInfo.productDetails[categoryKey];
                if (details) {
                    name = details.name || '';
                    if (details.price && details.price.totalPrice) {
                        price = details.price.totalPrice.amount || 0;
                    }
                }
            }
        }
        
        return { id: productID, name: name, price: price, category: category, quantity: quantity };
    });
    
    // Verify sync worked correctly
    EnterpriseFormatTests.assertEqual(syncedItems.length, 1, 'Sync: Should have 1 synced item');
    EnterpriseFormatTests.assertEqual(syncedItems[0].id, 'MER-CAP-LH44', 'Sync: Product ID should match');
    EnterpriseFormatTests.assertEqual(syncedItems[0].name, 'Hamilton Cap', 'Sync: Product name should match');
    EnterpriseFormatTests.assertEqual(syncedItems[0].price, 42.00, 'Sync: Product price should match');
    EnterpriseFormatTests.assertEqual(syncedItems[0].category, 'Accessories', 'Sync: Product category should match');
    EnterpriseFormatTests.assertEqual(syncedItems[0].quantity, 2, 'Sync: Product quantity should match');
}

// =========================================
// RUN ALL ENTERPRISE FORMAT TESTS
// =========================================
function runEnterpriseFormatTests() {
    console.log('========================================');
    console.log('ENTERPRISE DIGITALDATA FORMAT TESTS');
    console.log('========================================');
    
    EnterpriseFormatTests.reset();
    
    // Structure tests
    testGridboxLayerBaseStructure();
    testDigitalTouchpointStructure();
    testTransactionStructure();
    testCartStructure();
    testPageStructure();
    testUserStructure();
    testSearchInputStructure();
    testUpsellBookingFlowStructure();
    
    // Functionality tests (F1 Merchandise)
    testAddProductStructure();
    testAddRaceTicketStructure();
    testAddToCartCreatesProductAndReference();
    testEventStructureMatchesEnterprise();
    testCartTotalCalculation();
    testMultipleF1Products();
    testEventClassPush();
    
    // E2E and Correlation tests
    testFullE2EFlow();
    testWebsiteProductCorrelation();
    testCartSyncCompatibility();
    
    return EnterpriseFormatTests.summary();
}

// Export
if (typeof window !== 'undefined') {
    window.EnterpriseFormatTests = EnterpriseFormatTests;
    window.runEnterpriseFormatTests = runEnterpriseFormatTests;
}
