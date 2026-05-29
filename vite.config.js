import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// On GitHub Actions we deploy to a project page (https://USER.github.io/katgpt-web/),
// so assets must be served from the repo sub-path. Locally we keep base = '/'.
// Override with VITE_BASE if your repo / Pages path differs.
const base = process.env.VITE_BASE ?? (process.env.GITHUB_ACTIONS ? '/katgpt-web/' : '/')

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
})
