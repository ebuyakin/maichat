// userPrefs.js
// Encapsulates localStorage-backed user preferences: command history and filter-active flag.

const KEY_HISTORY = 'maichat_command_history'
const KEY_FILTER_ACTIVE = 'maichat_filter_active'
const MAX = 100

export function loadCommandHistory() {
  try {
    const raw = localStorage.getItem(KEY_HISTORY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.slice(-MAX) : []
  } catch {
    return []
  }
}

export function saveCommandHistory(history) {
  try {
    localStorage.setItem(KEY_HISTORY, JSON.stringify((history || []).slice(-MAX)))
  } catch {}
}

export function pushCommand(history, q) {
  if (!q) return history
  if (history[history.length - 1] === q) return history
  const next = [...history, q]
  return next.length > MAX ? next.slice(-MAX) : next
}

export function setFilterActive(v) {
  try {
    localStorage.setItem(KEY_FILTER_ACTIVE, v ? 'true' : 'false')
  } catch {}
}
export function getFilterActive() {
  try {
    return localStorage.getItem(KEY_FILTER_ACTIVE) === 'true'
  } catch {
    return false
  }
}
