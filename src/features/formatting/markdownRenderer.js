// Inline markdown rendering for assistant messages
// Replaces the extraction/placeholder system with direct inline rendering
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { enhanceHTMLString } from './stringEnhancer.js'

/**
 * Configure marked with sensible defaults for LLM output
 */
marked.setOptions({
  gfm: true, // GitHub Flavored Markdown
  breaks: false, // Don't treat single \n as <br> - preserve paragraph structure
  pedantic: false, // Don't be too strict
  smartLists: true, // Better list handling
  smartypants: false, // Keep quotes plain (no fancy typography)
  headerIds: false, // Don't add IDs to headers
  mangle: false, // Don't obfuscate email addresses
  xhtml: false, // Output HTML5
})

/**
 * Render markdown to HTML with inline formatting
 * 
 * Uses marked.js for markdown parsing, then optionally enhances with
 * syntax highlighting and math rendering.
 * 
 * @param {string} markdown - Raw markdown text
 * @param {Object} options - Rendering options
 * @param {boolean} options.enhance - Apply syntax highlighting and math rendering
 * @param {string} options.provider - Provider name (for provider-specific normalization)
 * @returns {string} - Rendered and enhanced HTML
 */
export function renderMarkdownInline(markdown, options = {}) {
  if (!markdown || typeof markdown !== 'string') return ''

  try {
    // Step 0: Extract language info from code fences and store separately
    const codeBlockLanguages = []
    let textWithPlaceholders = markdown

    // Find all code blocks with language specs: ```python, ```java, etc.
    textWithPlaceholders = textWithPlaceholders.replace(/```(\w+)\n/g, (match, lang) => {
      codeBlockLanguages.push(lang)
      return '```\n' // Remove language from fence so marked doesn't process it
    })

    // Step 1: Extract and protect math expressions before markdown parsing
    const mathExpressions = []

    // Extract display math: $$...$$ (must be done before inline to avoid conflicts)
    textWithPlaceholders = textWithPlaceholders.replace(/\$\$([\s\S]+?)\$\$/g, (match, content) => {
      const index = mathExpressions.length
      mathExpressions.push({ type: 'display', content: match })
      return `ⱮATHDISPLAY${index}ƤLACEHOLDER`
    })

    // Extract display math: \[...\] (LaTeX bracket notation)
    textWithPlaceholders = textWithPlaceholders.replace(/\\\[([\s\S]+?)\\\]/g, (match, content) => {
      const index = mathExpressions.length
      // Normalize to $$ delimiters to avoid backslash issues
      mathExpressions.push({ type: 'display', content: `$$${content}$$` })
      return `ⱮATHDISPLAY${index}ƤLACEHOLDER`
    })

    // Extract inline math: $...$ (single line only). Guard: closing $ must not be followed by a digit.
    textWithPlaceholders = textWithPlaceholders.replace(/\$([^\n$]+?)\$(?!\d)/g, (match, content) => {
      const index = mathExpressions.length
      mathExpressions.push({ type: 'inline', content: match })
      return `ⱮATHINLINE${index}ƤLACEHOLDER`
    })

    // Extract inline math: \(...\) (LaTeX parenthesis notation)
    textWithPlaceholders = textWithPlaceholders.replace(/\\\((.+?)\\\)/g, (match, content) => {
      const index = mathExpressions.length
      // Normalize to $ delimiters to avoid backslash issues
      mathExpressions.push({ type: 'inline', content: `$${content}$` })
      return `ⱮATHINLINE${index}ƤLACEHOLDER`
    })

    // Step 2: Parse markdown to HTML
    const rawHtml = marked.parse(textWithPlaceholders)

    // Step 3: Sanitize to prevent XSS
    const cleanHtml = DOMPurify.sanitize(rawHtml, {
      ALLOWED_TAGS: [
        // Headings & structure
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'p',
        'br',
        'hr',
        // Text formatting
        'strong',
        'em',
        'del',
        'code',
        'pre',
        // Lists
        'ul',
        'ol',
        'li',
        // Other blocks
        'blockquote',
        // Tables
        'table',
        'thead',
        'tbody',
        'tr',
        'th',
        'td',
        // Links (optional - can be removed if unwanted)
        'a',
      ],
      ALLOWED_ATTR: [
        'href',
        'target',
        'rel',
        'class',
        'data-language',
      ],
      ALLOW_DATA_ATTR: true, // For data-language on code blocks
      RETURN_TRUSTED_TYPE: false,
    })

    // Step 4: Restore math expressions (after sanitization to preserve LaTeX)
  let finalHtml = cleanHtml

    mathExpressions.forEach((math, index) => {
      const displayPlaceholder = `ⱮATHDISPLAY${index}ƤLACEHOLDER`
      const inlinePlaceholder = `ⱮATHINLINE${index}ƤLACEHOLDER`

      if (math.type === 'display') {
        finalHtml = finalHtml.split(displayPlaceholder).join(math.content)
      } else {
        finalHtml = finalHtml.split(inlinePlaceholder).join(math.content)
      }
    })

  // Step 5: Post-process to add language attributes to <pre> tags
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = finalHtml

    // Add language attributes from our extracted list
    const allPreTags = tempDiv.querySelectorAll('pre')
    allPreTags.forEach((pre, index) => {
      if (index < codeBlockLanguages.length) {
        const lang = codeBlockLanguages[index]
        pre.setAttribute('data-language', lang)
        // Also add class to <code> child for Prism compatibility
        const code = pre.querySelector('code')
        if (code) code.classList.add(`language-${lang}`)
      }
    })

    let result = tempDiv.innerHTML

    // Step 6: Linkify plain URLs in text (string-based, safe; skip inside code/pre/a)
    result = linkifyHtmlString(result)

    // Ensure anchors open in a new tab with safe rel
    result = enforceAnchorTargets(result)

    // Step 7 (optional): Apply inline enhancements if requested
    if (options.enhance) {
      result = enhanceHTMLString(result, { provider: options.provider })
    }

    return result
  } catch (error) {
    console.error('Markdown rendering error:', error)
    // Fallback: return escaped plain text
    return escapeHtml(markdown)
  }
}

/**
 * Convert plain URLs in HTML string to <a> links, skipping inside a/code/pre/kbd/samp.
 * Pure string processing with a small HTML tokenizer and tag stack.
 * Only http/https URLs are linkified. Trailing punctuation is trimmed conservatively.
 */
function linkifyHtmlString(html) {
  if (!html || typeof html !== 'string') return html

  const forbidden = new Set(['a', 'code', 'pre', 'kbd', 'samp'])
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g
  let out = ''
  let idx = 0
  /** @type {string[]} */
  const stack = []

  // Helper: linkify a plain text segment when not inside forbidden tags
  function linkifyText(text) {
    if (!text) return ''
    // Simple http(s) URL regex; excludes spaces and angle/quote brackets
    const urlRe = /(https?:\/\/[\w\-._~:/?#\[\]@!$&'()*+,;=%]+)(?![\w/])/g
    // Replace with anchors, trimming trailing punctuation like .,?!:;
    return text.replace(urlRe, (m) => {
      let url = m
      // Trim common trailing punctuation
      while (/[.,!?;:]$/.test(url)) url = url.slice(0, -1)
      // Basic safety: must still start with http(s)
      if (!/^https?:\/\//i.test(url)) return m
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>` + m.slice(url.length)
    })
  }

  let m
  while ((m = tagRe.exec(html)) !== null) {
    const textChunk = html.slice(idx, m.index)
    // If not inside forbidden tags, linkify this text
    if (!stack.some((t) => forbidden.has(t))) out += linkifyText(textChunk)
    else out += textChunk

    const fullTag = m[0]
    const name = m[1].toLowerCase()
    const isClose = fullTag.startsWith('</')
    if (!isClose) {
      // Self-closing check
      const selfClosing = /\/>\s*$/.test(fullTag) || name === 'br' || name === 'hr' || name === 'img'
      if (!selfClosing) stack.push(name)
    } else {
      // Pop up to matching name (well-formed from marked/DOMPurify)
      for (let i = stack.length - 1; i >= 0; i--) {
        const t = stack[i]
        stack.pop()
        if (t === name) break
      }
    }
    out += fullTag
    idx = m.index + fullTag.length
  }
  const tail = html.slice(idx)
  if (!stack.some((t) => forbidden.has(t))) out += linkifyText(tail)
  else out += tail

  return out
}

/**
 * Ensure all http/https anchor tags open in new tab and use safe rel.
 * Pure string transform over <a ...> start tags; leaves other links untouched.
 */
function enforceAnchorTargets(html) {
  if (!html || typeof html !== 'string') return html
  return html.replace(/<a\b([^>]*)>/gi, (match, attrs) => {
    const hrefM = attrs.match(/\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i)
    const hrefVal = hrefM ? (hrefM[2] || hrefM[3] || hrefM[4] || '').trim() : ''
    if (!/^https?:\/\//i.test(hrefVal)) {
      // Only enforce for http/https links
      return match
    }
    const hasTarget = /\btarget\s*=\s*/i.test(attrs)
    const relM = attrs.match(/\brel\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i)
    let relVal = relM ? (relM[2] || relM[3] || relM[4] || '').trim() : ''
    // Ensure noopener and noreferrer are present
    const relSet = new Set(relVal ? relVal.split(/\s+/) : [])
    relSet.add('noopener')
    relSet.add('noreferrer')
    const newRel = Array.from(relSet).join(' ')

    let newAttrs = attrs
    if (!hasTarget) newAttrs += ' target="_blank"'
    if (relM) {
      // Replace existing rel with merged
      newAttrs = newAttrs.replace(relM[0], `rel="${newRel}"`)
    } else {
      newAttrs += ` rel="${newRel}"`
    }
    return `<a${newAttrs}>`
  })
}

// Legacy DOM-time enhancement functions removed (enhanceRenderedMessage and helpers)
// Modern path uses string-time rendering only (renderMarkdownInline + enhanceHTMLString)

/**
 * Fallback HTML escaping
 */
function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/**
 * Check if a message has formattable content
 * Used to decide whether to use markdown rendering or keep plain text
 * @param {string} text - Message text to check
 * @returns {boolean}
 */
export function hasMarkdownContent(text) {
  if (!text) return false

  // Check for common markdown indicators
  const indicators = [
    /\*\*[^*]+\*\*/, // Bold
    /\*[^*]+\*/, // Italic
    /^#{1,6}\s+/m, // Headers
    /^[-*+]\s+/m, // Lists
    /^\d+\.\s+/m, // Numbered lists
    /```[\s\S]*?```/, // Code blocks
    /`[^`]+`/, // Inline code
    /^\>/m, // Blockquotes
    /\[.+\]\(.+\)/, // Links
    /\|.+\|/, // Tables
  ]

  return indicators.some((pattern) => pattern.test(text))
}
