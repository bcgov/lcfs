import 'dotenv/config'
import { defineConfig } from 'cypress'
import createBundler from '@bahmutov/cypress-esbuild-preprocessor'
import { addCucumberPreprocessorPlugin } from '@badeball/cypress-cucumber-preprocessor'
import { createEsbuildPlugin } from '@badeball/cypress-cucumber-preprocessor/esbuild'
import pg from 'pg'

const { Client } = pg

export default defineConfig({
  e2e: {
    supportFile: 'cypress/support/e2e.ts',
    testIsolation: false,
    specPattern: ['**/*.feature', '**/*.cy.js', '**/*.cy.ts'],
    excludeSpecPattern: ['**/*.skip.feature'],
    screenshotsFolder: 'cypress/screenshots',
    videosFolder: 'cypress/videos',
    // Global configurations
    reporter: 'mochawesome',
    reporterOptions: {
      reportDir: 'cypress/reports',
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

    // Viewport dimensions
    viewportWidth: 1280,
    viewportHeight: 720,

    // Base URL for tests
    baseUrl: process.env.CYPRESS_BASE_URL || 'http://localhost:3000',
    async setupNodeEvents(on, config) {
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
