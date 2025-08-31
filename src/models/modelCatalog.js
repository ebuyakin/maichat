// Static model catalog (v1) with enable/disable + persistence.
// No dynamic fetching or custom models yet.

const STORAGE_KEY = 'maichat_model_catalog_v1'

// Base metadata (context windows approximate as tokens)
const BASE_MODELS = [
  { id:'gpt-4o', contextWindow:128000 },
  { id:'gpt-4o-mini', contextWindow:128000 },
  { id:'gpt-4.1', contextWindow:128000 },
  { id:'gpt-4.1-mini', contextWindow:128000 },
  { id:'gpt-3.5-turbo', contextWindow:16000 }
]

function loadState(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {} } catch { return {} }
}
function saveState(state){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) }

// Ensure state includes all base models; newly added appear enabled by default.
function normalize(state){
  if(!state.models) state.models = {}
  for(const bm of BASE_MODELS){
    if(!state.models[bm.id]){
      state.models[bm.id] = { enabled:true, contextWindow: bm.contextWindow }
    } else {
      if(typeof state.models[bm.id].contextWindow !== 'number') state.models[bm.id].contextWindow = bm.contextWindow
      if(typeof state.models[bm.id].enabled !== 'boolean') state.models[bm.id].enabled = true
    }
  }
  // Remove any stray unknown models (v1 scope)
  Object.keys(state.models).forEach(id=>{ if(!BASE_MODELS.find(b=>b.id===id)) delete state.models[id] })
  if(!state.activeModel || !state.models[state.activeModel]?.enabled){
    // choose first enabled baseline
    const first = BASE_MODELS.find(m=> state.models[m.id]?.enabled)
    if(first) state.activeModel = first.id
  }
  return state
}

let __state = normalize(loadState())

export function getActiveModel(){ return __state.activeModel }
export function setActiveModel(id){ if(__state.models[id]?.enabled){ __state.activeModel = id; saveState(__state) } }
export function listModels(){ return BASE_MODELS.map(m=> ({ id:m.id, contextWindow: __state.models[m.id].contextWindow, enabled: __state.models[m.id].enabled })) }
export function toggleModelEnabled(id){ const m = __state.models[id]; if(!m) return; m.enabled = !m.enabled; if(!m.enabled && __state.activeModel===id){ setActiveModel(listModels().find(x=>x.enabled)?.id) } saveState(__state) }
export function getContextWindow(id){ const m = __state.models[id]; return m ? m.contextWindow : 8192 }

export function ensureCatalogLoaded(){ /* noop: module init covers */ }
