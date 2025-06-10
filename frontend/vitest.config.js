import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Run tests in sequence to reduce memory pressure
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true // Use single fork to reduce memory usage
      }
    },
    // Limit concurrent tests
    maxConcurrency: 1,
    // Enable garbage collection between test files
    sequence: {
      hooks: 'stack'
    },
    // Set reasonable timeouts
    testTimeout: 30000,
    hookTimeout: 30000,
    // Clean up modules between test runs
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true
  }
})
