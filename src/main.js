import './style.css'
import { createStore } from './store/memoryStore.js'
import { attachIndexes } from './store/indexes.js'
import { parse } from './filter/parser.js'
import { evaluate } from './filter/evaluator.js'
import { createModeManager, MODES } from './ui/modes.js'
import { createKeyRouter } from './ui/keyRouter.js'
import { buildParts, ActivePartController, scrollActiveIntoView } from './ui/parts.js'
import { createIndexedDbAdapter } from './store/indexedDbAdapter.js'
import { attachContentPersistence } from './persistence/contentPersistence.js'
import { createTopicPicker } from './ui/topicPicker.js'
import { openTopicEditor } from './ui/topicEditor.js'
import { modalIsActive } from './ui/focusTrap.js'

// Mode management
const modeManager = createModeManager()

// Root layout
const appEl = document.querySelector('#app')
appEl.innerHTML = `
  <div id="topBar" class="zone">
    <div id="commandWrapper">
      <input id="commandInput" placeholder=": command / filter" autocomplete="off" />
    </div>
    <div id="statusRight"><span id="commandError"></span></div>
  </div>
  <div id="historyPane" class="zone">
    <div id="history" class="history"></div>
  </div>
  <div id="inputBar" class="zone">
    <div class="inputBar-inner">
      <div class="row first">
        <input id="inputField" placeholder="Type message... (Enter to send)" autocomplete="off" />
      </div>
      <div class="row second">
        <div class="input-meta-left">
          <div id="modeIndicator" class="mode-label"></div>
          <span id="pendingModel" title="Model"></span>
          <span id="pendingTopic" title="Topic"></span>
        </div>
        <button id="sendBtn" disabled>Send</button>
      </div>
    </div>
  </div>
`

// Loading guard overlay (removed after bootstrap)
const loadingEl = document.createElement('div')
loadingEl.id = 'appLoading'
loadingEl.style.position = 'fixed'
loadingEl.style.inset = '0'
loadingEl.style.display = 'flex'
loadingEl.style.alignItems = 'center'
loadingEl.style.justifyContent = 'center'
loadingEl.style.background = 'rgba(0,0,0,0.4)'
loadingEl.style.fontSize = '0.9rem'
loadingEl.style.letterSpacing = '0.05em'
loadingEl.style.fontFamily = 'inherit'
loadingEl.textContent = 'Loading…'
document.body.appendChild(loadingEl)

// Initial layout pass
requestAnimationFrame(layoutHistoryPane)

// Dynamic layout sizing to avoid hidden first/last messages when bar heights change
function layoutHistoryPane(){
  const topBar = document.getElementById('topBar')
  const inputBar = document.getElementById('inputBar')
  const histPane = document.getElementById('historyPane')
  if(!topBar || !inputBar || !histPane) return
  const topH = topBar.getBoundingClientRect().height
  const botH = inputBar.getBoundingClientRect().height
  // Apply via inline style so CSS remains simple
  histPane.style.top = topH + 'px'
  histPane.style.bottom = botH + 'px'
}
window.addEventListener('resize', layoutHistoryPane)

// Debug HUD container
const hudEl = document.createElement('div')
hudEl.id = 'hud'
document.body.appendChild(hudEl)

// Store & persistence
const store = createStore()
attachIndexes(store)
const persistence = attachContentPersistence(store, createIndexedDbAdapter())
let currentTopicId = store.rootTopicId
const activeParts = new ActivePartController()
let overlay = null // { type: 'topic'|'model', list:[], activeIndex:0 }
let pendingMessageMeta = { topicId: null, model: 'gpt' }

function renderTopics(){ /* hidden for now */ }

function renderHistory(pairs){
  const hist = document.getElementById('history')
  const parts = buildParts(pairs)
  activeParts.setParts(parts)
  const byPair = {}
  for(const part of parts){ (byPair[part.pairId] ||= []).push(part) }
  hist.innerHTML = Object.entries(byPair).map(([pairId, parts])=>{
    return `<div class="pair" data-pair-id="${pairId}">${parts.map(pt=> renderPart(pt)).join('')}</div>`
  }).join('')
  applyActivePart()
}

function renderPart(pt){
  if(pt.role === 'meta'){
    const pair = store.pairs.get(pt.pairId)
    const topic = store.topics.get(pair.topicId)
	const ts = new Date(pair.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'})
	const topicPath = topic ? formatTopicPath(topic.id) : ''
    return `<div class="part meta" data-part-id="${pt.id}">
      <div class="meta-left">
        <span class="badge include" data-include="${pair.includeInContext}">${pair.includeInContext? 'in':'out'}</span>
        <span class="badge stars">${'★'.repeat(pair.star)}${'☆'.repeat(Math.max(0,3-pair.star))}</span>
	<span class="badge topic" title="${topic?escapeHtml(topicPath):''}">${topic?escapeHtml(middleTruncate(topicPath, 72)):''}</span>
      </div>
      <div class="meta-right">
        <span class="badge model">${pair.model}</span>
        <span class="badge timestamp" data-ts="${pair.createdAt}">${ts}</span>
      </div>
    </div>`
  }
  return `<div class="part ${pt.role}" data-part-id="${pt.id}">${escapeHtml(pt.text)}</div>`
}

function applyActivePart(){
  document.querySelectorAll('.part.active').forEach(el=>el.classList.remove('active'))
  const act = activeParts.active(); if(!act) return
  const el = document.querySelector(`[data-part-id="${act.id}"]`)
  if(el){ el.classList.add('active'); scrollActiveIntoView(document.getElementById('historyPane'), act.id) }
}

function escapeHtml(s){ return s.replace(/[&<>]/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])) }

function renderStatus(){ const modeEl = document.getElementById('modeIndicator'); if(modeEl) modeEl.textContent = `[${modeManager.mode.toUpperCase()}]` }

async function bootstrap(){
  await persistence.init()
  if(store.getAllPairs().length === 0){
    const topicId = store.rootTopicId
    const seedStars = [0,1,2,3,0]
    for(let i=0;i<5;i++){
      const id = store.addMessagePair({ topicId, model: i%2? 'gpt':'claude', userText:`User ${i}`, assistantText:`Assistant reply ${i}` })
      const pair = store.pairs.get(id)
      pair.star = seedStars[i]
      if(i===4) pair.includeInContext = false
    }
  }
  renderHistory(store.getAllPairs())
  renderTopics()
  renderStatus()
  applyActivePart()
  if(!pendingMessageMeta.topicId) pendingMessageMeta.topicId = store.rootTopicId
  layoutHistoryPane()
  // Remove loading guard
  loadingEl.remove()
}
bootstrap()

// Ensure pending persistence queued writes flushed on tab close
window.addEventListener('beforeunload', ()=>{ if(persistence && persistence.flush) persistence.flush() })

// Inputs
const commandInput = document.getElementById('commandInput')
const commandErrEl = document.getElementById('commandError')
const inputField = document.getElementById('inputField')
const sendBtn = document.getElementById('sendBtn')

// Command input Enter handled inside commandHandler; Escape clears filter there.
// Input field Enter handled inside inputHandler (remain in input mode) .

// Mode key handlers
const viewHandler = (e)=>{
  window.__lastKey = e.key
  if(e.key === 'Enter'){ modeManager.set(MODES.INPUT); return true }
  if(e.key === 'Escape'){ modeManager.set(MODES.COMMAND); return true }
  // Primary navigation j/k; secondary ArrowDown/ArrowUp
  if(e.key === 'j' || e.key === 'ArrowDown'){ activeParts.next(); applyActivePart(); return true }
  if(e.key === 'k' || e.key === 'ArrowUp'){ activeParts.prev(); applyActivePart(); return true }
  if(e.key === 'g'){ activeParts.first(); applyActivePart(); return true }
  if(e.key === 'G'){ activeParts.last(); applyActivePart(); return true }
  if(e.key === '*'){ cycleStar(); return true }
  if(e.key === 'a'){ toggleInclude(); return true }
  if(e.key === '1'){ setStarRating(1); return true }
  if(e.key === '2'){ setStarRating(2); return true }
  if(e.key === '3'){ setStarRating(3); return true }
  if(e.key === ' '){ setStarRating(0); return true }
}
const commandHandler = (e)=>{
  if(e.key === 'Enter'){
    const q = commandInput.value.trim()
    if(!q){ commandErrEl.textContent=''; renderHistory(store.getAllPairs()); activeParts.last(); applyActivePart(); modeManager.set(MODES.VIEW); return true }
    try {
      const ast = parse(q)
      const res = evaluate(ast, store.getAllPairs())
      renderHistory(res)
      commandErrEl.textContent=''
      modeManager.set(MODES.VIEW)
    } catch(ex){ commandErrEl.textContent = ex.message }
    return true
  }
  if(e.key === 'Escape'){
    // Clear filter but remain in command mode
    if(commandInput.value){ commandInput.value=''; renderHistory(store.getAllPairs()); activeParts.last(); applyActivePart(); commandErrEl.textContent='' }
    return true
  }
}
const inputHandler = (e)=>{
  if(e.key === 'Enter'){
    const text = inputField.value.trim()
    if(text){
  const topicId = pendingMessageMeta.topicId || currentTopicId
  const model = pendingMessageMeta.model || 'gpt'
  store.addMessagePair({ topicId, model, userText: text, assistantText: '(placeholder response)' })
      inputField.value=''
      renderHistory(store.getAllPairs())
      activeParts.last(); applyActivePart()
  updateSendDisabled()
    }
    return true // remain in input mode
  }
  if(e.key === 'Escape'){ modeManager.set(MODES.VIEW); return true }
}
modeManager.onChange((m)=>{
  renderStatus()
  if(m === MODES.VIEW){ commandInput.blur(); inputField.blur() }
  else if(m === MODES.INPUT){ inputField.focus() }
  else if(m === MODES.COMMAND){ commandInput.focus() }
})

// Removed gg sequence; single 'g' now handled in viewHandler.

function cycleStar(){
  const act = activeParts.active(); if(!act) return
  const pair = store.pairs.get(act.pairId); if(!pair) return
  store.updatePair(pair.id, { star: (pair.star+1)%4 })
  renderHistory(store.getAllPairs())
}
function setStarRating(star){
  const act = activeParts.active(); if(!act) return
  const pair = store.pairs.get(act.pairId); if(!pair) return
  if(pair.star === star) return
  store.updatePair(pair.id, { star })
  renderHistory(store.getAllPairs())
}
function toggleInclude(){
  const act = activeParts.active(); if(!act) return
  const pair = store.pairs.get(act.pairId); if(!pair) return
  store.updatePair(pair.id, { includeInContext: !pair.includeInContext })
  renderHistory(store.getAllPairs())
}

const keyRouter = createKeyRouter({ modeManager, handlers:{ view:viewHandler, command:commandHandler, input:inputHandler } })
keyRouter.attach()

// Debug
window.__modeManager = modeManager
window.__keyRouter = keyRouter
window.__store = store

// Click activation
document.addEventListener('click', e=>{
  const el = e.target.closest('.part'); if(!el) return
  activeParts.setActiveById(el.getAttribute('data-part-id'))
  applyActivePart()
})

// Ctrl-based direct mode activation
window.addEventListener('keydown', e=>{
  if(!e.ctrlKey) return
  const k = e.key.toLowerCase()
  if(modalIsActive && modalIsActive()) return
  if(k==='i'){ e.preventDefault(); modeManager.set(MODES.INPUT) }
  else if(k==='d'){ e.preventDefault(); modeManager.set(MODES.COMMAND) }
  else if(k==='v'){ e.preventDefault(); modeManager.set(MODES.VIEW) }
  else if(k==='t'){ if(!document.getElementById('appLoading')){ e.preventDefault(); openQuickTopicPicker() } }
  else if(k==='e'){ if(!document.getElementById('appLoading')){ e.preventDefault(); openTopicEditorOverlay() } }
  else if(k==='m'){ if(modeManager.mode===MODES.INPUT){ e.preventDefault(); openSelector('model') } }
})

// Overlay selectors
function openSelector(type){
  if(overlay){ closeSelector(); }
  const list = type==='topic' ? store.getAllTopics() : getModelList()
  overlay = { type, list, activeIndex: 0 }
  renderOverlay()
}

function openQuickTopicPicker(){
  // selection context differs by mode
  createTopicPicker({
    store,
    onSelect: (topicId)=>{
      if(modeManager.mode === MODES.INPUT){
        pendingMessageMeta.topicId = topicId
        renderPendingMeta()
      } else if(modeManager.mode === MODES.VIEW){
        const act = activeParts.active(); if(act){
          const pair = store.pairs.get(act.pairId); if(pair){ store.updatePair(pair.id, { topicId }); renderHistory(store.getAllPairs()); activeParts.setActiveById(act.id); applyActivePart() }
        }
      }
    },
    onCancel: ()=>{}
  })
}

function openTopicEditorOverlay(){
  openTopicEditor({
    store,
    onSelect: (topicId)=>{
      // Treat selecting in editor same as quick picker selection context
      if(modeManager.mode === MODES.INPUT){
        pendingMessageMeta.topicId = topicId
        renderPendingMeta()
      } else if(modeManager.mode === MODES.VIEW){
        const act = activeParts.active(); if(act){
          const pair = store.pairs.get(act.pairId); if(pair){ store.updatePair(pair.id, { topicId }); renderHistory(store.getAllPairs()); activeParts.setActiveById(act.id); applyActivePart() }
        }
      }
    },
    onClose: ()=>{}
  })
}
function closeSelector(){
  if(!overlay) return
  const el = document.getElementById('overlayRoot')
  if(el) el.remove()
  overlay = null
}
function getModelList(){
  // Placeholder static list; later can load dynamically / config
  return [ { id:'gpt', name:'gpt' }, { id:'claude', name:'claude' }, { id:'mixtral', name:'mixtral' } ]
}
function renderOverlay(){
  if(!overlay) return
  const root = document.createElement('div')
  root.id = 'overlayRoot'
  root.className = 'overlay-backdrop'
  const listItems = overlay.list.map((item,i)=>{
    const id = item.id || item.topicId || item.id
    const label = item.name || item.model || item.id || item
    const active = i===overlay.activeIndex ? ' class="active"' : ''
    return `<li data-index="${i}"${active}>${escapeHtml(label)}</li>`
  }).join('')
  root.innerHTML = `<div class="overlay-panel" data-type="${overlay.type}">
    <header>${overlay.type === 'topic' ? 'Select Topic' : 'Select Model'}</header>
    <div class="list"><ul>${listItems}</ul></div>
    <footer><span style="flex:1;opacity:.6">Enter=accept  Esc=cancel  j/k=move</span></footer>
  </div>`
  document.body.appendChild(root)
}
function applyOverlaySelection(){
  if(!overlay) return
  const item = overlay.list[overlay.activeIndex]
  if(overlay.type==='topic'){
    if(modeManager.mode === MODES.VIEW){ // update active pair topic
      const act = activeParts.active(); if(act){
        const pair = store.pairs.get(act.pairId); if(pair){ store.updatePair(pair.id, { topicId: item.id }); renderHistory(store.getAllPairs()); activeParts.setActiveById(act.id); applyActivePart() }
      }
      currentTopicId = item.id
    } else if(modeManager.mode === MODES.INPUT){
      pendingMessageMeta.topicId = item.id
      renderPendingMeta()
    }
  } else if(overlay.type==='model'){
    pendingMessageMeta.model = item.id
    renderPendingMeta()
  }
  closeSelector()
}

window.addEventListener('keydown', e=>{
  if(!overlay) return
  if(e.key === 'Escape'){ e.preventDefault(); closeSelector(); return }
  if(e.key === 'Enter'){ e.preventDefault(); applyOverlaySelection(); return }
  if(e.key === 'j' || e.key === 'ArrowDown'){ e.preventDefault(); overlay.activeIndex = Math.min(overlay.list.length-1, overlay.activeIndex+1); refreshOverlaySelection(); }
  if(e.key === 'k' || e.key === 'ArrowUp'){ e.preventDefault(); overlay.activeIndex = Math.max(0, overlay.activeIndex-1); refreshOverlaySelection(); }
})
function refreshOverlaySelection(){
  if(!overlay) return
  const root = document.getElementById('overlayRoot'); if(!root) return
  root.querySelectorAll('li').forEach(li=>{
    const idx = Number(li.getAttribute('data-index'))
    li.classList.toggle('active', idx===overlay.activeIndex)
  })
}

// HUD updater
function fmtTime(ts){ const d=new Date(ts); return d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'}) }
function updateHud(){
  const act = activeParts.active()
  let pairInfo='(none)'
  if(act){
    const pair = store.pairs.get(act.pairId)
    if(pair){
      const topic = store.topics.get(pair.topicId)
      pairInfo = `${pair.id.slice(0,8)} t:${topic?topic.name:''}\n★:${pair.star} include:${pair.includeInContext?'Y':'N'} model:${pair.model}\n@${fmtTime(pair.createdAt)}`
    }
  }
  const idx = act? `${activeParts.parts.indexOf(act)+1}/${activeParts.parts.length}` : '0/0'
  const focusEl = document.activeElement
  const focusDesc = focusEl ? `${focusEl.tagName.toLowerCase()}${focusEl.id?('#'+focusEl.id):''}` : 'none'
  hudEl.textContent = `mode: ${modeManager.mode}  lastKey:${window.__lastKey||'-'}\nactive: ${idx}\nfocus: ${focusDesc}\n${pairInfo}`
  requestAnimationFrame(updateHud)
}
requestAnimationFrame(updateHud)

function renderPendingMeta(){
  const pm = document.getElementById('pendingModel')
  const pt = document.getElementById('pendingTopic')
  if(pm) pm.textContent = pendingMessageMeta.model || 'gpt'
  if(pt){
    const topic = store.topics.get(pendingMessageMeta.topicId || currentTopicId)
    if(topic){
      const path = formatTopicPath(topic.id)
      pt.textContent = middleTruncate(path, 90)
      pt.title = path
    } else {
      pt.textContent = ''
      pt.title = ''
    }
  }
}

function formatTopicPath(id){
  const parts = store.getTopicPath(id)
  if(parts[0] === 'Root') parts.shift()
  return parts.join(' > ')
}
function middleTruncate(str, max){
  if(str.length <= max) return str
  const keep = max - 3
  const head = Math.ceil(keep/2)
  const tail = Math.floor(keep/2)
  return str.slice(0, head) + '…' + str.slice(str.length - tail)
}
function updateSendDisabled(){
  if(!sendBtn) return
  sendBtn.disabled = inputField.value.trim().length === 0
}
if(sendBtn){
  sendBtn.addEventListener('click', ()=>{
    if(modeManager.mode !== MODES.INPUT) modeManager.set(MODES.INPUT)
    const text = inputField.value.trim(); if(!text) return
    const topicId = pendingMessageMeta.topicId || currentTopicId
    const model = pendingMessageMeta.model || 'gpt'
    store.addMessagePair({ topicId, model, userText: text, assistantText: '(placeholder response)' })
    inputField.value=''; renderHistory(store.getAllPairs()); activeParts.last(); applyActivePart(); updateSendDisabled()
  })
  inputField.addEventListener('input', updateSendDisabled)
  renderPendingMeta(); updateSendDisabled()
}

// End main.js
