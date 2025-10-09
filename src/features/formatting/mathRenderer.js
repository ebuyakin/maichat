// Lazy-loaded math rendering using KaTeX
// Only loads when first math expression is encountered

let katexLoaded = false

/**
 * Render math expressions in an element using KaTeX
 * Automatically loads KaTeX on first call
 * @param {HTMLElement} element - Container element to search for math
 */
export async function renderMathInElement(element) {
  if (!element) return

  if (!katexLoaded) {
    try {
      await loadKaTeX()
      katexLoaded = true
    } catch (error) {
      console.error('Failed to load KaTeX:', error)
      return
    }
  }

  // Use KaTeX auto-render if available
  if (window.renderMathInElement) {
    try {
      window.renderMathInElement(element, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\[', right: '\\]', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
        ],
        throwOnError: false, // Show raw LaTeX if rendering fails
        errorColor: '#cc0000',
        strict: false,
        trust: false, // Don't allow \href and other potentially dangerous commands
        macros: {
          // Add common macros if needed
        },
      })
    } catch (error) {
      console.warn('Math rendering error:', error)
    }
  }
}

/**
 * Load KaTeX library and auto-render extension
 * Uses CDN for simplicity
 */
async function loadKaTeX() {
  // Check if already loaded
  if (window.katex) return Promise.resolve()

  // Load CSS
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css'
  link.integrity = 'sha384-n8MVd4RsNIU0tAv4ct0nTaAbDJwPJzDEaqSD1odI+WdtXRGWt2kTvGFasHpSy3SV'
  link.crossOrigin = 'anonymous'
  document.head.appendChild(link)

  // Load KaTeX JS
  await loadScript(
    'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js',
    'sha384-XjKyOOlGwcjNTAIQHIpgOno0Hl1YQqzUOEleOLALmuqehneUG+vnGctmUb0ZY0l8'
  )

  // Load auto-render extension
  await loadScript(
    'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js',
    'sha384-+VBxd3r6XgURycqtZ117nYw44OOcIax56Z4dCRWbxyPt0Koah1uHoK0o4+/RRE05'
  )

  return Promise.resolve()
}

/**
 * Load a script dynamically with integrity check
 */
function loadScript(src, integrity) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    if (integrity) {
      script.integrity = integrity
      script.crossOrigin = 'anonymous'
    }
    script.onload = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })
}
