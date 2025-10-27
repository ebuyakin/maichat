// Basic code overlay for Phase 2
// Single frame display with syntax highlighting placeholder

import { openModal } from '../../shared/openModal.js'

export function createCodeOverlay({ modeManager }) {
  let backdrop = null
  let panel = null
  let modalHandle = null
  let currentBlock = null
  let blocks = null // array of codeBlocks for active message
  let currentIndex = 0

  function renderPanel(codeBlock) {
    if (!panel) return
    const highlighted = highlightCode(codeBlock.code, codeBlock.language)
    const total = blocks ? blocks.length : 1
    const idxDisplay =
      total > 1 ? `<span class="code-overlay-index">(${currentIndex + 1}/${total})</span>` : ''
    panel.innerHTML = `
      <div class="code-overlay-header">
        <div class="code-overlay-title">
          Code: ${codeBlock.language} ${idxDisplay}
          <span class="code-overlay-subtitle">${codeBlock.lineCount} lines</span>
        </div>
        <button class="code-overlay-close" title="Close (Esc)">×</button>
      </div>
      <div class="code-overlay-content">
        <pre class="code-overlay-pre" tabindex="0"><code class="code-overlay-code">${highlighted}</code></pre>
      </div>
      <div class="code-overlay-footer">
        ${total > 1 ? `<div class="code-overlay-hint" aria-label="snippet navigation">n: next • p: prev</div>` : '<div class="code-overlay-hint"></div>'}
        <button class="btn code-copy-btn" title="Copy code (c or Ctrl+C)">Copy (or press c)</button>
      </div>
    `
    const closeBtn = panel.querySelector('.code-overlay-close')
    if (closeBtn) {
      closeBtn.addEventListener('click', () => close('button'))
    }
    const copyBtn = panel.querySelector('.code-copy-btn')
    if (copyBtn) {
      copyBtn.addEventListener('click', () => copyToClipboard(codeBlock.code))
    }
  }

  function show(codeBlock, messagePair, options = {}) {
    if (!codeBlock) return
    // If messagePair has codeBlocks we capture them for navigation
    if (messagePair && Array.isArray(messagePair.codeBlocks)) {
      blocks = messagePair.codeBlocks
      // determine index if provided vs find in array
      if (options.index != null) {
        currentIndex = options.index
      } else {
        const idx = blocks.findIndex(
          (b) => b === codeBlock || (b.index && b.index === codeBlock.index)
        )
        currentIndex = idx >= 0 ? idx : 0
      }
      currentBlock = blocks[currentIndex]
    } else {
      blocks = [codeBlock]
      currentIndex = 0
      currentBlock = codeBlock
    }
    // If already open, just update content
    if (modalHandle) {
      renderPanel(currentBlock)
      focusCode()
      return
    }
    backdrop = document.createElement('div')
    backdrop.className = 'code-overlay-backdrop'
    panel = document.createElement('div')
    panel.className = 'code-overlay'
    backdrop.appendChild(panel)
    document.body.appendChild(backdrop)
    renderPanel(currentBlock)
    // Click outside panel closes
    backdrop.addEventListener('mousedown', (e) => {
      if (e.target === backdrop) close('backdrop')
    })
    modalHandle = openModal({
      modeManager,
      root: backdrop, // IMPORTANT: backdrop is now the modal root (Option A)
      preferredFocus: () => panel.querySelector('.code-overlay-pre') || panel,
      closeKeys: ['Escape'],
      restoreMode: true,
      blockPolicy: { keys: true, pointer: true, wheel: true },
      beforeClose: () => {
        // Cleanup references so GC can reclaim
        currentBlock = null
        panel = null
        backdrop = null
        modalHandle = null
      },
    })
    // Add copy shortcut inside panel
    panel.addEventListener(
      'keydown',
      (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
          const codeEl = panel.querySelector('.code-overlay-code')
          if (codeEl) {
            copyToClipboard(codeEl.textContent)
            e.preventDefault()
          }
        } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'c') {
          const codeEl = panel.querySelector('.code-overlay-code')
          if (codeEl) {
            copyToClipboard(codeEl.textContent)
            e.preventDefault()
          }
        } else if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'n' || e.key === 'p')) {
          if (blocks && blocks.length > 1) {
            e.preventDefault()
            if (e.key === 'n') {
              currentIndex = (currentIndex + 1) % blocks.length
            } else {
              currentIndex = (currentIndex - 1 + blocks.length) % blocks.length
            }
            currentBlock = blocks[currentIndex]
            renderPanel(currentBlock)
            focusCode()
          }
        } else if (
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey &&
          (e.key === 'j' ||
            e.key === 'k' ||
            e.key === 'd' ||
            e.key === 'u' ||
            e.key === 'ArrowDown' ||
            e.key === 'ArrowUp')
        ) {
          const pre = panel.querySelector('.code-overlay-pre')
          if (pre) {
            const style = window.getComputedStyle(pre)
            let lineH = parseFloat(style.lineHeight)
            if (!lineH || isNaN(lineH)) lineH = 18
            let delta = 0
            if (e.key === 'j' || e.key === 'ArrowDown') delta = lineH
            else if (e.key === 'k' || e.key === 'ArrowUp') delta = -lineH
            else if (e.key === 'd') delta = Math.round(pre.clientHeight / 2)
            else if (e.key === 'u') delta = -Math.round(pre.clientHeight / 2)
            if (delta !== 0) {
              e.preventDefault()
              pre.scrollTop = pre.scrollTop + delta
            }
          }
        }
      },
      true
    )
    focusCode()
  }

  function focusCode() {
    try {
      const el = panel && panel.querySelector('.code-overlay-pre')
      if (el) el.focus()
    } catch {}
  }

  function close(trigger) {
    if (!modalHandle) {
      return
    }
    try {
      modalHandle.close(trigger)
    } catch {}
    // beforeClose hook handles nulling references
  }

  function isVisible() {
    return !!modalHandle
  }

  function copyToClipboard(text) {
    if (!text) return
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(text)
        .catch((err) => console.error('[CodeOverlay] Copy failed', err))
    } else {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
      } catch {}
      document.body.removeChild(ta)
    }
  }

  return { show, close, isVisible }
}

// Simple HTML escaping helper
function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// Lightweight tokenizer-based highlighter (best-effort, not full language support)
function highlightCode(code, lang) {
  if (!code) return ''
  const safe = escapeHtml(code)
  const l = (lang || '').toLowerCase()
  try {
    if (l === 'json') return highlightJson(safe)
    if (l === 'python' || l === 'py') return highlightGeneric(safe, PY_KEYWORDS)
    if (l === 'javascript' || l === 'js' || l === 'ts' || l === 'typescript')
      return highlightGeneric(safe, JS_KEYWORDS)
    if (l === 'bash' || l === 'sh' || l === 'shell') return highlightShell(safe)
    return safe // fallback plain
  } catch {
    return safe
  }
}

function wrap(tok, cls) {
  return `<span class="tok-${cls}">${tok}</span>`
}

const JS_KEYWORDS = new Set(
  'import export from const let var function return if else for while do switch case break continue try catch finally throw new class extends super this typeof instanceof in delete void await async yield static get set of'.split(
    /\s+/
  )
)
const PY_KEYWORDS = new Set(
  'def return if elif else for while break continue class pass import from as try except finally raise with lambda yield global nonlocal assert True False None and or not is in'.split(
    /\s+/
  )
)
const SHELL_BUILTINS = new Set(
  'echo cd ls cat grep find mkdir rm rmdir mv cp touch chmod chown export source alias unalias pwd which head tail sed awk kill'.split(
    /\s+/
  )
)

function highlightGeneric(html, keywordSet) {
  // Very naive: split on word boundaries, re-wrap
  return html
    .replace(/\b([A-Za-z_][A-Za-z0-9_]*)\b/g, (m, w) => (keywordSet.has(w) ? wrap(w, 'kw') : w))
    .replace(/(\d+)(?![^<]*>)/g, (m) => wrap(m, 'num'))
    .replace(/(&quot;.*?&quot;|'.*?')/g, (m) => wrap(m, 'str'))
}

function highlightJson(html) {
  return html
    .replace(/(&quot;.*?&quot;)(\s*:\s*)/g, (m, k, sep) => wrap(k, 'key') + sep)
    .replace(/(:\s*)(&quot;.*?&quot;)/g, (m, pre, val) => pre + wrap(val, 'str'))
    .replace(/(:\s*)(-?\d+(?:\.\d+)?)/g, (m, pre, num) => pre + wrap(num, 'num'))
    .replace(/\b(true|false|null)\b/g, (m) => wrap(m, 'kw'))
}

function highlightShell(html) {
  return html
    .replace(/\b([A-Za-z_][A-Za-z0-9_-]*)\b/g, (m, w) =>
      SHELL_BUILTINS.has(w) ? wrap(w, 'kw') : w
    )
    .replace(/(#.*?)(?=\n|$)/g, (m) => wrap(m, 'com'))
}
