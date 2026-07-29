import { defineConfig, devices } from '@playwright/test';

const port = process.env.PLAYWRIGHT_PORT ?? '5173';
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  reporter: 'line',
  use: {
    baseURL,
    channel: 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: `node node_modules/vite/bin/vite.js build apps/frontend --configLoader runner && node node_modules/vite/bin/vite.js preview apps/frontend --configLoader runner --host 127.0.0.1 --port ${port} --strictPort`,
    env: {
      VERCEL_ENV: 'preview',
      VITE_ENABLE_PLAYTEST_DIAGNOSTICS: 'true',
      VITE_ENABLE_TOPOLOGY_LAB: 'true',
      VITE_ENABLE_MODEL_LAB: 'true',
    },
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
