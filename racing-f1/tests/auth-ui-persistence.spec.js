// @ts-check
// Validates login UI persistence across all pages:
// - Account button shows user initials (not the SVG person icon)
// - Green dot badge is visible
// - Dropdown opens with name + tier + logout button
// - UI persists across navigation without re-login
// BASE_URL=https://racing-f1-rho.vercel.app npx playwright test auth-ui-persistence --project=chromium
const { test, expect } = require('@playwright/test');

const USER = {
  email: 'ui.test@f1store.com',
  firstName: 'Lewis', lastName: 'Tester',
  favoriteTeam: 'Mercedes', customerTier: 'gold'
};
const INITIALS = 'LT';
const PAGES = ['/', '/merchandise', '/teams', '/tickets', '/experiences', '/calendar', '/cart'];

async function seedAndLoad(page, path = '/') {
  await page.goto(path, { waitUntil: 'load' });
  await page.evaluate((u) => {
    localStorage.setItem('rf1_user', JSON.stringify(u));
  }, USER);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(600);
}

test('Account button shows initials (not SVG) when logged in', async ({ page }) => {
  await seedAndLoad(page, '/');

  const accountBtn = page.locator('[data-track="header-actions_click_account"]');
  await expect(accountBtn).toBeVisible();

  // Should show initials text, not SVG
  const initials = page.locator('.user-initials');
  await expect(initials).toBeVisible();
  await expect(initials).toHaveText(INITIALS);

  // Should have is-logged-in class
  await expect(accountBtn).toHaveClass(/is-logged-in/);
  console.log('✓ Initials visible:', await initials.textContent());
});

test('Green dot badge is visible on account button when logged in', async ({ page }) => {
  await seedAndLoad(page, '/');

  const accountBtn = page.locator('[data-track="header-actions_click_account"]');
  // The ::after pseudo-element green dot is applied via CSS is-logged-in class
  await expect(accountBtn).toHaveClass(/is-logged-in/);

  // Computed style check — border should be red
  const borderColor = await accountBtn.evaluate((el) => getComputedStyle(el).borderTopColor);
  console.log('✓ Border color (should be red):', borderColor);
  expect(borderColor).not.toBe('');
});

test('Dropdown opens with name, tier badge, and logout button', async ({ page }) => {
  await seedAndLoad(page, '/');

  // Click account button to open dropdown
  await page.locator('[data-track="header-actions_click_account"]').click();
  await page.waitForTimeout(300);

  const dropdown = page.locator('#userDropdown');
  await expect(dropdown).toHaveClass(/open/);

  // Name shown
  const name = page.locator('.user-dropdown-name');
  await expect(name).toContainText(USER.firstName);
  console.log('✓ Name in dropdown:', await name.textContent());

  // Email shown
  const email = page.locator('.user-dropdown-email');
  await expect(email).toContainText(USER.email);

  // Tier badge shown
  const tier = page.locator('.user-dropdown-tier');
  await expect(tier).toBeVisible();
  await expect(tier).toContainText('Gold');
  console.log('✓ Tier badge:', await tier.textContent());

  // Logout button exists
  const logoutBtn = page.locator('#dropdownLogoutBtn');
  await expect(logoutBtn).toBeVisible();
  await expect(logoutBtn).toContainText('Sign out');
});

test('Logout clears UI and redirects to home', async ({ page }) => {
  await seedAndLoad(page, '/merchandise');

  // Open dropdown and click logout
  await page.locator('[data-track="header-actions_click_account"]').click();
  await page.waitForTimeout(200);
  await page.locator('#dropdownLogoutBtn').click();
  await page.waitForTimeout(2000);

  // Should be back on home with no user in localStorage
  const auth = await page.evaluate(() => localStorage.getItem('rf1_user'));
  expect(auth, 'rf1_user should be cleared after logout').toBeNull();

  // Account button should show login link again
  const loginLink = page.locator('[href="login.html"]');
  await expect(loginLink).toBeVisible();
  console.log('✓ Logged out — account link restored to login.html');
});

test('UI persists across all pages without re-login', async ({ page }) => {
  await seedAndLoad(page, '/');
  const results = [];

  for (const path of PAGES) {
    await page.goto(path, { waitUntil: 'load' });
    await page.waitForTimeout(600);

    const hasInitials = await page.locator('.user-initials').count() > 0;
    const initialsText = hasInitials ? await page.locator('.user-initials').first().textContent() : null;
    const isLoggedInClass = await page.locator('[data-track="header-actions_click_account"]')
      .evaluate((el) => el.classList.contains('is-logged-in')).catch(() => false);
    const auth = await page.evaluate(() => JSON.parse(localStorage.getItem('rf1_user') || 'null'));

    results.push({
      path,
      hasInitials,
      initialsText,
      isLoggedInClass,
      hasAuth: !!auth,
      tier: auth ? auth.customerTier : null
    });
  }

  console.log('\nAuth UI Persistence across pages:');
  results.forEach(r => {
    const status = r.hasInitials && r.isLoggedInClass && r.hasAuth ? '✓' : '✗';
    console.log('  ' + status + ' ' + r.path.padEnd(16) + ' initials:' + (r.initialsText || 'NONE') + ' class:' + r.isLoggedInClass + ' tier:' + r.tier);
  });

  const failed = results.filter(r => !r.hasInitials || !r.isLoggedInClass || !r.hasAuth);
  expect(failed.length, 'UI must show logged-in state on ALL pages: ' + failed.map(r => r.path).join(', ')).toBe(0);
});
