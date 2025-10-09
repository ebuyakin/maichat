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
    const active = activeParts.active()
    if (!active) return null
    return document.querySelector(`[data-part-id="${active.id}"]`)
  }

  /**
   * Copy code block by number (1-indexed)
   * If no number specified, copies first/only code block
   * @param {number|null} blockNumber - Block number (1-indexed), or null for first block
   */
  function copyCode(blockNumber = null) {
    const msgEl = getActiveMessageElement()
    if (!msgEl) return false

    const codeBlocks = msgEl.querySelectorAll('.assistant-body pre code')
    if (codeBlocks.length === 0) return false

    // If no number specified and only one block, copy it
    if (blockNumber === null) {
      if (codeBlocks.length === 1) {
        const code = codeBlocks[0].textContent
        return copyToClipboard(code, 'Code copied')
      } else {
        // Multiple blocks but no number specified - do nothing, wait for digit
        return false
      }
    }

    // Copy specific block (1-indexed for user, 0-indexed for array)
    const index = blockNumber - 1
    if (index < 0 || index >= codeBlocks.length) {
      showToast(`Code block ${blockNumber} not found (1-${codeBlocks.length} available)`, true)
      return false
    }

    const code = codeBlocks[index].textContent
    return copyToClipboard(code, `Code block ${blockNumber} copied`)
  }

  /**
   * Copy equation by number (1-indexed)
   * If no number specified, copies first/only equation
   * @param {number|null} equationNumber - Equation number (1-indexed), or null for first equation
   */
  function copyEquation(equationNumber = null) {
    const msgEl = getActiveMessageElement()
    if (!msgEl) return false

    const equations = msgEl.querySelectorAll('.assistant-body .katex-display.numbered')
    if (equations.length === 0) return false

    // If no number specified and only one equation, copy it
    if (equationNumber === null) {
      if (equations.length === 1) {
        const latex = extractLatexFromEquation(equations[0])
        return copyToClipboard(latex, 'Equation copied')
      } else {
        // Multiple equations but no number specified - do nothing, wait for digit
        return false
      }
    }

    // Copy specific equation (1-indexed for user, 0-indexed for array)
    const index = equationNumber - 1
    if (index < 0 || index >= equations.length) {
      showToast(`Equation ${equationNumber} not found (1-${equations.length} available)`, true)
      return false
    }

    const latex = extractLatexFromEquation(equations[index])
    return copyToClipboard(latex, `Equation ${equationNumber} copied`)
  }

  /**
   * Extract LaTeX source from a KaTeX-rendered equation
   * @param {HTMLElement} equationElement - The .katex-display element
   * @returns {string} - LaTeX source code
   */
  function extractLatexFromEquation(equationElement) {
    // KaTeX stores original LaTeX in annotation tag
    const annotation = equationElement.querySelector('annotation[encoding="application/x-tex"]')
    if (annotation) {
      return annotation.textContent
    }

    // Fallback: return visible text if annotation not found
    return equationElement.textContent || ''
  }

  /**
   * Copy math expression at cursor
   * Looks for .katex elements
   */
  function copyMath() {
    const msgEl = getActiveMessageElement()
    if (!msgEl) return false

    // Try to find KaTeX element and get original TeX
    const katexEl = msgEl.querySelector('.katex')
    if (!katexEl) return false

    // KaTeX stores original in annotation
    const annotation = katexEl.querySelector('annotation[encoding="application/x-tex"]')
    const tex = annotation ? annotation.textContent : katexEl.textContent

    return copyToClipboard(tex, 'Math copied')
  }

  /**
   * Copy entire message text
   */
  function copyMessage() {
    const msgEl = getActiveMessageElement()
    if (!msgEl) return false

    const body = msgEl.querySelector('.assistant-body, .part-inner')
    if (!body) return false

    const text = body.textContent
    return copyToClipboard(text, 'Message copied')
  }

  /**
   * Copy table as TSV (tab-separated values)
   */
  function copyTable() {
    const msgEl = getActiveMessageElement()
    if (!msgEl) return false

    const table = msgEl.querySelector('table')
    if (!table) return false

    const rows = Array.from(table.querySelectorAll('tr'))
    const tsv = rows
      .map((row) => {
        const cells = Array.from(row.querySelectorAll('th, td'))
        return cells.map((cell) => cell.textContent.trim()).join('\t')
      })
      .join('\n')

    return copyToClipboard(tsv, 'Table copied')
  }

  /**
   * Helper to copy text to clipboard
   */
  function copyToClipboard(text, successMessage) {
    try {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          showToast(successMessage)
        })
        .catch((err) => {
          console.error('Copy failed:', err)
          showToast('Copy failed', true)
        })
      return true
    } catch (err) {
      console.error('Clipboard not available:', err)
      return false
    }
  }

  /**
   * Show temporary toast notification
   */
  function showToast(message, isError = false) {
    // Create toast element
    const toast = document.createElement('div')
    toast.textContent = message
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: ${isError ? '#f66' : '#5fa8ff'};
      color: white;
      padding: 12px 20px;
      border-radius: 4px;
      font-size: 13px;
      font-family: var(--font-ui);
      z-index: 10000;
      animation: slideIn 0.3s ease;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    `

    // Add animation
    const style = document.createElement('style')
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateY(100px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    `
    document.head.appendChild(style)

    document.body.appendChild(toast)

    // Auto-remove after 2 seconds
    setTimeout(() => {
      toast.style.animation = 'slideIn 0.3s ease reverse'
      setTimeout(() => {
        document.body.removeChild(toast)
        document.head.removeChild(style)
      }, 300)
    }, 2000)
  }

  return {
    copyCode,
    copyEquation,
    copyMath,
    copyMessage,
    copyTable,
  }
}
