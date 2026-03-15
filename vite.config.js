import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { copyFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  base: '/commute/',
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
  plugins: [
    vue(),
    {
      name: 'copy-404',
      closeBundle() {
        copyFileSync(join(__dirname, 'dist/index.html'), join(__dirname, 'dist/404.html'))
      },
    },
  ],
})
