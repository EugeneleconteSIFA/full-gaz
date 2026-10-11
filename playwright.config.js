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
  ],
  webServer: { command: 'python3 -m http.server 8790 --bind 127.0.0.1', url: 'http://127.0.0.1:8790/correspondance.html', reuseExistingServer: true, stderr: 'ignore' },
});
