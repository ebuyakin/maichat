import { defineConfig } from 'vite';

// Use a subpath when deploying to GitHub Pages: https://<user>.github.io/<repo>/
const repoName = 'maichat';
const isCI = process.env.GITHUB_ACTIONS === 'true';

export default defineConfig({
  base: isCI ? `/${repoName}/` : '/',
});
