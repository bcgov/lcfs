import { defineConfig } from 'cypress'
import vitePreprocessor from 'cypress-vite'
import path from 'path'
import { fileURLToPath } from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  // Global configurations
  reporter: 'mochawesome',
  reporterOptions: {
    reportDir: 'cypress/reports',
    overwrite: false,
    html: false,
    json: true
  },
  e2e: {
    // Timeouts
    defaultCommandTimeout: 20000, // Time in milliseconds
    pageLoadTimeout: 40000, // Time in milliseconds

    // Screenshots for failed tests
    screenshotOnRunFailure: true,

    // Video recording
    video: true,

    // Viewport dimensions
    viewportWidth: 1280,
    viewportHeight: 720,

    // Base URL for tests
    baseUrl: 'http://localhost:3000',

    // Node events and plugin configuration
    setupNodeEvents(on, config) {
      // Task for logging
      on('task', {
        log(message) {
          console.log(message)
          return null
        }
      })
      on(
        'file:preprocessor',
        vitePreprocessor({
          configFile: path.resolve(__dirname, './vite.config.js'),
          mode: 'development'
        })
      )

      return config
    }
  }
})
