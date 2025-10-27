import { openModal } from '../../shared/openModal.js'

function median(arr) {
  if (!arr || !arr.length) return null
  const sorted = arr.slice().sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function formatResponseTime(ms) {
  if (ms == null) return '—'
  return `${(ms / 1000).toFixed(1)}s`
}

export function computeDailyCounts(pairs) {
  // Group by local calendar day (YYYY-MM-DD)
  const byDay = new Map()
  for (const p of pairs) {
    const d = new Date(p.createdAt || Date.now())
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const existing = byDay.get(key)
    const responseTimes = existing?.responseTimes || []
    if (typeof p.responseMs === 'number') {
      responseTimes.push(p.responseMs)
    }
    byDay.set(key, {
      count: (existing?.count || 0) + 1,
      responseTimes
    })
  }
  const rows = Array.from(byDay.entries()).map(([day, data]) => ({
    day,
    count: data.count,
    medianResponseTime: median(data.responseTimes)
  }))
  // Descending order (newest at top) for easier access to recent data
  rows.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0))
  return rows
}

export function computeModelCounts(pairs) {
  // Group by model
  const byModel = new Map()
  for (const p of pairs) {
    const model = p.model || 'unknown'
    const existing = byModel.get(model)
    const responseTimes = existing?.responseTimes || []
    if (typeof p.responseMs === 'number') {
      responseTimes.push(p.responseMs)
    }
    byModel.set(model, {
      count: (existing?.count || 0) + 1,
      responseTimes
    })
  }
  const rows = Array.from(byModel.entries()).map(([model, data]) => ({
    model,
    count: data.count,
    medianResponseTime: median(data.responseTimes)
  }))
  // Sort by count descending (most used models first)
  rows.sort((a, b) => b.count - a.count)
  return rows
}

export function openDailyStatsOverlay({ store, activeParts, historyRuntime, modeManager }) {
  if (document.getElementById('dailyStatsOverlayRoot')) return
  // Derive currently visible unique pairs from activeParts
  const visiblePairIds = Array.from(new Set((activeParts.parts || []).map((p) => p.pairId)))
  const visiblePairs = visiblePairIds.map((id) => store.pairs.get(id)).filter(Boolean)
  
  let viewMode = 'daily' // 'daily' or 'model'
  
  function renderContent() {
    const rows = viewMode === 'daily' ? computeDailyCounts(visiblePairs) : computeModelCounts(visiblePairs)
    const { headerHtml, tableHtml, footerHtml } = rows.length ? generateTableAndFooter(rows, viewMode, visiblePairs) : emptyHtml()
    
    const headerEl = root.querySelector('.stats-header-container')
    headerEl.innerHTML = headerHtml
    
    const bodyEl = root.querySelector('.stats-body')
    bodyEl.innerHTML = tableHtml
    
    const footerEl = root.querySelector('.stats-footer-container')
    footerEl.innerHTML = footerHtml
    
    // Update tab styling
    root.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewMode)
    })
    
    // Re-setup keyboard navigation
    setupNavigation()
  }

  const root = document.createElement('div')
  root.id = 'dailyStatsOverlayRoot'
  root.className = 'overlay-backdrop centered'
  root.innerHTML = `
    <div class="overlay-panel compact daily-stats-panel" style="width:420px;max-width:90vw;">
      <header>Activity Stats (respects current filter)</header>
      <div class="stats-tabs" style="display:flex;gap:8px;padding:8px 12px;border-bottom:1px solid #222;">
        <button class="tab-btn active" data-view="daily">By Date</button>
        <button class="tab-btn" data-view="model">By Model</button>
      </div>
      <div class="stats-header-container"></div>
      <div class="stats-body" style="height:395px;overflow:auto;padding:5px;"></div>
      <div class="stats-footer-container"></div>
      <div class="stats-hint">MRT - median response time • h/l or [ ] switch tabs • j/k navigate • g/G jump to first/last • Enter or Esc to close</div>
      <div class="buttons" style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px;padding:8px 9px 5px 9px;">
        <button class="btn" type="button" data-action="close">Close</button>
      </div>
    </div>`
  document.body.appendChild(root)
  const panel = root.querySelector('.daily-stats-panel')
  
  let activeRowIndex = 0
  let rowEls = []
  let focusableCells = []
  let tbody = null
  
  function setupNavigation() {
    tbody = panel.querySelector('.stats-table tbody')
    rowEls = tbody ? Array.from(tbody.querySelectorAll('tr')) : []
    focusableCells = rowEls.map((tr) => tr.querySelector('td')).filter(Boolean)
    activeRowIndex = 0  // Always focus first row (most recent/most used)
    
    focusableCells.forEach((td, i) => {
      td.setAttribute('tabindex', i === activeRowIndex ? '0' : '-1')
    })
    applyActiveRow(-1, activeRowIndex)
    
    if (activeRowIndex >= 0 && focusableCells[activeRowIndex]) {
      focusableCells[activeRowIndex].focus({ preventScroll: false })
      rowEls[activeRowIndex].scrollIntoView({ block: 'nearest' })
    }
  }
  
  function applyActiveRow(prevIdx, nextIdx) {
    if (prevIdx != null && prevIdx >= 0 && rowEls[prevIdx]) {
      rowEls[prevIdx].classList.remove('active')
      if (focusableCells[prevIdx]) focusableCells[prevIdx].setAttribute('tabindex', '-1')
    }
    if (nextIdx != null && nextIdx >= 0 && rowEls[nextIdx]) {
      rowEls[nextIdx].classList.add('active')
      if (focusableCells[nextIdx]) focusableCells[nextIdx].setAttribute('tabindex', '0')
    }
  }
  
  // Initial render
  renderContent()
  
  const preferredFocusEl = () => {
    if (activeRowIndex >= 0 && focusableCells[activeRowIndex]) return focusableCells[activeRowIndex]
    return panel.querySelector('button[data-action="close"]')
  }
  const { close } = openModal({
    modeManager,
    root,
    closeKeys: ['Escape', 'Enter'],
    restoreMode: true,
    preferredFocus: preferredFocusEl,
  })
  
  // Tab click handlers
  root.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const newView = btn.dataset.view
      if (newView !== viewMode) {
        viewMode = newView
        renderContent()
      }
    })
  })
  
  // Tab keyboard switching (h/l or [/])
  panel.addEventListener('keydown', (e) => {
    // h/l tab switching (without modifiers)
    if ((e.key === 'h' || e.key === '[') && !e.metaKey && !e.altKey && !e.ctrlKey) {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      viewMode = 'daily'
      renderContent()
      return
    }
    if ((e.key === 'l' || e.key === ']') && !e.metaKey && !e.altKey && !e.ctrlKey) {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      viewMode = 'model'
      renderContent()
      return
    }
    
    // j/k/g/G navigation
    const keys = ['j', 'k', 'g', 'G', 'ArrowDown', 'ArrowUp']
    if (!keys.includes(e.key)) return
    if (!focusableCells.length) return
    e.preventDefault()
    e.stopPropagation()
    const prev = activeRowIndex
    if (e.key === 'j' || e.key === 'ArrowDown') {
      activeRowIndex = Math.min(activeRowIndex + 1, focusableCells.length - 1)
    } else if (e.key === 'k' || e.key === 'ArrowUp') {
      activeRowIndex = Math.max(activeRowIndex - 1, 0)
    } else if (e.key === 'g') {
      activeRowIndex = 0
    } else if (e.key === 'G') {
      activeRowIndex = focusableCells.length - 1
    }
    if (prev !== activeRowIndex) {
      applyActiveRow(prev, activeRowIndex)
      const el = focusableCells[activeRowIndex]
      el.setAttribute('tabindex', '0')
      el.focus({ preventScroll: false })
      rowEls[activeRowIndex].scrollIntoView({ block: 'nearest' })
    }
  })
  
  root.addEventListener('click', (e) => {
    if (e.target === root) close()
  })
  panel.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action="close"]')
    if (btn) close()
  })
  
  if (tbody) {
    tbody.addEventListener('click', (e) => {
      const tr = e.target.closest('tr')
      if (!tr) return
      const idx = rowEls.indexOf(tr)
      if (idx !== -1) {
        applyActiveRow(activeRowIndex, idx)
        activeRowIndex = idx
        const cell = focusableCells[activeRowIndex]
        if (cell) {
          cell.setAttribute('tabindex', '0')
          cell.focus({ preventScroll: false })
        }
      }
    })
  }
}

function generateTableAndFooter(rows, viewMode, visiblePairs) {
  const total = rows.reduce((s, r) => s + r.count, 0)
  // Calculate overall median response time from ALL individual messages (not median of medians)
  const allResponseTimes = []
  for (const p of visiblePairs) {
    if (typeof p.responseMs === 'number') {
      allResponseTimes.push(p.responseMs)
    }
  }
  const overallMedian = median(allResponseTimes)
  
  const firstColHeader = viewMode === 'daily' ? 'Date' : 'Model'
  const firstColKey = viewMode === 'daily' ? 'day' : 'model'
  
  const headerHtml = `
    <div class="stats-header">
      <span class="stats-header-label">${firstColHeader}</span>
      <span class="stats-header-count">Count</span>
      <span class="stats-header-time">MRT</span>
    </div>`
  
  const tableHtml = `
    <table class="stats-table" style="width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed;">
      <tbody>
        ${rows.map((r) => `<tr>
          <td style="padding:2px 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:51%;">${r[firstColKey]}</td>
          <td style="padding:2px 8px;text-align:right;width:26%;">${r.count}</td>
          <td style="padding:2px 8px;text-align:right;width:23%;">${formatResponseTime(r.medianResponseTime)}</td>
        </tr>`).join('')}
      </tbody>
    </table>`
  
  const footerHtml = `
    <div class="stats-footer">
      <span class="stats-footer-label">Total</span>
      <span class="stats-footer-count">${total}</span>
      <span class="stats-footer-time">${formatResponseTime(overallMedian)}</span>
    </div>`
  
  return { headerHtml, tableHtml, footerHtml }
}
function emptyHtml() {
  return {
    headerHtml: '',
    tableHtml: '<div style="opacity:.7;font-size:12px;padding:20px;text-align:center;">No messages in the current view.</div>',
    footerHtml: ''
  }
}
