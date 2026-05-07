import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:4000',
  },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:4000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
