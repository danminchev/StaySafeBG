import { defineConfig } from 'vite'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login.html'),
        register: resolve(__dirname, 'register.html'),
        articles: resolve(__dirname, 'articles.html'),
        articleDetails: resolve(__dirname, 'article-details.html'),
        scamCheck: resolve(__dirname, 'scam-check.html'),
        reportScam: resolve(__dirname, 'report-scam.html'),
        admin: resolve(__dirname, 'admin.html')
      }
    }
  }
})
