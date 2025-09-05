// Quick Topic Picker (Selection Mode)
// Responsibilities: render filtered tree subset, keyboard nav (j/k), selection callback, focus isolation.
import { openModal } from '../shared/openModal.js'

export function createTopicPicker({ store, modeManager, onSelect, onCancel }){
  let filter = ''
  let flat = [] // visible rows { topic, depth }
  let activeIndex = 0
  const expanded = new Set() // expanded topic ids
  const previousActive = document.activeElement
  let inTreeFocus = false

  // Expand initial top-level nodes (children of hidden root)
  const rootId = store.rootTopicId
  for(const id of (store.children.get(rootId)||[])) expanded.add(id)

  const rootEl = document.createElement('div')
  rootEl.className = 'topic-picker-backdrop'
  rootEl.innerHTML = `<div class="topic-picker"><input type="text" class="tp-search" placeholder="Search (Shift+J to tree)"/><div class="tp-tree" role="tree" tabindex="0"></div></div>`
  const searchInput = rootEl.querySelector('.tp-search')
  const treeEl = rootEl.querySelector('.tp-tree')

  function escapeHtml(s){ return s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])) }

  function topicPathNames(id){
    const parts = []
    let cur = store.topics.get(id)
  while(cur){ parts.push(cur.name); cur = cur.parentId ? store.topics.get(cur.parentId) : null }
  const full = parts.reverse()
  if(full[0]==='Root') full.shift()
  return full.join(' > ')
  }

  function buildFlat(){
    flat = []
    const lower = filter.toLowerCase()
    const match = (t)=> !lower || t.name.toLowerCase().includes(lower) || topicPathNames(t.id).toLowerCase().includes(lower)
    // Determine force-expanded ancestors of matches
    const forceExpand = new Set()
    if(lower){
      for(const t of store.topics.values()){
        if(match(t)){
          let cur = t.parentId ? store.topics.get(t.parentId) : null
          while(cur){ forceExpand.add(cur.id); cur = cur.parentId ? store.topics.get(cur.parentId) : null }
        }
      }
    }
    function dfs(id, depth){
      const t = store.topics.get(id); if(!t) return
      const m = match(t)
      let include = m
      if(!m){
        for(const cid of (store.children.get(id)||[])){
          if(descendantHasMatch(cid)){ include = true; break }
        }
      }
      if(!include) return
      flat.push({ topic:t, depth })
      const isExp = expanded.has(id) || forceExpand.has(id)
      if(isExp){
        for(const cid of (store.children.get(id)||[])) dfs(cid, depth+1)
      }
    }
    const descCache = new Map()
    function descendantHasMatch(id){
      if(descCache.has(id)) return descCache.get(id)
      const t = store.topics.get(id); if(!t){ descCache.set(id,false); return false }
      if(match(t)){ descCache.set(id,true); return true }
      for(const cid of (store.children.get(id)||[])) if(descendantHasMatch(cid)){ descCache.set(id,true); return true }
      descCache.set(id,false); return false
    }
  // Only show children of hidden root as top-level
  for(const rid of (store.children.get(rootId)||[])) dfs(rid,0)
  }

  function render(){
    buildFlat()
    if(activeIndex >= flat.length) activeIndex = flat.length? flat.length-1:0
    treeEl.innerHTML = flat.map((row,i)=> renderRow(row, i===activeIndex)).join('')
  }

  function renderRow({ topic, depth }, active){
    const hasChildren = (store.children.get(topic.id)||[]).size>0
    const isExpanded = expanded.has(topic.id)
    const marker = hasChildren ? (isExpanded? '▾':'▸') : '·'
    const cls = `tp-row${active?' active':''}`
    return `<div class="${cls}" data-id="${topic.id}" style="padding-left:${depth*16}px">${marker} ${escapeHtml(topic.name)} <span class="tp-counts">(${topic.directCount||0}/${topic.totalCount||0})</span></div>`
  }

  function toggleExpandOrDescend(){
    const row = flat[activeIndex]; if(!row) return
    const id = row.topic.id
    const kids = store.children.get(id)
    if(!kids || kids.size===0) return
    if(!expanded.has(id)){ expanded.add(id); render(); return }
    // move to first child
    buildFlat()
    const firstChildId = [...kids][0]
    const idx = flat.findIndex(r=>r.topic.id===firstChildId)
    if(idx>=0){ activeIndex = idx; render() }
  }
  function collapseOrParent(){
    const row = flat[activeIndex]; if(!row) return
    const id = row.topic.id
    if(expanded.has(id)){ expanded.delete(id); render(); return }
    const parentId = row.topic.parentId; if(!parentId) return
    buildFlat()
    const pIdx = flat.findIndex(r=>r.topic.id===parentId)
    if(pIdx>=0){ activeIndex = pIdx; render() }
  }

  function swallow(e){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation() }
  function onKey(e){
    if(!inTreeFocus){
      if(e.key==='Escape'){ swallow(e); teardown(); onCancel && onCancel(); return }
      if(e.key==='J' && e.shiftKey){ swallow(e); inTreeFocus=true; treeEl.focus(); return }
      return
    }
    switch(e.key){
      case 'Escape': swallow(e); inTreeFocus=false; searchInput.focus(); return
      case 'Enter': swallow(e); const row = flat[activeIndex]; if(row){ teardown(); onSelect && onSelect(row.topic.id) } return
      case 'j': case 'ArrowDown': swallow(e); activeIndex=Math.min(flat.length-1, activeIndex+1); render(); return
      case 'k': case 'ArrowUp': swallow(e); activeIndex=Math.max(0, activeIndex-1); render(); return
      case 'l': case 'ArrowRight': swallow(e); toggleExpandOrDescend(); return
      case 'h': case 'ArrowLeft': swallow(e); collapseOrParent(); return
    }
  }

  searchInput.addEventListener('input', ()=>{ filter = searchInput.value.trim(); activeIndex=0; render() })
  rootEl.addEventListener('keydown', onKey)

  const modal = openModal({ modeManager, root: rootEl, closeKeys:[], restoreMode:true })
  function teardown(){ modal.close('manual'); if(previousActive && previousActive.focus){ try { previousActive.focus() } catch(_){} } }

  document.body.appendChild(rootEl)
  searchInput.focus()
  render()
  return { destroy: teardown }
}
