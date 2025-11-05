import { listModels, getActiveModel } from '../../core/models/modelCatalog.js'
import { openModal } from '../../shared/openModal.js'

// Dedicated Re-ask overlay (normal-only): choose model, Enter = send immediately, Esc = cancel.
// Usage: openReaskOverlay({ modeManager, defaultModel, onConfirm, onClose })
export function openReaskOverlay({ modeManager, defaultModel, onConfirm, onClose }) {
  if (document.getElementById('reaskOverlayRoot')) return
  const root = document.createElement('div')
  root.id = 'reaskOverlayRoot'
  root.className = 'overlay-backdrop centered'
  root.innerHTML = `
    <div class="overlay-panel model-selector-panel compact">
      <header class="dim" style="opacity:.7;">Re-ask</header>
      <div class="ms-body">
        <ul class="model-list" role="listbox"></ul>
        <div class="ms-hint" style="max-width:46ch; white-space:normal; word-break:break-word; line-height:1.3;">type to filter · j/k move · Enter send · Esc cancel · replaces the current answer; the previous will be saved</div>
      </div>
    </div>`
  document.body.appendChild(root)
  const panel = root.querySelector('.model-selector-panel')
  const listEl = panel.querySelector('.model-list')

  const allModels = listModels().filter((m) => m.enabled !== false).map((m) => m.id)
  let filter = ''
  let filtered = allModels.slice()
  let activeIndex = (() => {
    const preferred = defaultModel || (getActiveModel && getActiveModel())
    if (preferred) {
      const i = filtered.indexOf(preferred)
      if (i >= 0) return i
    }
    return 0
  })()

  const modal = openModal({
    modeManager,
    root,
    closeKeys: [],
    restoreMode: false,
    preferredFocus: () => listEl,
  })

  function close(trigger = 'manual') {
    try { root.removeEventListener('keydown', keyHandler, true) } catch {}
    modal.close(trigger)
    if (onClose) onClose()
  }
  root.addEventListener('click', (e) => {
    if (e.target === root) close('backdrop')
  })

  function applyFilter() {
    const f = filter.toLowerCase()
    filtered = allModels.filter((m) => m.toLowerCase().includes(f))
    if (activeIndex >= filtered.length) activeIndex = filtered.length - 1
    if (activeIndex < 0) activeIndex = 0
    renderList()
  }
  function renderList() {
    if (!filtered.length) {
      listEl.innerHTML = ''
      listEl.setAttribute('tabindex', '0')
      try { listEl.focus({ preventScroll: true }) } catch {}
      return
    }
    listEl.innerHTML = filtered
      .map(
        (m, i) =>
          `<li class="model-item${i === activeIndex ? ' active' : ''}" data-name="${m}" role="option" aria-selected="${i === activeIndex}">${m}</li>`
      )
      .join('')
    const items = listEl.querySelectorAll('.model-item')
    items.forEach((el, i) => {
      if (i === activeIndex) el.setAttribute('tabindex', '0')
      else el.removeAttribute('tabindex')
    })
    listEl.removeAttribute('tabindex')
    const activeEl = listEl.querySelector('.model-item.active')
    if (activeEl) {
      try { activeEl.focus({ preventScroll: true }) } catch {}
      try { activeEl.scrollIntoView({ block: 'nearest' }) } catch {}
    }
  }
  function move(delta) {
    if (!filtered.length) return
    activeIndex = (activeIndex + delta + filtered.length) % filtered.length
    renderList()
  }
  function confirmSend() {
    const name = filtered[activeIndex]
    if (!name) return
    if (onConfirm) onConfirm(name)
    close('confirm')
  }

  function keyHandler(e) {
    const swallow = () => {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation()
    }
    if (e.key === 'Escape') { swallow(); close('escape'); return }
    if (e.key === 'Enter') { swallow(); confirmSend(); return }
    if (e.key === 'j' || e.key === 'ArrowDown') { if (filtered.length) { swallow(); move(1) } return }
    if (e.key === 'k' || e.key === 'ArrowUp') { if (filtered.length) { swallow(); move(-1) } return }
    if (e.key === 'Backspace') { swallow(); filter = filter.slice(0, -1); applyFilter(); return }
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) { swallow(); filter += e.key; applyFilter(); return }
  }
  root.addEventListener('keydown', keyHandler, true)
  applyFilter()
}
