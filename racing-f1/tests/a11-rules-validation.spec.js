// @ts-check
// Validates all a11 rules: P1 (User/Search/Promo) + P2 (F1 domain)
// BASE_URL=https://racing-f1-rho.vercel.app npx playwright test a11-rules-validation --project=chromium
const { test, expect } = require('@playwright/test');

function captureBeacons(page) {
  const beacons = [];
  page.on('response', async (res) => {
    const url = res.url();
    if (/\/b\/ss\//.test(url)) {
      const u = new URL(url);
      beacons.push({
        events:  u.searchParams.get('events') || '',
        products: decodeURIComponent(u.searchParams.get('products') || ''),
        pe:      u.searchParams.get('pe') || '',
        pev2:    decodeURIComponent(u.searchParams.get('pev2') || ''),
        cc:      u.searchParams.get('cc') || '',
        v6:      u.searchParams.get('v6') || '',
        v7:      u.searchParams.get('v7') || '',
        v9:      u.searchParams.get('v9') || '',
        v11:     u.searchParams.get('v11') || '',
        v12:     u.searchParams.get('v12') || '',
        v13:     u.searchParams.get('v13') || '',
        v14:     u.searchParams.get('v14') || '',
        v15:     u.searchParams.get('v15') || '',
        c3:      u.searchParams.get('c3') || '',
        status:  res.status(),
      });
    }
  });
  return beacons;
}

async function pushEvent(page, payload) {
  await page.evaluate((p) => {
    window.adobeDataLayer = window.adobeDataLayer || [];
    window.adobeDataLayer.push(p);
  }, payload);
  await page.waitForTimeout(2500);
}

// ── P1 ──────────────────────────────────────────────────────────────────────

test('User logged in fires event3 + eVar6', async ({ page }) => {
  const b = captureBeacons(page);
  await page.goto('/', { waitUntil: 'networkidle' });
  await pushEvent(page, { event: 'User logged in', attributes: { user_id: 'u1', user_type: 'registered', login_status: true } });
  console.log('LOGIN >>>', JSON.stringify(b.filter(x => x.events), null, 2));
  const hit = b.find(x => x.events === 'event3');
  expect(hit, 'User logged in should fire event3').toBeTruthy();
  expect(hit.v6, 'eVar6 should be "logged in"').toBe('logged in');
  expect(hit.status).toBe(200);
});

test('User signed up fires event4', async ({ page }) => {
  const b = captureBeacons(page);
  await page.goto('/', { waitUntil: 'networkidle' });
  await pushEvent(page, { event: 'User signed up', attributes: { user_id: 'u2', user_type: 'new' } });
  console.log('SIGNUP >>>', JSON.stringify(b.filter(x => x.events), null, 2));
  const hit = b.find(x => x.events === 'event4');
  expect(hit, 'User signed up should fire event4').toBeTruthy();
  expect(hit.status).toBe(200);
});

test('User logged out sets eVar6=logged out', async ({ page }) => {
  const b = captureBeacons(page);
  await page.goto('/', { waitUntil: 'networkidle' });
  await pushEvent(page, { event: 'User logged out', attributes: { user_id: 'u1' } });
  console.log('LOGOUT >>>', JSON.stringify(b.filter(x => x.pev2.includes('Logout') || x.v6), null, 2));
  const hit = b.find(x => x.pev2 === 'User Logout');
  expect(hit, 'User logged out beacon should fire').toBeTruthy();
  expect(hit.v6, 'eVar6 should be "logged out"').toBe('logged out');
  expect(hit.status).toBe(200);
});

test('Search performed fires event2 + eVar9', async ({ page }) => {
  const b = captureBeacons(page);
  await page.goto('/', { waitUntil: 'networkidle' });
  await pushEvent(page, { event: 'Search performed', attributes: { search_term: 'red bull jacket', search_results: 5 } });
  console.log('SEARCH >>>', JSON.stringify(b.filter(x => x.events), null, 2));
  const hit = b.find(x => x.events === 'event2');
  expect(hit, 'Search performed should fire event2').toBeTruthy();
  expect(hit.v9, 'eVar9 should contain search term').toBe('red bull jacket');
  expect(hit.status).toBe(200);
});

test('Promo code applied fires event5 + eVar11', async ({ page }) => {
  const b = captureBeacons(page);
  await page.goto('/cart', { waitUntil: 'networkidle' });
  await pushEvent(page, { event: 'Promo code applied', attributes: { promo_code: 'F1SAVE10', promo_discount: 10 } });
  console.log('PROMO >>>', JSON.stringify(b.filter(x => x.events), null, 2));
  const hit = b.find(x => x.events === 'event5');
  expect(hit, 'Promo applied should fire event5').toBeTruthy();
  expect(hit.v11, 'eVar11 should contain promo code').toBe('F1SAVE10');
  expect(hit.status).toBe(200);
});

test('Error occurred fires event10 + prop3', async ({ page }) => {
  const b = captureBeacons(page);
  await page.goto('/', { waitUntil: 'networkidle' });
  await pushEvent(page, { event: 'Error occurred', attributes: { error_type: 'payment_error', ga_errorMessage: 'Card declined' } });
  console.log('ERROR >>>', JSON.stringify(b.filter(x => x.events), null, 2));
  const hit = b.find(x => x.events === 'event10');
  expect(hit, 'Error occurred should fire event10').toBeTruthy();
  expect(hit.c3, 'prop3 should contain error message').toBeTruthy();
  expect(hit.status).toBe(200);
});

// ── P2 ──────────────────────────────────────────────────────────────────────

test('Race details viewed sets eVar12', async ({ page }) => {
  const b = captureBeacons(page);
  await page.goto('/calendar', { waitUntil: 'networkidle' });
  await pushEvent(page, { event: 'Race details viewed', attributes: { race_name: 'Monaco Grand Prix', race_location: 'Monaco' } });
  console.log('RACE >>>', JSON.stringify(b.filter(x => x.v12), null, 2));
  const hit = b.find(x => x.v12 === 'Monaco Grand Prix');
  expect(hit, 'Race details viewed should set eVar12').toBeTruthy();
  expect(hit.status).toBe(200);
});

test('Ticket type selected fires event6 + eVar13', async ({ page }) => {
  const b = captureBeacons(page);
  await page.goto('/tickets', { waitUntil: 'networkidle' });
  await pushEvent(page, { event: 'Ticket type selected', attributes: { ticket_type: 'General Admission', ticket_category: 'Standard', stand_name: 'T1', ticket_price: 299 } });
  console.log('TICKET >>>', JSON.stringify(b.filter(x => x.events), null, 2));
  const hit = b.find(x => x.events === 'event6');
  expect(hit, 'Ticket selected should fire event6').toBeTruthy();
  expect(hit.v13, 'eVar13 should contain ticket type').toBe('General Admission');
  expect(hit.status).toBe(200);
});

test('Seat selected fires event7', async ({ page }) => {
  const b = captureBeacons(page);
  await page.goto('/tickets', { waitUntil: 'networkidle' });
  await pushEvent(page, { event: 'Seat selected', attributes: { seat_id: 'A12', row: 'A', section: 'T1', seat_price: 299 } });
  console.log('SEAT >>>', JSON.stringify(b.filter(x => x.events), null, 2));
  const hit = b.find(x => x.events === 'event7');
  expect(hit, 'Seat selected should fire event7').toBeTruthy();
  expect(hit.status).toBe(200);
});

test('Team profile viewed sets eVar14', async ({ page }) => {
  const b = captureBeacons(page);
  await page.goto('/teams', { waitUntil: 'networkidle' });
  await pushEvent(page, { event: 'Team profile viewed', attributes: { team_name: 'Ferrari' } });
  console.log('TEAM >>>', JSON.stringify(b.filter(x => x.v14), null, 2));
  const hit = b.find(x => x.v14 === 'Ferrari');
  expect(hit, 'Team profile viewed should set eVar14').toBeTruthy();
  expect(hit.status).toBe(200);
});

test('Experience booked fires event8 + eVar15', async ({ page }) => {
  const b = captureBeacons(page);
  await page.goto('/experiences', { waitUntil: 'networkidle' });
  await pushEvent(page, { event: 'Experience booked', attributes: { experience_name: 'Pit Lane Walk', experience_type: 'VIP', experience_price: 499 } });
  console.log('EXPERIENCE >>>', JSON.stringify(b.filter(x => x.events), null, 2));
  const hit = b.find(x => x.events === 'event8');
  expect(hit, 'Experience booked should fire event8').toBeTruthy();
  expect(hit.v15, 'eVar15 should contain experience name').toBe('Pit Lane Walk');
  expect(hit.status).toBe(200);
});

test('Hospitality package selected fires event9', async ({ page }) => {
  const b = captureBeacons(page);
  await page.goto('/experiences', { waitUntil: 'networkidle' });
  await pushEvent(page, { event: 'Hospitality package selected', attributes: { package_name: 'Paddock Club', package_price: 1499 } });
  console.log('HOSPITALITY >>>', JSON.stringify(b.filter(x => x.events), null, 2));
  const hit = b.find(x => x.events === 'event9');
  expect(hit, 'Hospitality selected should fire event9').toBeTruthy();
  expect(hit.status).toBe(200);
});

test('View cart fires with products string', async ({ page }) => {
  const b = captureBeacons(page);
  await page.goto('/cart', { waitUntil: 'networkidle' });
  await pushEvent(page, { event: 'View cart', attributes: { cart_total: 159.99, item_count: 1, item_0_id: 'RB-JKT-2024', item_0_qty: 1, item_0_price: 159.99 } });
  console.log('VIEW CART >>>', JSON.stringify(b.filter(x => x.products && x.pev2.includes('Cart')), null, 2));
  const hit = b.find(x => x.pev2 === 'View Cart');
  expect(hit, 'View cart beacon should fire').toBeTruthy();
  expect(hit.products, 'products should contain cart item').toContain('RB-JKT-2024');
  expect(hit.status).toBe(200);
});

test('ClearCart fires scRemove', async ({ page }) => {
  const b = captureBeacons(page);
  await page.goto('/cart', { waitUntil: 'networkidle' });
  await pushEvent(page, { event: 'ClearCart', attributes: { items_cleared: 1, value_cleared: 159.99 } });
  console.log('CLEAR CART >>>', JSON.stringify(b.filter(x => x.events), null, 2));
  const hit = b.find(x => x.events === 'scRemove' && x.pev2 === 'Clear Cart');
  expect(hit, 'ClearCart should fire scRemove').toBeTruthy();
  expect(hit.status).toBe(200);
});
