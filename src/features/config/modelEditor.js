// modelEditor.js moved from ui/modelEditor.js (Phase 6.6 Config)
// Restored original (moved from src/ui/modelEditor.js) - path adjusted only.
import { listModels, getActiveModel, setActiveModel, updateModelMeta, setModelEnabled, addModel, deleteModel } from '../../core/models/modelCatalog.js'
import { openModal } from '../../shared/openModal.js'

export function openModelEditor({ onClose, store }){
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
  <div class="me-sep" aria-hidden="true"></div>
    <div class="me-new">
      <div class="me-row me-new-row">
        <span class="me-col me-col-toggle"></span>
  <span class="me-col me-col-name"><input class="me-id-input" type="text" placeholder="New model" /></span>
        <span class="me-col me-col-cw"><input data-field="contextWindow" data-scale="1000" class="me-num" type="number" min="0" step="1" placeholder="8" title="K tokens"/></span>
        <span class="me-col me-col-tpm"><input data-field="tpm" data-scale="1000" class="me-num" type="number" min="0" step="1" placeholder="200" title="K tokens/min"/></span>
        <span class="me-col me-col-rpm"><input data-field="rpm" class="me-num" type="number" min="0" step="1" placeholder="60" title="requests/min"/></span>
        <span class="me-col me-col-tpd"><input data-field="tpd" data-scale="1000" class="me-num" type="number" min="0" step="1" placeholder="1000" title="K tokens/day"/></span>
      </div>
      <div class="me-add-controls">
        <button class="btn btn-sm" data-action="add">Add</button>
      </div>
    </div>
    <footer class="me-footer">
      <span class="me-hint">j/k move · Space toggle · Enter/Esc close · Click numbers to edit</span>
      <div class="me-controls">
        <div class="me-controls-left">
          <button class="btn-ghost btn-sm" aria-disabled="true" disabled title="Not implemented yet">Sync models</button>
        </div>
        <div class="me-controls-right">
      <button class="btn btn-sm" data-action="save">Save</button>
      <button class="btn btn-sm" data-action="cancel">Cancel</button>
        </div>
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
    if(activeIndex >= models.length) activeIndex = models.length-1
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
  updateFooterState()
  updateScrollHints()
  syncScrollbarVar()
  }
  function fmt(n){ return Math.round(n/1000) }
  function toggle(id){
    const cur = draftById.get(id) || origById.get(id)
    if(!cur) return
    draftById.set(id, { ...cur, enabled: !cur.enabled })
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
    const tgt = e.target; if(tgt && (tgt.getAttribute('data-field')||'').length){ return }
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
    const cur = draftById.get(id) || origById.get(id)
    if(cur){ draftById.set(id, { ...cur, [field]: absVal }) }
    // re-render but keep focus on edited input
    const preserveId = id
    const caretPos = input.selectionStart
    render(preserveId)
    const li2 = ul.querySelector(`li[data-id="${preserveId}"]`)
    if(li2){ const same = li2.querySelector(`input.me-num[data-field="${field}"]`); if(same){ same.focus(); try{ same.setSelectionRange(caretPos, caretPos) }catch{} } }
  })
  // Add button (always-visible new model row)
  panel.querySelector('.me-new')?.addEventListener('click', (e)=>{
    const btn = e.target.closest('button[data-action="add"]')
    if(!btn) return
    const row = panel.querySelector('.me-new .me-new-row')
    const id = row.querySelector('.me-id-input')?.value?.trim()
    const cwK = Number(row.querySelector('input[data-field="contextWindow"]')?.value)
    const tpmK = Number(row.querySelector('input[data-field="tpm"]')?.value)
    const rpm = Number(row.querySelector('input[data-field="rpm"]')?.value)
  const tpdK = Number(row.querySelector('input[data-field="tpd"]')?.value)
    if(!id) return
    if(draftById.has(id) || origById.has(id)) return
  const meta = { enabled:true, contextWindow:(isFinite(cwK)?cwK:8)*1000, tpm:(isFinite(tpmK)?tpmK:200)*1000, rpm:(isFinite(rpm)?rpm:60), tpd:(isFinite(tpdK)?tpdK:1000)*1000 }
    draftById.set(id, { id, ...meta })
    stagedAdds.set(id, { ...meta })
    stagedDeletes.delete(id)
    render(id)
    ensureVisible()
  })
  // Sync is intentionally passive (non-focusable, no click handler) until implemented
  window.addEventListener('keydown', keyHandler, true)
  const modal = openModal({ modeManager: window.__modeManager, root: backdrop, closeKeys:[], restoreMode:true, preferredFocus:()=> ul.querySelector('li.active') || ul })
  function keyHandler(e){
  const handledKeys = ['Escape',' ','Enter','j','k','ArrowDown','ArrowUp']
    if(handledKeys.includes(e.key)){
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }
  if(e.key==='Escape'){ /* Cancel */ close(); return }
  if(e.key==='Enter'){ if(isDirty()) { performSave() } close(); return }
  if(e.key===' '){ const cur = models[activeIndex]; if(cur){ toggle(cur.id) } return }
    if(e.key==='j' || e.key==='ArrowDown'){ move(1); return }
    if(e.key==='k' || e.key==='ArrowUp'){ move(-1); return }
  }
  function move(delta){
  const prev = models[activeIndex] && models[activeIndex].id
  activeIndex = Math.min(models.length-1, Math.max(0, activeIndex + delta))
    if(models[activeIndex] && models[activeIndex].id !== prev){
      const lis = ul.querySelectorAll('li')
      lis.forEach((li,i)=> li.classList.toggle('active', i===activeIndex))
      ensureVisible()
    }
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
    // Added/Deleted
    if(stagedAdds.size>0 || stagedDeletes.size>0) return true
    // Changed fields
    for(const [id, draft] of draftById){
      const orig = origById.get(id)
      if(!orig) return true
      if(draft.enabled !== orig.enabled) return true
      if(draft.contextWindow !== orig.contextWindow) return true
      if(draft.tpm !== orig.tpm) return true
      if(draft.rpm !== orig.rpm) return true
      if(draft.tpd !== orig.tpd) return true
    }
    return false
  }
  function updateFooterState(){
    const saveBtn = panel.querySelector('button[data-action="save"]')
    const dirty = isDirty()
    if(saveBtn){ saveBtn.textContent = dirty ? 'Save' : 'Saved'; saveBtn.disabled = !dirty }
  }
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
  }
  // Footer controls: Save/Cancel (Sync remains passive)
  panel.querySelector('.me-footer')?.addEventListener('click', async (e)=>{
    const act = e.target.closest('button[data-action]')?.getAttribute('data-action')
    if(!act) return
    if(act==='cancel'){ close(); return }
    if(act==='save'){
      performSave()
      close(); return
    }
  })
  render()
  function close(){ window.removeEventListener('keydown', keyHandler, true); modal.close('manual'); onClose && onClose() }
}
