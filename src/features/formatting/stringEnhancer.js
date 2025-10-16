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
        const rendered = window.katex.renderToString(mathContent.trim(), {
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

    // Process inline math ($...$)
    // Pattern: $...$ (but not $$)
    result = result.replace(/\$([^\n$]+?)\$/g, (match, mathContent) => {
      try {
        const rendered = window.katex.renderToString(mathContent.trim(), {
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
        const rendered = window.katex.renderToString(mathContent.trim(), {
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
        const rendered = window.katex.renderToString(mathContent.trim(), {
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
 * Apply all enhancements to HTML string
 * 
 * Combines syntax highlighting and math rendering
 * 
 * @param {string} html - Raw markdown-rendered HTML
 * @returns {string} - Fully enhanced HTML
 */
export function enhanceHTMLString(html) {
  if (!html || typeof html !== 'string') return html

  // Apply enhancements in order
  let result = html
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
