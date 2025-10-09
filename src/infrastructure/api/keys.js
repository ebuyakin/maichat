// Moved from src/api/keys.js (Phase 3 infrastructure move)
// Centralized API key storage & retrieval utilities
// Keys stored in localStorage under single JSON object 'maichat_api_keys'
// Legacy (pre M6.3) OpenAI key lived at 'maichat.openai.key' (string). We migrate transparently.

const STORAGE_KEY = 'maichat_api_keys'
const LEGACY_OPENAI_KEY = 'maichat.openai.key'

export function loadApiKeys() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
  } catch {
    return {}
  }
}
export function saveApiKeys(obj) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(obj || {}))
}

function migrateLegacy() {
  try {
    const legacy = localStorage.getItem(LEGACY_OPENAI_KEY)
    if (legacy) {
      const cur = loadApiKeys()
      if (!cur.openai) {
        cur.openai = legacy
        saveApiKeys(cur)
      }
      // remove legacy key so mismatch bugs surface if code still references it
      try {
        localStorage.removeItem(LEGACY_OPENAI_KEY)
      } catch {}
    }
  } catch {}
}

export function getApiKey(provider) {
  migrateLegacy()
  const keys = loadApiKeys()
  return keys[provider] || ''
}

export function setApiKey(provider, value) {
  const keys = loadApiKeys()
  if (value) keys[provider] = value
  else delete keys[provider]
  saveApiKeys(keys)
}
