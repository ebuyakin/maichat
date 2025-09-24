// modelEditor.js moved from ui/modelEditor.js (Phase 6.6 Config)
// Restored original (moved from src/ui/modelEditor.js) - path adjusted only.
import { listModels, getActiveModel, setActiveModel, updateModelMeta, setModelEnabled, addModel, deleteModel, renameModel } from '../../core/models/modelCatalog.js'
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
  panel.style.minWidth = '930px'
  panel.innerHTML = `
    <header>Models</header>
  <div class="me-hintbar"><span class="me-hint">j/k rows · h/l cols · Space toggle · on Provider: switch · Ctrl+N new</span></div>
    <div class="me-table">
      <div class="me-row me-head" aria-hidden="true">
  <span class="me-col me-col-toggle">Enabled</span>
  <span class="me-col me-col-name">Model</span>
  <span class="me-col me-col-provider">Provider</span>
  <span class="me-col me-col-cw">CW (K)</span>
  <span class="me-col me-col-tpm">TPM (K)</span>
  <span class="me-col me-col-rpm">RPM (K)</span>
  <span class="me-col me-col-tpd">TPD (K)</span>
  <span class="me-col me-col-otpm">OTPM (K)</span>
      </div>
  <div class="list"><ul tabindex="0" class="me-list"></ul></div>
  <div class="me-hintbar" aria-hidden="true"><span class="me-hint">CW — context window · TPM — tokens per minute · RPM — requests per minute · TPD — tokens per day · OTPM — output tokens per minute (Anthropic)</span></div>
    </div>
    <footer class="me-footer">
      <div class="me-controls">
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
  // Helper: keep focus within overlay so key handling stays active
  function ensureListFocus(){ try { ul.focus({ preventScroll:true }) } catch(_){} }
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
  // Navigation state: null = row only (no column focus); otherwise 0..7 => column index
  // 0: toggle, 1: name (read-only except for new row), 2: provider (ONLY focusable/editable for pending new row), 3..7: numeric fields cw, tpm, rpm, tpd, otpm.
  // For existing rows, navigation should jump from name (1) directly to CW (3) when user presses 'l'.
  let selectedCol = null
  let editing = false
  let pendingNewRow = null // { enabled, id:'', contextWindow,tpm,rpm,tpd,otpm }
  let __dirty = false
  let __applied = false // becomes true when changes are saved

  const COLS = ['toggle','name','provider','contextWindow','tpm','rpm','tpd','otpm']
  const PROVIDER_COL_INDEX = 2
  const FIRST_NUMERIC_COL = 3 // contextWindow
  const LAST_COL = 7
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
  const activeBadge = m.id===activeModel?'<span class="me-active">(active)</span>':''
      const inUse = usedCounts.get(String(m.id).toLowerCase())>0
      li.innerHTML = `
        <span class="me-col me-col-toggle ${m.enabled?'on':'off'}" data-role="toggle" aria-label="${m.enabled?'enabled':'disabled'}">${m.enabled? '●':'○'}</span>
        <span class="me-col me-col-name"><input aria-label="Model ID" data-field="id" type="text" value="${m.id}" class="me-name-input"/>${activeBadge}</span>
        <span class="me-col me-col-provider"><input aria-label="Provider" data-field="provider" type="text" value="${m.provider || 'openai'}" class="me-provider-input"/></span>
        <span class="me-col me-col-cw"><input aria-label="Context window (K tokens)" data-field="contextWindow" data-scale="1000" type="number" min="0" step="1" value="${Math.round((m.contextWindow||0)/1000)}" class="me-num"/></span>
        <span class="me-col me-col-tpm"><input aria-label="Tokens per minute (K tokens)" data-field="tpm" data-scale="1000" type="number" min="0" step="1" value="${Math.round((m.tpm||0)/1000)}" class="me-num"/></span>
        <span class="me-col me-col-rpm"><input aria-label="Requests per minute" data-field="rpm" type="number" min="0" step="1" value="${m.rpm}" class="me-num"/></span>
        <span class="me-col me-col-tpd"><div class="me-actions"><input aria-label="Tokens per day (K tokens)" data-field="tpd" data-scale="1000" type="number" min="0" step="1" value="${Math.round((m.tpd||0)/1000)}" class="me-num"/></div></span>
        <span class="me-col me-col-otpm"><input aria-label="Output tokens per minute (K tokens)" data-field="otpm" data-scale="1000" type="number" min="0" step="1" value="${m.otpm!=null?Math.round((m.otpm||0)/1000):''}" class="me-num" placeholder="-"/></span>`
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
        <span class="me-col me-col-provider"><input class="me-provider-input" data-pending="1" data-field="provider" type="text" placeholder="Provider" value="${pendingNewRow.provider || 'openai'}"/></span>
        <span class="me-col me-col-cw"><input aria-label="Context window (K tokens)" data-pending="1" data-field="contextWindow" data-scale="1000" type="number" min="0" step="1" value="${Math.round((pendingNewRow.contextWindow||0)/1000)}" class="me-num"/></span>
        <span class="me-col me-col-tpm"><input aria-label="Tokens per minute (K tokens)" data-pending="1" data-field="tpm" data-scale="1000" type="number" min="0" step="1" value="${Math.round((pendingNewRow.tpm||0)/1000)}" class="me-num"/></span>
        <span class="me-col me-col-rpm"><input aria-label="Requests per minute" data-pending="1" data-field="rpm" type="number" min="0" step="1" value="${pendingNewRow.rpm||0}" class="me-num"/></span>
        <span class="me-col me-col-tpd"><div class="me-actions"><input aria-label="Tokens per day (K tokens)" data-pending="1" data-field="tpd" data-scale="1000" type="number" min="0" step="1" value="${Math.round((pendingNewRow.tpd||0)/1000)}" class="me-num"/></div></span>
        <span class="me-col me-col-otpm"><input aria-label="Output tokens per minute (K tokens)" data-pending="1" data-field="otpm" data-scale="1000" type="number" min="0" step="1" value="${pendingNewRow.otpm!=null?Math.round((pendingNewRow.otpm||0)/1000):''}" class="me-num" placeholder="-"/></span>`
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
    // Ensure focus stays inside overlay to keep key handling alive
    try { ul.focus({ preventScroll:true }) } catch {}
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

  function isBaseModel(id){ return ['gpt-5','gpt-5-mini','gpt-5-nano','gpt-4.1','gpt-4.1-mini','gpt-4.1-nano','o3','o4-mini','gpt-4o','gpt-4o-mini','gpt-3.5-turbo','claude-3-5-sonnet-20240620','claude-3-5-haiku-20241022'].includes(id) }
  ul.addEventListener('click', e=>{ 
    const li = e.target.closest('li.me-row')
    if(!li || li.classList.contains('me-add')) return
    activeIndex = Array.from(ul.querySelectorAll('li.me-row')).indexOf(li)
    const tgt = e.target; if(tgt && ((tgt.getAttribute('data-field')||'').length || tgt.classList.contains('me-name-input') || tgt.classList.contains('me-provider-input'))){ return }
    // Toggle enabled in draft
    const id = li.dataset.id
    const cur = draftById.get(id) || origById.get(id)
    if(cur){
      draftById.set(id, { ...cur, enabled: !cur.enabled })
      render(id)
      try { ul.focus({ preventScroll:true }) } catch {}
    }
  })
  ul.addEventListener('change', e=>{
    const input = e.target.closest('input.me-num, input.me-name-input, input.me-provider-input')
    if(!input) return
    const li = e.target.closest('li')
    if(!li) return
    const id = li.dataset.id
    const field = input.getAttribute('data-field')
    
    // Handle numeric fields
    if(input.classList.contains('me-num')){
      let val = Number(input.value)
      if(!Number.isFinite(val) || val < 0) { val = 0; input.value = '0' }
      const scale = Number(input.getAttribute('data-scale') || '1')
      const absVal = val * scale
      
      if(input.getAttribute('data-pending')==='1'){
        if(!pendingNewRow) return
        pendingNewRow[field] = absVal
      } else {
        const cur = draftById.get(id) || origById.get(id)
        if(cur){ draftById.set(id, { ...cur, [field]: absVal }) }
      }
    }
    
    // Handle text fields (Model ID and Provider)
    else if(input.classList.contains('me-name-input') || input.classList.contains('me-provider-input')){
      const val = (input.value || '').trim()
      
      if(input.getAttribute('data-pending')==='1'){
        if(!pendingNewRow) return
        pendingNewRow[field] = val
      } else {
        const cur = draftById.get(id) || origById.get(id)
        if(cur){ 
          draftById.set(id, { ...cur, [field]: val }) 
        }
      }
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
        provider: pendingNewRow?.provider || 'openai',
        contextWindow: pendingNewRow?.contextWindow || 8192,
        tpm: pendingNewRow?.tpm || 8192,
        rpm: pendingNewRow?.rpm || 60,
        tpd: pendingNewRow?.tpd || 100000,
        otpm: pendingNewRow?.otpm
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
  selectedCol = FIRST_NUMERIC_COL
  applyCellSelection(); enterEditMode()
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
    beforeClose: () => { onClose && onClose({ dirty: !!__applied }) }
  })
  // Buttons wiring
  function doSave(){ performSave(); updateFooterState(); ensureListFocus() }
  function doCancelAndClose(){ close() }
  saveBtn?.addEventListener('click', (e)=>{ e.preventDefault(); doSave() })
  cancelBtn?.addEventListener('click', (e)=>{ e.preventDefault(); doCancelAndClose() })
  function keyHandler(e){
    // Ignore if not the latest active editor or panel is detached
    if (ACTIVE_EDITOR_TOKEN !== TOKEN) return
    if (!panel.isConnected) return
    const lowerKey = (typeof e.key === 'string' ? e.key.toLowerCase() : '')
    // Global shortcuts first
  if(e.ctrlKey && lowerKey==='s'){ e.preventDefault(); doSave(); return }
  // Escape is handled by openModal closeKeys; do not handle locally to avoid leaks
    // Do not intercept when editing inside an input except Esc and special stepping
    const inputFocused = document.activeElement && document.activeElement.tagName==='INPUT' && document.activeElement.classList.contains('me-num')
    const nameEditing = document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('me-name-input')
    const providerEditing = document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('me-provider-input')
    const isSpace = (e.key===' ' || e.key==='Spacebar' || e.code==='Space')
  const handledKeys = ['Escape','Enter','PageDown','PageUp','ArrowDown','ArrowUp']
    // When editing an input, intercept vim-like nav keys and treat them as navigation
    if (inputFocused || nameEditing || providerEditing){
      if (e.key==='Enter'){
        // Commit current input value into draft/pending and remain in editor
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
        
        // Handle provider field changes for existing models
        if (ae && ae.classList.contains('me-provider-input')){
          const li = ae.closest('li')
          const id = li && li.dataset.id
          const field = ae.getAttribute('data-field') // should be 'provider'
          const val = (ae.value || '').trim()
          
          if (ae.getAttribute('data-pending')==='1'){
            // New row: update pending row
            if(pendingNewRow && field){ pendingNewRow[field] = val; __dirty = true }
          } else if (id && field){
            // Existing row: update draft
            const cur = draftById.get(id) || origById.get(id)
            if(cur){ draftById.set(id, { ...cur, [field]: val }); __dirty = true }
          }
        }
        
        // Handle model ID field changes for existing models
        if (ae && ae.classList.contains('me-name-input') && ae.getAttribute('data-field') === 'id'){
          const li = ae.closest('li')
          const oldId = li && li.dataset.id
          const newId = (ae.value || '').trim()
          
          if (oldId && newId && oldId !== newId){
            // Renaming existing model
            const cur = draftById.get(oldId) || origById.get(oldId)
            if(cur && !draftById.has(newId) && !origById.has(newId)){
              draftById.set(newId, { ...cur, id: newId })
              draftById.delete(oldId)
              stagedDeletes.set(oldId, cur)
              stagedAdds.set(newId, { ...cur, id: newId })
              __dirty = true
              render(newId)
              const idx = models.findIndex(m=> m.id===newId)
              if(idx>=0){ activeIndex = idx; ensureVisible() }
            }
          }
        }
        
        if (nameEditing){
          const inputEl = document.activeElement
          const id = (inputEl && inputEl.value || '').trim()
          if (id && !draftById.has(id) && !origById.has(id)){
            const meta = {
              enabled: true,
              contextWindow: pendingNewRow?.contextWindow || 8192,
              tpm: pendingNewRow?.tpm || 8192,
              rpm: pendingNewRow?.rpm || 60,
              tpd: pendingNewRow?.tpd || 100000,
              otpm: pendingNewRow?.otpm
            }
            draftById.set(id, { id, ...meta })
            stagedAdds.set(id, { ...meta })
            stagedDeletes.delete(id)
            __dirty = true
            selectedCol = 1
            render(id)
            const idx = models.findIndex(m=> m.id===id)
            if(idx>=0){ activeIndex = idx; ensureVisible() }
            selectedCol = FIRST_NUMERIC_COL
            applyCellSelection(); enterEditMode()
          }
        }
        document.activeElement.blur(); editing=false; e.preventDefault();
        ensureListFocus()
        return
      }
      if (lowerKey==='h'){ e.preventDefault(); moveCol(-1); return }
      if (lowerKey==='l'){ e.preventDefault(); moveCol(1); return }
      if (lowerKey==='j' || e.key==='ArrowDown'){ e.preventDefault(); document.activeElement.blur(); editing=false; selectedCol=null; move(1); ensureListFocus(); return }
      if (lowerKey==='k' || e.key==='ArrowUp'){ e.preventDefault(); document.activeElement.blur(); editing=false; selectedCol=null; move(-1); ensureListFocus(); return }
      if (e.key==='PageDown'){ e.preventDefault(); document.activeElement.blur(); editing=false; selectedCol=null; movePage(1); ensureListFocus(); return }
      if (e.key==='PageUp'){ e.preventDefault(); document.activeElement.blur(); editing=false; selectedCol=null; movePage(-1); ensureListFocus(); return }
      if (lowerKey==='g'){ e.preventDefault(); document.activeElement.blur(); editing=false; selectedCol=null; if(e.shiftKey){ activeIndex = (pendingNewRow? models.length : Math.max(0, models.length-1)); } else { activeIndex = 0 } render(models[activeIndex]?.id); ensureVisible(); ensureListFocus(); return }
      return
    }
    if(isSpace || ['j','k','g','h','l','g'].includes(lowerKey) || handledKeys.includes(e.key) || (e.ctrlKey && lowerKey==='n') ){
      e.preventDefault()
    }
    // Enter at overlay level: no global save/close action
    if(e.key==='Enter'){ return }
    // Ctrl+N: start inline new row
  if(e.ctrlKey && lowerKey==='n'){
  if(!pendingNewRow){ pendingNewRow = { id:'', enabled:true, provider:'openai', contextWindow:8192, tpm:8192, rpm:60, tpd:100000, otpm: undefined } }
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
  if(lowerKey==='g' && !e.shiftKey){ selectedCol=null; activeIndex = 0; render(models[0]?.id); ensureVisible(); ensureListFocus(); return }
  if(lowerKey==='g' && e.shiftKey){
      if (pendingNewRow){
        activeIndex = models.length; selectedCol = 1; render(); applyCellSelection(); enterEditMode(); ensureVisible(); ensureListFocus(); return
      }
      selectedCol=null; activeIndex = (models.length-1); render(models[activeIndex]?.id); ensureVisible(); ensureListFocus(); return
    }
  if(e.key==='PageDown'){ movePage(1); return }
  if(e.key==='PageUp'){ movePage(-1); return }
    // Column movement
  if(lowerKey==='l'){
      if (selectedCol===null){
        // Start at Model column (1) for existing rows, Provider column (2) for new rows
        const isPending = !!pendingNewRow && activeIndex === models.length
        selectedCol = isPending ? PROVIDER_COL_INDEX : 1  // Start at Model column for existing rows
        applyCellSelection(); enterEditMode(); ensureVisible(); return
      }
      moveCol(1); return
    }
  if(lowerKey==='h'){
      if (selectedCol===null){
        // Start at Model column (1) for existing rows, Provider column (2) for new rows
        const isPending = !!pendingNewRow && activeIndex === models.length
        selectedCol = isPending ? PROVIDER_COL_INDEX : 1  // Start at Model column for existing rows
        applyCellSelection(); enterEditMode(); ensureVisible(); return
      }
      moveCol(-1); return
    }
    // Toggle / provider switch for pending row
    if(isSpace){
      const rowIdx = activeIndex
      const isPending = !!pendingNewRow && rowIdx === models.length
      if(selectedCol===2 && isPending){
        pendingNewRow.provider = (pendingNewRow.provider==='openai' ? 'anthropic' : 'openai')
        render(); applyCellSelection(); enterEditMode(); ensureVisible(); return
      }
      const cur = (models[rowIdx]); if(cur){ toggle(cur.id) } return
    }
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
  if(selectedCol===null){
    const isPending = !!pendingNewRow && activeIndex === models.length
    selectedCol = isPending ? PROVIDER_COL_INDEX : 1  // Start at Model column for existing rows, Provider for new rows
    applyCellSelection(); enterEditMode(); return
  }
    let next = selectedCol + delta
  // Determine pending row and columns allowed
  const isPendingRow = !!pendingNewRow && activeIndex === models.length
  
  // Allow navigation to all columns for both existing and pending rows
  if(next < 1) next = 1  // Start from name column (1)
  if(next > LAST_COL) next = LAST_COL
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
      '.me-col-toggle', '.me-col-name', '.me-col-provider', '.me-col-cw', '.me-col-tpm', '.me-col-rpm', '.me-col-tpd', '.me-col-otpm'
    ][selectedCol]
    const cell = sel && row.querySelector(sel)
    if(cell) cell.classList.add('me-col-selected')
  }
  function enterEditMode(){
    if(selectedCol===null) return
    const row = ul.children[activeIndex]
    if(!row) return
  const sel = [ '.me-col-toggle', '.me-col-name', '.me-col-provider', '.me-col-cw', '.me-col-tpm', '.me-col-rpm', '.me-col-tpd', '.me-col-otpm' ][selectedCol]
    const cell = sel && row.querySelector(sel)
    if(!cell) return
  const nameInput = cell.querySelector('input.me-name-input')
  if(nameInput){ editing = true; nameInput.focus(); try{ nameInput.select() }catch{}; return }
  
  const providerInput = cell.querySelector('input.me-provider-input')
  if(providerInput){ editing = true; providerInput.focus(); try{ providerInput.select() }catch{}; return }
  
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
  if ((draft.otpm||0) !== (orig.otpm||0)) return true
    }
    return !!__dirty
  }
  function updateFooterState(){
    const dirty = isDirty()
    if (saveBtn) saveBtn.textContent = dirty ? 'Apply (Ctrl+S)' : 'All saved'
    if (cancelBtn) cancelBtn.textContent = dirty ? 'Cancel+Close (Esc)' : 'Close (Esc)'
  }
  function performSave(){
    // First pass: Handle model ID renames
    for(const [id, draft] of draftById){
      if(stagedAdds.has(id)) continue
      const orig = origById.get(id)
      if(!orig) continue
      
      // Check if this is a model ID rename
      if(draft.id && draft.id !== orig.id && draft.id !== id){
        const success = renameModel(id, draft.id)
        if(success){
          // Update our tracking maps to use the new ID
          draftById.delete(id)
          draftById.set(draft.id, draft)
          origById.delete(id)
          origById.set(draft.id, { ...orig, id: draft.id })
        }
      }
    }
    
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
      if(draft.otpm !== orig.otpm) patch.otpm = draft.otpm
      if(draft.provider !== orig.provider) patch.provider = draft.provider
      if(Object.keys(patch).length){ updateModelMeta(id, patch) }
    }
    // Apply deletions for custom models not used
    if(store){
      const used = new Set(); for(const p of store.getAllPairs()) used.add(String(p.model||'').toLowerCase())
      for(const id of stagedDeletes){ if(!isBaseModel(id) && !used.has(String(id).toLowerCase())) deleteModel(id) }
    } else {
      for(const id of stagedDeletes){ if(!isBaseModel(id)) deleteModel(id) }
    }
    // Reset staged state so editor reflects a clean state post-save
    pendingNewRow = null
    stagedAdds.clear()
    stagedDeletes.clear()
    __dirty = false
    __applied = true
    // Rebuild originals/drafts from the now-updated catalog so isDirty() returns false
    origById.clear(); draftById.clear()
    render()
    updateFooterState()
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
  // confirmDialog removed: Editors now use explicit Save/Cancel per overlays.md
}
