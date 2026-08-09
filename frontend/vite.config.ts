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
    pool: 'threads',
    maxWorkers: '100%',
    silent: 'passed-only',
    coverage: {
      provider: 'v8',
      // thresholds: {
      //   statements: 80,
      //   functions: 80,
      //   branches: 80,
      //   lines: 80
      // },
      reporter: ['html'],
      include: ['src/**/*.{js,jsx,ts,tsx}'],
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
