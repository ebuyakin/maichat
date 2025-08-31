// Simple Model Editor (Ctrl+Shift+M) for enable/disable only
import { listModels, toggleModelEnabled, getActiveModel, setActiveModel } from '../models/modelCatalog.js'
import { createFocusTrap } from './focusTrap.js'

export function openModelEditor({ onClose }){
  const backdrop = document.createElement('div')
  backdrop.className = 'overlay-backdrop centered'
  const panel = document.createElement('div')
  panel.className = 'overlay-panel compact'
  panel.style.minWidth = '420px'
  panel.innerHTML = `<header>Models</header><div class="list"><ul tabindex="0" class="me-list"></ul></div><footer><span style="font-size:11px;color:#888;">j/k move · Space toggle · Enter/Esc close</span></footer>`
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
      li.style.display='flex'; li.style.justifyContent='space-between'; li.style.gap='12px'
      if(i === activeIndex) li.classList.add('active')
      li.innerHTML = `<span>${m.id} ${m.id===activeModel?'<strong style=\"color:#8ab4ff\">(active)</strong>':''}</span><span style="font-size:11px; color:${m.enabled?'#6fa8ff':'#666'}">${m.enabled? 'enabled':'disabled'} · ${formatCW(m.contextWindow)}</span>`
      ul.appendChild(li)
    })
  }
  function formatCW(n){ if(n>=1000) return (n/1000)+'k'; return String(n) }
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
  const trap = createFocusTrap(backdrop, ()=> ul.querySelector('li.active') || ul)
  function keyHandler(e){
    // Intercept navigation keys so they never reach underlying app
  const handledKeys = ['Escape',' ','Enter','j','k','ArrowDown','ArrowUp']
    if(handledKeys.includes(e.key)){
      e.preventDefault()
      e.stopPropagation()
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
  function close(){ window.removeEventListener('keydown', keyHandler, true); trap.release(); backdrop.remove(); onClose && onClose() }
}
