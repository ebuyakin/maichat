import { openModal } from '../../shared/openModal.js'

export function createEquationOverlay({ modeManager }) {
  let backdrop = null
  let panel = null
  let modalHandle = null
  let currentBlock = null
  let blocks = null // array of equationBlocks
  let currentIndex = 0

  function renderPanel(eqBlock) {
    if (!panel) return
    const total = blocks ? blocks.length : 1
    const idxDisplay =
      total > 1 ? `<span class="code-overlay-index">(${currentIndex + 1}/${total})</span>` : ''
    const highlighted = escapeHtml(eqBlock.tex) // placeholder until KaTeX
    panel.innerHTML = `
      <div class="code-overlay-header">
        <div class="code-overlay-title">
          Equation ${idxDisplay}
          <span class="code-overlay-subtitle">${eqBlock.display ? 'display' : 'inline'}</span>
        </div>
        <button class="code-overlay-close" title="Close (Esc)">×</button>
      </div>
      <div class="code-overlay-content">
        <pre class="code-overlay-pre" tabindex="0"><code class="code-overlay-code">${highlighted}</code></pre>
      </div>
      <div class="code-overlay-footer">
        ${total > 1 ? `<div class="code-overlay-hint" aria-label="equation navigation">n: next • p: prev</div>` : '<div class="code-overlay-hint"></div>'}
        <button class="btn code-copy-btn" title="Copy TeX (c or Ctrl+C)">Copy (or press c)</button>
      </div>
    `
    const closeBtn = panel.querySelector('.code-overlay-close')
    if (closeBtn) {
      closeBtn.addEventListener('click', () => close('button'))
    }
    const copyBtn = panel.querySelector('.code-copy-btn')
    if (copyBtn) {
      copyBtn.addEventListener('click', () => copyToClipboard(eqBlock.tex))
    }
  }

  function show(eqBlock, messagePair, options = {}) {
    if (!eqBlock) return
    if (messagePair && Array.isArray(messagePair.equationBlocks)) {
      blocks = messagePair.equationBlocks
      if (options.index != null) {
        currentIndex = options.index
      } else {
        const idx = blocks.findIndex((b) => b === eqBlock || (b.index && b.index === eqBlock.index))
        currentIndex = idx >= 0 ? idx : 0
      }
      currentBlock = blocks[currentIndex]
    } else {
      blocks = [eqBlock]
      currentIndex = 0
      currentBlock = eqBlock
    }
    if (modalHandle) {
      renderPanel(currentBlock)
      focus()
      return
    }
    backdrop = document.createElement('div')
    backdrop.className = 'code-overlay-backdrop'
    panel = document.createElement('div')
    panel.className = 'code-overlay'
    backdrop.appendChild(panel)
    document.body.appendChild(backdrop)
    renderPanel(currentBlock)
    backdrop.addEventListener('mousedown', (e) => {
      if (e.target === backdrop) close('backdrop')
    })
    modalHandle = openModal({
      modeManager,
      root: backdrop,
      preferredFocus: () => panel.querySelector('.code-overlay-pre') || panel,
      closeKeys: ['Escape'],
      restoreMode: true,
      blockPolicy: { keys: true, pointer: true, wheel: true },
      beforeClose: () => {
        currentBlock = null
        panel = null
        backdrop = null
        modalHandle = null
      },
    })
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
            focus()
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
    focus()
    console.log(
      '[EquationOverlay] Opened modal for block:',
      currentBlock.display ? 'display' : 'inline'
    )
  }

  function focus() {
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
    console.log('[EquationOverlay] Closed')
  }
  function isVisible() {
    return !!modalHandle
  }
  function copyToClipboard(text) {
    if (!text) return
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(text)
        .catch((err) => console.error('[EquationOverlay] Copy failed', err))
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

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
