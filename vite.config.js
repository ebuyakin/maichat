import { defineConfig } from 'vite'
import { resolve } from 'path'

// Use a subpath when deploying to GitHub Pages: https://<user>.github.io/<repo>/
const repoName = 'maichat'
const isCI = process.env.GITHUB_ACTIONS === 'true'
const hasCustomDomain = true // Set this to true since we're using maichat.app

export default defineConfig({
  base: isCI && !hasCustomDomain ? `/${repoName}/` : '/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app.html'),
        tutorial: resolve(__dirname, 'tutorial.html'),
      }
    }
  }
})
