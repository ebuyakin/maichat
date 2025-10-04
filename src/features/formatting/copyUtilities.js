// Copy utilities for formatted content
// Provides keyboard shortcuts to copy code, math, tables, etc.

/**
 * Setup copy shortcuts for formatted content
 * @param {Object} activeParts - Active parts manager
 * @returns {Object} - Copy utility functions
 */
export function setupCopyShortcuts(activeParts) {
  
  /**
   * Find the active message element
   */
  function getActiveMessageElement() {
    const active = activeParts.active();
    if (!active) return null;
    return document.querySelector(`[data-part-id="${active.id}"]`);
  }
  
  /**
   * Copy code block at cursor
   * Looks for <pre><code> in active message
   */
  function copyCode() {
    const msgEl = getActiveMessageElement();
    if (!msgEl) return false;
    
    const codeBlock = msgEl.querySelector('pre code');
    if (!codeBlock) return false;
    
    const code = codeBlock.textContent;
    return copyToClipboard(code, 'Code copied');
  }
  
  /**
   * Copy math expression at cursor
   * Looks for .katex elements
   */
  function copyMath() {
    const msgEl = getActiveMessageElement();
    if (!msgEl) return false;
    
    // Try to find KaTeX element and get original TeX
    const katexEl = msgEl.querySelector('.katex');
    if (!katexEl) return false;
    
    // KaTeX stores original in annotation
    const annotation = katexEl.querySelector('annotation[encoding="application/x-tex"]');
    const tex = annotation ? annotation.textContent : katexEl.textContent;
    
    return copyToClipboard(tex, 'Math copied');
  }
  
  /**
   * Copy entire message text
   */
  function copyMessage() {
    const msgEl = getActiveMessageElement();
    if (!msgEl) return false;
    
    const body = msgEl.querySelector('.assistant-body, .part-inner');
    if (!body) return false;
    
    const text = body.textContent;
    return copyToClipboard(text, 'Message copied');
  }
  
  /**
   * Copy table as TSV (tab-separated values)
   */
  function copyTable() {
    const msgEl = getActiveMessageElement();
    if (!msgEl) return false;
    
    const table = msgEl.querySelector('table');
    if (!table) return false;
    
    const rows = Array.from(table.querySelectorAll('tr'));
    const tsv = rows.map(row => {
      const cells = Array.from(row.querySelectorAll('th, td'));
      return cells.map(cell => cell.textContent.trim()).join('\t');
    }).join('\n');
    
    return copyToClipboard(tsv, 'Table copied');
  }
  
  /**
   * Helper to copy text to clipboard
   */
  function copyToClipboard(text, successMessage) {
    try {
      navigator.clipboard.writeText(text).then(() => {
        showToast(successMessage);
      }).catch(err => {
        console.error('Copy failed:', err);
        showToast('Copy failed', true);
      });
      return true;
    } catch (err) {
      console.error('Clipboard not available:', err);
      return false;
    }
  }
  
  /**
   * Show temporary toast notification
   * TODO: Replace with actual toast system
   */
  function showToast(message, isError = false) {
    console.log(`[TOAST] ${message}`);
    // Future: implement actual toast UI
  }
  
  return {
    copyCode,
    copyMath,
    copyMessage,
    copyTable
  };
}
