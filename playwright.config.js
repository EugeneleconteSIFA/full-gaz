const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'tests',
  testMatch: /.*\.spec\.js/,
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:8790', browserName: 'chromium' },
  projects: [
    { name: 'mobile-390', use: { viewport: { width: 390, height: 844 }, hasTouch: true } },
    { name: 'tablette-820', use: { viewport: { width: 820, height: 1180 }, hasTouch: true } },
    { name: 'ordi-1440', use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: { command: 'rm -rf .state-e2e && DEV=1 PORT=8790 STATE_DIRECTORY=.state-e2e node server/server.mjs', url: 'http://127.0.0.1:8790/api/health', reuseExistingServer: false },
});
