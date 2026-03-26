import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// IMPORTANT: schimba base cu '/numele-repo-ului-tau/'
// Daca repo-ul se numeste 'code-debugger', lasa asa.
// Daca il deployezi pe un domeniu custom sau e un user page (username.github.io), pune base: '/'
export default defineConfig({
  plugins: [react()],
  base: '/code-debugger/',
  build: {
    outDir: 'docs',    // GitHub Pages poate servi direct din /docs pe branch main
    emptyOutDir: true,
  },
})
