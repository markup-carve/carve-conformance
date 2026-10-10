import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './tests',
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4175', trace: 'retain-on-failure' },
  webServer: { command: 'python3 -m http.server 4175 --bind 127.0.0.1 --directory _site', url: 'http://127.0.0.1:4175', reuseExistingServer: !process.env.CI },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name:'firefox',use:{...devices['Desktop Firefox']} },
    { name:'webkit',use:{...devices['Desktop Safari']} },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
})
