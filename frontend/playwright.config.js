import 'dotenv/config'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, devices } from '@playwright/test'
import { cucumberReporter, defineBddConfig } from 'playwright-bdd'

const configuredBaseURL = process.env.PLAYWRIGHT_BASE_URL
const baseURL = configuredBaseURL || 'http://localhost:3000'
const benchmark = process.env.E2E_BENCHMARK === 'true'
const reportRunId =
  process.env.PLAYWRIGHT_RUN_ID ||
  new Date().toISOString().replace(/[.:]/g, '-')
const reportDir =
  process.env.PLAYWRIGHT_REPORT_DIR || 'playwright/reports/' + reportRunId

const bddTestDir = defineBddConfig({
  features: './playwright/features/**/*.feature',
  steps: ['./playwright/support/fixtures.js', './playwright/steps/**/*.js'],
  outputDir: './playwright/.features-gen'
})

const sharedUse = {
  baseURL,
  actionTimeout: 20_000,
  navigationTimeout: 60_000,
  screenshot: 'only-on-failure',
  video: 'on',
  trace: benchmark ? 'off' : 'retain-on-failure',
  viewport: { width: 1280, height: 720 }
}

const firefoxUse = {}
if (process.platform === 'darwin') {
  // Keep Firefox app-data out of macOS 27's protected shared Firefox folder.
  const firefoxHome =
    process.env.CFFIXED_USER_HOME || resolve('playwright/.firefox-home')
  mkdirSync(firefoxHome, { recursive: true })
  firefoxUse.launchOptions = {
    env: { ...process.env, CFFIXED_USER_HOME: firefoxHome }
  }
}

const browserProjects = [
  {
    name: 'chrome',
    device: devices['Desktop Chrome'],
    browserOptions: { channel: 'chrome' }
  },
  {
    name: 'firefox',
    device: devices['Desktop Firefox'],
    browserOptions: firefoxUse
  },
  { name: 'webkit', device: devices['Desktop Safari'] }
]

const projects = browserProjects.flatMap(
  ({ name, device, browserOptions = {} }) => [
    {
      name,
      testDir: './playwright/e2e',
      testMatch: '**/*.spec.js',
      use: { ...sharedUse, ...device, ...browserOptions }
    },
    {
      name: name + '-bdd',
      testDir: bddTestDir,
      testMatch: '**/*.spec.js',
      use: { ...sharedUse, ...device, ...browserOptions }
    }
  ]
)

export default defineConfig({
  testDir: './playwright',
  outputDir: './playwright/artifacts',
  fullyParallel: true,
  workers: process.env.PLAYWRIGHT_WORKERS
    ? Number(process.env.PLAYWRIGHT_WORKERS)
    : undefined,
  forbidOnly: Boolean(process.env.CI),
  retries: !benchmark && process.env.CI ? 1 : 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: benchmark
    ? [['list'], ['json', { outputFile: reportDir + '/results.json' }]]
    : [
        ['list'],
        ['html', { outputFolder: reportDir + '/html', open: 'never' }],
        ['json', { outputFile: reportDir + '/results.json' }],
        ['junit', { outputFile: reportDir + '/junit.xml' }],
        cucumberReporter('html', {
          outputFile: reportDir + '/cucumber.html'
        })
      ],
  projects,
  ...(configuredBaseURL
    ? {}
    : {
        webServer: {
          command: 'npm run dev -- --strictPort',
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000
        }
      })
})
