// Simple Model Editor (Ctrl+Shift+M) for enable/disable only
import { listModels, toggleModelEnabled, getActiveModel, setActiveModel } from '../models/modelCatalog.js'
import { openModal } from './openModal.js'

export function openModelEditor({ onClose }){
  const backdrop = document.createElement('div')
  backdrop.className = 'overlay-backdrop centered'
  const panel = document.createElement('div')
  panel.className = 'overlay-panel model-editor'
  panel.style.minWidth = '620px'
  panel.innerHTML = `<header>Models</header><div class="list"><ul tabindex="0" class="me-list"></ul></div><footer><span class="me-hint">j/k move · Space toggle · Enter/Esc close</span></footer>`
  backdrop.appendChild(panel)
  document.body.appendChild(backdrop)
  const ul = panel.querySelector('ul')

  let models = []
  let activeIndex = 0
  function render(preserveId){
    const prevId = preserveId || (models[activeIndex] && models[activeIndex].id)
  // Preserve original catalog order (BASE_MODELS order from catalog)
  models = listModels()
    const activeModel = getActiveModel()
    if(prevId){
      const newIdx = models.findIndex(m=> m.id===prevId)
      if(newIdx >= 0) activeIndex = newIdx
    }
    if(activeIndex >= models.length) activeIndex = models.length-1
    if(activeIndex < 0) activeIndex = 0
    ul.innerHTML = ''
    models.forEach((m,i)=>{
      const li = document.createElement('li')
      li.dataset.id = m.id
      li.tabIndex = -1
      li.classList.add('me-row')
      if(i === activeIndex) li.classList.add('active')
      const activeBadge = m.id===activeModel?'<span class="me-active">active</span>':''
      li.innerHTML = `
        <span class="me-col me-col-toggle ${m.enabled?'on':'off'}" data-role="toggle" aria-label="${m.enabled?'enabled':'disabled'}">${m.enabled? '●':'○'}</span>
        <span class="me-col me-col-name">${m.id} ${activeBadge}</span>
        <span class="me-col me-col-metrics">${fmt(m.contextWindow)}/${fmt(m.tpm)} · r${m.rpm} · d${fmt(m.tpd)}</span>`
      ul.appendChild(li)
    })
  }
  function fmt(n){ return Math.round(n/1000) }
  function toggle(id){
    const preserveId = id
    toggleModelEnabled(id)
    if(!listModels().find(m=>m.id===getActiveModel())?.enabled){
      const firstEnabled = listModels().find(m=>m.enabled)
      if(firstEnabled) setActiveModel(firstEnabled.id)
    }
    render(preserveId)
  }
  render()

  ul.addEventListener('click', e=>{ const li = e.target.closest('li'); if(!li) return; activeIndex = Array.from(ul.children).indexOf(li); toggle(li.dataset.id) })
  window.addEventListener('keydown', keyHandler, true)
  const modal = openModal({ modeManager: window.__modeManager, root: backdrop, closeKeys:[], restoreMode:true, preferredFocus:()=> ul.querySelector('li.active') || ul })
  function keyHandler(e){
    // Intercept navigation keys so they never reach underlying app
  const handledKeys = ['Escape',' ','Enter','j','k','ArrowDown','ArrowUp']
    if(handledKeys.includes(e.key)){
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }
  if(e.key==='Escape'){ close(); return }
  if(e.key==='Enter'){ close(); return }
  if(e.key===' '){ const cur = models[activeIndex]; if(cur){ toggle(cur.id) } return }
    if(e.key==='j' || e.key==='ArrowDown'){ move(1); return }
    if(e.key==='k' || e.key==='ArrowUp'){ move(-1); return }
  }
  function move(delta){
    const prev = models[activeIndex] && models[activeIndex].id
    activeIndex = Math.min(models.length-1, Math.max(0, activeIndex + delta))
    if(models[activeIndex] && models[activeIndex].id !== prev){
      // Just update classes
      const lis = ul.querySelectorAll('li')
      lis.forEach((li,i)=> li.classList.toggle('active', i===activeIndex))
    }
  }
  render()
  function close(){ window.removeEventListener('keydown', keyHandler, true); modal.close('manual'); onClose && onClose() }
}
