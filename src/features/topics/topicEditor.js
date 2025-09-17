// topicEditor.js moved from ui/topicEditor.js (Phase 6.4 Topics)
import { openModal } from '../../shared/openModal.js'
import { getSettings, saveSettings } from '../../core/settings/index.js'

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
  let orderMode = getSettings().topicOrderMode || 'manual' // 'manual' | 'recent'
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
  backdrop.innerHTML = `\n    <div class="topic-editor">\n      <div class="te-header">\n        <div><strong>Topic Editor</strong></div>\n        <div style="margin-top:14px;">Ctrl+J - focus on topic tree; Ctrl+F - focus search</div>\n        <div>j/k - move down/up the tree, h/l - collapse/expand, n - new child topic, N - new root topic</div>\n        <div>r - rename topic, d - delete topic, m - mark topic, p - paste topic.</div>\n        <div style="margin-top:4px;">Edit focused topic parameters: Ctrl+E - system message, Ctrl+T - temperature, Ctrl+L - max response length.</div>\n        <div>Apply (Ctrl+S) saves changes, Esc - Cancel+Close.</div>\n      </div>\n      <div class="te-body">\n        <div class="te-left">\n          <input type="text" class="te-search" placeholder="Search (name / path substring)"/>\n          <div class="te-tree" role="tree" tabindex="0"></div>\n          <div class="te-hints" aria-live="polite"></div>\n        </div>\n        <div class="te-details" data-pane="details">\n          <div class="te-path"></div>\n          <div class="te-field">\n            <label>System message</label>\n            <textarea class="te-textarea" spellcheck="false" placeholder="You are MaiChat Assistant for this topic. Be concise and ask clarifying questions when needed."></textarea>\n            <div class="te-actions">\n              <button class="te-btn" data-act="reset">Reset to template (Ctrl+R)</button>\n              <button class="te-btn" data-act="insert-path">Insert topic path (Ctrl+I)</button>\n            </div>\n          </div>\n          <div class="te-grid">\n            <div class="te-field">\n              <label>Temperature (0–2)</label>\n              <input type="number" step="0.1" min="0" max="2" class="te-input" data-field="temperature"/>\n              <div class="te-hint">Higher = more creative.</div>\n            </div>\n            <div class="te-field">\n              <label>Max output tokens</label>\n              <input type="number" min="1" class="te-input" data-field="maxTokens"/>\n              <div class="te-hint">Leave empty for default output size.</div>\n            </div>\n          </div>\n          <div class="te-primary-actions">\n            <button class="te-btn te-apply" data-act="save">Apply (Ctrl+S)</button>\n            <button class="te-btn te-cancel" data-act="cancel">Cancel+Close (Esc)</button>\n          </div>\n        </div>\n      </div>\n      <div class="te-warning" aria-live="polite"></div>\n    </div>`
  const searchInput = backdrop.querySelector('.te-search')
  const treeEl = backdrop.querySelector('.te-tree')
  const detailsEl = backdrop.querySelector('.te-details')
  const hintsEl = backdrop.querySelector('.te-hints')
  const pathEl = backdrop.querySelector('.te-path')
  const sysTextarea = backdrop.querySelector('.te-textarea')
  const tempInput = backdrop.querySelector('input[data-field="temperature"]')
  const maxTokInput = backdrop.querySelector('input[data-field="maxTokens"]')
  const applyBtn = backdrop.querySelector('.te-primary-actions .te-apply')
  const cancelBtn = backdrop.querySelector('.te-primary-actions .te-cancel')
  const warningEl = backdrop.querySelector('.te-warning')
  // Remove the legacy 'System message' label and let the textarea move up
  try { backdrop.querySelector('.te-field > label')?.remove() } catch {}

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
    function compareTopics(aId, bId){
      const ta = store.topics.get(aId), tb = store.topics.get(bId)
      if(orderMode==='recent'){
        const d=(tb?.lastActiveAt||0) - (ta?.lastActiveAt||0)
        if(d) return d
      } else {
        const d=(ta?.sortIndex||0) - (tb?.sortIndex||0)
        if(d) return d
      }
      return (ta?.createdAt||0) - (tb?.createdAt||0) || (ta?.name||'').localeCompare(tb?.name||'')
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
        const kids = Array.from((store.children.get(id)||[])).sort(compareTopics)
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
    const roots = Array.from((store.children.get(null)||[])).sort(compareTopics)
    for (const rid of roots) {
      if (rid === store.rootTopicId) {
        const kids = Array.from((store.children.get(store.rootTopicId)||[])).sort(compareTopics)
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
    // Update order hints (three-line wording)
    if(hintsEl){
      if(orderMode==='recent'){
        const l1 = 'Topic tree is sorted chronologically'
        const l2 = '(most recently used topics on top)'
        const l3 = 'o / Ctrl+O - change sorting to logical view'
        hintsEl.innerHTML = `<div class="te-hint">${l1}</div><div class="te-hint">${l2}</div><div class="te-hint">${l3}</div>`
      } else {
        const l1 = 'Topic tree is sorted logically'
        const l2 = '(Ctrl+U / Ctrl+D - move topics up/down)'
        const l3 = 'o / Ctrl+O - change sorting to chronological view'
        hintsEl.innerHTML = `<div class="te-hint">${l1}</div><div class="te-hint">${l2}</div><div class="te-hint">${l3}</div>`
      }
    }
    if (editing && editing.inputEl) {
      const el = treeEl.querySelector('input.te-edit')
      if (el) { editing.inputEl = el; setTimeout(()=>el.focus(),0) }
    }
  }
  let isDirty = false
  let suppressBlurSave = false
  let sessionDirty = false
  function updateButtonsState(){
    try {
      if(!applyBtn || !cancelBtn) return
      if(isDirty){
        applyBtn.textContent = 'Apply (Ctrl+S)'
        cancelBtn.textContent = 'Cancel+Close (Esc)'
      } else {
        applyBtn.textContent = 'All saved'
        cancelBtn.textContent = 'Close (Esc)'
      }
    } catch {}
  }
  function setDirty(v){ isDirty = !!v; updateButtonsState() }
  function currentTopic() { return flat[activeIndex]?.topic || null }
  function renderDetails(){
    const t = currentTopic()
  if(!t){ detailsEl.setAttribute('aria-disabled','true'); sysTextarea.value=''; tempInput.value=''; maxTokInput.value=''; pathEl.textContent='Edit topic system message:'; return }
    detailsEl.removeAttribute('aria-disabled')
  const path = topicPathNames(t.id)
  const name = t.name || ''
          pathEl.textContent = `Edit topic system message: ${name}`
          sysTextarea.value = typeof t.systemMessage==='string' ? t.systemMessage : ''
  const rp = t.requestParams || {}
  tempInput.value = (typeof rp.temperature==='number') ? String(rp.temperature) : '0.7'
    maxTokInput.value = (typeof rp.maxOutputTokens==='number') ? String(rp.maxOutputTokens) : ''
  setDirty(false)
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
  setDirty(false); sessionDirty = true
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
  sessionDirty = true
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
  if (newName !== t.name){ store.renameTopic(t.id, newName); sessionDirty = true }
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
  sessionDirty = true
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
  sessionDirty = true
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
  if (e.key==='Escape'){ e.preventDefault(); teardown(); return }
      if (e.key==='Enter'){ e.preventDefault(); if(editing.mode==='create') finishCreate(true); else finishRename(true); setTimeout(()=>{ inTreeFocus?treeEl.focus():searchInput.focus() },0); return }
      return
    }
    if(deleteConfirmId){
      if(e.key==='y' || e.key==='Y'){ e.preventDefault(); executeDelete(deleteConfirmId); return }
  if(e.key==='n' || e.key==='N'){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); deleteConfirmId=null; showWarning('Cancelled'); return }
  if(e.key==='Escape'){ e.preventDefault(); teardown(); return }
    }
    if(!inTreeFocus){
      // Only allow pane toggle into the tree; all other keys should type in inputs/textarea
      if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); teardown(); return }
      if(e.ctrlKey && (e.key==='j' || e.key==='J')){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); inTreeFocus=true; treeEl.focus(); return }
      return
    }
    // Tree-focused bindings
    // Toggle order with plain 'o' as well (no modifiers) when in tree
    if(!e.ctrlKey && !e.metaKey && !e.altKey){
      if(e.key==='o' || e.key==='O'){
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        orderMode = orderMode==='manual' ? 'recent' : 'manual';
        saveSettings({ topicOrderMode: orderMode }); buildFlat(); render(); return
      }
    }
    // Ctrl bindings
    if(e.ctrlKey && !e.metaKey && !e.altKey){
      const k = e.key
      if(k==='o' || k==='O'){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); orderMode = orderMode==='manual' ? 'recent' : 'manual'; saveSettings({ topicOrderMode: orderMode }); buildFlat(); render(); return }
      if(orderMode==='manual' && (k==='u' || k==='U')){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); moveActiveSibling(-1); return }
      if(orderMode==='manual' && (k==='d' || k==='D')){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); moveActiveSibling(1); return }
    }
    switch(e.key){
      case 'Escape': e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); teardown(); return
      case 'Enter': e.preventDefault(); selectCurrent(); return
      case 'j': case 'ArrowDown': e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); activeIndex = Math.min(flat.length-1, activeIndex+1); render(); return
      case 'k': case 'ArrowUp': e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); activeIndex = Math.max(0, activeIndex-1); render(); return
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
  function moveActiveSibling(delta){
    const row = flat[activeIndex]; if(!row) return
    const t = row.topic
    // Determine siblings directly from store for determinism (avoid relying on current flat render state)
    const rawSiblings = Array.from((store.children.get(t.parentId)||new Set()))
    const sortKey = (id)=>{
      const x = store.topics.get(id) || {}
      return [Number.isFinite(x.sortIndex) ? x.sortIndex : Infinity, x.createdAt||0, x.name||'']
    }
    rawSiblings.sort((a,b)=>{
      const ka = sortKey(a), kb = sortKey(b)
      if(ka[0]!==kb[0]) return ka[0]-kb[0]
      if(ka[1]!==kb[1]) return ka[1]-kb[1]
      return ka[2].localeCompare(kb[2])
    })
    const idx = rawSiblings.indexOf(t.id); if(idx<0) return
    const to = idx + delta; if(to<0 || to>=rawSiblings.length) return
    // Swap target with neighbor and reindex sequentially starting at 0
    const nextOrder = rawSiblings.slice()
    const tmp = nextOrder[idx]; nextOrder[idx] = nextOrder[to]; nextOrder[to] = tmp
    for(let i=0;i<nextOrder.length;i++){
      const id = nextOrder[i]
      const topic = store.topics.get(id)
      if(!topic || topic.sortIndex === i) continue
      store.updateTopic(id, { sortIndex: i })
    }
    buildFlat();
    const newIdx = flat.findIndex(r=>r.topic.id===t.id); if(newIdx>=0) activeIndex=newIdx
    render()
  }
  // subscribe to store changes so the editor stays in sync while open
  const offAdd = store.on && store.on('topic:add', () => render())
  const offUpd = store.on && store.on('topic:update', () => render())
  const offDel = store.on && store.on('topic:delete', () => { buildFlat(); render() })
  const offMove = store.on && store.on('topic:move', () => { buildFlat(); render() })
  const offCounts = store.on && store.on('topic:counts', () => render())
  const offLastActive = store.on && store.on('topic:lastActive', () => render())
  // No global swallow here; rely on central modal blocker in openModal()
  function teardown() {
    try{ offAdd && offAdd() }catch{}
    try{ offUpd && offUpd() }catch{}
    try{ offDel && offDel() }catch{}
    try{ offMove && offMove() }catch{}
    try{ offCounts && offCounts() }catch{}
    backdrop.removeEventListener('keydown', onKey)
  // nothing global to remove; central blocker detaches on modal close
    modal.close('manual')
  if (onClose) onClose({ dirty: !!sessionDirty })
    try{ offLastActive && offLastActive() }catch{}
  }
  searchInput.addEventListener('input', ()=>{ filter = searchInput.value.trim(); buildFlat(); activeIndex = 0; render() })
  backdrop.addEventListener('keydown', onKey)
  backdrop.addEventListener('keydown', (e)=>{ 
    const inDetails = detailsEl.contains(e.target)
  if(e.ctrlKey && (e.key==='e'||e.key==='E')){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); detailsEl.querySelector('.te-textarea')?.focus(); inTreeFocus=false; return }
  if(e.ctrlKey && (e.key==='t'||e.key==='T')){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); focusTemp(); inTreeFocus=false; return }
  if(e.ctrlKey && (e.key==='l'||e.key==='L')){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); focusMaxTok(); inTreeFocus=false; return }
  if(e.ctrlKey && (e.key==='f'||e.key==='F')){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); searchInput.focus(); inTreeFocus=false; return }
  if(e.ctrlKey && (e.key==='s'||e.key==='S')){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); saveDetails(); return }
  if(e.ctrlKey && (e.key==='r'||e.key==='R')){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); resetTemplate(); return }
  if(e.ctrlKey && (e.key==='i'||e.key==='I')){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); insertPath(); return }
    if(inDetails && e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); teardown(); return }
  }, true)
  // Capture-phase safety handler to ensure reorder keys are never lost
  backdrop.addEventListener('keydown', (e)=>{
    const isTreeEvent = treeEl.contains(e.target)
    if(!isTreeEvent) return
    if(!e.ctrlKey || e.metaKey || e.altKey) return
    const k = e.key
    if(orderMode==='manual' && (k==='u'||k==='U')){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); moveActiveSibling(-1) }
    else if(orderMode==='manual' && (k==='d'||k==='D')){ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); moveActiveSibling(1) }
  }, true)
  // Keep inTreeFocus synced with actual focus target
  backdrop.addEventListener('focusin', (e)=>{ inTreeFocus = treeEl.contains(e.target) }, true)
  sysTextarea.addEventListener('input', ()=> setDirty(true))
  tempInput.addEventListener('input', ()=> setDirty(true))
  maxTokInput.addEventListener('input', ()=> setDirty(true))
  // No autosave on blur; explicit Apply (Ctrl+S) to save changes.
  detailsEl.addEventListener('click', (e)=>{ 
    const act = e.target.getAttribute && e.target.getAttribute('data-act'); 
    if(act==='reset'){ resetTemplate() } 
    else if(act==='insert-path'){ insertPath() } 
    else if(act==='save'){ saveDetails() } 
    else if(act==='cancel'){ teardown() } 
  })
  // Create modal wrapper (focus trap + mode restore); Esc handling stays custom in this module
  const modal = openModal({ modeManager: window.__modeManager, root: backdrop, closeKeys: [], restoreMode: true })
  document.body.appendChild(backdrop)
  searchInput.focus()
  buildFlat(); render(); updateButtonsState()
  return { destroy: teardown }
}
