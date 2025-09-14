// topicEditor.js moved from ui/topicEditor.js (Phase 6.4 Topics)
import { openModal } from '../../shared/openModal.js'

export function openTopicEditor({ store, onSelect, onClose }) {
  let filter = ''
  let flat = []
  let activeIndex = 0
  let expanded = new Set()
  let markedTopicId = null
  let editing = null
  let warningTimeout = null
  let deleteConfirmId = null
  let inTreeFocus = false
  const previousActive = document.activeElement

  const rootId = store.rootTopicId
  for (const id of (store.children.get(null) || [])) {
    if (id === rootId) {
      for (const cid of (store.children.get(rootId) || [])) expanded.add(cid)
    } else {
      expanded.add(id)
    }
  }

  const backdrop = document.createElement('div')
  backdrop.className = 'topic-editor-backdrop'
  backdrop.innerHTML = `\n    <div class="topic-editor">\n      <div class="te-header">\n        <div><strong>Topic Editor</strong></div>\n        <div>Ctrl+J - focus on topic tree;</div>\n        <div>j/k - move down/up the tree, h/l - collapse/expand, n - new child topic, N - new root topic</div>\n        <div>r - rename topic, d - delete topic, m - mark topic, p - paste topic.</div>\n        <div style="margin-top:4px;">Edit focused tree parameters: Ctrl+E - system message, Ctrl+T - temperature, Ctrl+O - max response length.</div>\n        <div>Ctrl+S - Save changes, Esc - Cancel+Close.</div>\n      </div>\n      <div class="te-body">\n        <div class="te-left">\n          <input type="text" class="te-search" placeholder="Search (name / path substring)"/>\n          <div class="te-tree" role="tree" tabindex="0"></div>\n        </div>\n        <div class="te-details" data-pane="details">\n          <div class="te-path"></div>\n          <div class="te-field">\n            <label>System message</label>\n            <textarea class="te-textarea" spellcheck="false" placeholder="You are MaiChat Assistant for this topic. Be concise and ask clarifying questions when needed."></textarea>\n            <div class="te-actions">\n              <button class="te-btn" data-act="reset">Reset to template (Ctrl+R)</button>\n              <button class="te-btn" data-act="insert-path">Insert topic path (Ctrl+I)</button>\n            </div>\n          </div>\n          <div class="te-grid">\n            <div class="te-field">\n              <label>Temperature (0–2)</label>\n              <input type="number" step="0.1" min="0" max="2" class="te-input" data-field="temperature"/>\n              <div class="te-hint">Higher = more creative.</div>\n            </div>\n            <div class="te-field">\n              <label>Max output tokens</label>\n              <input type="number" min="1" class="te-input" data-field="maxTokens"/>\n              <div class="te-hint">Leave empty for default output size.</div>\n            </div>\n          </div>\n          <div class="te-primary-actions">\n            <button class="te-btn te-save" data-act="save">Save (Ctrl+S)</button>\n            <button class="te-btn te-cancel" data-act="cancel">Cancel (Esc)</button>\n          </div>\n          <div class="te-status"><span class="te-dirty" hidden>Unsaved changes</span><span class="te-saved"></span></div>\n        </div>\n      </div>\n      <div class="te-warning" aria-live="polite"></div>\n    </div>`
  const searchInput = backdrop.querySelector('.te-search')
  const treeEl = backdrop.querySelector('.te-tree')
  const detailsEl = backdrop.querySelector('.te-details')
  const pathEl = backdrop.querySelector('.te-path')
  const sysTextarea = backdrop.querySelector('.te-textarea')
  const tempInput = backdrop.querySelector('input[data-field="temperature"]')
  const maxTokInput = backdrop.querySelector('input[data-field="maxTokens"]')
  const dirtyEl = backdrop.querySelector('.te-dirty')
  const savedEl = backdrop.querySelector('.te-saved')
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
    const full = names.reverse()
    if (full[0] === 'Root') full.shift()
    return full.join(' > ')
  }
  function buildFlat() {
    flat = []
    const lowerFilter = filter.toLowerCase()
    const match = (t)=> !lowerFilter || t.name.toLowerCase().includes(lowerFilter) || topicPathNames(t.id).toLowerCase().includes(lowerFilter)
    const forceExpand = new Set()
    if (lowerFilter) {
      for (const t of store.topics.values()) {
        if (match(t)) {
          let cur = t.parentId ? store.topics.get(t.parentId) : null
          while (cur) { forceExpand.add(cur.id); cur = cur.parentId ? store.topics.get(cur.parentId) : null }
        }
      }
    }
  function dfs(id, depth) {
      const t = store.topics.get(id); if(!t) return
      const m = match(t)
      let include = m
      let hasDescendantMatch = false
      if (!m) {
        for (const cid of (store.children.get(id)||[])) {
          if (descendantHasMatch(cid)) { hasDescendantMatch = true; break }
        }
        include = hasDescendantMatch
      }
      if (!include) return
      flat.push({ topic: t, depth })
      const isExpanded = expanded.has(id) || forceExpand.has(id)
      if (isExpanded) {
        const kids = Array.from((store.children.get(id)||[])).sort((a,b)=>{
          const ta = store.topics.get(a), tb = store.topics.get(b)
          return (ta?.createdAt||0) - (tb?.createdAt||0) || (ta?.name||'').localeCompare(tb?.name||'')
        })
        for (const cid of kids) dfs(cid, depth+1)
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
    // Order top-level roots deterministically by createdAt then name
    const roots = Array.from((store.children.get(null)||[])).sort((a,b)=>{
      const ta = store.topics.get(a), tb = store.topics.get(b)
      return (ta?.createdAt||0) - (tb?.createdAt||0) || (ta?.name||'').localeCompare(tb?.name||'')
    })
    for (const rid of roots) {
      if (rid === rootId) {
        const kids = Array.from((store.children.get(rootId)||[])).sort((a,b)=>{
          const ta = store.topics.get(a), tb = store.topics.get(b)
          return (ta?.createdAt||0) - (tb?.createdAt||0) || (ta?.name||'').localeCompare(tb?.name||'')
        })
        for (const cid of kids) dfs(cid, 0)
      } else {
        dfs(rid,0)
      }
    }
  }
  function render() {
    buildFlat()
    if (activeIndex >= flat.length) activeIndex = flat.length? flat.length-1:0
    treeEl.innerHTML = flat.map((row,i)=> renderRow(row, i===activeIndex)).join('') + (editing && editing.mode==='create' ? renderCreateRow(): '')
    renderDetails()
    if (editing && editing.inputEl) {
      const el = treeEl.querySelector('input.te-edit')
      if (el) { editing.inputEl = el; setTimeout(()=>el.focus(),0) }
    }
  }
  let isDirty = false
  let suppressBlurSave = false
  function setDirty(v){ isDirty = !!v; if(dirtyEl){ dirtyEl.hidden = !isDirty } }
  function currentTopic() { return flat[activeIndex]?.topic || null }
  function renderDetails(){
    const t = currentTopic()
    if(!t){ detailsEl.setAttribute('aria-disabled','true'); sysTextarea.value=''; tempInput.value=''; maxTokInput.value=''; pathEl.textContent=''; return }
    detailsEl.removeAttribute('aria-disabled')
  const path = topicPathNames(t.id)
  const name = t.name || ''
  pathEl.textContent = `Edit topic details: ${name}`
    sysTextarea.value = typeof t.systemMessage==='string' ? t.systemMessage : ''
  const rp = t.requestParams || {}
  tempInput.value = (typeof rp.temperature==='number') ? String(rp.temperature) : '0.7'
    maxTokInput.value = (typeof rp.maxOutputTokens==='number') ? String(rp.maxOutputTokens) : ''
    setDirty(false); savedEl.textContent=''
  }
  function saveDetails(){ const t=currentTopic(); if(!t) return; const patch={}
    const sm = sysTextarea.value
    patch.systemMessage = sm
    const rp = Object.assign({}, t.requestParams||{})
    const tempVal = parseFloat(tempInput.value)
    if(!Number.isNaN(tempVal)) rp.temperature = Math.max(0, Math.min(2, tempVal)); else delete rp.temperature
    const tokVal = parseInt(maxTokInput.value,10)
    if(Number.isFinite(tokVal) && tokVal>0) rp.maxOutputTokens = tokVal; else delete rp.maxOutputTokens
    patch.requestParams = rp
    store.updateTopic(t.id, patch)
    setDirty(false); savedEl.textContent = 'Saved '
    try{ setTimeout(()=>{ savedEl.textContent='' }, 1400) }catch{}
  }
  function cancelDetails(){ const t=currentTopic(); if(!t) return; suppressBlurSave = true; renderDetails(); setTimeout(()=>{ suppressBlurSave = false }, 0) }
  function resetTemplate(){ const t=currentTopic(); if(!t) return; sysTextarea.value = 'You are MaiChat Assistant for this topic. Be concise and ask clarifying questions when needed.'; setDirty(true) }
  function insertPath(){ const t=currentTopic(); if(!t) return; const ins = topicPathNames(t.id); const el = sysTextarea; const start = el.selectionStart||0; const end = el.selectionEnd||0; const v = el.value; el.value = v.slice(0,start) + ins + v.slice(end); setDirty(true) }
  function focusTemp(){ try{ tempInput?.focus() }catch{} }
  function focusMaxTok(){ try{ maxTokInput?.focus() }catch{} }
  function renderRow({ topic, depth }, active) {
    const hasChildren = (store.children.get(topic.id)||[]).size > 0
    const isExpanded = expanded.has(topic.id)
    const marker = (hasChildren? (isExpanded? '▾':'▸') : '·')
    const isMarked = topic.id === markedTopicId
    const marked = isMarked ? '▶ ' : ''
    const cls = `te-row${active?' active':''}${isMarked?' marked':''}`
    if (editing && editing.mode==='rename' && editing.topicId===topic.id) {
      return `<div class="${cls}" data-id="${topic.id}" style="padding-left:${depth*16}px"><span class="te-marker">${marker}</span> ${marked}<input class="te-edit" type="text" value="${escapeHtml(topic.name)}" /></div>`
    }
    return `<div class="${cls}" data-id="${topic.id}" style="padding-left:${depth*16}px"><span class="te-marker">${marker}</span> ${marked}${escapeHtml(topic.name)} <span class="te-counts">(${topic.directCount||0}/${topic.totalCount||0})</span></div>`
  }
  function renderCreateRow() {
    let depth
    if(editing && editing.topicId === store.rootTopicId){
      depth = 0
    } else {
      const baseDepth = flat[activeIndex] ? flat[activeIndex].depth : 0
      depth = baseDepth + 1
    }
    return `<div class="te-row creating" style="padding-left:${depth*16}px"> + <input class="te-edit" type="text" placeholder="New topic name" /></div>`
  }
  function escapeHtml(s){ return s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])) }
  function currentTopic() { return flat[activeIndex]?.topic || null }
  function ensureVisible(topicId) {
    let cur = store.topics.get(topicId)
    while (cur && cur.parentId) { expanded.add(cur.parentId); cur = store.topics.get(cur.parentId) }
  }
  function createChild() {
    if (editing) return
    editing = { mode:'create', topicId: currentTopic()?.id || null, inputEl: null }
    if(editing.topicId) expanded.add(editing.topicId)
    render()
    const input = treeEl.querySelector('input.te-edit'); if(input){ editing.inputEl = input; input.focus() }
  }
  function createTopLevel(){
    if(editing) return
    editing = { mode:'create', topicId: store.rootTopicId, inputEl: null }
    render()
    const input = treeEl.querySelector('input.te-edit'); if(input){ editing.inputEl = input; input.focus() }
  }
  function finishCreate(commit) {
    if (!editing || editing.mode!=='create') return
    const val = editing.inputEl?.value.trim()
    const parentId = editing.topicId === store.rootTopicId ? store.rootTopicId : editing.topicId
    if (commit) {
      if (!val) { showWarning('Name required'); return }
      if (siblingNameExists(parentId, val)) { showWarning('Duplicate sibling name'); return }
      const id = store.addTopic(val, parentId)
      ensureVisible(id)
      editing = null
      filter = ''
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
    const parentId = row.topic.parentId
    if (!parentId) return
    const pIndex = flat.findIndex(r=>r.topic.id===parentId)
    if (pIndex>=0) { activeIndex = pIndex; render() }
  }
  function expandOrChild() {
    const row = flat[activeIndex]; if(!row) return
    const id = row.topic.id
    const children = store.children.get(id)
    if (!children || children.size===0) return
    if (!expanded.has(id)) { expanded.add(id); render(); return }
    buildFlat()
    const firstChildId = [...children][0]
    const idx = flat.findIndex(r=>r.topic.id===firstChildId)
    if (idx>=0) { activeIndex = idx; render() }
  }
  function onKey(e) {
    if (editing) {
      if (e.key==='Escape'){ e.preventDefault(); if(editing.mode==='create') finishCreate(false); else finishRename(false); setTimeout(()=>{ inTreeFocus?treeEl.focus():searchInput.focus() },0); return }
      if (e.key==='Enter'){ e.preventDefault(); if(editing.mode==='create') finishCreate(true); else finishRename(true); setTimeout(()=>{ inTreeFocus?treeEl.focus():searchInput.focus() },0); return }
      return
    }
    if(deleteConfirmId){
      if(e.key==='y' || e.key==='Y'){ e.preventDefault(); executeDelete(deleteConfirmId); return }
      if(e.key==='n' || e.key==='N' || e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); deleteConfirmId=null; showWarning('Cancelled'); return }
    }
    if(!inTreeFocus){
      // Only allow pane toggle into the tree; all other keys should type in inputs/textarea
      if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); teardown(); return }
      if(e.ctrlKey && (e.key==='j' || e.key==='J')){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); inTreeFocus=true; treeEl.focus(); return }
      return
    }
    switch(e.key){
      case 'Escape': e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); inTreeFocus=false; searchInput.focus(); return
      case 'Enter': e.preventDefault(); selectCurrent(); return
      case 'j': case 'ArrowDown': e.preventDefault(); activeIndex = Math.min(flat.length-1, activeIndex+1); render(); return
      case 'k': case 'ArrowUp': e.preventDefault(); activeIndex = Math.max(0, activeIndex-1); render(); return
      case 'h': case 'ArrowLeft': e.preventDefault(); collapseOrParent(); return
      case 'l': case 'ArrowRight': e.preventDefault(); expandOrChild(); return
      case 'n': e.preventDefault(); createChild(); return
      case 'N': e.preventDefault(); createTopLevel(); return
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
  const modal = openModal({ modeManager: store.modeManager || window.__modeManager, root: backdrop, closeKeys:[], restoreMode:true })
  function teardown() {
    offAdd(); offUpd(); offDel(); offMove(); offCounts()
    backdrop.removeEventListener('keydown', onKey)
    modal.close('manual')
    if (onClose) onClose()
  }
  searchInput.addEventListener('input', ()=>{ filter = searchInput.value.trim(); buildFlat(); activeIndex = 0; render() })
  backdrop.addEventListener('keydown', onKey)
  backdrop.addEventListener('keydown', (e)=>{ 
    const inDetails = detailsEl.contains(e.target)
  if(e.ctrlKey && (e.key==='e'||e.key==='E')){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); detailsEl.querySelector('.te-textarea')?.focus(); inTreeFocus=false; return }
  if(e.ctrlKey && (e.key==='t'||e.key==='T')){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); focusTemp(); inTreeFocus=false; return }
  if(e.ctrlKey && (e.key==='o'||e.key==='O')){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); focusMaxTok(); inTreeFocus=false; return }
  if(e.ctrlKey && (e.key==='s'||e.key==='S')){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); saveDetails(); return }
  if(e.ctrlKey && (e.key==='r'||e.key==='R')){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); resetTemplate(); return }
  if(e.ctrlKey && (e.key==='i'||e.key==='I')){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); insertPath(); return }
    if(inDetails && e.key==='Escape'){
      if(isDirty){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); cancelDetails(); return }
    }
  }, true)
  // Keep inTreeFocus synced with actual focus target
  backdrop.addEventListener('focusin', (e)=>{ inTreeFocus = treeEl.contains(e.target) }, true)
  sysTextarea.addEventListener('input', ()=> setDirty(true))
  tempInput.addEventListener('input', ()=> setDirty(true))
  maxTokInput.addEventListener('input', ()=> setDirty(true))
  sysTextarea.addEventListener('blur', ()=>{ if(isDirty && !suppressBlurSave) saveDetails() })
  tempInput.addEventListener('blur', ()=>{ if(isDirty && !suppressBlurSave) saveDetails() })
  maxTokInput.addEventListener('blur', ()=>{ if(isDirty && !suppressBlurSave) saveDetails() })
  detailsEl.addEventListener('click', (e)=>{ 
    const act = e.target.getAttribute && e.target.getAttribute('data-act'); 
    if(act==='reset'){ resetTemplate() } 
    else if(act==='insert-path'){ insertPath() } 
    else if(act==='save'){ saveDetails() } 
    else if(act==='cancel'){ 
      if(isDirty){ cancelDetails() } 
      else { teardown() }
    } 
  })
  document.body.appendChild(backdrop)
  searchInput.focus()
  buildFlat(); render()
  return { destroy: teardown }
}
