import { defineConfig, lazyPlugins } from 'vite-plus'
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
//   - `npm run test:coverage` (full run) and the CI `--merge-reports` step
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
  lint: {
    plugins: ['eslint', 'typescript', 'import', 'node', 'promise', 'react'],
    env: { browser: true, es2020: true, jest: true },
    globals: { vi: 'writable' },
    settings: { react: { version: '18.2' } },
    jsPlugins: [
      { name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' },
      { name: 'cypress', specifier: 'eslint-plugin-cypress' },
      { name: 'chai-friendly', specifier: 'eslint-plugin-chai-friendly' }
    ],
    rules: {
      'vite-plus/prefer-vite-plus-imports': 'error',
      'eslint/no-unused-vars': 'warn',
      'typescript/no-unused-vars': 'warn',
      'typescript/no-explicit-any': 'warn',
      'typescript/no-floating-promises': 'off',
      'typescript/unbound-method': 'off',
      'typescript/restrict-template-expressions': 'off',
      'typescript/no-base-to-string': 'off',
      'typescript/no-misused-spread': 'off',
      'typescript/no-useless-default-assignment': 'off',
      'typescript/await-thenable': 'off',
      'typescript/no-redundant-type-constituents': 'off',
      'typescript/require-array-sort-compare': 'off',
      'typescript/no-implied-eval': 'off',
      'react/only-export-components': ['warn', { allowConstantExport: true }],
      'react/rules-of-hooks': 'error',
      'react/exhaustive-deps': 'warn',
      'react/react-in-jsx-scope': 'off',
      'react/error-boundaries': 'off',
      'react/exhaustive-effect-dependencies': 'off',
      'react/forward-ref-uses-ref': 'off',
      'react/globals': 'off',
      'react/hooks': 'off',
      'react/iframe-missing-sandbox': 'off',
      'react/immutability': 'off',
      'react/incompatible-library': 'off',
      'react/jsx-props-no-spread-multi': 'off',
      'react/memo-dependencies': 'off',
      'react/no-unstable-nested-components': 'off',
      'react/preserve-manual-memoization': 'off',
      'react/purity': 'off',
      'react/refs': 'off',
      'react/set-state-in-effect': 'off',
      'react/set-state-in-render': 'off',
      'react/static-components': 'off',
      'react/use-memo': 'off',
      'react/void-use-memo': 'off',
      'import/no-absolute-path': 'off',
      'import/no-unassigned-import': 'off',
      'import/first': 'error',
      'no-proto': 'error',
      'cypress/no-assigning-return-values': 'error',
      'cypress/no-unnecessary-waiting': 'off',
      'cypress/no-async-tests': 'error',
      'cypress/unsafe-to-chain-command': 'error',
      'chai-friendly/no-unused-expressions': 'error',
      'eslint/no-unused-expressions': 'off',
      'typescript/no-unused-expressions': 'off'
    },
    categories: { correctness: 'error' },
    options: { typeAware: true, typeCheck: true, maxWarnings: 0 }
  },
  fmt: {
    singleQuote: true,
    semi: false,
    trailingComma: 'none',
    printWidth: 80,
    sortPackageJson: false,
    ignorePatterns: []
  },
  define: {
    __APP_VERSION__: JSON.stringify(appVersion)
  },
  plugins: lazyPlugins(() => [react(), svgr()]),
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
    // Vitest v4 compatibility: preserve mock call history.
    // Remove after tests no longer rely on calls from setup or earlier tests.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
    clearMocks: false,
    // Vitest v4 compatibility: keep separate Vite servers for inline projects.
    // Remove when plugins and config hooks can run once for shared projects.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    // https://vitest.dev/guide/migration/#inline-projects-share-the-vite-server-by-default
    sharedViteServer: false,
    globals: true,
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
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.{node.test,node.spec}.{js,jsx,ts,tsx}'],
          setupFiles: []
        }
      },
      {
        extends: true,
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
          exclude: ['src/**/*.{node.test,node.spec}.{js,jsx,ts,tsx}'],
          setupFiles: './testSetup.js'
        }
      }
    ]
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
