// Playwright config for the M2 smoke test (docs/plans/active/m2-demo.md): Chromium only, against
// the Vite dev server on 5173. Not part of pnpm check (it needs the browser download); the deploy
// workflow runs it after pnpm check. A dev server already listening on 5173 is reused, so the
// test can run beside `pnpm dev` with HMR on.
import { defineConfig, devices } from '@playwright/test'

const BASE_URL = 'http://localhost:5173'
const CI = process.env.CI !== undefined && process.env.CI !== ''

export default defineConfig({
  testDir: 'tests/e2e',
  // One worker, tests in file order: every test opens its own browser context, but the dev
  // server and the Web Lock test are easier to reason about one at a time.
  fullyParallel: false,
  workers: 1,
  forbidOnly: CI,
  // No retries locally so a flake shows up as a failure; one retry on CI, with a trace of it.
  retries: CI ? 1 : 0,
  reporter: CI ? [['list'], ['github']] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm dev',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
