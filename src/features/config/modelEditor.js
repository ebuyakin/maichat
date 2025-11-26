// modelEditor.js moved from ui/modelEditor.js (Phase 6.6 Config)
// Restored original (moved from src/ui/modelEditor.js) - path adjusted only.
import {
  listModels,
  getActiveModel,
  setActiveModel,
  updateModelMeta,
  setModelEnabled,
  addModel,
  deleteModel,
  renameModel,
  SUPPORTED_PROVIDERS,
} from '../../core/models/modelCatalog.js'
import { openModal } from '../../shared/openModal.js'

// Ensure only the latest opened editor handles global keys
let ACTIVE_EDITOR_TOKEN = null

export function openModelEditor({ onClose, store }) {
  const TOKEN = Symbol('modelEditor')
  ACTIVE_EDITOR_TOKEN = TOKEN
  const backdrop = document.createElement('div')
  backdrop.className = 'overlay-backdrop centered'
  const panel = document.createElement('div')
  panel.className = 'overlay-panel model-editor'
  panel.style.minWidth = '1000px'
  panel.innerHTML = `
    <header>Models</header>
  <div class="me-hintbar"><span class="me-hint">j/k rows · h/l cols · Space Enable/Disable · Enter edit mode · Esc nav mode · Ctrl+N new model</span></div>
    <div class="me-table">
      <div class="me-row me-head" aria-hidden="true">
  <span class="me-col me-col-toggle">Enabled</span>
  <span class="me-col me-col-name">Model</span>
  <span class="me-col me-col-provider">Provider</span>
  <span class="me-col me-col-search">Search</span>
  <span class="me-col me-col-cw">CW (K)</span>
  <span class="me-col me-col-tpm">TPM (K)</span>
  <span class="me-col me-col-otpm">OTPM (K)</span>
  <span class="me-col me-col-tpd">TPD (K)</span>
  <span class="me-col me-col-rpm">RPM</span>
  <span class="me-col me-col-rpd">RPD</span>
      </div>
  <div class="list"><ul tabindex="0" class="me-list"></ul></div>
  <div class="me-hintbar" aria-hidden="true"><span class="me-hint">CW — context window · TPM — tokens per minute · OTPM — output tokens per minute (Anthropic) · TPD — tokens per day · RPM — requests per minute · RPD — requests per day</span></div>
    </div>
    <footer class="me-footer">
      <div class="me-controls">
        <div class="me-controls-left">
          <span class="me-mode-badge" aria-label="Editor mode">[nav]</span>
        </div>
        <div class="me-controls-right">
          <button class="btn btn-sm" id="me-save-btn">Apply (Ctrl+S)</button>
          <button class="btn btn-sm" id="me-cancel-btn">Cancel+Close (Esc)</button>
        </div>
      </div>
    </footer>`
  backdrop.appendChild(panel)
  document.body.appendChild(backdrop)
  const ul = panel.querySelector('ul')
  const listContainer = panel.querySelector('.list')
  const saveBtn = panel.querySelector('#me-save-btn')
  const cancelBtn = panel.querySelector('#me-cancel-btn')
  const modeBadge = panel.querySelector('.me-mode-badge')
    function updateModeBadge() {
      if (!modeBadge) return
      modeBadge.textContent = mode === 'edit' ? '[edit]' : '[nav]'
    }
  // Helper: keep focus within overlay so key handling stays active
  function ensureListFocus() {
    try {
      ul.focus({ preventScroll: true })
    } catch (_) {}
  }
  // Compute actual scrollbar width and apply to CSS vars for precise alignment
  function syncScrollbarVar() {
    try {
      if (!listContainer) return
      // Force layout to compute current scrollbar width
      const sw = listContainer.offsetWidth - listContainer.clientWidth
      if (Number.isFinite(sw) && sw >= 0) {
        panel.style.setProperty('--me-scrollbar-w', sw + 'px')
        // Avoid double counting any separate track border in CSS when using measured width
        panel.style.setProperty('--me-scrollbar-track-border', '0px')
      }
    } catch {}
  }

  let models = []
  let origById = new Map()
  let draftById = new Map()
  let stagedDeletes = new Set()
  let stagedAdds = new Map() // id -> meta
  let activeIndex = 0
  // Navigation state: null = row only (no column focus); otherwise 0..7 => column index
  // 0: toggle, 1: name (read-only except for new row), 2: provider (ONLY focusable/editable for pending new row), 3..7: numeric fields cw, tpm, rpm, tpd, otpm.
  // For existing rows, navigation should jump from name (1) directly to CW (3) when user presses 'l'.
  let selectedCol = 0  // Start at Enabled/Disabled column (most common use case)
  let mode = 'navigation'  // 'navigation' | 'edit'
  let pendingNewRow = null // { enabled, id:'', contextWindow,tpm,rpm,tpd,otpm }
  let __dirty = false
  let __applied = false // becomes true when changes are saved

  const COLS = ['toggle', 'name', 'provider', 'webSearch', 'contextWindow', 'tpm', 'otpm', 'tpd', 'rpm', 'rpd']
  const PROVIDER_COL_INDEX = 2
  const WEBSEARCH_COL_INDEX = 3
  const FIRST_NUMERIC_COL = 4 // contextWindow
  const LAST_COL = 9
  function render(preserveId) {
    const prevId = preserveId || (models[activeIndex] && models[activeIndex].id)
    models = listModels()
    const activeModel = getActiveModel()
    const usedCounts = new Map()
    if (store && typeof store.getAllPairs === 'function') {
      for (const p of store.getAllPairs()) {
        const k = String(p.model || '').toLowerCase()
        usedCounts.set(k, (usedCounts.get(k) || 0) + 1)
      }
    }
    // Build original snapshot once
    if (origById.size === 0) {
      for (const m of models) {
        origById.set(m.id, { ...m })
      }
    }
    // Initialize draft from original on first render
    if (draftById.size === 0) {
      for (const m of models) {
        draftById.set(m.id, { ...m })
      }
    }
    if (prevId) {
      const newIdx = models.findIndex((m) => m.id === prevId)
      if (newIdx >= 0) activeIndex = newIdx
    }
    // Clamp activeIndex based on total rows count including pending new row
    const totalRows = models.length + (pendingNewRow ? 1 : 0)
    if (activeIndex >= totalRows) activeIndex = totalRows - 1
    if (activeIndex < 0) activeIndex = 0
    ul.innerHTML = ''
    models.forEach((base, i) => {
      const m = draftById.get(base.id) || base
      const li = document.createElement('li')
      li.dataset.id = m.id
      li.tabIndex = -1
      li.classList.add('me-row')
      if (i === activeIndex) li.classList.add('active')
      const activeBadge = m.id === activeModel ? '<span class="me-active">(active)</span>' : ''
      const inUse = usedCounts.get(String(m.id).toLowerCase()) > 0
      const providerOptions = SUPPORTED_PROVIDERS.map(p => 
        `<option value="${p}" ${(m.provider || 'openai') === p ? 'selected' : ''}>${p}</option>`
      ).join('')
      li.innerHTML = `
        <span class="me-col me-col-toggle ${m.enabled ? 'on' : 'off'}" data-role="toggle" aria-label="${m.enabled ? 'enabled' : 'disabled'}">${m.enabled ? '●' : '○'}</span>
        <span class="me-col me-col-name"><input aria-label="Model ID" data-field="id" type="text" value="${m.id}" class="me-name-input"/>${activeBadge}</span>
        <span class="me-col me-col-provider"><select aria-label="Provider" data-field="provider" class="me-provider-select">${providerOptions}</select></span>
        <span class="me-col me-col-search"><input aria-label="Web Search" data-field="webSearch" type="checkbox" ${m.webSearch ? 'checked' : ''} class="me-checkbox"/></span>
        <span class="me-col me-col-cw"><input aria-label="Context window (K tokens)" data-field="contextWindow" data-scale="1000" type="number" min="0" step="1" value="${Math.round((m.contextWindow || 0) / 1000)}" class="me-num"/></span>
        <span class="me-col me-col-tpm"><input aria-label="Tokens per minute (K tokens)" data-field="tpm" data-scale="1000" type="number" min="0" step="1" value="${Math.round((m.tpm || 0) / 1000)}" class="me-num"/></span>
        <span class="me-col me-col-otpm"><input aria-label="Output tokens per minute (K tokens)" data-field="otpm" data-scale="1000" type="number" min="0" step="1" value="${m.otpm != null ? Math.round((m.otpm || 0) / 1000) : ''}" class="me-num" placeholder="-"/></span>
        <span class="me-col me-col-tpd"><input aria-label="Tokens per day (K tokens)" data-field="tpd" data-scale="1000" type="number" min="0" step="1" value="${m.tpd != null ? Math.round((m.tpd || 0) / 1000) : ''}" class="me-num" placeholder="-"/></span>
        <span class="me-col me-col-rpm"><input aria-label="Requests per minute" data-field="rpm" type="number" min="0" step="1" value="${m.rpm || ''}" class="me-num" placeholder="-"/></span>
        <span class="me-col me-col-rpd"><div class="me-actions"><input aria-label="Requests per day" data-field="rpd" type="number" min="0" step="1" value="${m.rpd || ''}" class="me-num" placeholder="-"/></div></span>`
      ul.appendChild(li)
    })
    // Render inline pending new row, if any
    if (pendingNewRow) {
      const i = models.length
      const li = document.createElement('li')
      li.dataset.id = ''
      li.tabIndex = -1
      li.classList.add('me-row')
      if (i === activeIndex) li.classList.add('active')
      const pendingProviderOptions = SUPPORTED_PROVIDERS.map(p => 
        `<option value="${p}" ${(pendingNewRow.provider || 'openai') === p ? 'selected' : ''}>${p}</option>`
      ).join('')
      li.innerHTML = `
        <span class="me-col me-col-toggle on" data-role="toggle" aria-label="enabled">●</span>
        <span class="me-col me-col-name"><input class="me-name-input" data-pending="1" data-field="id" type="text" placeholder="New model id" value="${pendingNewRow.id || ''}"/></span>
        <span class="me-col me-col-provider"><select aria-label="Provider" data-pending="1" data-field="provider" class="me-provider-select">${pendingProviderOptions}</select></span>
        <span class="me-col me-col-search"><input aria-label="Web Search" data-pending="1" data-field="webSearch" type="checkbox" ${pendingNewRow.webSearch ? 'checked' : ''} class="me-checkbox"/></span>
        <span class="me-col me-col-cw"><input aria-label="Context window (K tokens)" data-pending="1" data-field="contextWindow" data-scale="1000" type="number" min="0" step="1" value="${Math.round((pendingNewRow.contextWindow || 0) / 1000)}" class="me-num"/></span>
        <span class="me-col me-col-tpm"><input aria-label="Tokens per minute (K tokens)" data-pending="1" data-field="tpm" data-scale="1000" type="number" min="0" step="1" value="${Math.round((pendingNewRow.tpm || 0) / 1000)}" class="me-num"/></span>
        <span class="me-col me-col-otpm"><input aria-label="Output tokens per minute (K tokens)" data-pending="1" data-field="otpm" data-scale="1000" type="number" min="0" step="1" value="${pendingNewRow.otpm != null ? Math.round((pendingNewRow.otpm || 0) / 1000) : ''}" class="me-num" placeholder="-"/></span>
        <span class="me-col me-col-tpd"><input aria-label="Tokens per day (K tokens)" data-pending="1" data-field="tpd" data-scale="1000" type="number" min="0" step="1" value="${pendingNewRow.tpd != null ? Math.round((pendingNewRow.tpd || 0) / 1000) : ''}" class="me-num" placeholder="-"/></span>
        <span class="me-col me-col-rpm"><input aria-label="Requests per minute" data-pending="1" data-field="rpm" type="number" min="0" step="1" value="${pendingNewRow.rpm || 0}" class="me-num" placeholder="-"/></span>
        <span class="me-col me-col-rpd"><div class="me-actions"><input aria-label="Requests per day" data-pending="1" data-field="rpd" type="number" min="0" step="1" value="${pendingNewRow.rpd || ''}" class="me-num" placeholder="-"/></div></span>`
      ul.appendChild(li)
    }
    // Apply visual selection outline when a column is selected
    applyCellSelection()
    updateFooterState()
    updateScrollHints()
    syncScrollbarVar()
  }
  function fmt(n) {
    return Math.round(n / 1000)
  }
  
  let hintTimeout = null
  function showActiveModelHint() {
    // Clear any existing hint
    if (hintTimeout) {
      clearTimeout(hintTimeout)
      hintTimeout = null
    }
    
    // Find or create hint element
    let hintEl = panel.querySelector('.me-active-model-hint')
    if (!hintEl) {
      hintEl = document.createElement('div')
      hintEl.className = 'me-active-model-hint'
      hintEl.textContent = 'Cannot disable active model. Switch to another model first.'
      panel.appendChild(hintEl)
    }
    
    // Show hint
    hintEl.style.display = 'block'
    hintEl.style.opacity = '1'
    
    // Ensure focus stays on the list so keyboard navigation continues working
    ensureListFocus()
    
    // Hide after 2 seconds
    hintTimeout = setTimeout(() => {
      if (hintEl) {
        hintEl.style.opacity = '0'
        setTimeout(() => {
          if (hintEl) hintEl.style.display = 'none'
        }, 300)
      }
      hintTimeout = null
    }, 2000)
  }
  
  function toggle(id) {
    const cur = draftById.get(id) || origById.get(id)
    if (!cur) return
    
    // Don't allow disabling the currently active model
    const active = getActiveModel()
    if (active === id && cur.enabled === true) {
      // Show visual feedback
      showActiveModelHint()
      return
    }
    
    draftById.set(id, { ...cur, enabled: !cur.enabled })
    __dirty = true
    render(id)
    // Ensure focus stays inside overlay to keep key handling alive
    try {
      ul.focus({ preventScroll: true })
    } catch {}
  }
  render()
  syncScrollbarVar()
  window.addEventListener('resize', syncScrollbarVar)
  // Scroll hint indicators (top/bottom gradient fades)
  function updateScrollHints() {
    if (!listContainer) return
    const { scrollTop, scrollHeight, clientHeight } = listContainer
    const hasScroll = scrollHeight > clientHeight + 1
    listContainer.classList.toggle('has-scroll', hasScroll)
    if (!hasScroll) {
      listContainer.classList.remove('has-more-below', 'has-more-above')
      return
    }
    const atTop = scrollTop <= 0
    const atBottom = scrollTop + clientHeight >= scrollHeight - 1
    listContainer.classList.toggle('has-more-above', !atTop)
    listContainer.classList.toggle('has-more-below', !atBottom)
  }
  listContainer?.addEventListener('scroll', updateScrollHints)

  function isBaseModel(id) {
    return [
      'gpt-5',
      'gpt-5-mini',
      'gpt-5-nano',
      'o4-mini',
      'claude-sonnet-4-5-20250929',
      'claude-opus-4-1-20250929',
      'claude-3-5-haiku-20241022',
      'gemini-2-5-pro',
      'gemini-2-5-flash',
      'gemini-2-0-flash',
    ].includes(id)
  }
  ul.addEventListener('click', (e) => {
    const li = e.target.closest('li.me-row')
    if (!li || li.classList.contains('me-add')) return
    activeIndex = Array.from(ul.querySelectorAll('li.me-row')).indexOf(li)
    
    const tgt = e.target
    
    // Determine which column was clicked
    const clickedCell = tgt.closest('.me-col-toggle, .me-col-name, .me-col-provider, .me-col-search, .me-col-cw, .me-col-tpm, .me-col-otpm, .me-col-tpd, .me-col-rpm, .me-col-rpd')
    if (clickedCell) {
      // Map cell class to column index
      const colMap = {
        'me-col-toggle': 0,
        'me-col-name': 1,
        'me-col-provider': 2,
        'me-col-search': 3,
        'me-col-cw': 4,
        'me-col-tpm': 5,
        'me-col-otpm': 6,
        'me-col-tpd': 7,
        'me-col-rpm': 8,
        'me-col-rpd': 9,
      }
      
      for (const [cls, col] of Object.entries(colMap)) {
        if (clickedCell.classList.contains(cls)) {
          selectedCol = col
          break
        }
      }
      
      // Update visual selection
      applyCellSelection()
      
      // If clicked on an input/select/checkbox, enter edit mode
      if (tgt.tagName === 'INPUT' || tgt.tagName === 'SELECT') {
        mode = 'edit'
        // Input/select is already focused by browser, just update mode
      } else if (selectedCol === 0 || selectedCol === WEBSEARCH_COL_INDEX) {
        // Clicked on checkbox column but not on the checkbox itself - toggle it
        if (selectedCol === 0) {
          const m = models[activeIndex]
          if (m) {
            toggle(m.id)
            render(m.id)
            applyCellSelection()
          }
        } else if (selectedCol === WEBSEARCH_COL_INDEX) {
          const rowIdx = activeIndex
          const isPending = !!pendingNewRow && rowIdx === models.length
          
          if (isPending) {
            pendingNewRow.webSearch = !pendingNewRow.webSearch
            __dirty = true
            render()
            applyCellSelection()
          } else {
            const m = models[rowIdx]
            if (m) {
              const id = m.id
              const draft = draftById.get(id) || origById.get(id)
              if (draft) {
                draftById.set(id, { ...draft, webSearch: !draft.webSearch })
                __dirty = true
                render(id)
                applyCellSelection()
              }
            }
          }
        }
      }
      
      return
    }
    
    // Fallback: clicked on row but not a specific cell - treat as toggle enabled
    const id = li.dataset.id
    const cur = draftById.get(id) || origById.get(id)
    if (cur) {
      // Don't allow disabling the currently active model
      const active = getActiveModel()
      if (active === id && cur.enabled === true) {
        // Show visual feedback
        showActiveModelHint()
        return
      }
      
      draftById.set(id, { ...cur, enabled: !cur.enabled })
      render(id)
      try {
        ul.focus({ preventScroll: true })
      } catch {}
    }
  })
  ul.addEventListener('change', (e) => {
    const input = e.target.closest('input.me-num, input.me-name-input, select.me-provider-select, input.me-checkbox')
    if (!input) return
    const li = e.target.closest('li')
    if (!li) return
    const id = li.dataset.id
    const field = input.getAttribute('data-field')

    // Handle checkbox fields
    if (input.classList.contains('me-checkbox')) {
      const val = input.checked

      if (input.getAttribute('data-pending') === '1') {
        if (!pendingNewRow) return
        pendingNewRow[field] = val
        __dirty = true
      } else {
        const cur = draftById.get(id) || origById.get(id)
        if (cur) {
          const updated = { ...cur, [field]: val }
          draftById.set(id, updated)
          // If this is a staged add, update stagedAdds too
          if (stagedAdds.has(id)) {
            stagedAdds.set(id, { ...updated })
          }
          __dirty = true
        }
      }
      updateFooterState()
    }

    // Handle numeric fields
    else if (input.classList.contains('me-num')) {
      let val = Number(input.value)
      // Empty input should be treated as undefined/null (no limit)
      if (input.value === '' || input.value === null || input.value === undefined) {
        val = undefined
      } else if (!Number.isFinite(val) || val < 0) {
        val = 0
        input.value = '0'
      }
      
      const scale = Number(input.getAttribute('data-scale') || '1')
      const absVal = val !== undefined ? val * scale : undefined

      if (input.getAttribute('data-pending') === '1') {
        if (!pendingNewRow) return
        pendingNewRow[field] = absVal
      } else {
        const cur = draftById.get(id) || origById.get(id)
        if (cur) {
          const updated = { ...cur, [field]: absVal }
          draftById.set(id, updated)
          // If this is a staged add, update stagedAdds too
          if (stagedAdds.has(id)) {
            stagedAdds.set(id, { ...updated })
          }
        }
      }
    }

    // Handle text fields (Model ID) and select fields (Provider)
    else if (
      input.classList.contains('me-name-input') ||
      input.classList.contains('me-provider-select')
    ) {
      const val = (input.value || '').trim()

      if (input.getAttribute('data-pending') === '1') {
        if (!pendingNewRow) return
        pendingNewRow[field] = val
      } else {
        const cur = draftById.get(id) || origById.get(id)
        if (cur) {
          const updated = { ...cur, [field]: val }
          draftById.set(id, updated)
          // If this is a staged add, update stagedAdds too
          if (stagedAdds.has(id)) {
            stagedAdds.set(id, { ...updated })
          }
        }
      }
    }

    __dirty = true
    // re-render but keep focus on edited input
    const preserveId = id || ''
    const caretPos = input.selectionStart
    const wasSelect = input.classList.contains('me-provider-select')
    const wasCheckbox = input.classList.contains('me-checkbox')
    render(preserveId)
    const li2 = ul.querySelector(`li[data-id="${preserveId}"]`)
    if (li2) {
      // Refocus number inputs
      if (!wasSelect && !wasCheckbox) {
        const same = li2.querySelector(`input.me-num[data-field="${field}"]`)
        if (same) {
          same.focus()
          try {
            same.setSelectionRange(caretPos, caretPos)
          } catch {}
        }
      }
      // Refocus select (provider dropdown)
      if (wasSelect) {
        const sameSelect = li2.querySelector(`select.me-provider-select[data-field="${field}"]`)
        if (sameSelect) {
          sameSelect.focus()
        }
      }
    }
  })
  // Inline new row: Name input commit
  ul.addEventListener('keydown', (e) => {
    const nameInput = e.target.closest('input.me-name-input')
    if (!nameInput) return
    if (e.key === 'Enter') {
      const id = (nameInput.value || '').trim()
      if (!id) return
      if (draftById.has(id) || origById.has(id)) return
      const meta = {
        enabled: true,
        provider: pendingNewRow?.provider || 'openai',
        webSearch: pendingNewRow?.webSearch !== undefined ? pendingNewRow.webSearch : true,
        contextWindow: pendingNewRow?.contextWindow || 8192,
        tpm: pendingNewRow?.tpm || 8192,
        rpm: pendingNewRow?.rpm || 60,
        tpd: pendingNewRow?.tpd || 100000,
        otpm: pendingNewRow?.otpm,
        rpd: pendingNewRow?.rpd,
      }
      draftById.set(id, { id, ...meta })
      stagedAdds.set(id, { ...meta })
      stagedDeletes.delete(id)
      __dirty = true
      // keep pending visual state until save/close to allow returning and editing name again
      selectedCol = 1
      render(id)
      // Move activeIndex to new row if found
      const idx = models.findIndex((m) => m.id === id)
      if (idx >= 0) {
        activeIndex = idx
        ensureVisible()
      }
      // Focus first numeric input of the row in navigation mode (don't enter edit yet)
      selectedCol = FIRST_NUMERIC_COL
      applyCellSelection()
    }
  })
  // Sync is intentionally passive (non-focusable, no click handler) until implemented
  // Attach to backdrop (capture) so keys are local to overlay and work under central blocker
  backdrop.addEventListener('keydown', keyHandler, true)
  const modal = openModal({
    modeManager: window.__modeManager,
    root: backdrop,
    closeKeys: ['Escape'],
    restoreMode: true,
    preferredFocus: () => ul.querySelector('li.active') || ul,
    // Signal whether a save occurred so caller can trigger rebuild+bottom-align
    beforeClose: () => {
      onClose && onClose({ dirty: !!__applied })
    },
  })
  // Buttons wiring
  function doSave() {
    performSave()
    updateFooterState()
    ensureListFocus()
  }
  function doCancelAndClose() {
    close()
  }
  saveBtn?.addEventListener('click', (e) => {
    e.preventDefault()
    doSave()
  })
  cancelBtn?.addEventListener('click', (e) => {
    e.preventDefault()
    doCancelAndClose()
  })
  function keyHandler(e) {
    // Ignore if not the latest active editor or panel is detached
    if (ACTIVE_EDITOR_TOKEN !== TOKEN) return
    if (!panel.isConnected) return
    const lowerKey = typeof e.key === 'string' ? e.key.toLowerCase() : ''
    
    // Global shortcuts (work in both modes)
    if (e.ctrlKey && lowerKey === 's') {
      e.preventDefault()
      doSave()
      return
    }

    // ========== NAVIGATION MODE ==========
    if (mode === 'navigation') {
      // Arrow keys and vim-style navigation: move between cells
      if (e.key === 'ArrowDown' || lowerKey === 'j') {
        e.preventDefault()
        move(1)
        return
      }
      if (e.key === 'ArrowUp' || lowerKey === 'k') {
        e.preventDefault()
        move(-1)
        return
      }
      if (e.key === 'ArrowRight' || lowerKey === 'l') {
        e.preventDefault()
        moveCol(1)
        return
      }
      if (e.key === 'ArrowLeft' || lowerKey === 'h') {
        e.preventDefault()
        moveCol(-1)
        return
      }
      
      // Page navigation
      if (e.key === 'PageDown') {
        e.preventDefault()
        movePage(1)
        return
      }
      if (e.key === 'PageUp') {
        e.preventDefault()
        movePage(-1)
        return
      }
      
      // Ctrl+N: Add new model
      if (e.ctrlKey && lowerKey === 'n') {
        e.preventDefault()
        if (!pendingNewRow) {
          pendingNewRow = {
            id: '',
            enabled: true,
            provider: 'openai',
            webSearch: true,
            contextWindow: 8192,
            tpm: 8192,
            rpm: 60,
            tpd: 100000,
            otpm: undefined,
            rpd: undefined,
          }
        }
        activeIndex = models.length
        selectedCol = 1 // name column
        render()
        applyCellSelection()
        const inp = ul.querySelector('li.me-row:last-child .me-name-input')
        if (inp) {
          inp.focus()
        }
        ensureVisible()
        return
      }
      
      // Enter: Enter edit mode or toggle checkbox
      if (e.key === 'Enter') {
        e.preventDefault()
        
        // Special case: Enabled checkbox (column 0)
        if (selectedCol === 0) {
          const m = models[activeIndex]
          if (m) {
            toggle(m.id)
            render(m.id)
            applyCellSelection()
          }
          return
        }
        
        // Special case: WebSearch checkbox (column 3)
        if (selectedCol === WEBSEARCH_COL_INDEX) {
          const rowIdx = activeIndex
          const isPending = !!pendingNewRow && rowIdx === models.length
          
          if (isPending) {
            pendingNewRow.webSearch = !pendingNewRow.webSearch
            __dirty = true
            render()
            applyCellSelection()
          } else {
            const m = models[rowIdx]
            if (m) {
              const id = m.id
              const draft = draftById.get(id) || origById.get(id)
              if (draft) {
                draftById.set(id, { ...draft, webSearch: !draft.webSearch })
                __dirty = true
                render(id)
                applyCellSelection()
              }
            }
          }
          return
        }
        
        // Regular columns: enter edit mode
        mode = 'edit'
        updateModeBadge()
        enterEditMode()
        return
      }
      
      // Space: Toggle checkboxes when focused on checkbox columns
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault()
        
        // Toggle Enabled checkbox (column 0)
        if (selectedCol === 0) {
          const m = models[activeIndex]
          if (m) {
            toggle(m.id)
            render(m.id)
            applyCellSelection()
          }
          return
        }
        
        // Toggle WebSearch checkbox (column 3)
        if (selectedCol === WEBSEARCH_COL_INDEX) {
          const rowIdx = activeIndex
          const isPending = !!pendingNewRow && rowIdx === models.length
          
          if (isPending) {
            pendingNewRow.webSearch = !pendingNewRow.webSearch
            __dirty = true
            render()
            applyCellSelection()
          } else {
            const m = models[rowIdx]
            if (m) {
              const id = m.id
              const draft = draftById.get(id) || origById.get(id)
              if (draft) {
                draftById.set(id, { ...draft, webSearch: !draft.webSearch })
                __dirty = true
                render(id)
                applyCellSelection()
              }
            }
          }
          return
        }
        
        // On non-checkbox columns, do nothing (prevent default scroll)
        return
      }
      
      // Escape: Close overlay (handled by openModal)
      // Delete: Delete custom model
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const m = models[activeIndex]
        if (m && !isBaseModel(m.id)) {
          e.preventDefault()
          // Track delete by id in stagedDeletes (Set of ids)
          stagedDeletes.add(m.id)
          __dirty = true
          const nextIdx = Math.min(activeIndex, models.length - 2)
          activeIndex = Math.max(0, nextIdx)
          render(models[activeIndex]?.id)
          applyCellSelection()
          ensureVisible()
        }
        return
      }
      
      return
    }

    // ========== EDIT MODE ==========
    if (mode === 'edit') {
      // Escape: Cancel editing, restore original value
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation() // Prevent other listeners on same element (openModal)
        
        // Restore original value by re-rendering
        const m = models[activeIndex]
        if (m) {
          render(m.id)
        } else {
          render()
        }
        
        // Exit edit mode
        mode = 'navigation'
        updateModeBadge()
        document.activeElement.blur()
        applyCellSelection()
        ensureListFocus()
        return
      }
      
      // Enter: Commit changes and exit edit mode
      if (e.key === 'Enter') {
        e.preventDefault()
        
        // Commit current input value
        const ae = document.activeElement
        
        // Number input
        if (ae && ae.classList.contains('me-num')) {
          const li = ae.closest('li')
          const id = li && li.dataset.id
          const field = ae.getAttribute('data-field')
          let val = Number(ae.value)
          // Empty input should be treated as undefined/null (no limit)
          if (ae.value === '' || ae.value === null || ae.value === undefined) {
            val = undefined
          } else if (!Number.isFinite(val) || val < 0) {
            val = 0
          }
          const scale = Number(ae.getAttribute('data-scale') || '1')
          const absVal = val !== undefined ? val * scale : undefined
          
          if (ae.getAttribute('data-pending') === '1') {
            if (pendingNewRow) {
              pendingNewRow[field] = absVal
              __dirty = true
            }
          } else if (id) {
            const cur = draftById.get(id) || origById.get(id)
            if (cur) {
              const updated = { ...cur, [field]: absVal }
              draftById.set(id, updated)
              // If this is a staged add, update stagedAdds too
              if (stagedAdds.has(id)) {
                stagedAdds.set(id, { ...updated })
              }
              __dirty = true
            }
          }
        }
        
        // Provider select
        if (ae && ae.classList.contains('me-provider-select')) {
          const li = ae.closest('li')
          const id = li && li.dataset.id
          const field = ae.getAttribute('data-field')
          const val = (ae.value || '').trim()
          
          if (ae.getAttribute('data-pending') === '1') {
            if (pendingNewRow && field) {
              pendingNewRow[field] = val
              __dirty = true
            }
          } else if (id && field) {
            const cur = draftById.get(id) || origById.get(id)
            if (cur) {
              const updated = { ...cur, [field]: val }
              draftById.set(id, updated)
              // If this is a staged add, update stagedAdds too
              if (stagedAdds.has(id)) {
                stagedAdds.set(id, { ...updated })
              }
              __dirty = true
            }
          }
        }
        
        // Name input (model ID)
        if (ae && ae.classList.contains('me-name-input')) {
          const nameVal = (ae.value || '').trim()
          
          if (ae.getAttribute('data-field') === 'id') {
            // Renaming existing model
            const li = ae.closest('li')
            const oldId = li && li.dataset.id
            
            if (oldId && nameVal && oldId !== nameVal) {
              const cur = draftById.get(oldId) || origById.get(oldId)
              if (cur && !draftById.has(nameVal) && !origById.has(nameVal)) {
                draftById.set(nameVal, { ...cur, id: nameVal })
                draftById.delete(oldId)
                // Track delete of oldId in stagedDeletes (Set of ids)
                stagedDeletes.add(oldId)
                stagedAdds.set(nameVal, { ...cur, id: nameVal })
                __dirty = true
                render(nameVal)
                const idx = models.findIndex((m) => m.id === nameVal)
                if (idx >= 0) {
                  activeIndex = idx
                  ensureVisible()
                }
              }
            }
          } else {
            // New row name input
            if (nameVal && !draftById.has(nameVal) && !origById.has(nameVal)) {
              const meta = {
                enabled: true,
                provider: pendingNewRow?.provider || 'openai',
                webSearch: pendingNewRow?.webSearch !== undefined ? pendingNewRow.webSearch : true,
                contextWindow: pendingNewRow?.contextWindow || 8192,
                tpm: pendingNewRow?.tpm || 8192,
                rpm: pendingNewRow?.rpm || 60,
                tpd: pendingNewRow?.tpd || 100000,
                otpm: pendingNewRow?.otpm,
                rpd: pendingNewRow?.rpd,
              }
              draftById.set(nameVal, { id: nameVal, ...meta })
              stagedAdds.set(nameVal, { ...meta })
              stagedDeletes.delete(nameVal)
              __dirty = true
              render(nameVal)
              const idx = models.findIndex((m) => m.id === nameVal)
              if (idx >= 0) {
                activeIndex = idx
                ensureVisible()
              }
            }
          }
        }
        
        // Exit edit mode
        mode = 'navigation'
        updateModeBadge()
        
        // Get fresh reference to active element (in case render() was called by change event)
        const currentActive = document.activeElement
        
        // For select elements, defer blur and refocus to avoid stuck focus
        const isSelect = currentActive && currentActive.tagName === 'SELECT'
        if (isSelect) {
          // Use requestAnimationFrame to let browser finish dropdown close
          requestAnimationFrame(() => {
            const freshActive = document.activeElement
            if (freshActive && typeof freshActive.blur === 'function') {
              try {
                freshActive.blur()
              } catch {}
            }
            applyCellSelection()
            ensureListFocus()
          })
        } else {
          // For other inputs, blur immediately
          if (currentActive && typeof currentActive.blur === 'function') {
            try {
              currentActive.blur()
            } catch {}
          }
          applyCellSelection()
          ensureListFocus()
        }
        return
      }
      
      // All other keys in edit mode: allow normal text editing
      // (arrows move cursor within input, letters type, etc.)
      return
    }
  }
  function move(delta) {
    const rowsCount = models.length + (pendingNewRow ? 1 : 0)
    const prevIndex = activeIndex
    activeIndex = Math.min(rowsCount - 1, Math.max(0, activeIndex + delta))
    // Keep column selection when changing rows
    applyCellSelection()
    if (prevIndex !== activeIndex) {
      const lis = ul.querySelectorAll('li.me-row')
      lis.forEach((li, i) => li.classList.toggle('active', i === activeIndex))
      ensureVisible()
    }
  }
  function movePage(dir) {
    const container = panel.querySelector('.list')
    if (!container) return
    const deltaRows = Math.max(1, Math.floor(container.clientHeight / 28)) // approx row height
    move(dir > 0 ? deltaRows : -deltaRows)
  }
  function moveCol(delta) {
    if (activeIndex < 0) return
    const rowsCount = models.length + (pendingNewRow ? 1 : 0)
    if (activeIndex >= rowsCount) return
    if (selectedCol === null) {
      const isPending = !!pendingNewRow && activeIndex === models.length
      selectedCol = isPending ? PROVIDER_COL_INDEX : 1 // Start at Model column for existing rows, Provider for new rows
      applyCellSelection()
      return
    }
    let next = selectedCol + delta
    // Determine pending row and columns allowed
    const isPendingRow = !!pendingNewRow && activeIndex === models.length

    // Allow navigation to all columns including Enabled (0)
    if (next < 0) next = 0
    if (next > LAST_COL) next = LAST_COL
    selectedCol = next
    applyCellSelection()
    // Stay in navigation mode - user must press Enter to edit
  }
  function applyCellSelection() {
    // Clear previous
    ul.querySelectorAll('.me-col-selected').forEach((el) => el.classList.remove('me-col-selected'))
    if (selectedCol === null) return
    const row = ul.children[activeIndex]
    if (!row) return
    const sel = [
      '.me-col-toggle',
      '.me-col-name',
      '.me-col-provider',
      '.me-col-search',
      '.me-col-cw',
      '.me-col-tpm',
      '.me-col-otpm',
      '.me-col-tpd',
      '.me-col-rpm',
      '.me-col-rpd',
    ][selectedCol]
    const cell = sel && row.querySelector(sel)
    if (cell) cell.classList.add('me-col-selected')
  }
  function enterEditMode() {
    if (selectedCol === null) return
    const row = ul.children[activeIndex]
    if (!row) return
    const sel = [
      '.me-col-toggle',
      '.me-col-name',
      '.me-col-provider',
      '.me-col-search',
      '.me-col-cw',
      '.me-col-tpm',
      '.me-col-otpm',
      '.me-col-tpd',
      '.me-col-rpm',
      '.me-col-rpd',
    ][selectedCol]
    const cell = sel && row.querySelector(sel)
    if (!cell) return
    
    const nameInput = cell.querySelector('input.me-name-input')
    if (nameInput) {
      nameInput.focus()
      // Place cursor at end instead of selecting all
      const len = nameInput.value.length
      try {
        nameInput.setSelectionRange(len, len)
      } catch {}
      return
    }

    const providerSelect = cell.querySelector('select.me-provider-select')
    if (providerSelect) {
      providerSelect.focus()
      return
    }

    const checkbox = cell.querySelector('input.me-checkbox')
    if (checkbox) {
      checkbox.focus()
      return
    }

    const input = cell.querySelector('input.me-num')
    if (input) {
      input.focus()
      // Place cursor at end for number inputs
      // Number inputs need special handling - use requestAnimationFrame for reliable positioning
      requestAnimationFrame(() => {
        const len = String(input.value).length
        try {
          input.setSelectionRange(len, len)
        } catch {
          // Fallback for inputs that don't support setSelectionRange
          try {
            input.selectionStart = len
            input.selectionEnd = len
          } catch {}
        }
      })
    }
  }
  function ensureVisible() {
    const container = panel.querySelector('.list')
    const row = ul.children[activeIndex]
    if (!container || !row) return
    // Use built-in behavior if available
    try {
      row.scrollIntoView({ block: 'nearest' })
    } catch {}
    updateScrollHints()
  }
  function isDirty() {
    // Consider any staged change, pending new row, or diffs vs. original as dirty
    if (pendingNewRow) return true
    if (stagedAdds.size > 0 || stagedDeletes.size > 0) return true
    for (const [id, draft] of draftById) {
      const orig = origById.get(id)
      if (!orig) return true
      if ((draft.enabled || false) !== (orig.enabled || false)) return true
      if ((draft.contextWindow || 0) !== (orig.contextWindow || 0)) return true
      if ((draft.tpm || 0) !== (orig.tpm || 0)) return true
      if ((draft.rpm || 0) !== (orig.rpm || 0)) return true
      if ((draft.tpd || 0) !== (orig.tpd || 0)) return true
      if ((draft.otpm || 0) !== (orig.otpm || 0)) return true
      if ((draft.webSearch || false) !== (orig.webSearch || false)) return true
    }
    return !!__dirty
  }
  function updateFooterState() {
    const dirty = isDirty()
    if (saveBtn) saveBtn.textContent = dirty ? 'Apply (Ctrl+S)' : 'All saved'
    if (cancelBtn) cancelBtn.textContent = dirty ? 'Cancel+Close (Esc)' : 'Close (Esc)'
  }
  function performSave() {
    // First pass: Handle model ID renames
    for (const [id, draft] of draftById) {
      if (stagedAdds.has(id)) continue
      const orig = origById.get(id)
      if (!orig) continue

      // Check if this is a model ID rename
      if (draft.id && draft.id !== orig.id && draft.id !== id) {
        const success = renameModel(id, draft.id)
        if (success) {
          // Update our tracking maps to use the new ID
          draftById.delete(id)
          draftById.set(draft.id, draft)
          origById.delete(id)
          origById.set(draft.id, { ...orig, id: draft.id })
        }
      }
    }

    // Apply staged adds
    for (const [id, meta] of stagedAdds) {
      addModel(id, meta)
    }
    // Apply updates vs originals
    for (const [id, draft] of draftById) {
      if (stagedAdds.has(id)) continue
      const orig = origById.get(id)
      if (!orig) continue
      if (draft.enabled !== orig.enabled) {
        setModelEnabled(id, draft.enabled)
      }
      const patch = {}
      if (draft.contextWindow !== orig.contextWindow) patch.contextWindow = draft.contextWindow
      if (draft.tpm !== orig.tpm) patch.tpm = draft.tpm
      if (draft.rpm !== orig.rpm) patch.rpm = draft.rpm
      if (draft.tpd !== orig.tpd) patch.tpd = draft.tpd
      if (draft.otpm !== orig.otpm) patch.otpm = draft.otpm
      if (draft.rpd !== orig.rpd) patch.rpd = draft.rpd
      if (draft.provider !== orig.provider) patch.provider = draft.provider
      if (draft.webSearch !== orig.webSearch) patch.webSearch = draft.webSearch
      if (Object.keys(patch).length) {
        updateModelMeta(id, patch)
      }
    }
    // Apply deletions for custom models not used
    if (store) {
      const used = new Set()
      for (const p of store.getAllPairs()) used.add(String(p.model || '').toLowerCase())
      for (const id of stagedDeletes) {
        if (!isBaseModel(id) && !used.has(String(id).toLowerCase())) deleteModel(id)
      }
    } else {
      for (const id of stagedDeletes) {
        if (!isBaseModel(id)) deleteModel(id)
      }
    }
    // Reset staged state so editor reflects a clean state post-save
    pendingNewRow = null
    stagedAdds.clear()
    stagedDeletes.clear()
    __dirty = false
    __applied = true
    // Rebuild originals/drafts from the now-updated catalog so isDirty() returns false
    origById.clear()
    draftById.clear()
    render()
    updateFooterState()
  }
  // No Save/Cancel buttons; Sync remains passive
  render()
  function close() {
    // Cleanup listener and clear token ownership
    try {
      backdrop.removeEventListener('keydown', keyHandler, true)
    } catch {}
    if (ACTIVE_EDITOR_TOKEN === TOKEN) ACTIVE_EDITOR_TOKEN = null
    // beforeClose provided to modal will call onClose once
    modal.close('manual')
  }
  // confirmDialog removed: Editors now use explicit Save/Cancel per overlays.md
}
