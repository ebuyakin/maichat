import { defineConfig } from 'vite'

// Use a subpath when deploying to GitHub Pages: https://<user>.github.io/<repo>/
const repoName = 'maichat'
const isCI = process.env.GITHUB_ACTIONS === 'true'
const hasCustomDomain = true // Set this to true since we're using maichat.io

export default defineConfig({
  base: isCI ? `/${repoName}/` : '/',
  base: isCI && !hasCustomDomain ? `/${repoName}/` : '/',
})
