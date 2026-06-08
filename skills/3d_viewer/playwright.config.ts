import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:4273',
    headless: true,
  },
  webServer: {
    command: `node ${import.meta.dirname}/scripts/serve.mjs`,
    port: 4273,
    reuseExistingServer: !process.env.CI,
  },
})
