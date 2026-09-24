/// <reference types="vitest/config" />

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'
import path from 'path'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'

const releaseNotesPath = fileURLToPath(
  new URL('./public/release-notes.json', import.meta.url)
)
const appVersion: string = existsSync(releaseNotesPath)
  ? (JSON.parse(readFileSync(releaseNotesPath, 'utf-8'))[0]?.version ?? '0.0.0')
  : '0.0.0'

// Coverage thresholds (issue #4094). These are floors, not targets: they exist
// so coverage cannot silently regress. Raise them as coverage improves (see
// wiki/Testing-Procedures.md, "Coverage thresholds").
//
// Thresholds are only enforced when ENFORCE_COVERAGE_THRESHOLDS is set, because
// Vitest checks them against whatever was collected in the current process:
//   - a filtered run (`vitest run src/views/Foo.test.jsx`) or a CI shard
//     (`--shard=N/M`) only covers a slice of the suite and would always fail;
//   - `npm run test.coverage` (full run) and the CI `--merge-reports` step
//     (all shards merged) are the two places that see the whole suite, and
//     both set the variable.
const COVERAGE_THRESHOLDS = {
  statements: 60,
  branches: 50,
  functions: 52,
  lines: 60
}
const isShardedRun = process.argv.some((arg) => arg.startsWith('--shard'))
const enforceCoverageThresholds =
  ['1', 'true'].includes(process.env.ENFORCE_COVERAGE_THRESHOLDS ?? '') &&
  !isShardedRun

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion)
  },
  plugins: [react(), svgr()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    host: true,
    port: 3000,
    hmr: {
      overlay: false,
      clientPort: 3000
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './testSetup.js',
    // vitest 4 no longer excludes cypress/dist by default, so scope to src
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    coverage: {
      provider: 'v8',
      thresholds: enforceCoverageThresholds ? COVERAGE_THRESHOLDS : undefined,
      enabled: true,
      reporter: ['text-summary', 'html'],
      include: ['src'],
      exclude: [
        'src/*.{jsx,js,tsx,ts}',
        'src/assets',
        'src/constants',
        'src/themes',
        'src/tests'
      ]
    }
  },
  optimizeDeps: {
    include: [
      '@mui/material/Tooltip',
      '@mui/material/Grid2',
      'luxon',
      'chroma-js',
      'buffer'
    ]
  }
})
