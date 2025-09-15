// modelEditor.js moved from ui/modelEditor.js (Phase 6.6 Config)
// Restored original (moved from src/ui/modelEditor.js) - path adjusted only.
import { listModels, getActiveModel, setActiveModel, updateModelMeta, setModelEnabled, addModel, deleteModel } from '../../core/models/modelCatalog.js'
import { openModal } from '../../shared/openModal.js'

// Ensure only the latest opened editor handles global keys
let ACTIVE_EDITOR_TOKEN = null

export function openModelEditor({ onClose, store }){
  const TOKEN = Symbol('modelEditor')
  ACTIVE_EDITOR_TOKEN = TOKEN
  const backdrop = document.createElement('div')
  backdrop.className = 'overlay-backdrop centered'
  const panel = document.createElement('div')
  panel.className = 'overlay-panel model-editor'
  panel.style.minWidth = '720px'
  panel.innerHTML = `
    <header>Models</header>
    <div class="me-table">
      <div class="me-row me-head" aria-hidden="true">
  <span class="me-col me-col-toggle">Enabled</span>
  <span class="me-col me-col-name">Model</span>
  <span class="me-col me-col-cw">Context window (K)</span>
  <span class="me-col me-col-tpm">TPM (K)</span>
  <span class="me-col me-col-rpm">RPM (K)</span>
  <span class="me-col me-col-tpd">TPD (K)</span>
      </div>
      <div class="list"><ul tabindex="0" class="me-list"></ul></div>
    </div>
    <footer class="me-footer">
      <span class="me-hint">j/k rows · h/l cols · Space toggle · Ctrl+N new · Enter save · Esc discard</span>
      <div class="me-controls">
        <div class="me-controls-left">
          <button class="btn-ghost btn-sm" aria-disabled="true" disabled title="Not implemented yet">Sync models</button>
        </div>
  <div class="me-controls-right"></div>
      </div>
  </footer>`
  backdrop.appendChild(panel)
  document.body.appendChild(backdrop)
  const ul = panel.querySelector('ul')
  const listContainer = panel.querySelector('.list')
  // Compute actual scrollbar width and apply to CSS vars for precise alignment
  function syncScrollbarVar(){
    try{
      if(!listContainer) return
      // Force layout to compute current scrollbar width
      const sw = listContainer.offsetWidth - listContainer.clientWidth
      if(Number.isFinite(sw) && sw >= 0){
        panel.style.setProperty('--me-scrollbar-w', sw + 'px')
        // Avoid double counting any separate track border in CSS when using measured width
        panel.style.setProperty('--me-scrollbar-track-border', '0px')
      }
    }catch{}
  }

  let models = []
  let origById = new Map()
  let draftById = new Map()
  let stagedDeletes = new Set()
  let stagedAdds = new Map() // id -> meta
  let activeIndex = 0
  // Navigation state: null = row only (no column focus); otherwise 0..5 => column index
  // 0: toggle, 1: name (read-only except for new row), 2..5: numeric fields cw, tpm, rpm, tpd
  let selectedCol = null
  let editing = false
  let pendingNewRow = null // { enabled, id:'', contextWindow,tpm,rpm,tpd }
  let __dirty = false

  const COLS = ['toggle','name','contextWindow','tpm','rpm','tpd']
  const FIRST_EDITABLE_COL = 2
  const LAST_COL = 5
  function render(preserveId){
    const prevId = preserveId || (models[activeIndex] && models[activeIndex].id)
  models = listModels()
    const activeModel = getActiveModel()
    const usedCounts = new Map()
    if(store && typeof store.getAllPairs==='function'){
      for(const p of store.getAllPairs()){
        const k = String(p.model||'').toLowerCase(); usedCounts.set(k, (usedCounts.get(k)||0)+1)
      }
    }
    // Build original snapshot once
    if(origById.size===0){
      for(const m of models){ origById.set(m.id, { ...m }) }
    }
    // Initialize draft from original on first render
    if(draftById.size===0){
      for(const m of models){ draftById.set(m.id, { ...m }) }
    }
  if(prevId){
      const newIdx = models.findIndex(m=> m.id===prevId)
      if(newIdx >= 0) activeIndex = newIdx
    }
  // Clamp activeIndex based on total rows count including pending new row
  const totalRows = models.length + (pendingNewRow ? 1 : 0)
  if(activeIndex >= totalRows) activeIndex = totalRows - 1
  if(activeIndex < 0) activeIndex = 0
    ul.innerHTML = ''
    models.forEach((base,i)=>{
      const m = draftById.get(base.id) || base
      const li = document.createElement('li')
      li.dataset.id = m.id
      li.tabIndex = -1
      li.classList.add('me-row')
      if(i === activeIndex) li.classList.add('active')
      const activeBadge = m.id===activeModel?'<span class="me-active">active</span>':''
      const inUse = usedCounts.get(String(m.id).toLowerCase())>0
      li.innerHTML = `
        <span class="me-col me-col-toggle ${m.enabled?'on':'off'}" data-role="toggle" aria-label="${m.enabled?'enabled':'disabled'}">${m.enabled? '●':'○'}</span>
        <span class="me-col me-col-name">${m.id} ${activeBadge}</span>
        <span class="me-col me-col-cw"><input aria-label="Context window (K tokens)" data-field="contextWindow" data-scale="1000" type="number" min="0" step="1" value="${Math.round((m.contextWindow||0)/1000)}" class="me-num"/></span>
        <span class="me-col me-col-tpm"><input aria-label="Tokens per minute (K tokens)" data-field="tpm" data-scale="1000" type="number" min="0" step="1" value="${Math.round((m.tpm||0)/1000)}" class="me-num"/></span>
        <span class="me-col me-col-rpm"><input aria-label="Requests per minute" data-field="rpm" type="number" min="0" step="1" value="${m.rpm}" class="me-num"/></span>
  <span class="me-col me-col-tpd"><div class="me-actions"><input aria-label="Tokens per day (K tokens)" data-field="tpd" data-scale="1000" type="number" min="0" step="1" value="${Math.round((m.tpd||0)/1000)}" class="me-num"/></div></span>`
      ul.appendChild(li)
    })
    // Render inline pending new row, if any
    if(pendingNewRow){
      const i = models.length
      const li = document.createElement('li')
      li.dataset.id = ''
      li.tabIndex = -1
      li.classList.add('me-row')
      if(i === activeIndex) li.classList.add('active')
      li.innerHTML = `
        <span class="me-col me-col-toggle on" data-role="toggle" aria-label="enabled">●</span>
        <span class="me-col me-col-name"><input class="me-name-input" type="text" placeholder="New model id" value="${pendingNewRow.id||''}"/></span>
        <span class="me-col me-col-cw"><input aria-label="Context window (K tokens)" data-pending="1" data-field="contextWindow" data-scale="1000" type="number" min="0" step="1" value="${Math.round((pendingNewRow.contextWindow||0)/1000)}" class="me-num"/></span>
        <span class="me-col me-col-tpm"><input aria-label="Tokens per minute (K tokens)" data-pending="1" data-field="tpm" data-scale="1000" type="number" min="0" step="1" value="${Math.round((pendingNewRow.tpm||0)/1000)}" class="me-num"/></span>
        <span class="me-col me-col-rpm"><input aria-label="Requests per minute" data-pending="1" data-field="rpm" type="number" min="0" step="1" value="${pendingNewRow.rpm||0}" class="me-num"/></span>
        <span class="me-col me-col-tpd"><div class="me-actions"><input aria-label="Tokens per day (K tokens)" data-pending="1" data-field="tpd" data-scale="1000" type="number" min="0" step="1" value="${Math.round((pendingNewRow.tpd||0)/1000)}" class="me-num"/></div></span>`
      ul.appendChild(li)
    }
    // Apply visual selection outline when a column is selected
    applyCellSelection()
  updateFooterState()
  updateScrollHints()
  syncScrollbarVar()
  }
  function fmt(n){ return Math.round(n/1000) }
  function toggle(id){
    const cur = draftById.get(id) || origById.get(id)
    if(!cur) return
    draftById.set(id, { ...cur, enabled: !cur.enabled })
  __dirty = true
    // Keep active model valid in snapshot UI: if active becomes disabled, switch to first enabled
    const active = getActiveModel()
    if(active===id && cur.enabled===true){
      const firstEnabled = [...draftById.values()].find(m=> m.enabled)
      if(firstEnabled) setActiveModel(firstEnabled.id)
    }
    render(id)
  }
  render()
  syncScrollbarVar()
  window.addEventListener('resize', syncScrollbarVar)
  // Scroll hint indicators (top/bottom gradient fades)
  function updateScrollHints(){
    if(!listContainer) return
    const { scrollTop, scrollHeight, clientHeight } = listContainer
    const hasScroll = scrollHeight > clientHeight + 1
    listContainer.classList.toggle('has-scroll', hasScroll)
    if(!hasScroll){
      listContainer.classList.remove('has-more-below','has-more-above')
      return
    }
    const atTop = scrollTop <= 0
    const atBottom = scrollTop + clientHeight >= scrollHeight - 1
    listContainer.classList.toggle('has-more-above', !atTop)
    listContainer.classList.toggle('has-more-below', !atBottom)
  }
  listContainer?.addEventListener('scroll', updateScrollHints)

  function isBaseModel(id){ return ['gpt-5','gpt-5-mini','gpt-5-nano','gpt-4.1','gpt-4.1-mini','gpt-4.1-nano','o3','o4-mini','gpt-4o','gpt-4o-mini','gpt-3.5-turbo'].includes(id) }
  ul.addEventListener('click', e=>{ 
    const li = e.target.closest('li.me-row')
    if(!li || li.classList.contains('me-add')) return
    activeIndex = Array.from(ul.querySelectorAll('li.me-row')).indexOf(li)
    const tgt = e.target; if(tgt && ((tgt.getAttribute('data-field')||'').length || tgt.classList.contains('me-name-input'))){ return }
    // Toggle enabled in draft
    const id = li.dataset.id
    const cur = draftById.get(id) || origById.get(id)
    if(cur){ draftById.set(id, { ...cur, enabled: !cur.enabled }); render(id) }
  })
  ul.addEventListener('change', e=>{
    const input = e.target.closest('input.me-num')
    if(!input) return
    const li = e.target.closest('li')
    if(!li) return
    const id = li.dataset.id
    const field = input.getAttribute('data-field')
    let val = Number(input.value)
    if(!Number.isFinite(val) || val < 0) { val = 0; input.value = '0' }
    const scale = Number(input.getAttribute('data-scale') || '1')
    const absVal = val * scale
    // Pending new row or existing draft
  if(input.getAttribute('data-pending')==='1'){
      if(!pendingNewRow) return
      pendingNewRow[field] = absVal
    } else {
      const cur = draftById.get(id) || origById.get(id)
      if(cur){ draftById.set(id, { ...cur, [field]: absVal }) }
    }
  __dirty = true
    // re-render but keep focus on edited input
    const preserveId = id || ''
    const caretPos = input.selectionStart
    render(preserveId)
    const li2 = ul.querySelector(`li[data-id="${preserveId}"]`)
    if(li2){ const same = li2.querySelector(`input.me-num[data-field="${field}"]`); if(same){ same.focus(); try{ same.setSelectionRange(caretPos, caretPos) }catch{} } }
  })
  // Inline new row: Name input commit
  ul.addEventListener('keydown', e=>{
    const nameInput = e.target.closest('input.me-name-input')
    if(!nameInput) return
    if(e.key==='Enter'){
      const id = (nameInput.value||'').trim()
      if(!id) return
      if(draftById.has(id) || origById.has(id)) return
      const meta = {
        enabled: true,
        contextWindow: pendingNewRow?.contextWindow || 8192,
        tpm: pendingNewRow?.tpm || 8192,
        rpm: pendingNewRow?.rpm || 60,
        tpd: pendingNewRow?.tpd || 100000
      }
      draftById.set(id, { id, ...meta })
      stagedAdds.set(id, { ...meta })
      stagedDeletes.delete(id)
  __dirty = true
  // keep pending visual state until save/close to allow returning and editing name again
  selectedCol = 1
  render(id)
      // Move activeIndex to new row if found
      const idx = models.findIndex(m=> m.id===id)
      if(idx>=0){ activeIndex = idx; ensureVisible() }
      // focus first numeric input of the row in edit mode
  selectedCol = FIRST_EDITABLE_COL
  applyCellSelection(); enterEditMode()
    }
  })
  // Sync is intentionally passive (non-focusable, no click handler) until implemented
  // Attach to backdrop (capture) so keys are local to overlay and work under central blocker
  backdrop.addEventListener('keydown', keyHandler, true)
  const modal = openModal({
    modeManager: window.__modeManager,
    root: backdrop,
    closeKeys: [],
    restoreMode: true,
    preferredFocus: () => ul.querySelector('li.active') || ul,
    beforeClose: () => { onClose && onClose() }
  })
  function keyHandler(e){
    // Ignore if not the latest active editor or panel is detached
    if (ACTIVE_EDITOR_TOKEN !== TOKEN) return
    if (!panel.isConnected) return
    // Do not intercept when editing inside an input except Esc and special stepping
    const inputFocused = document.activeElement && document.activeElement.tagName==='INPUT' && document.activeElement.classList.contains('me-num')
    const nameEditing = document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('me-name-input')
    const isSpace = (e.key===' ' || e.key==='Spacebar' || e.code==='Space')
  const lowerKey = (typeof e.key === 'string' ? e.key.toLowerCase() : '')
  const handledKeys = ['Escape','Enter','PageDown','PageUp','ArrowDown','ArrowUp']
    // When editing an input, intercept vim-like nav keys and treat them as navigation
    if (inputFocused || nameEditing){
      if (e.key==='Escape' || e.key==='Enter'){
        // Commit current input value into draft/pending to keep state consistent for dirty check
        const ae = document.activeElement
        if (ae && ae.classList.contains('me-num')){
          const li = ae.closest('li')
          const id = li && li.dataset.id
          const field = ae.getAttribute('data-field')
          let val = Number(ae.value); if(!Number.isFinite(val) || val<0) val = 0
          const scale = Number(ae.getAttribute('data-scale')||'1')
          const absVal = val * scale
          if (ae.getAttribute('data-pending')==='1'){
            if(pendingNewRow){ pendingNewRow[field] = absVal; __dirty = true }
          } else if (id){
            const cur = draftById.get(id) || origById.get(id)
            if(cur){ draftById.set(id, { ...cur, [field]: absVal }); __dirty = true }
          }
        }
        if (e.key==='Enter' && nameEditing){
          const inputEl = document.activeElement
          const id = (inputEl && inputEl.value || '').trim()
          if (id && !draftById.has(id) && !origById.has(id)){
            const meta = {
              enabled: true,
              contextWindow: pendingNewRow?.contextWindow || 8192,
              tpm: pendingNewRow?.tpm || 8192,
              rpm: pendingNewRow?.rpm || 60,
              tpd: pendingNewRow?.tpd || 100000
            }
            draftById.set(id, { id, ...meta })
            stagedAdds.set(id, { ...meta })
            stagedDeletes.delete(id)
            __dirty = true
            selectedCol = 1
            render(id)
            const idx = models.findIndex(m=> m.id===id)
            if(idx>=0){ activeIndex = idx; ensureVisible() }
            selectedCol = FIRST_EDITABLE_COL
            applyCellSelection(); enterEditMode()
          }
        }
        document.activeElement.blur(); editing=false; e.preventDefault();
        if(isDirty()){
          const kind = (e.key==='Enter') ? 'save' : 'discard'
          confirmDialog(kind).then(ok=>{ if(ok){ if(kind==='save') performSave(); close() } })
        } else { close() }
        return
      }
      if (lowerKey==='h'){ e.preventDefault(); moveCol(-1); return }
      if (lowerKey==='l'){ e.preventDefault(); moveCol(1); return }
      if (lowerKey==='j' || e.key==='ArrowDown'){ e.preventDefault(); document.activeElement.blur(); editing=false; selectedCol=null; move(1); return }
      if (lowerKey==='k' || e.key==='ArrowUp'){ e.preventDefault(); document.activeElement.blur(); editing=false; selectedCol=null; move(-1); return }
      if (e.key==='PageDown'){ e.preventDefault(); document.activeElement.blur(); editing=false; selectedCol=null; movePage(1); return }
      if (e.key==='PageUp'){ e.preventDefault(); document.activeElement.blur(); editing=false; selectedCol=null; movePage(-1); return }
      if (lowerKey==='g'){ e.preventDefault(); document.activeElement.blur(); editing=false; selectedCol=null; if(e.shiftKey){ activeIndex = (pendingNewRow? models.length : Math.max(0, models.length-1)); } else { activeIndex = 0 } render(models[activeIndex]?.id); ensureVisible(); return }
      return
    }
    if(isSpace || ['j','k','g','h','l'].includes(lowerKey) || handledKeys.includes(e.key) || (e.ctrlKey && lowerKey==='n') ){
      e.preventDefault()
    }
    // Esc: if editing input -> blur; else maybe confirm discard if dirty; else close
    if(e.key==='Escape'){
      if(inputFocused || nameEditing){ document.activeElement.blur(); editing=false; return }
      if(isDirty()) { confirmDialog('discard').then(ok=>{ if(ok){ close() } }); return }
      close(); return
    }
    // Enter: if editing -> blur and stay in nav; else confirm save if dirty else close
    if(e.key==='Enter'){
      if(inputFocused || nameEditing){ document.activeElement.blur(); editing=false; return }
      if(isDirty()){ confirmDialog('save').then(ok=>{ if(ok){ performSave(); close() } }); return }
      close(); return
    }
    // Ctrl+N: start inline new row
  if(e.ctrlKey && lowerKey==='n'){
      if(!pendingNewRow){ pendingNewRow = { id:'', enabled:true, contextWindow:8192, tpm:8192, rpm:60, tpd:100000 } }
      activeIndex = models.length
      selectedCol = 1 // name column
      render()
      applyCellSelection()
      const inp = ul.querySelector('li.me-row:last-child .me-name-input')
      if(inp){ inp.focus() }
      ensureVisible(); return
    }
    // Row movement
  if(lowerKey==='j' || e.key==='ArrowDown'){ move(1); return }
  if(lowerKey==='k' || e.key==='ArrowUp'){ move(-1); return }
  if(lowerKey==='g' && !e.shiftKey){ selectedCol=null; activeIndex = 0; render(models[0]?.id); ensureVisible(); return }
  if(lowerKey==='g' && e.shiftKey){
      if (pendingNewRow){
        activeIndex = models.length; selectedCol = 1; render(); applyCellSelection(); enterEditMode(); ensureVisible(); return
      }
      selectedCol=null; activeIndex = (models.length-1); render(models[activeIndex]?.id); ensureVisible(); return
    }
  if(e.key==='PageDown'){ movePage(1); return }
  if(e.key==='PageUp'){ movePage(-1); return }
    // Column movement
  if(lowerKey==='l'){
      if (selectedCol===null){ selectedCol = FIRST_EDITABLE_COL; applyCellSelection(); enterEditMode(); ensureVisible(); return }
      moveCol(1); return
    }
  if(lowerKey==='h'){
      if (selectedCol===null){ selectedCol = FIRST_EDITABLE_COL; applyCellSelection(); enterEditMode(); ensureVisible(); return }
      moveCol(-1); return
    }
    // Toggle
    if(isSpace){ const cur = (models[activeIndex]); if(cur){ toggle(cur.id) } return }
  }
  function move(delta){
    const rowsCount = models.length + (pendingNewRow?1:0)
    const prevIndex = activeIndex
    activeIndex = Math.min(rowsCount-1, Math.max(0, activeIndex + delta))
    // Reset column selection when changing rows
  selectedCol = null
  applyCellSelection()
    if(prevIndex !== activeIndex){
      const lis = ul.querySelectorAll('li.me-row')
      lis.forEach((li,i)=> li.classList.toggle('active', i===activeIndex))
      ensureVisible()
    }
  }
  function movePage(dir){
    const container = panel.querySelector('.list')
    if(!container) return
    const deltaRows = Math.max(1, Math.floor(container.clientHeight / 28)) // approx row height
    move(dir>0 ? deltaRows : -deltaRows)
  }
  function moveCol(delta){
    if(activeIndex<0) return
    const rowsCount = models.length + (pendingNewRow?1:0)
    if(activeIndex>=rowsCount) return
  if(selectedCol===null){ selectedCol = FIRST_EDITABLE_COL; applyCellSelection(); enterEditMode(); return }
    let next = selectedCol + delta
  // Allow name column (1) only for the pending new row; otherwise clamp to numeric [2..5]
  const isPendingRow = !!pendingNewRow && activeIndex === models.length
  if(!isPendingRow && next < FIRST_EDITABLE_COL) next = FIRST_EDITABLE_COL
  if(isPendingRow && next < 1) next = 1
    if(next>LAST_COL) next=LAST_COL
    selectedCol = next
    applyCellSelection()
    // Immediately enter edit mode for numeric cells
  enterEditMode()
  }
  function applyCellSelection(){
    // Clear previous
    ul.querySelectorAll('.me-col-selected').forEach(el=> el.classList.remove('me-col-selected'))
    if(selectedCol===null) return
    const row = ul.children[activeIndex]
    if(!row) return
    const sel = [
      '.me-col-toggle', '.me-col-name', '.me-col-cw', '.me-col-tpm', '.me-col-rpm', '.me-col-tpd'
    ][selectedCol]
    const cell = sel && row.querySelector(sel)
    if(cell) cell.classList.add('me-col-selected')
  }
  function enterEditMode(){
    if(selectedCol===null) return
    const row = ul.children[activeIndex]
    if(!row) return
    const sel = [ '.me-col-toggle', '.me-col-name', '.me-col-cw', '.me-col-tpm', '.me-col-rpm', '.me-col-tpd' ][selectedCol]
    const cell = sel && row.querySelector(sel)
    if(!cell) return
  const nameInput = cell.querySelector('input.me-name-input')
  if(nameInput){ editing = true; nameInput.focus(); try{ nameInput.select() }catch{}; return }
  const input = cell.querySelector('input.me-num')
  if(input){ editing = true; input.focus(); try{ input.select() }catch{} }
  }
  function ensureVisible(){
    const container = panel.querySelector('.list')
    const row = ul.children[activeIndex]
    if(!container || !row) return
    // Use built-in behavior if available
    try { row.scrollIntoView({ block: 'nearest' }) } catch {}
  updateScrollHints()
  }
  function isDirty(){
    // Consider any staged change, pending new row, or diffs vs. original as dirty
    if (pendingNewRow) return true
    if (stagedAdds.size > 0 || stagedDeletes.size > 0) return true
    for (const [id, draft] of draftById){
      const orig = origById.get(id)
      if (!orig) return true
      if ((draft.enabled||false) !== (orig.enabled||false)) return true
      if ((draft.contextWindow||0) !== (orig.contextWindow||0)) return true
      if ((draft.tpm||0) !== (orig.tpm||0)) return true
      if ((draft.rpm||0) !== (orig.rpm||0)) return true
      if ((draft.tpd||0) !== (orig.tpd||0)) return true
    }
    return !!__dirty
  }
  function updateFooterState(){ /* saved/dirty hint reserved for future */ }
  function performSave(){
    // Apply staged adds
    for(const [id, meta] of stagedAdds){ addModel(id, meta) }
    // Apply updates vs originals
    for(const [id, draft] of draftById){
      if(stagedAdds.has(id)) continue
      const orig = origById.get(id)
      if(!orig) continue
      if(draft.enabled !== orig.enabled){ setModelEnabled(id, draft.enabled) }
      const patch = {}
      if(draft.contextWindow !== orig.contextWindow) patch.contextWindow = draft.contextWindow
      if(draft.tpm !== orig.tpm) patch.tpm = draft.tpm
      if(draft.rpm !== orig.rpm) patch.rpm = draft.rpm
      if(draft.tpd !== orig.tpd) patch.tpd = draft.tpd
      if(Object.keys(patch).length){ updateModelMeta(id, patch) }
    }
    // Apply deletions for custom models not used
    if(store){
      const used = new Set(); for(const p of store.getAllPairs()) used.add(String(p.model||'').toLowerCase())
      for(const id of stagedDeletes){ if(!isBaseModel(id) && !used.has(String(id).toLowerCase())) deleteModel(id) }
    } else {
      for(const id of stagedDeletes){ if(!isBaseModel(id)) deleteModel(id) }
    }
  __dirty = false
  }
  // No Save/Cancel buttons; Sync remains passive
  render()
  function close(){
    // Cleanup listener and clear token ownership
  try{ backdrop.removeEventListener('keydown', keyHandler, true) }catch{}
    if (ACTIVE_EDITOR_TOKEN === TOKEN) ACTIVE_EDITOR_TOKEN = null
    // beforeClose provided to modal will call onClose once
    modal.close('manual')
  }
  function confirmDialog(kind){
    // kind: 'save' | 'discard'
    return new Promise(resolve=>{
      const b = document.createElement('div')
      b.className = 'overlay-backdrop centered'
      const p = document.createElement('div')
      p.className = 'overlay-panel compact'
  const title = kind==='save' ? 'Confirm changes' : 'Disregard changes'
  const body = kind==='save' ? 'Apply changes and close? [y/n]' : 'Discard changes and close? [y/n]'
  p.innerHTML = `<header>${title}</header><div style="padding:17px 21px; font:12px var(--font-ui); color:#bbb;">${body}</div>`
      b.appendChild(p); document.body.appendChild(b)
      const m = openModal({ modeManager: window.__modeManager, root: b, closeKeys:['Escape'], restoreMode:false })
      function onKey(ev){
        const k = ev.key.toLowerCase()
        if(k==='y'){ ev.preventDefault(); cleanup(true) }
        else if(k==='n' || ev.key==='Escape'){ ev.preventDefault(); cleanup(false) }
      }
      function cleanup(val){ window.removeEventListener('keydown', onKey, true); m.close('manual'); b.remove(); resolve(val) }
      window.addEventListener('keydown', onKey, true)
    })
  }
}
