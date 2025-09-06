// modelSelector.js moved from ui/modelSelector.js (Phase 6.6 Config)
import { listModels, getActiveModel, setActiveModel } from '../../core/models/modelCatalog.js'
import { openModal } from '../../shared/openModal.js'

// Restored original selector (moved from ui) with path adjustments; supports j/k navigation, filtering, Enter select, Esc close.
  export function openModelSelector({ onSelect, onClose }){
    if(document.getElementById('modelSelectorRoot')) return
    const root = document.createElement('div')
    root.id = 'modelSelectorRoot'
    root.className = 'overlay-backdrop centered'
    root.innerHTML = `
      <div class="overlay-panel model-selector-panel compact">
        <header>Model Selector</header>
        <div class="ms-body">
          <ul class="model-list" role="listbox"></ul>
          <div class="filter-row"><span class="filter-value"></span></div>
          <div class="ms-hint">type to filter · j/k move · Enter select · Esc close</div>
        </div>
      </div>`
    document.body.appendChild(root)
    const panel = root.querySelector('.model-selector-panel')
    const listEl = panel.querySelector('.model-list')
    const filterValueEl = panel.querySelector('.filter-value')
  // Use listModels() (returns array) instead of removed getModelCatalog()
  const allModels = listModels().filter(m=> m.enabled !== false).map(m=> m.id)
    let filter = ''
    let filtered = allModels.slice()
    // Start with current active model highlighted if present (parity / usability)
    let activeIndex = (()=>{
      const current = getActiveModel && getActiveModel()
      if(current){
        const i = filtered.indexOf(current)
        if(i>=0) return i
      }
      return 0
    })()
    const modal = openModal({ modeManager: window.__modeManager, root, closeKeys:[], restoreMode:true, preferredFocus: ()=> listEl })
    function close(){ modal.close('manual'); if(onClose) onClose() }
    root.addEventListener('click', e=>{ if(e.target===root) close() })
    function applyFilter(){
      const f = filter.toLowerCase()
      filtered = allModels.filter(m=> m.toLowerCase().includes(f))
      if(activeIndex >= filtered.length) activeIndex = filtered.length-1
      if(activeIndex < 0) activeIndex = 0
      renderList()
    }
    function renderList(){
      if(!filtered.length){
        listEl.innerHTML = ''
        filterValueEl.textContent = filter
        // Fallback: keep focus inside overlay via list element itself
  listEl.setAttribute('tabindex','0')
  try { listEl.focus({ preventScroll:true }) } catch(_){}
        return
      }
      listEl.innerHTML = filtered.map((m,i)=> `<li class="model-item${i===activeIndex?' active':''}" data-name="${m}" role="option" aria-selected="${i===activeIndex}">${m}</li>`).join('')
      filterValueEl.textContent = filter
      const items = listEl.querySelectorAll('.model-item')
      items.forEach((el,i)=>{
        if(i===activeIndex){ el.setAttribute('tabindex','0') } else { el.removeAttribute('tabindex') }
      })
      listEl.removeAttribute('tabindex') // list itself not focus target when items exist
      const activeEl = listEl.querySelector('.model-item.active')
      if(activeEl){
        try { activeEl.focus({ preventScroll:true }) } catch(_){}
        try { if(typeof activeEl.scrollIntoView === 'function') activeEl.scrollIntoView({ block:'nearest' }) } catch(_) {}
      }
    }
    function move(delta){
      if(!filtered.length) return
      activeIndex = (activeIndex + delta + filtered.length) % filtered.length
      renderList()
    }
    function selectActive(){
      const name = filtered[activeIndex]
      if(name){
        try { setActiveModel(name) } catch(_){}
        if(onSelect) onSelect(name)
        close()
      }
    }
  // Capture at root (capturing) so keys don't bubble to global keyRouter first
  function keyHandler(e){
      const swallow = ()=>{ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation() }
      if(e.key==='Escape'){ swallow(); close(); return }
      if(e.key==='Enter'){ swallow(); selectActive(); return }
      if(e.key==='j' || e.key==='ArrowDown'){ if(filtered.length){ swallow(); move(1); } return }
      if(e.key==='k' || e.key==='ArrowUp'){ if(filtered.length){ swallow(); move(-1); } return }
      if(e.key==='Backspace'){ swallow(); filter = filter.slice(0,-1); applyFilter(); return }
      if(e.key.length===1 && !e.metaKey && !e.ctrlKey && !e.altKey){ swallow(); filter += e.key; applyFilter(); return }
  }
  window.addEventListener('keydown', keyHandler, true)
  const originalClose = close
  // Wrap close to cleanup window listener
  function closeWrapped(){ window.removeEventListener('keydown', keyHandler, true); originalClose() }
  close = closeWrapped
    applyFilter()
  }
