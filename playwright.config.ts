import { defineConfig, devices } from '@playwright/test';
import path from 'path';

// Use process.env.PORT by default and fallback to 5173
// Vite's default port is 5173
const PORT = process.env.PORT || 5173;

// Set webServer.url and use.baseURL with the dynamically assigned port
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './.e2e', // Directory where E2E tests are located
  timeout: 30 * 1000, // Timeout for each test
  expect: {
    timeout: 5000 // Timeout for expect assertions
  },
  fullyParallel: true, // Run tests in parallel
  forbidOnly: !!process.env.CI, // Fail the build on CI if test.only is left in code
  retries: process.env.CI ? 2 : 0, // Retry on CI only
  workers: process.env.CI ? 1 : undefined, // Opt for fewer workers on CI
  reporter: process.env.CI ? 'dot' : 'html', // Use 'dot' reporter on CI, 'html' locally

  // Shared settings for all the projects below
  use: {
    baseURL: baseURL,
    headless: !!process.env.CI, // Run headless on CI, headed locally
    trace: 'on-first-retry', // Collect trace when retrying the failed test
    // Optional: Add viewport settings
    // viewport: { width: 1280, height: 720 },
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Optional: Add Firefox and WebKit if needed
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // Web server configuration
  webServer: {
    // Command to start the dev server for the web package
    // Use preview for CI to test the build output
    command: process.env.CI 
      ? `pnpm --filter @gradient-tool/web preview --port ${PORT}` 
      : `pnpm --filter @gradient-tool/web dev --port ${PORT}`,
    url: baseURL,
    timeout: 120 * 1000, // 2 minutes timeout for the server to start
    reuseExistingServer: !process.env.CI, // Reuse dev server locally
    stdout: 'ignore',
    stderr: 'pipe',
  },
}); 