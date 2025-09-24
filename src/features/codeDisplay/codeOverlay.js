// Basic code overlay for Phase 2
// Single frame display with syntax highlighting placeholder

export function createCodeOverlay() {
  let overlayElement = null;
  let isOpen = false;

  function show(codeBlock, messagePair) {
    if (isOpen) {
      hide();
      return;
    }

    // Create overlay structure
    overlayElement = document.createElement('div');
    overlayElement.className = 'code-overlay-backdrop';
    overlayElement.innerHTML = `
      <div class="code-overlay">
        <div class="code-overlay-header">
          <div class="code-overlay-title">
            Code Block: ${codeBlock.language}
            <span class="code-overlay-subtitle">${codeBlock.lineCount} lines</span>
          </div>
          <button class="code-overlay-close" title="Close (Esc)">×</button>
        </div>
        <div class="code-overlay-content">
          <pre class="code-overlay-pre"><code class="code-overlay-code">${escapeHtml(codeBlock.code)}</code></pre>
        </div>
        <div class="code-overlay-footer">
          <button class="btn code-copy-btn" title="Copy code (Ctrl+C)">Copy</button>
        </div>
      </div>
    `;

    // Add to DOM
    document.body.appendChild(overlayElement);
    isOpen = true;

    // Focus management
    overlayElement.focus();
    
    // Event listeners
    overlayElement.addEventListener('click', (e) => {
      if (e.target === overlayElement) {
        hide(); // Click backdrop to close
      }
    });

    const closeBtn = overlayElement.querySelector('.code-overlay-close');
    closeBtn.addEventListener('click', hide);

    const copyBtn = overlayElement.querySelector('.code-copy-btn');
    copyBtn.addEventListener('click', () => copyToClipboard(codeBlock.code));

    // Keyboard handling
    overlayElement.addEventListener('keydown', handleKeydown);

    console.log('[CodeOverlay] Opened:', codeBlock.language, 'block');
  }

  function hide() {
    if (!isOpen || !overlayElement) return;
    
    overlayElement.remove();
    overlayElement = null;
    isOpen = false;
    
    console.log('[CodeOverlay] Closed');
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      hide();
    } else if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const codeElement = overlayElement.querySelector('.code-overlay-code');
      if (codeElement) {
        copyToClipboard(codeElement.textContent);
      }
    }
  }

  function copyToClipboard(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        console.log('[CodeOverlay] Copied to clipboard');
        // TODO: Show temporary success feedback
      }).catch((err) => {
        console.error('[CodeOverlay] Copy failed:', err);
      });
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      console.log('[CodeOverlay] Copied via fallback');
    }
  }

  function isVisible() {
    return isOpen;
  }

  return {
    show,
    hide,
    isVisible
  };
}

// Simple HTML escaping helper
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}