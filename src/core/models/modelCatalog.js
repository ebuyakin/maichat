// default preconfigured model catalog for new users
const STORAGE_KEY = 'maichat_model_catalog_v2'

/**
 * Supported AI providers
 * When adding a new provider: add ID here, create estimator in infrastructure/provider/tokenEstimation/, 
 * register in tokenEstimator.js, and add base models below
 * 
 * NOTE: This list must stay in sync with ADAPTERS in infrastructure/provider/adapterV2.js
 * (Different naming: 'google' here vs 'gemini' adapter name, 'xai' here vs 'grok' adapter name)
 */
export const SUPPORTED_PROVIDERS = ['openai', 'anthropic', 'google', 'xai']

const BASE_MODELS = [
  // OpenAI models (Tier 1 limits)
  { 
    id: 'gpt-5', 
    provider: 'openai', 
    contextWindow: 400000, 
    tpm: 500000, 
    rpm: 500, 
    tpd: 1500000,
    webSearch: true,
  },
  { 
    id: 'gpt-5-mini', 
    provider: 'openai', 
    contextWindow: 400000, 
    tpm: 500000, 
    rpm: 500, 
    tpd: 5000000,
    webSearch: true,
  },
  { 
    id: 'gpt-5-nano', 
    provider: 'openai', 
    contextWindow: 400000, 
    tpm: 200000, 
    rpm: 500, 
    tpd: 2000000,
    webSearch: true,
  },
  { 
    id: 'o4-mini', 
    provider: 'openai', 
    contextWindow: 128000, 
    tpm: 200000, 
    rpm: 500, 
    tpd: 2000000,
    webSearch: true,
  },
  // Anthropic models (Tier 1 limits)
  {
    id: 'claude-sonnet-4-5-20250929',
    provider: 'anthropic',
    contextWindow: 200000,
    tpm: 30000,
    rpm: 50,
    otpm: 8000,
    webSearch: true,
  },
  {
    id: 'claude-opus-4-1-20250805',
    provider: 'anthropic',
    contextWindow: 200000,
    tpm: 30000,
    rpm: 50,
    otpm: 8000,
    webSearch: true,
  },
  {
    id: 'claude-haiku-4-5-20251001',
    provider: 'anthropic',
    contextWindow: 200000,
    tpm: 50000,
    rpm: 50,
    otpm: 8000,
    webSearch: true,
  },
  // Gemini models (Free tier limits)
  {
    id: 'gemini-3-pro-preview', // new, added 25.11.2025
    provider: 'google',
    contextWindow: 1000000,
    tpm: 15000,
    rpm: 30,
    rpd: 14400,
    webSearch: true,
  },
  {
    id: 'gemini-2.5-pro',
    provider: 'google',
    contextWindow: 1000000,
    tpm: 125000,
    rpm: 2,
    rpd: 50,
    webSearch: true,
  },
  {
    id: 'gemini-2.5-flash',
    provider: 'google',
    contextWindow: 1000000,
    tpm: 250000,
    rpm: 10,
    rpd: 250,
    webSearch: true,
  },
  {
    id: 'gemini-2.0-flash',
    provider: 'google',
    contextWindow: 1000000,
    tpm: 1000000,
    rpm: 15,
    rpd: 200,
    webSearch: true,
  },
  // xAI models (Tier 1 limits)
  {
    id: 'grok-4-fast-non-reasoning',
    provider: 'xai',
    contextWindow: 2000000,
    tpm: 4000000,
    rpm: 480,
    webSearch: true,
  },
  {
    id: 'grok-4-fast-reasoning',
    provider: 'xai',
    contextWindow: 2000000,
    tpm: 4000000,
    rpm: 480,
    webSearch: true,
  },
  {
    id: 'grok-code-fast-1',
    provider: 'xai',
    contextWindow: 256000,
    tpm: 2000000,
    rpm: 480,
    webSearch: false,
  },
]
function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
  } catch {
    return {}
  }
}
function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}
function normalize(state) {
  if (!state.models) state.models = {}
  for (const bm of BASE_MODELS) {
    if (!state.models[bm.id]) {
      state.models[bm.id] = {
        enabled: true,
        provider: bm.provider || 'openai',
        contextWindow: bm.contextWindow,
        tpm: bm.tpm,
        rpm: bm.rpm,
      }
      // Only include optional fields if defined in BASE_MODELS
      if (bm.tpd !== undefined) state.models[bm.id].tpd = bm.tpd
      if (bm.otpm !== undefined) state.models[bm.id].otpm = bm.otpm
      if (bm.rpd !== undefined) state.models[bm.id].rpd = bm.rpd
      if (bm.webSearch !== undefined) state.models[bm.id].webSearch = bm.webSearch
    } else {
      if (typeof state.models[bm.id].contextWindow !== 'number')
        state.models[bm.id].contextWindow = bm.contextWindow
      if (typeof state.models[bm.id].enabled !== 'boolean') state.models[bm.id].enabled = true
      if (typeof state.models[bm.id].tpm !== 'number') state.models[bm.id].tpm = bm.tpm
      if (typeof state.models[bm.id].rpm !== 'number') state.models[bm.id].rpm = bm.rpm
      // TPD is optional - only set from BASE_MODELS if defined there
      if (state.models[bm.id].tpd === undefined && bm.tpd !== undefined) {
        state.models[bm.id].tpd = bm.tpd
      } else if (state.models[bm.id].tpd != null && !Number.isFinite(Number(state.models[bm.id].tpd))) {
        delete state.models[bm.id].tpd
      }
      if (typeof state.models[bm.id].provider !== 'string')
        state.models[bm.id].provider = bm.provider || 'openai'
      // Initialize otpm from BASE_MODELS if undefined, or validate if present
      if (state.models[bm.id].otpm === undefined && bm.otpm !== undefined) {
        state.models[bm.id].otpm = bm.otpm
      } else if (state.models[bm.id].otpm != null && !Number.isFinite(Number(state.models[bm.id].otpm))) {
        delete state.models[bm.id].otpm
      }
      // Initialize rpd from BASE_MODELS if undefined, or validate if present
      if (state.models[bm.id].rpd === undefined && bm.rpd !== undefined) {
        state.models[bm.id].rpd = bm.rpd
      } else if (state.models[bm.id].rpd != null && !Number.isFinite(Number(state.models[bm.id].rpd))) {
        delete state.models[bm.id].rpd
      }
      // Initialize webSearch from BASE_MODELS if undefined, or validate if present
      if (state.models[bm.id].webSearch === undefined && bm.webSearch !== undefined) {
        state.models[bm.id].webSearch = bm.webSearch
      } else if (state.models[bm.id].webSearch != null && typeof state.models[bm.id].webSearch !== 'boolean') {
        delete state.models[bm.id].webSearch
      }
    }
  }
  // Ensure any custom models (not in BASE_MODELS) have required fields
  for (const [id, m] of Object.entries(state.models)) {
    if (!BASE_MODELS.find((b) => b.id === id)) {
      if (typeof m.enabled !== 'boolean') m.enabled = true
      if (typeof m.contextWindow !== 'number') m.contextWindow = 8192
      if (typeof m.tpm !== 'number') m.tpm = 8192
      if (typeof m.rpm !== 'number') m.rpm = 60
      if (typeof m.tpd !== 'number') m.tpd = 100000
      if (typeof m.provider !== 'string') m.provider = 'openai'
      if (m.otpm != null && !Number.isFinite(Number(m.otpm))) delete m.otpm
      if (m.rpd != null && !Number.isFinite(Number(m.rpd))) delete m.rpd
      if (m.webSearch != null && typeof m.webSearch !== 'boolean') delete m.webSearch
    }
  }
  if (!state.activeModel || !state.models[state.activeModel]?.enabled) {
    // Prefer modern defaults if available (economical models first)
    const preferred = ['gpt-5-nano', 'gpt-5-mini', 'gpt-5']
    const pref = preferred.find((id) => state.models[id]?.enabled)
    if (pref) state.activeModel = pref
    else {
      // else first enabled base model, else any enabled custom
      const first =
        BASE_MODELS.find((m) => state.models[m.id]?.enabled) ||
        Object.keys(state.models)
          .map((id) => ({ id }))
          .find((x) => state.models[x.id]?.enabled)
      if (first) state.activeModel = first.id
    }
  }
  return state
}
let __state = normalize(loadState())
export function getActiveModel() {
  return __state.activeModel
}
export function setActiveModel(id) {
  if (__state.models[id]?.enabled) {
    __state.activeModel = id
    // Track last usage for MRU sorting
    __state.models[id].lastUsedAt = Date.now()
    saveState(__state)
  }
}
export function listModels() {
  // Include both base and custom models; sort by: enabled desc, then MRU (most recently used), then alphabetical
  const allIds = Array.from(
    new Set([...BASE_MODELS.map((m) => m.id), ...Object.keys(__state.models)])
  )
  return allIds
    .filter((id) => !!__state.models[id])
    .map((id) => ({
      id,
      provider: __state.models[id].provider || 'openai',
      contextWindow: __state.models[id].contextWindow,
      tpm: __state.models[id].tpm,
      rpm: __state.models[id].rpm,
      tpd: __state.models[id].tpd,
      otpm: __state.models[id].otpm,
      rpd: __state.models[id].rpd,
      webSearch: __state.models[id].webSearch,
      enabled: __state.models[id].enabled,
      lastUsedAt: __state.models[id].lastUsedAt,
    }))
    .sort((a, b) => {
      // 1. Enabled models first
      if (b.enabled !== a.enabled) return b.enabled - a.enabled
      
      // 2. Recently used first (MRU - Most Recently Used)
      const aUsed = __state.models[a.id]?.lastUsedAt || 0
      const bUsed = __state.models[b.id]?.lastUsedAt || 0
      if (bUsed !== aUsed) return bUsed - aUsed  // Descending (recent first)
      
      // 3. Alphabetical fallback for never-used models
      return a.id.localeCompare(b.id)
    })
}
export function toggleModelEnabled(id) {
  const m = __state.models[id]
  if (!m) return
  m.enabled = !m.enabled
  if (!m.enabled && __state.activeModel === id) {
    setActiveModel(listModels().find((x) => x.enabled)?.id)
  }
  saveState(__state)
}
export function getContextWindow(id) {
  const m = __state.models[id]
  return m ? m.contextWindow : 8192
}
export function getModelMeta(id) {
  const m = __state.models[id]
  if (!m)
    return {
      provider: 'openai',
      contextWindow: 8192,
      tpm: 8192,
      rpm: 60,
      tpd: 100000,
      otpm: undefined,
      rpd: undefined,
      webSearch: undefined,
      lastUsedAt: undefined,
    }
  return { ...m, provider: m.provider || 'openai', otpm: m.otpm, rpd: m.rpd, webSearch: m.webSearch, lastUsedAt: m.lastUsedAt }
}
export function ensureCatalogLoaded() {}

// New: explicit enable/disable and metadata updates
export function setModelEnabled(id, enabled) {
  const m = __state.models[id]
  if (!m) return
  const prev = !!m.enabled
  m.enabled = !!enabled
  if (prev && !m.enabled && __state.activeModel === id) {
    setActiveModel(listModels().find((x) => x.enabled)?.id)
  }
  saveState(__state)
}

export function updateModelMeta(id, patch) {
  const m = __state.models[id]
  if (!m) return
  const num = (v, def) => {
    const n = Number(v)
    return Number.isFinite(n) && n >= 0 ? n : def
  }
  const next = { ...m }
  if (patch && 'contextWindow' in patch)
    next.contextWindow = num(patch.contextWindow, m.contextWindow)
  if (patch && 'tpm' in patch) next.tpm = num(patch.tpm, m.tpm)
  if (patch && 'rpm' in patch) next.rpm = num(patch.rpm, m.rpm)
  if (patch && 'tpd' in patch) next.tpd = num(patch.tpd, m.tpd)
  if (patch && 'otpm' in patch) {
    const v = Number(patch.otpm)
    if (Number.isFinite(v) && v >= 0) next.otpm = v
    else if (patch.otpm === null) delete next.otpm
  }
  if (patch && 'rpd' in patch) {
    const v = Number(patch.rpd)
    if (Number.isFinite(v) && v >= 0) next.rpd = v
    else if (patch.rpd === null) delete next.rpd
  }
  if (patch && 'provider' in patch) next.provider = String(patch.provider || 'openai')
  if (patch && 'webSearch' in patch) next.webSearch = Boolean(patch.webSearch)
  __state.models[id] = next
  saveState(__state)
}

export function addModel(id, meta) {
  if (!id || typeof id !== 'string') return false
  id = id.trim()
  if (!id) return false
  if (__state.models[id]) return false
  const num = (v, def) => {
    const n = Number(v)
    return Number.isFinite(n) && n >= 0 ? n : def
  }
  const m = {
    enabled: true,
    provider: typeof meta?.provider === 'string' && meta.provider ? meta.provider : 'openai',
    contextWindow: num(meta?.contextWindow, 8192),
    tpm: num(meta?.tpm, 8192),
    rpm: num(meta?.rpm, 60),
    tpd: num(meta?.tpd, 100000),
    otpm:
      meta && Number.isFinite(Number(meta.otpm)) && Number(meta.otpm) >= 0
        ? Number(meta.otpm)
        : undefined,
    rpd:
      meta && Number.isFinite(Number(meta.rpd)) && Number(meta.rpd) >= 0
        ? Number(meta.rpd)
        : undefined,
    webSearch: typeof meta?.webSearch === 'boolean' ? meta.webSearch : undefined,
  }
  __state.models[id] = m
  if (!__state.activeModel || !__state.models[__state.activeModel]?.enabled)
    __state.activeModel = id
  saveState(__state)
  return true
}

export function deleteModel(id) {
  // Only allow deleting custom models; base models can be disabled but not removed
  if (BASE_MODELS.find((b) => b.id === id)) return false
  if (!__state.models[id]) return false
  // If active, switch to first enabled remaining
  const wasActive = __state.activeModel === id
  delete __state.models[id]
  if (wasActive) {
    const first = listModels().find((m) => m.enabled)
    __state.activeModel = first ? first.id : undefined
  }
  saveState(__state)
  return true
}

export function renameModel(oldId, newId) {
  // Can't rename if new ID already exists
  if (__state.models[newId]) return false

  // Can't rename base models
  if (BASE_MODELS.find((b) => b.id === oldId)) return false

  const model = __state.models[oldId]
  if (!model) return false

  // Create new model with new ID but same metadata
  __state.models[newId] = { ...model, id: newId }

  // Delete old model
  delete __state.models[oldId]

  // Update activeModel if it was the renamed model
  if (__state.activeModel === oldId) {
    __state.activeModel = newId
  }

  saveState(__state)
  return true
}
