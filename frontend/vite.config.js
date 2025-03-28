import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
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
    // watch: {
    //   usePolling: true,
    // },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './testSetup.js',

    coverage: {
      thresholds: '80',
      enabled: true,
      reporter: ['html'],
      include: ['src'],
      exclude: [
        'src/*.{jsx,js}',
        'src/assets',
        'src/constants',
        'src/themes',
        'src/tests',
        'src/stores'
      ]
    }
  },
  optimizeDeps: {
    include: ['@mui/material/Grid2', '@mui/material/Tooltip']
  }
})
