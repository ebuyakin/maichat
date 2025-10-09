// Moved from src/ui/util.js (Phase 4 shared primitives move)
export function escapeHtml(s) {
  if (!s && s !== 0) return ''
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])
}
