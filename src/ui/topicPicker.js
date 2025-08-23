// Quick Topic Picker (Selection Mode)
// Responsibilities: render filtered tree subset, keyboard nav (j/k), selection callback, focus isolation.
import { createFocusTrap } from './focusTrap.js'

export function createTopicPicker({ store, onSelect, onCancel }){
  let filter = ''
  let flatVisible = []
  let activeIndex = 0
  let rootEl = document.createElement('div')
  rootEl.className = 'topic-picker-backdrop'
  rootEl.innerHTML = `<div class="topic-picker"><input type="text" class="tp-search" placeholder="Search topics..."/><div class="tp-tree" role="tree"></div></div>`
  const searchInput = rootEl.querySelector('.tp-search')
  const treeEl = rootEl.querySelector('.tp-tree')
  const previousActive = document.activeElement
  let inTreeFocus = false // start in search

  function buildFlat(){
    // BFS tree build with filter
    flatVisible = []
    const match = (t)=> !filter || t.name.toLowerCase().includes(filter)
    const stack = [...(store.children.get(null)||[])].map(id=>store.topics.get(id))
    while(stack.length){
      const t = stack.shift()
      if(!t) continue
      const include = match(t) || hasMatchingDesc(t)
      if(include) flatVisible.push(t)
      // push children always so descendants considered for hasMatchingDesc
      const kids = Array.from(store.children.get(t.id)||[]).map(id=>store.topics.get(id))
      for(const k of kids) stack.push(k)
    }
  }
  function hasMatchingDesc(topic){
    const kids = store.children.get(topic.id); if(!kids) return false
    for(const id of kids){
      const kt = store.topics.get(id)
      if(!kt) continue
      if(kt.name.toLowerCase().includes(filter)) return true
      if(hasMatchingDesc(kt)) return true
    }
    return false
  }
  function render(){
    buildFlat()
    if(activeIndex >= flatVisible.length) activeIndex = flatVisible.length? flatVisible.length-1:0
    treeEl.innerHTML = flatVisible.map((t,i)=> `<div class="tp-row${i===activeIndex?' active':''}" data-id="${t.id}">${escapeHtml(t.name)} <span class="tp-counts">(${t.directCount||0}/${t.totalCount||0})</span></div>`).join('')
  }
  function escapeHtml(s){ return s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])) }

  function attachKeyHandler(){
    function onKey(e){
      if(!inTreeFocus){
        if(e.key==='Escape'){ e.preventDefault(); teardown(); onCancel && onCancel(); return }
        if(e.key==='J' && e.shiftKey){ e.preventDefault(); inTreeFocus=true; treeEl.focus(); return }
        return
      }
      if(e.key==='Escape'){ e.preventDefault(); inTreeFocus=false; searchInput.focus(); return }
      if(e.key==='Enter'){ e.preventDefault(); const t = flatVisible[activeIndex]; if(t){ teardown(); onSelect && onSelect(t.id) } return }
      if(e.key==='j' || e.key==='ArrowDown'){ e.preventDefault(); activeIndex = Math.min(flatVisible.length-1, activeIndex+1); render(); return }
      if(e.key==='k' || e.key==='ArrowUp'){ e.preventDefault(); activeIndex = Math.max(0, activeIndex-1); render(); return }
    }
    rootEl.addEventListener('keydown', onKey)
  }

  searchInput.addEventListener('input', ()=>{ filter = searchInput.value.trim().toLowerCase(); render() })

  const focusTrap = createFocusTrap(rootEl, ()=> inTreeFocus ? treeEl : searchInput)
  function teardown(){
    rootEl.remove()
    focusTrap.release()
    if(previousActive && previousActive.focus){ try { previousActive.focus() } catch(_){} }
  }

  attachKeyHandler()
  document.body.appendChild(rootEl)
  searchInput.focus()
  render()
  return { destroy: teardown }
}
