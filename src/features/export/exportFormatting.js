// Formatting helpers for export feature

export function sanitizeFilename(name) {
  if (!name) return ''
  return String(name).replace(/[\/\\:*?"<>|]/g, '_')
}

export function defaultFilenameUTC(ext) {
  const d = new Date()
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const HH = String(d.getUTCHours()).padStart(2, '0')
  const MM = String(d.getUTCMinutes()).padStart(2, '0')
  const SS = String(d.getUTCSeconds()).padStart(2, '0')
  return `export_chat-${yyyy}${mm}${dd}-${HH}${MM}${SS}.${ext}`
}

export function formatLocalYYYYMMDD_HHMM(iso) {
  const d = new Date(iso)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const HH = String(d.getHours()).padStart(2, '0')
  const MM = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${HH}:${MM}`
}

export function computeFenceForText(text) {
  const matches = String(text || '').match(/`+/g)
  const maxRun = matches ? matches.reduce((m, s) => Math.max(m, s.length), 0) : 0
  const len = Math.max(3, maxRun + 1)
  return '`'.repeat(len)
}
