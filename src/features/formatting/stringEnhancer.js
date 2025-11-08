/**
 * String-based enhancement for code syntax highlighting and math rendering
 * 
 * This module processes HTML strings (not DOM elements) to apply:
 * - Syntax highlighting via Prism.highlight()
 * - Math rendering via katex.renderToString()
 * 
 * String-based processing is faster and more predictable than DOM manipulation,
 * and allows enhancement to happen synchronously during HTML building.
 */

/**
 * Apply syntax highlighting to code blocks in HTML string
 * 
 * Finds <code class="language-*"> elements and applies Prism syntax highlighting
 * 
 * @param {string} html - HTML string with code blocks
 * @returns {string} - HTML string with highlighted code
 */
export function applySyntaxHighlightToString(html) {
  if (!html || typeof html !== 'string') return html
  if (!window.Prism) {
    console.warn('Prism not loaded, skipping syntax highlighting')
    return html
  }

  // Find all code blocks with language class
  // Pattern: <code class="language-LANG">...code...</code>
  const codeBlockPattern = /<code class="language-(\w+)">([\s\S]*?)<\/code>/g

  return html.replace(codeBlockPattern, (match, language, code) => {
    // Check if language is supported
    const grammar = window.Prism.languages[language]
    if (!grammar) {
      // Language not loaded, return as-is
      return match
    }

    try {
      // Decode HTML entities in code (marked.js encodes them)
      const decodedCode = decodeHTMLEntities(code)
      
      // Apply Prism highlighting
      const highlighted = window.Prism.highlight(decodedCode, grammar, language)
      
      // Return highlighted code wrapped in same structure
      return `<code class="language-${language}">${highlighted}</code>`
    } catch (error) {
      console.warn(`Failed to highlight ${language} code:`, error)
      return match // Return original on error
    }
  })
}

/**
 * Render math expressions in HTML string
 * 
 * Finds $...$ (inline) and $$...$$ (display) math and renders with KaTeX
 * 
 * @param {string} html - HTML string with math expressions
 * @returns {string} - HTML string with rendered math
 */
export function renderMathToString(html) {
  if (!html || typeof html !== 'string') return html
  if (!window.katex) {
    console.warn('KaTeX not loaded, skipping math rendering')
    return html
  }

  let result = html

  try {
    // Process display math ($$...$$) first to avoid conflicts with inline
    // Pattern: $$...$$
    result = result.replace(/\$\$([\s\S]+?)\$\$/g, (match, mathContent) => {
      try {
        // Decode HTML entities (markdown renderer's DOM step encodes them)
        const decodedMath = decodeHTMLEntities(mathContent.trim())
        const rendered = window.katex.renderToString(decodedMath, {
          displayMode: true,
          throwOnError: false,
          errorColor: '#cc0000',
          strict: false,
          trust: false,
        })
        // Add 'numbered' class for CSS counter-based numbering
        return rendered.replace('class="katex-display"', 'class="katex-display numbered"')
      } catch (error) {
        console.warn('Failed to render display math:', error)
        return match // Return original on error
      }
    })

    // Process inline math ($...$), guard: closing $ must not be followed by a digit
    // Pattern: $...$(?!digit) (but not $$)
    result = result.replace(/\$([^\n$]+?)\$(?!\d)/g, (match, mathContent) => {
      try {
        // Decode HTML entities (markdown renderer's DOM step encodes them)
        const decodedMath = decodeHTMLEntities(mathContent.trim())
        const rendered = window.katex.renderToString(decodedMath, {
          displayMode: false,
          throwOnError: false,
          errorColor: '#cc0000',
          strict: false,
          trust: false,
        })
        return rendered
      } catch (error) {
        console.warn('Failed to render inline math:', error)
        return match // Return original on error
      }
    })

    // Process LaTeX bracket notation: \[...\] (display)
    result = result.replace(/\\\[([\s\S]+?)\\\]/g, (match, mathContent) => {
      try {
        // Decode HTML entities (markdown renderer's DOM step encodes them)
        const decodedMath = decodeHTMLEntities(mathContent.trim())
        const rendered = window.katex.renderToString(decodedMath, {
          displayMode: true,
          throwOnError: false,
          errorColor: '#cc0000',
          strict: false,
          trust: false,
        })
        // Add 'numbered' class for CSS counter-based numbering
        return rendered.replace('class="katex-display"', 'class="katex-display numbered"')
      } catch (error) {
        console.warn('Failed to render LaTeX bracket math:', error)
        return match
      }
    })

    // Process LaTeX parenthesis notation: \(...\) (inline)
    result = result.replace(/\\\((.+?)\\\)/g, (match, mathContent) => {
      try {
        // Decode HTML entities (markdown renderer's DOM step encodes them)
        const decodedMath = decodeHTMLEntities(mathContent.trim())
        const rendered = window.katex.renderToString(decodedMath, {
          displayMode: false,
          throwOnError: false,
          errorColor: '#cc0000',
          strict: false,
          trust: false,
        })
        return rendered
      } catch (error) {
        console.warn('Failed to render LaTeX parenthesis math:', error)
        return match
      }
    })
  } catch (error) {
    console.error('Math rendering error:', error)
    return html // Return original on catastrophic error
  }

  return result
}

/**
 * Detect if math content should be rendered in display mode
 * Internal helper for normalizeGeminiMath
 * 
 * @param {string} content - Math expression content (without delimiters)
 * @returns {boolean} - True if should be display mode
 */
function shouldRenderAsDisplay(content) {
  // Length threshold: equations longer than 60 chars are likely display-worthy
  if (content.length > 60) return true
  
  // LaTeX display environments (matrices, aligned equations, cases, etc.)
  const displayEnvs = /\\begin\{(pmatrix|bmatrix|vmatrix|Vmatrix|matrix|aligned|alignat|align|cases|split|gather|multline|equation|eqnarray|array)\}/
  if (displayEnvs.test(content)) return true
  
  // Multi-line content (LaTeX line breaks)
  if (/\\\\/.test(content)) return true
  
  // Newlines within content (rare but possible)
  if (content.includes('\n')) return true
  
  return false
}

/**
 * Normalize Gemini's math expressions to standard delimiters
 * Internal helper (not exported)
 * 
 * Gemini uses single $ for all equations (inline and display).
 * This converts single-$ display-worthy equations to $$ for proper rendering.
 * 
 * @param {string} text - Text with Gemini-style math
 * @returns {string} - Text with normalized math delimiters
 */
function normalizeGeminiMath(text) {
  if (!text || typeof text !== 'string') return text
  
  // Process single-$ equations and promote display-worthy ones to $$
  // Guard: closing $ must not be followed by a digit (to avoid false positives like "$5 and $10")
  return text.replace(/\$([^\n$]+?)\$(?!\d)/g, (match, content) => {
    const trimmed = content.trim()
    if (shouldRenderAsDisplay(trimmed)) {
      // Convert to display mode delimiters
      return `$$${content}$$`
    }
    // Keep as inline
    return match
  })
}

/**
 * Apply all enhancements to HTML string
 * 
 * Combines syntax highlighting and math rendering.
 * Applies provider-specific normalization before rendering.
 * 
 * @param {string} html - Raw markdown-rendered HTML
 * @param {Object} options - Enhancement options
 * @param {string} options.provider - Provider name (e.g., 'gemini', 'openai', 'anthropic')
 * @returns {string} - Fully enhanced HTML
 */
export function enhanceHTMLString(html, options = {}) {
  if (!html || typeof html !== 'string') return html

  // Apply enhancements in order
  let result = html
  
  // Provider-specific normalization (internal, not exposed)
  if (options.provider === 'gemini') {
    result = normalizeGeminiMath(result)
  }
  
  result = applySyntaxHighlightToString(result)
  result = renderMathToString(result)
  
  return result
}

/**
 * Helper: Decode HTML entities
 * Marked.js encodes < > & etc. in code blocks, we need to decode for Prism
 * 
 * @param {string} text - Text with HTML entities
 * @returns {string} - Decoded text
 */
function decodeHTMLEntities(text) {
  const entities = {
    '&lt;': '<',
    '&gt;': '>',
    '&amp;': '&',
    '&quot;': '"',
    '&#39;': "'",
  }
  
  return text.replace(/&(?:lt|gt|amp|quot|#39);/g, (match) => entities[match] || match)
}
