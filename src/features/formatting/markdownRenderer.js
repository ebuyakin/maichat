// Inline markdown rendering for assistant messages
// Replaces the extraction/placeholder system with direct inline rendering
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Track lazy-loaded features
let prismLoadPromise = null;
let katexLoadPromise = null;

/**
 * Configure marked with sensible defaults for LLM output
 */
marked.setOptions({
  gfm: true,              // GitHub Flavored Markdown
  breaks: false,          // Don't treat single \n as <br> - preserve paragraph structure
  pedantic: false,        // Don't be too strict
  smartLists: true,       // Better list handling
  smartypants: false,     // Keep quotes plain (no fancy typography)
  headerIds: false,       // Don't add IDs to headers
  mangle: false,          // Don't obfuscate email addresses
  xhtml: false            // Output HTML5
});

/**
 * Main rendering function: converts markdown to sanitized HTML
 * @param {string} markdown - Raw markdown text from LLM
 * @returns {string} - Sanitized HTML ready for innerHTML
 */
export function renderMarkdownInline(markdown) {
  if (!markdown || typeof markdown !== 'string') return '';
  
  try {
    // Step 0: Extract language info from code fences and store separately
    const codeBlockLanguages = [];
    let textWithPlaceholders = markdown;
    
    // Find all code blocks with language specs: ```python, ```java, etc.
    textWithPlaceholders = textWithPlaceholders.replace(/```(\w+)\n/g, (match, lang) => {
      codeBlockLanguages.push(lang);
      return '```\n'; // Remove language from fence so marked doesn't process it
    });
    
    // Step 1: Extract and protect math expressions before markdown parsing
    const mathExpressions = [];
    
    // Extract display math: $$...$$ (must be done before inline to avoid conflicts)
    textWithPlaceholders = textWithPlaceholders.replace(/\$\$([\s\S]+?)\$\$/g, (match, content) => {
      const index = mathExpressions.length;
      mathExpressions.push({ type: 'display', content: match });
      return `ⱮATHDISPLAY${index}ƤLACEHOLDER`;
    });
    
    // Extract display math: \[...\] (LaTeX bracket notation)
    textWithPlaceholders = textWithPlaceholders.replace(/\\\[([\s\S]+?)\\\]/g, (match, content) => {
      const index = mathExpressions.length;
      // Normalize to $$ delimiters to avoid backslash issues
      mathExpressions.push({ type: 'display', content: `$$${content}$$` });
      return `ⱮATHDISPLAY${index}ƤLACEHOLDER`;
    });
    
    // Extract inline math: $...$ (single line only to avoid false positives)
    textWithPlaceholders = textWithPlaceholders.replace(/\$([^\n$]+?)\$/g, (match, content) => {
      const index = mathExpressions.length;
      mathExpressions.push({ type: 'inline', content: match });
      return `ⱮATHINLINE${index}ƤLACEHOLDER`;
    });
    
    // Extract inline math: \(...\) (LaTeX parenthesis notation)
    textWithPlaceholders = textWithPlaceholders.replace(/\\\((.+?)\\\)/g, (match, content) => {
      const index = mathExpressions.length;
      // Normalize to $ delimiters to avoid backslash issues
      mathExpressions.push({ type: 'inline', content: `$${content}$` });
      return `ⱮATHINLINE${index}ƤLACEHOLDER`;
    });
    
    // Step 2: Parse markdown to HTML
    const rawHtml = marked.parse(textWithPlaceholders);
    
    // Step 3: Sanitize to prevent XSS
    const cleanHtml = DOMPurify.sanitize(rawHtml, {
      ALLOWED_TAGS: [
        // Headings & structure
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr',
        // Text formatting
        'strong', 'em', 'del', 'code', 'pre',
        // Lists
        'ul', 'ol', 'li',
        // Other blocks
        'blockquote',
        // Tables
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        // Links (optional - can be removed if unwanted)
        'a'
      ],
      ALLOWED_ATTR: {
        'a': ['href', 'target', 'rel'],
        'pre': ['class', 'data-language'],
        'code': ['class'],
        '*': ['class']  // Allow class on any element for styling
      },
      ALLOW_DATA_ATTR: true,  // For data-language on code blocks
      RETURN_TRUSTED_TYPE: false
    });
    
    // Step 4: Restore math expressions (after sanitization to preserve LaTeX)
    let finalHtml = cleanHtml;
    
    mathExpressions.forEach((math, index) => {
      const displayPlaceholder = `ⱮATHDISPLAY${index}ƤLACEHOLDER`;
      const inlinePlaceholder = `ⱮATHINLINE${index}ƤLACEHOLDER`;
      
      if (math.type === 'display') {
        finalHtml = finalHtml.split(displayPlaceholder).join(math.content);
      } else {
        finalHtml = finalHtml.split(inlinePlaceholder).join(math.content);
      }
    });
    
    // Step 5: Post-process to add language attributes to <pre> tags
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = finalHtml;
    
    // Add language attributes from our extracted list
    const allPreTags = tempDiv.querySelectorAll('pre');
    allPreTags.forEach((pre, index) => {
      if (index < codeBlockLanguages.length) {
        const lang = codeBlockLanguages[index];
        pre.setAttribute('data-language', lang);
      }
    });
    
    return tempDiv.innerHTML;
    
  } catch (error) {
    console.error('Markdown rendering error:', error);
    // Fallback: return escaped plain text
    return escapeHtml(markdown);
  }
}

/**
 * Enhance rendered message with lazy-loaded features
 * Called after DOM insertion to add syntax highlighting and math rendering
 * @param {HTMLElement} messageElement - The .message.assistant element
 */
export function enhanceRenderedMessage(messageElement) {
  if (!messageElement) return;
  
  // Check for code blocks and lazy load syntax highlighting
  const codeBlocks = messageElement.querySelectorAll('pre code[class*="language-"]');
  if (codeBlocks.length > 0) {
    lazyLoadSyntaxHighlighting(codeBlocks);
  }
  
  // Check for math delimiters and lazy load KaTeX
  const textContent = messageElement.textContent || '';
  if (textContent.includes('$') || textContent.includes('\\[') || textContent.includes('\\(')) {
    lazyLoadMathRendering(messageElement).then(() => {
      // After KaTeX renders, number standalone display equations
      numberStandaloneEquations(messageElement);
    });
  }
}

/**
 * Number standalone display equations
 * Only equations that are alone in their paragraph get numbered
 * @param {HTMLElement} messageElement - The message element
 */
function numberStandaloneEquations(messageElement) {
  const displayEquations = messageElement.querySelectorAll('.katex-display');
  
  displayEquations.forEach(display => {
    const parent = display.parentElement;
    if (!parent) return;
    
    // Get all text content in the parent, excluding the equation itself
    const allText = parent.textContent || '';
    const equationText = display.textContent || '';
    const otherText = allText.replace(equationText, '').trim();
    
    // If there's very little other text (less than 10 chars), consider it standalone
    if (otherText.length < 10) {
      display.classList.add('numbered');
    }
  });
}

/**
 * Lazy load Prism.js for syntax highlighting
 * @param {NodeList} codeBlocks - Code elements to highlight
 */
function lazyLoadSyntaxHighlighting(codeBlocks) {
  if (!prismLoadPromise) {
    prismLoadPromise = import('./syntaxHighlight.js')
      .then(module => {
        module.highlightCodeBlocks(codeBlocks);
      })
      .catch(error => {
        console.warn('Failed to load syntax highlighting:', error);
        prismLoadPromise = null; // Allow retry
      });
  } else {
    // Prism already loaded or loading, just highlight these blocks
    prismLoadPromise.then(() => {
      if (window.Prism) {
        codeBlocks.forEach(block => {
          window.Prism.highlightElement(block);
        });
      }
    });
  }
}

/**
 * Lazy load KaTeX for math rendering
 * @param {HTMLElement} element - Container element to search for math
 * @returns {Promise} - Promise that resolves when rendering is complete
 */
function lazyLoadMathRendering(element) {
  if (!katexLoadPromise) {
    katexLoadPromise = import('./mathRenderer.js')
      .then(module => {
        return module.renderMathInElement(element);
      })
      .catch(error => {
        console.warn('Failed to load math rendering:', error);
        katexLoadPromise = null; // Allow retry
      });
    return katexLoadPromise;
  } else {
    // KaTeX already loaded or loading, just render this element
    return katexLoadPromise.then(() => {
      // Re-import and call render
      return import('./mathRenderer.js').then(m => m.renderMathInElement(element));
    });
  }
}

/**
 * Fallback HTML escaping
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Check if a message has formattable content
 * Used to decide whether to use markdown rendering or keep plain text
 * @param {string} text - Message text to check
 * @returns {boolean}
 */
export function hasMarkdownContent(text) {
  if (!text) return false;
  
  // Check for common markdown indicators
  const indicators = [
    /\*\*[^*]+\*\*/,           // Bold
    /\*[^*]+\*/,               // Italic  
    /^#{1,6}\s+/m,             // Headers
    /^[-*+]\s+/m,              // Lists
    /^\d+\.\s+/m,              // Numbered lists
    /```[\s\S]*?```/,          // Code blocks
    /`[^`]+`/,                 // Inline code
    /^\>/m,                    // Blockquotes
    /\[.+\]\(.+\)/,            // Links
    /\|.+\|/                   // Tables
  ];
  
  return indicators.some(pattern => pattern.test(text));
}
