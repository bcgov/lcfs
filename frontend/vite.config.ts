/// <reference types="vitest/config" />

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    svgr()
  ],
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
    coverage: {
      provider: 'v8',
      // thresholds: {
      //   statements: 80,
      //   functions: 80,
      //   branches: 80,
      //   lines: 80
      // },
      enabled: true,
      reporter: ['html'],
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
      'chroma-js'
    ]
  }
})
