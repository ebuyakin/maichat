import { openModal } from '../../shared/openModal.js'

export function computeDailyCounts(pairs){
  // Group by local calendar day (YYYY-MM-DD)
  const byDay = new Map()
  for(const p of pairs){
    const d = new Date(p.createdAt || Date.now())
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    byDay.set(key, (byDay.get(key)||0)+1)
  }
  const rows = Array.from(byDay.entries()).map(([day,count])=>({ day, count }))
  // Ascending order (oldest at top, newest at bottom) to match message history chronology
  rows.sort((a,b)=> a.day < b.day ? -1 : (a.day > b.day ? 1 : 0))
  return rows
}

export function openDailyStatsOverlay({ store, activeParts, historyRuntime, modeManager }){
  if(document.getElementById('dailyStatsOverlayRoot')) return
  // Derive currently visible unique pairs from activeParts
  const visiblePairIds = Array.from(new Set((activeParts.parts||[]).map(p=> p.pairId)))
  const visiblePairs = visiblePairIds.map(id=> store.pairs.get(id)).filter(Boolean)
  const dayRows = computeDailyCounts(visiblePairs)

  const root = document.createElement('div')
  root.id = 'dailyStatsOverlayRoot'
  root.className = 'overlay-backdrop centered'
  root.innerHTML = `
    <div class="overlay-panel compact daily-stats-panel">
      <header>Daily Activity (respects current filter)</header>
      <div class="stats-body" style="max-height:60vh;overflow:auto;padding:5px;">
  ${dayRows.length ? tableHtml(dayRows) : emptyHtml()}
      </div>
      <div class="buttons" style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px;padding:8px 9px 5px 9px;">
        <button class="btn" type="button" data-action="close">Close</button>
      </div>
    </div>`
  document.body.appendChild(root)
  const panel = root.querySelector('.daily-stats-panel')
  // Setup focusable cells (first td of each row) and default focus on last (bottom) date row
  const tbody = panel.querySelector('.stats-table tbody')
  const rowEls = tbody ? Array.from(tbody.querySelectorAll('tr')) : []
  const focusableCells = rowEls.map(tr=> tr.querySelector('td')).filter(Boolean)
  let activeRowIndex = focusableCells.length ? focusableCells.length - 1 : -1
  function applyActiveRow(prevIdx, nextIdx){
    if(prevIdx!=null && prevIdx>=0 && rowEls[prevIdx]){ rowEls[prevIdx].classList.remove('active'); if(focusableCells[prevIdx]) focusableCells[prevIdx].setAttribute('tabindex','-1') }
    if(nextIdx!=null && nextIdx>=0 && rowEls[nextIdx]){ rowEls[nextIdx].classList.add('active'); if(focusableCells[nextIdx]) focusableCells[nextIdx].setAttribute('tabindex','0') }
  }
  focusableCells.forEach((td, i)=>{ td.setAttribute('tabindex', i===activeRowIndex ? '0' : '-1') })
  applyActiveRow(-1, activeRowIndex)
  const preferredFocusEl = ()=>{
    if(activeRowIndex>=0 && focusableCells[activeRowIndex]) return focusableCells[activeRowIndex]
    return panel.querySelector('button[data-action="close"]')
  }
  const { close } = openModal({ modeManager, root, closeKeys:['Escape','Enter'], restoreMode:true, preferredFocus: preferredFocusEl })
  if(activeRowIndex>=0){
    // Ensure the last row is visible when opened
    focusableCells[activeRowIndex].focus({ preventScroll:false })
  const bodyEl = panel.querySelector('.stats-body'); if(bodyEl){ rowEls[activeRowIndex].scrollIntoView({ block:'nearest' }) }
  }
  root.addEventListener('click', e=>{ if(e.target===root) close() })
  panel.addEventListener('click', e=>{ const btn = e.target.closest('button[data-action="close"]'); if(btn) close() })
  // Keyboard navigation across rows: j/k and g/G + click-to-focus
  panel.addEventListener('keydown', (e)=>{
    const keys = ['j','k','g','G','ArrowDown','ArrowUp']
    if(!keys.includes(e.key)) return
  if(!focusableCells.length) return
    e.preventDefault(); e.stopPropagation()
    const prev = activeRowIndex
    if(e.key==='j' || e.key==='ArrowDown'){ activeRowIndex = Math.min(activeRowIndex + 1, focusableCells.length - 1) }
    else if(e.key==='k' || e.key==='ArrowUp'){ activeRowIndex = Math.max(activeRowIndex - 1, 0) }
    else if(e.key==='g'){ activeRowIndex = 0 }
    else if(e.key==='G'){ activeRowIndex = focusableCells.length - 1 }
    if(prev !== activeRowIndex){
      applyActiveRow(prev, activeRowIndex)
    const el = focusableCells[activeRowIndex]
    el.setAttribute('tabindex','0'); el.focus({ preventScroll:false }); rowEls[activeRowIndex].scrollIntoView({ block:'nearest' })
    }
  })
  if(tbody){ tbody.addEventListener('click', (e)=>{ const tr = e.target.closest('tr'); if(!tr) return; const idx = rowEls.indexOf(tr); if(idx!==-1){ applyActiveRow(activeRowIndex, idx); activeRowIndex = idx; const cell = focusableCells[activeRowIndex]; if(cell){ cell.setAttribute('tabindex','0'); cell.focus({ preventScroll:false }) } } }) }
}

function tableHtml(rows){
  const total = rows.reduce((s,r)=> s+r.count, 0)
  return `
    <table class="stats-table" style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead><tr><th style="text-align:left;padding:4px 8px;font-weight:400;">Date</th><th style="text-align:right;padding:4px 8px;font-weight:400;">Count</th></tr></thead>
      <tbody>
        ${rows.map(r=> `<tr><td style="padding:2px 8px;">${r.day}</td><td style="padding:2px 8px;text-align:right;">${r.count}</td></tr>`).join('')}
      </tbody>
      <tfoot><tr><td style="padding:6px 8px;font-weight:400;">Total</td><td style="padding:6px 8px;text-align:right;font-weight:400;">${total}</td></tr></tfoot>
    </table>`
}
function emptyHtml(){ return '<div style="opacity:.7;font-size:12px;">No messages in the current view.</div>' }
