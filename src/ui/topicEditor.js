// Topic Editor Overlay - full CRUD + move
import { createFocusTrap } from './focusTrap.js'
// Keyboard:
//  j/k navigate, h collapse/go parent, l expand/first child
//  n new child, r rename, d delete, M mark, P place under current, Shift+P place at root
//  Enter selects (optional callback), Esc cancel / exit edit

export function openTopicEditor({ store, onSelect, onClose }) {
  let filter = ''
  let flat = [] // visible nodes { topic, depth }
  let activeIndex = 0
  let expanded = new Set() // topicIds expanded
  let markedTopicId = null
  let editing = null // { mode:'create'|'rename', topicId, inputEl }
  let warningTimeout = null
  let deleteConfirmId = null // topic id waiting for y/n
  let inTreeFocus = false // start with search focus
  const previousActive = document.activeElement // fallback; focusTrap will restore

  // expand all ancestors of existing topics initially (shallow: root children)
  for (const id of (store.children.get(null) || [])) expanded.add(id)

  const backdrop = document.createElement('div')
  backdrop.className = 'topic-editor-backdrop'
  backdrop.innerHTML = `\n    <div class="topic-editor">\n      <div class="te-header">Topic Editor – Shift+J focus tree · Esc (tree→search / search→close) · j/k nav · h/l collapse/expand · n new · r rename · d delete (confirm) · m mark · p paste</div>\n      <input type="text" class="te-search" placeholder="Search (name / path substring)"/>\n      <div class="te-tree" role="tree" tabindex="0"></div>\n      <div class="te-warning" aria-live="polite"></div>\n    </div>`
  const searchInput = backdrop.querySelector('.te-search')
  const treeEl = backdrop.querySelector('.te-tree')
  const warningEl = backdrop.querySelector('.te-warning')

  function showWarning(msg) {
    warningEl.textContent = msg
    warningEl.classList.add('visible')
    if (warningTimeout) clearTimeout(warningTimeout)
    warningTimeout = setTimeout(() => { warningEl.textContent=''; warningEl.classList.remove('visible') }, 2600)
  }

  function topicPathNames(id) {
    const names = []
    let cur = store.topics.get(id)
    while (cur) { names.push(cur.name); cur = cur.parentId ? store.topics.get(cur.parentId) : null }
    return names.reverse().join(' > ')
  }

  function buildFlat() {
    flat = []
    const lowerFilter = filter.toLowerCase()
    const match = (t)=> !lowerFilter || t.name.toLowerCase().includes(lowerFilter) || topicPathNames(t.id).toLowerCase().includes(lowerFilter)

    // Determine which nodes should be force-expanded due to filter matches under them
    const forceExpand = new Set()
    if (lowerFilter) {
      for (const t of store.topics.values()) {
        if (match(t)) {
          // add ancestors
            let cur = t.parentId ? store.topics.get(t.parentId) : null
            while (cur) { forceExpand.add(cur.id); cur = cur.parentId ? store.topics.get(cur.parentId) : null }
        }
      }
    }

    function dfs(id, depth) {
      const t = store.topics.get(id); if(!t) return
      const m = match(t)
      // include if match OR any descendant matches (descendant match => id in forceExpand set or recursively discovered)
      let include = m
      let hasDescendantMatch = false
      if (!m) {
        // check descendants only if needed
        for (const cid of (store.children.get(id)||[])) {
          if (descendantHasMatch(cid)) { hasDescendantMatch = true; break }
        }
        include = hasDescendantMatch
      }
      if (!include) return
      flat.push({ topic: t, depth })
      const isExpanded = expanded.has(id) || forceExpand.has(id)
      if (isExpanded) {
        for (const cid of (store.children.get(id)||[])) dfs(cid, depth+1)
      }
    }
    const cacheDescMatch = new Map()
    function descendantHasMatch(id) {
      if (cacheDescMatch.has(id)) return cacheDescMatch.get(id)
      const t = store.topics.get(id); if(!t) return false
      if (match(t)) { cacheDescMatch.set(id,true); return true }
      for (const cid of (store.children.get(id)||[])) {
        if (descendantHasMatch(cid)) { cacheDescMatch.set(id,true); return true }
      }
      cacheDescMatch.set(id,false); return false
    }
    // Start at roots
    for (const rid of (store.children.get(null)||[])) dfs(rid, 0)
  }

  function render() {
    buildFlat()
    if (activeIndex >= flat.length) activeIndex = flat.length? flat.length-1:0
    treeEl.innerHTML = flat.map((row,i)=> renderRow(row, i===activeIndex)).join('') + (editing && editing.mode==='create' ? renderCreateRow(): '')
    if (editing && editing.inputEl) {
      // reattach input focus
      const el = treeEl.querySelector('input.te-edit')
      if (el) { editing.inputEl = el; setTimeout(()=>el.focus(),0) }
    }
  }

  function renderRow({ topic, depth }, active) {
    const hasChildren = (store.children.get(topic.id)||[]).size > 0
    const isExpanded = expanded.has(topic.id)
    const marker = (hasChildren? (isExpanded? '▾':'▸') : '·')
    const isMarked = topic.id === markedTopicId
    const marked = isMarked ? '▶ ' : ''
    const cls = `te-row${active?' active':''}${isMarked?' marked':''}`
    if (editing && editing.mode==='rename' && editing.topicId===topic.id) {
      return `<div class="${cls}" data-id="${topic.id}" style="padding-left:${depth*16}px">${marker} ${marked}<input class="te-edit" type="text" value="${escapeHtml(topic.name)}" /></div>`
    }
    return `<div class="${cls}" data-id="${topic.id}" style="padding-left:${depth*16}px">${marker} ${marked}${escapeHtml(topic.name)} <span class="te-counts">(${topic.directCount||0}/${topic.totalCount||0})</span></div>`
  }

  function renderCreateRow() {
    // appended after current children; indent one deeper than active node when creating child
    const baseDepth = flat[activeIndex] ? flat[activeIndex].depth : 0
    return `<div class="te-row creating" style="padding-left:${(baseDepth+1)*16}px"> + <input class="te-edit" type="text" placeholder="New topic name" /></div>`
  }

  function escapeHtml(s){ return s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])) }

  function currentTopic() { return flat[activeIndex]?.topic || null }

  function ensureVisible(topicId) {
    // Expand ancestors
    let cur = store.topics.get(topicId)
    while (cur && cur.parentId) { expanded.add(cur.parentId); cur = store.topics.get(cur.parentId) }
  }

  function createChild() {
    if (editing) return
    editing = { mode:'create', topicId: currentTopic()?.id || null, inputEl: null }
    expanded.add(editing.topicId) // ensure parent expanded
    render()
    const input = treeEl.querySelector('input.te-edit'); if(input){ editing.inputEl = input; input.focus() }
  }

  function finishCreate(commit) {
    if (!editing || editing.mode!=='create') return
    const val = editing.inputEl?.value.trim()
    const parentId = editing.topicId
    if (commit) {
      if (!val) { showWarning('Name required'); return }
      // sibling uniqueness
      if (siblingNameExists(parentId, val)) { showWarning('Duplicate sibling name'); return }
      const id = store.addTopic(val, parentId)
      ensureVisible(id)
      editing = null
      filter = ''
      // move focus to new topic
      buildFlat(); activeIndex = flat.findIndex(r=>r.topic.id===id)
      render()
    } else {
      editing = null; render()
    }
  }

  function startRename() {
    const t = currentTopic(); if(!t) return
    if (editing) return
    editing = { mode:'rename', topicId: t.id, inputEl: null }
    render()
    const input = treeEl.querySelector('input.te-edit'); if(input){ editing.inputEl = input; input.select() }
  }

  function finishRename(commit) {
    if (!editing || editing.mode!=='rename') return
    const t = store.topics.get(editing.topicId)
    if (!t) { editing=null; render(); return }
    const newName = editing.inputEl?.value.trim()
    if (commit) {
      if(!newName){ showWarning('Name required'); return }
      if (siblingNameExists(t.parentId, newName, t.id)) { showWarning('Duplicate sibling name'); return }
      if (newName !== t.name) store.renameTopic(t.id, newName)
    }
    editing = null; render()
  }

  function siblingNameExists(parentId, name, excludeId) {
    for (const cid of (store.children.get(parentId)||[])) {
      const ct = store.topics.get(cid); if(!ct) continue
      if (excludeId && cid === excludeId) continue
      if (ct.name.toLowerCase() === name.toLowerCase()) return true
    }
    return false
  }

  function attemptDelete() {
    const t = currentTopic(); if(!t) return
    if (t.id === store.rootTopicId) { showWarning('Cannot delete root'); return }
    deleteConfirmId = t.id
    showWarning(`Delete "${t.name}"? y/n`)
  }

  function executeDelete(id){
    const t = store.topics.get(id); if(!t) return
    const ok = store.deleteTopic(id)
    if(!ok){ showWarning('Delete blocked (children or messages)'); return }
    deleteConfirmId = null
    buildFlat(); if(activeIndex>=flat.length) activeIndex = Math.max(0, flat.length-1)
    render()
  }

  function markTopic() {
    const t = currentTopic(); if(!t) return
    if(t.id === store.rootTopicId){ showWarning('Cannot mark root'); return }
    markedTopicId = t.id
    render()
  }

  function placeTopic() {
    if (!markedTopicId) { showWarning('Nothing marked'); return }
    const movingId = markedTopicId
    const target = currentTopic(); if(!target){ showWarning('No target'); return }
    if(target.id === movingId){ showWarning('Cannot paste into itself'); return }
    const ok = store.moveTopic(movingId, target.id)
    if(!ok) { showWarning('Move blocked (cycle/root)'); return }
    ensureVisible(movingId)
    markedTopicId = null
    buildFlat(); activeIndex = flat.findIndex(r=>r.topic.id===movingId); if(activeIndex<0) activeIndex=0
    render()
  }

  function selectCurrent() {
    const t = currentTopic(); if(!t) return
    if (onSelect) onSelect(t.id)
    teardown()
  }

  function collapseOrParent() {
    const row = flat[activeIndex]; if(!row) return
    const id = row.topic.id
    if (expanded.has(id)) { expanded.delete(id); render(); return }
    // move to parent
    const parentId = row.topic.parentId
    if (!parentId) return
    // find parent index
    const pIndex = flat.findIndex(r=>r.topic.id===parentId)
    if (pIndex>=0) { activeIndex = pIndex; render() }
  }

  function expandOrChild() {
    const row = flat[activeIndex]; if(!row) return
    const id = row.topic.id
    const children = store.children.get(id)
    if (!children || children.size===0) return
    if (!expanded.has(id)) { expanded.add(id); render(); return }
    // move to first child
    buildFlat()
    const firstChildId = [...children][0]
    const idx = flat.findIndex(r=>r.topic.id===firstChildId)
    if (idx>=0) { activeIndex = idx; render() }
  }

  function onKey(e) {
    // Inline edit
    if (editing) {
      if (e.key==='Escape'){ e.preventDefault(); if(editing.mode==='create') finishCreate(false); else finishRename(false); setTimeout(()=>{ inTreeFocus?treeEl.focus():searchInput.focus() },0); return }
      if (e.key==='Enter'){ e.preventDefault(); if(editing.mode==='create') finishCreate(true); else finishRename(true); setTimeout(()=>{ inTreeFocus?treeEl.focus():searchInput.focus() },0); return }
      return
    }
    // Delete confirmation
    if(deleteConfirmId){
      if(e.key==='y' || e.key==='Y'){ e.preventDefault(); executeDelete(deleteConfirmId); return }
      if(e.key==='n' || e.key==='N' || e.key==='Escape'){ e.preventDefault(); deleteConfirmId=null; showWarning('Cancelled'); return }
    }
    // Search focus layer
    if(!inTreeFocus){
      if(e.key==='Escape'){ e.preventDefault(); teardown(); return }
      if(e.key==='J' && e.shiftKey){ e.preventDefault(); inTreeFocus=true; treeEl.focus(); return }
      return
    }
    // Tree focus layer
    switch(e.key){
      case 'Escape': e.preventDefault(); inTreeFocus=false; searchInput.focus(); return
      case 'Enter': e.preventDefault(); selectCurrent(); return
      case 'j': case 'ArrowDown': e.preventDefault(); activeIndex = Math.min(flat.length-1, activeIndex+1); render(); return
      case 'k': case 'ArrowUp': e.preventDefault(); activeIndex = Math.max(0, activeIndex-1); render(); return
      case 'h': case 'ArrowLeft': e.preventDefault(); collapseOrParent(); return
      case 'l': case 'ArrowRight': e.preventDefault(); expandOrChild(); return
      case 'n': e.preventDefault(); createChild(); return
      case 'r': e.preventDefault(); startRename(); return
      case 'd': e.preventDefault(); attemptDelete(); return
  case 'm': e.preventDefault(); markTopic(); return
  case 'p': e.preventDefault(); placeTopic(); return
      default: break
    }
  }

  function onStoreEvent(){ render() }
  const offAdd = store.on('topic:add', onStoreEvent)
  const offUpd = store.on('topic:update', onStoreEvent)
  const offDel = store.on('topic:delete', onStoreEvent)
  const offMove = store.on('topic:move', onStoreEvent)
  const offCounts = store.on('topic:counts', onStoreEvent)

  const focusTrap = createFocusTrap(backdrop, ()=> inTreeFocus ? treeEl : searchInput)
  function teardown() {
    offAdd(); offUpd(); offDel(); offMove(); offCounts()
    backdrop.removeEventListener('keydown', onKey)
    backdrop.remove()
    focusTrap.release()
    if (onClose) onClose()
  }

  searchInput.addEventListener('input', ()=>{ filter = searchInput.value.trim(); buildFlat(); activeIndex = 0; render() })
  backdrop.addEventListener('keydown', onKey)

  document.body.appendChild(backdrop)
  searchInput.focus()
  buildFlat(); render()

  return { destroy: teardown }
}
