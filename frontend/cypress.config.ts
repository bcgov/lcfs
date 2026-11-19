import 'dotenv/config'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'cypress'
import createBundler from '@bahmutov/cypress-esbuild-preprocessor'
import { addCucumberPreprocessorPlugin } from '@badeball/cypress-cucumber-preprocessor'
import { createEsbuildPlugin } from '@badeball/cypress-cucumber-preprocessor/esbuild'
import pg from 'pg'

const { Client } = pg
const requestedArtifactBrowser = process.env.E2E_ARTIFACT_BROWSER
const comparisonFeature = process.env.E2E_COMPARISON_FEATURE === 'true'
const artifactBrowser =
  requestedArtifactBrowser &&
  ['chrome', 'firefox', 'webkit'].includes(requestedArtifactBrowser)
    ? requestedArtifactBrowser
    : undefined
const browserOutputSuffix = artifactBrowser ? `/${artifactBrowser}` : ''
const benchmark = process.env.E2E_BENCHMARK === 'true'
const reportDir =
  (process.env.E2E_REPORT_DIR || 'cypress/reports') + browserOutputSuffix

export default defineConfig({
  experimentalWebKitSupport: true,
  e2e: {
    supportFile: 'cypress/support/e2e.ts',
    testIsolation: false,
    specPattern: [
      'cypress/e2e/**/*.feature',
      'cypress/e2e/**/*.cy.js',
      'cypress/e2e/**/*.cy.ts'
    ],
    excludeSpecPattern: ['**/*.skip.feature'],
    screenshotsFolder: 'cypress/screenshots' + browserOutputSuffix,
    videosFolder: 'cypress/videos' + browserOutputSuffix,
    // Global configurations
    reporter: 'mochawesome',
    reporterOptions: {
      reportDir,
      reportFilename: 'results.json',
      overwrite: false,
      html: false,
      json: true
    },
    // Timeouts
    defaultCommandTimeout: 20000, // Time in milliseconds
    pageLoadTimeout: 60000, // Generous timeout to accommodate OAuth redirects

    // Screenshots for failed tests
    screenshotOnRunFailure: true,
    watchForFileChanges: false,
    // Video recording
    video: true,
    retries: {
      runMode: !benchmark && Boolean(process.env.CI) ? 1 : 0,
      openMode: 0
    },

    // Viewport dimensions
    viewportWidth: 1280,
    viewportHeight: 720,

    // Base URL for tests
    baseUrl: process.env.CYPRESS_BASE_URL || 'http://localhost:3000',
    async setupNodeEvents(on, config) {
      on('before:browser:launch', (browser, launchOptions) => {
        if (process.platform === 'darwin' && browser.family === 'firefox') {
          // Keep local Firefox runs in a private writable application-data directory.
          const firefoxHome = resolve(
            process.env.CFFIXED_USER_HOME || 'playwright/.firefox-home'
          )
          mkdirSync(firefoxHome, { recursive: true })
          launchOptions.env.CFFIXED_USER_HOME = firefoxHome
        }

        return launchOptions
      })

      if (artifactBrowser || comparisonFeature) {
        // The Cucumber preprocessor uses Cypress's public expose API for these overrides.
        config.expose = { ...config.expose }
        if (artifactBrowser) {
          config.expose.htmlOutput = reportDir + '/cucumber.html'
        }
        if (comparisonFeature) {
          config.expose.stepDefinitions =
            'cypress/e2e/Pages/User/PublicLogin.test.js'
        }
      }

      on('task', {
        log(message: unknown) {
          console.log(message)

          return null
        },
        table(message: unknown) {
          console.table(message)

          return null
        },
        async clearComplianceReports() {
          const client = new Client({
            user: process.env.DB_CYPRESS_USER || 'lcfs',
            host: process.env.DB_CYPRESS_HOST || 'localhost',
            database: process.env.DB_CYPRESS_NAME || 'lcfs',
            password: process.env.DB_CYPRESS_PASSWORD || 'development_only',
            port: Number.parseInt(process.env.DB_PORT || '5432', 10)
          })

          await client.connect()
          try {
            await client.query('truncate compliance_report cascade;')
            return 'Compliance reports cleared'
          } finally {
            await client.end()
          }
        },
        async createDraftTransfer({
          agreementDate
        }: {
          agreementDate: string
        }) {
          const client = new Client({
            user: process.env.DB_CYPRESS_USER || 'lcfs',
            host: process.env.DB_CYPRESS_HOST || 'localhost',
            database: process.env.DB_CYPRESS_NAME || 'lcfs',
            password: process.env.DB_CYPRESS_PASSWORD || 'development_only',
            port: Number.parseInt(process.env.DB_PORT || '5432', 10)
          })

          try {
            await client.connect()
            const result = await client.query(
              `WITH new_transfer AS (
                INSERT INTO transfer (
                  from_organization_id,
                  to_organization_id,
                  agreement_date,
                  quantity,
                  price_per_unit,
                  current_status_id
                )
                SELECT 1, 2, $1::timestamp, 100, 40.99, transfer_status_id
                FROM transfer_status
                WHERE status = 'Draft'
                RETURNING transfer_id, current_status_id
              )
              INSERT INTO transfer_history (
                transfer_id,
                transfer_status_id,
                user_profile_id,
                display_name
              )
              SELECT
                transfer_id,
                current_status_id,
                7,
                'Draft date persistence test'
              FROM new_transfer
              RETURNING transfer_id`,
              [agreementDate]
            )
            return result.rows[0].transfer_id
          } finally {
            await client.end()
          }
        },
        async deleteTransfer(transferId: number) {
          const client = new Client({
            user: process.env.DB_CYPRESS_USER || 'lcfs',
            host: process.env.DB_CYPRESS_HOST || 'localhost',
            database: process.env.DB_CYPRESS_NAME || 'lcfs',
            password: process.env.DB_CYPRESS_PASSWORD || 'development_only',
            port: Number.parseInt(process.env.DB_PORT || '5432', 10)
          })

          try {
            await client.connect()
            await client.query(
              'DELETE FROM transfer_history WHERE transfer_id = $1',
              [transferId]
            )
            await client.query('DELETE FROM transfer WHERE transfer_id = $1', [
              transferId
            ])
          } finally {
            await client.end()
          }
          return null
        }
      })

      // Register cucumber plugin after custom tasks so plugin tasks are not overridden.
      await addCucumberPreprocessorPlugin(on, config)

      on(
        'file:preprocessor',
        createBundler({
          plugins: [createEsbuildPlugin(config)]
        })
      )

      return config
    }
  }
})
