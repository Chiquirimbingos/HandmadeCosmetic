import { defineConfig } from 'vite'
import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// __dirname no existe en módulos ES (este archivo usa import/export).
// Lo reconstruimos manualmente a partir de import.meta.url.
const __dirname = dirname(fileURLToPath(import.meta.url))

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
      try {
        const outDir = resolve(__dirname, 'dist')
        const assetsDir = resolve(outDir, 'assets')
        const indexPath = resolve(outDir, 'index.html')

        const cssFile = readdirSync(assetsDir).find(f => f.endsWith('.css'))
        if (!cssFile) {
          console.warn('[inline-css] No se encontró archivo .css en dist/assets — se omite inlining.')
          return
        }

        const cssContent = readFileSync(resolve(assetsDir, cssFile), 'utf-8')
        let html = readFileSync(indexPath, 'utf-8')

        const before = html

        // 1. Eliminar el <link rel="stylesheet"> que apunta al CSS propio del build
        html = html.replace(
          /<link rel="stylesheet"[^>]*href="\/assets\/[^"]*\.css"[^>]*>/,
          ''
        )

        // 2. Insertar el <style> INMEDIATAMENTE después de <head>, antes que
        //    cualquier <script>, para garantizar que el navegador resuelva
        //    todo el CSS (incluyendo custom properties) antes del primer
        //    pintado y antes de que el JS module empiece a ejecutar.
        html = html.replace(
          /<head>/,
          `<head>\n  <style>${cssContent}</style>`
        )

        if (html === before) {
          console.warn('[inline-css] No se encontró <link rel="stylesheet"> para reemplazar en index.html.')
          return
        }

        writeFileSync(indexPath, html)
        console.log(`[inline-css] CSS incrustado correctamente (${cssContent.length} bytes).`)
      } catch (err) {
        console.error('[inline-css] ERROR al incrustar el CSS:', err)
        throw err // Falla el build explícitamente en vez de fallar en silencio
      }
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
