import { defineConfig } from "cypress";
import createBundler from "@bahmutov/cypress-esbuild-preprocessor";
import { addCucumberPreprocessorPlugin } from "@badeball/cypress-cucumber-preprocessor";
import { createEsbuildPlugin } from "@badeball/cypress-cucumber-preprocessor/esbuild";
import { GenerateCtrfReport } from 'cypress-ctrf-json-reporter'

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

      on("file:preprocessor", createBundler({
        plugins: [createEsbuildPlugin(config)],
      }));

      // Add GenerateCtrfReport to the on('after:run') event
      on('after:run', async (results) => {
        const ctrfReport = new GenerateCtrfReport({
          jsonDir: "cypress/reports",
          outputFile: "cypress/reports/ctrf-report.json",
          on
        });
        await ctrfReport.generate();
      });

      return config;
    },
  },
});