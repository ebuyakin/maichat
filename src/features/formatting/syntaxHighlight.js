// Lazy-loaded syntax highlighting using Prism.js
// Only loads when first code block is encountered

let prismLoaded = false;

/**
 * Highlight code blocks with Prism.js
 * Automatically loads Prism core + common languages on first call
 * @param {NodeList|Array} codeBlocks - Code elements with class="language-*"
 */
export async function highlightCodeBlocks(codeBlocks) {
  if (!prismLoaded) {
    try {
      // Load Prism core
      await loadPrismCore();
      prismLoaded = true;
    } catch (error) {
      console.error('Failed to load Prism:', error);
      return;
    }
  }
  
  // Highlight all provided blocks
  if (window.Prism && codeBlocks) {
    Array.from(codeBlocks).forEach(block => {
      try {
        window.Prism.highlightElement(block);
      } catch (error) {
        console.warn('Failed to highlight code block:', error);
      }
    });
  }
}

/**
 * Load Prism core and common languages
 * Uses CDN for simplicity - can be replaced with npm package if needed
 */
async function loadPrismCore() {
  // Check if already loaded
  if (window.Prism) return Promise.resolve();
  
  // Load CSS
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css';
  document.head.appendChild(link);
  
  // Load core JS
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js');
  
  // Load common languages (async, don't wait)
  const languages = ['python', 'javascript', 'typescript', 'bash', 'json', 'sql', 'yaml', 'markdown'];
  languages.forEach(lang => {
    loadScript(`https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-${lang}.min.js`)
      .catch(err => console.warn(`Failed to load Prism language ${lang}:`, err));
  });
  
  return Promise.resolve();
}

/**
 * Load a script dynamically
 */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/**
 * Get language from code block class
 * @param {HTMLElement} codeElement
 * @returns {string|null}
 */
export function getLanguageFromClass(codeElement) {
  const className = codeElement.className;
  const match = className.match(/language-(\w+)/);
  return match ? match[1] : null;
}
