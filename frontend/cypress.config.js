import { defineConfig } from "cypress";
import createBundler from "@bahmutov/cypress-esbuild-preprocessor";
import { addCucumberPreprocessorPlugin } from "@badeball/cypress-cucumber-preprocessor";
import { createEsbuildPlugin } from "@badeball/cypress-cucumber-preprocessor/esbuild";
import { GenerateCtrfReport } from 'cypress-ctrf-json-reporter'

function initPlugins(on, plugins) {
  const eventCallbacks = {}

  const customOn = (eventName, callback) => {
    if (!eventCallbacks[eventName]) {
      eventCallbacks[eventName] = []
      // Register a single handler for each event that will execute all registered callbacks
      on(eventName, async (...args) => {
        for (const cb of eventCallbacks[eventName]) {
          await cb(...args)
        }
      })
    }
    eventCallbacks[eventName].push(callback)
  }

  // Initialize each plugin with the custom `on` handler
  plugins.forEach((plugin) => plugin(customOn))
}

export default defineConfig({
  e2e: {
    specPattern: ["**/*.feature", "**/*.cy.js"],
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

    // Video recording
    video: false,

    // Viewport dimensions
    viewportWidth: 1280,
    viewportHeight: 720,

    // Base URL for tests
    baseUrl: process.env.CYPRESS_BASE_URL || 'http://localhost:3000',
    async setupNodeEvents(on, config) {
      // This is required for the preprocessor to be able to generate JSON reports after each run, and more,
      await addCucumberPreprocessorPlugin(on, config);
      initPlugins(on, [(on) => new GenerateCtrfReport({ on })])

      on(
        "file:preprocessor",
        createBundler({
          plugins: [createEsbuildPlugin(config)],
        })
      );

      // on('after:run', async (results) => {
      //   const ctrfReporter =  new GenerateCtrfReport({
      //     outputDir: "cypress/reports/",
      //     outputFile: "cypress/reports/ctrf-report.json",
      //     on: results
      //   });
      //   ctrfReporter.generateCtrfReport();
      // });

      return config;
    },
  },
});