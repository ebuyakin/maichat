// Lightweight model selector overlay (Ctrl+M)
import { listModels, getActiveModel, setActiveModel } from '../models/modelCatalog.js'
import { createFocusTrap } from './focusTrap.js'

export function openModelSelector({ onClose }){
  const models = listModels().filter(m=> m.enabled)
  const backdrop = document.createElement('div')
  backdrop.className = 'overlay-backdrop centered'
  const panel = document.createElement('div')
  panel.className = 'overlay-panel compact'
  panel.style.minWidth = '340px'
  panel.innerHTML = `<header>Select Model</header><div class="list"><ul tabindex="0"></ul></div><footer><input type="text" placeholder="type to filter" class="std-input" data-role="filter" /></footer>`
  const ul = panel.querySelector('ul')
  const filterInput = panel.querySelector('[data-role=filter]')
  backdrop.appendChild(panel)
  document.body.appendChild(backdrop)
  let items = models
  let activeIndex = Math.max(0, items.findIndex(m=> m.id === getActiveModel()))
  function render(){
    ul.innerHTML = ''
    items.forEach((m,i)=>{
      const li = document.createElement('li')
      li.textContent = `${m.id} · ${formatCW(m.contextWindow)}`
      li.dataset.id = m.id
      if(i===activeIndex) li.classList.add('active')
      ul.appendChild(li)
    })
  }
  function formatCW(n){ if(n>=1000) return (n/1000)+'k'; return String(n) }
  function applyFilter(){
    const q = filterInput.value.trim().toLowerCase()
    items = models.filter(m=> !q || m.id.toLowerCase().includes(q))
    if(activeIndex >= items.length) activeIndex = items.length-1
    if(activeIndex < 0) activeIndex = 0
    render()
  }
  render()
  filterInput.addEventListener('input', applyFilter)
  panel.addEventListener('click', e=>{
    const li = e.target.closest('li'); if(!li) return
    setActiveModel(li.dataset.id)
    close()
  })
  window.addEventListener('keydown', keyHandler, true)
  const trap = createFocusTrap(backdrop, ()=> filterInput)
  function keyHandler(e){
    const handled = ['Escape','Enter','j','k','ArrowDown','ArrowUp']
    if(handled.includes(e.key)){
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    }
    if(e.key==='Escape'){ close(); return }
    if(e.key==='Enter'){ const cur = items[activeIndex]; if(cur){ setActiveModel(cur.id); close() } return }
    if(e.key==='j' || e.key==='ArrowDown'){ if(activeIndex < items.length-1){ activeIndex++; render() } return }
    if(e.key==='k' || e.key==='ArrowUp'){ if(activeIndex>0){ activeIndex--; render() } return }
  }
  filterInput.focus()
  function close(){ window.removeEventListener('keydown', keyHandler, true); trap.release(); backdrop.remove(); onClose && onClose() }
}
