import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './site/tests',
  use: { baseURL: 'http://127.0.0.1:4173', ...devices['Desktop Chrome'] },
  webServer: { command: 'python3 -m http.server 4173 --bind 127.0.0.1 --directory _site', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI },
});
