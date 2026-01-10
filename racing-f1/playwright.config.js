// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  timeout: 30000,
  expect: {
    timeout: 10000,
  },
  
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  
  use: {
    baseURL: process.env.BASE_URL || 'https://racing-f1-rho.vercel.app',
    
    // Tracing & Screenshots
    trace: 'on',
    screenshot: 'on',
    video: 'on',
    
    // Browser settings
    headless: true,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    
    // Actions
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--disable-web-security']
        }
      },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 13'] },
    },
    {
      name: 'Tablet',
      use: { ...devices['iPad Pro 11'] },
    },
  ],
  
  outputDir: 'test-results/',
  
  webServer: {
    command: 'npx serve . -l 3000',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
