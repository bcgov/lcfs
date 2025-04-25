import 'dotenv/config'
import { defineConfig } from 'cypress'
import createBundler from '@bahmutov/cypress-esbuild-preprocessor'
import { addCucumberPreprocessorPlugin } from '@badeball/cypress-cucumber-preprocessor'
import { createEsbuildPlugin } from '@badeball/cypress-cucumber-preprocessor/esbuild'
import pg from 'pg'

const { Client } = pg

export default defineConfig({
  e2e: {
    supportFile: 'cypress/support/e2e.js',
    testIsolation: false,
    experimentalSessionAndOrigin: true,
    specPattern: ['**/*.feature', '**/*.cy.js'],
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
    pageLoadTimeout: 20000, // Time in milliseconds

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
      // This is required for the preprocessor to be able to generate JSON reports after each run, and more,
      await addCucumberPreprocessorPlugin(on, config)

      on(
        'file:preprocessor',
        createBundler({
          plugins: [createEsbuildPlugin(config)]
        })
      )

      on('task', {
        log(message) {
          console.log(message)

          return null
        },
        table(message) {
          console.table(message)

          return null
        },
        clearComplianceReports() {
          return new Promise((resolve, reject) => {
            const client = new Client({
              user: process.env.DB_CYPRESS_USER || 'lcfs',
              host: process.env.DB_CYPRESS_HOST || 'localhost',
              database: process.env.DB_CYPRESS_NAME || 'lcfs',
              password: process.env.DB_CYPRESS_PASSWORD || 'development_only',
              port: parseInt(process.env.DB_PORT || '5432')
            })

            client.connect()
            client.query('truncate compliance_report cascade;', (err, res) => {
              client.end()
              if (err) reject(err)
              else resolve('Compliance reports cleared')
            })
          })
        }
      })

      return config
    }
  }
})
