import { defineConfig } from 'vite'
import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { resolve } from 'path'

// ─────────────────────────────────────────────────────────────
// Plugin casero: incrusta el CSS generado directamente dentro
// del <head> del index.html final, en vez de dejarlo como un
// archivo .css separado que el navegador debe pedir aparte.
// Esto elimina cualquier escenario de "HTML carga antes que el
// CSS llegue" en hostings estáticos (Render, etc.).
// ─────────────────────────────────────────────────────────────
function inlineCssPlugin() {
  return {
    name: 'inline-css',
    apply: 'build',
    closeBundle() {
      const outDir = resolve(__dirname, 'dist')
      const assetsDir = resolve(outDir, 'assets')
      const indexPath = resolve(outDir, 'index.html')

      const cssFile = readdirSync(assetsDir).find(f => f.endsWith('.css'))
      if (!cssFile) return

      const cssContent = readFileSync(resolve(assetsDir, cssFile), 'utf-8')
      let html = readFileSync(indexPath, 'utf-8')

      // Reemplaza el <link rel="stylesheet" ...> por un <style> inline
      html = html.replace(
        /<link rel="stylesheet"[^>]*href="[^"]*\.css"[^>]*>/,
        `<style>${cssContent}</style>`
      )

      writeFileSync(indexPath, html)
    },
  }
}

export default defineConfig({
  root: 'src',
  base: '/',
  publicDir: '../public',
  plugins: [inlineCssPlugin()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    open: true,
  },
})
