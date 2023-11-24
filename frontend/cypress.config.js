const { defineConfig } = require("cypress");

module.exports = defineConfig({
  // Global configurations
  reporter: "mochawesome",
  reporterOptions: {
    reportDir: "cypress/reports",
    overwrite: false,
    html: false,
    json: true,
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
    baseUrl: "http://localhost:3000",

    // Node events and plugin configuration
    setupNodeEvents(on, config) {
      // Task for logging
      on('task', {
        log(message) {
          console.log(message);
          return null;
        },
      });
      
      return config;
    },
  },
});
