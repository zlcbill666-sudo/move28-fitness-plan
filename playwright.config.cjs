const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  use: {
    baseURL: 'http://127.0.0.1:8765',
    browserName: 'chromium',
    channel: 'chrome',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'node tests/e2e/helpers/static-server.cjs 8765',
    url: 'http://127.0.0.1:8765/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  },
  projects: [
    {
      name: 'desktop',
      use: { viewport: { width: 1280, height: 800 } }
    },
    {
      name: 'mobile',
      use: {
        ...devices['iPhone 13'],
        browserName: 'chromium',
        viewport: { width: 390, height: 844 }
      }
    }
  ]
});
