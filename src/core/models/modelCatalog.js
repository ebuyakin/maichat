// Moved from src/models/modelCatalog.js (Phase 5 core move)
const STORAGE_KEY = 'maichat_model_catalog_v2'
const BASE_MODELS = [
  { id:'gpt-5', contextWindow:128000, tpm:30000, rpm:500, tpd:900000 },
  { id:'gpt-5-mini', contextWindow:128000, tpm:200000, rpm:500, tpd:2000000 },
  { id:'gpt-5-nano', contextWindow:128000, tpm:200000, rpm:500, tpd:2000000 },
  { id:'gpt-4.1', contextWindow:128000, tpm:30000, rpm:500, tpd:900000 },
  { id:'gpt-4.1-mini', contextWindow:128000, tpm:200000, rpm:500, tpd:2000000 },
  { id:'gpt-4.1-nano', contextWindow:128000, tpm:200000, rpm:500, tpd:2000000 },
  { id:'o3', contextWindow:128000, tpm:30000, rpm:500, tpd:90000 },
  { id:'o4-mini', contextWindow:128000, tpm:200000, rpm:500, tpd:2000000 },
  { id:'gpt-4o', contextWindow:128000, tpm:30000, rpm:500, tpd:900000 },
  { id:'gpt-4o-mini', contextWindow:128000, tpm:200000, rpm:500, tpd:2000000 },
  { id:'gpt-3.5-turbo', contextWindow:16000, tpm:200000, rpm:500, tpd:2000000 }
]
function loadState(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {} } catch { return {} } }
function saveState(state){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) }
function normalize(state){
  if(!state.models) state.models = {}
  for(const bm of BASE_MODELS){
    if(!state.models[bm.id]){ state.models[bm.id] = { enabled:true, contextWindow: bm.contextWindow, tpm: bm.tpm, rpm: bm.rpm, tpd: bm.tpd } }
    else {
      if(typeof state.models[bm.id].contextWindow !== 'number') state.models[bm.id].contextWindow = bm.contextWindow
      if(typeof state.models[bm.id].enabled !== 'boolean') state.models[bm.id].enabled = true
      if(typeof state.models[bm.id].tpm !== 'number') state.models[bm.id].tpm = bm.tpm
      if(typeof state.models[bm.id].rpm !== 'number') state.models[bm.id].rpm = bm.rpm
      if(typeof state.models[bm.id].tpd !== 'number') state.models[bm.id].tpd = bm.tpd
    }
  }
  // Ensure any custom models (not in BASE_MODELS) have required fields
  for (const [id, m] of Object.entries(state.models)){
    if(!BASE_MODELS.find(b=>b.id===id)){
      if(typeof m.enabled !== 'boolean') m.enabled = true
      if(typeof m.contextWindow !== 'number') m.contextWindow = 8192
      if(typeof m.tpm !== 'number') m.tpm = 8192
      if(typeof m.rpm !== 'number') m.rpm = 60
      if(typeof m.tpd !== 'number') m.tpd = 100000
    }
  }
  if(!state.activeModel || !state.models[state.activeModel]?.enabled){
    // prefer first enabled base model, else any enabled custom
    const first = BASE_MODELS.find(m=> state.models[m.id]?.enabled) || Object.keys(state.models).map(id=>({id})).find(x=> state.models[x.id]?.enabled)
    if(first) state.activeModel = first.id
  }
  return state
}
let __state = normalize(loadState())
export function getActiveModel(){ return __state.activeModel }
export function setActiveModel(id){ if(__state.models[id]?.enabled){ __state.activeModel = id; saveState(__state) } }
export function listModels(){
  // Include both base and custom models; stable sort by: enabled desc, base first, then id asc
  const allIds = Array.from(new Set([...BASE_MODELS.map(m=>m.id), ...Object.keys(__state.models)]))
  const isBase = (id)=> !!BASE_MODELS.find(b=>b.id===id)
  return allIds
    .filter(id=> !!__state.models[id])
    .map(id=> ({ id, contextWindow:__state.models[id].contextWindow, tpm:__state.models[id].tpm, rpm:__state.models[id].rpm, tpd:__state.models[id].tpd, enabled:__state.models[id].enabled }))
    .sort((a,b)=> (b.enabled - a.enabled) || (Number(isBase(b.id)) - Number(isBase(a.id))) || a.id.localeCompare(b.id))
}
export function toggleModelEnabled(id){ const m = __state.models[id]; if(!m) return; m.enabled = !m.enabled; if(!m.enabled && __state.activeModel===id){ setActiveModel(listModels().find(x=>x.enabled)?.id) } saveState(__state) }
export function getContextWindow(id){ const m = __state.models[id]; return m ? m.contextWindow : 8192 }
export function getModelMeta(id){ const m = __state.models[id]; if(!m) return { contextWindow:8192, tpm:8192, rpm:60, tpd:100000 }; return { ...m } }
export function ensureCatalogLoaded(){}

// New: explicit enable/disable and metadata updates
export function setModelEnabled(id, enabled){ const m = __state.models[id]; if(!m) return; const prev = !!m.enabled; m.enabled = !!enabled; if(prev && !m.enabled && __state.activeModel===id){ setActiveModel(listModels().find(x=>x.enabled)?.id) } saveState(__state) }

export function updateModelMeta(id, patch){
  const m = __state.models[id]; if(!m) return
  const num = (v, def)=>{ const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : def }
  const next = { ...m }
  if(patch && 'contextWindow' in patch) next.contextWindow = num(patch.contextWindow, m.contextWindow)
  if(patch && 'tpm' in patch) next.tpm = num(patch.tpm, m.tpm)
  if(patch && 'rpm' in patch) next.rpm = num(patch.rpm, m.rpm)
  if(patch && 'tpd' in patch) next.tpd = num(patch.tpd, m.tpd)
  __state.models[id] = next
  saveState(__state)
}

export function addModel(id, meta){
  if(!id || typeof id !== 'string') return false
  id = id.trim()
  if(!id) return false
  if(__state.models[id]) return false
  const num = (v, def)=>{ const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : def }
  const m = {
    enabled: true,
    contextWindow: num(meta?.contextWindow, 8192),
    tpm: num(meta?.tpm, 8192),
    rpm: num(meta?.rpm, 60),
    tpd: num(meta?.tpd, 100000)
  }
  __state.models[id] = m
  if(!__state.activeModel || !__state.models[__state.activeModel]?.enabled) __state.activeModel = id
  saveState(__state)
  return true
}

export function deleteModel(id){
  // Only allow deleting custom models; base models can be disabled but not removed
  if(BASE_MODELS.find(b=>b.id===id)) return false
  if(!__state.models[id]) return false
  // If active, switch to first enabled remaining
  const wasActive = __state.activeModel === id
  delete __state.models[id]
  if(wasActive){
    const first = listModels().find(m=>m.enabled)
    __state.activeModel = first ? first.id : undefined
  }
  saveState(__state)
  return true
}
