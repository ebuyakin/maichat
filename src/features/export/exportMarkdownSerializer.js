import { computeFenceForText, formatLocalYYYYMMDD_HHMM } from './exportFormatting.js'

export function buildMarkdownExport({ pairs, meta }) {
  const headerObj = {
    generatedAt: meta?.generatedAt || new Date().toISOString(),
    app: meta?.app,
    filterInput: meta?.filterInput || '',
    orderApplied: meta?.orderApplied || 'time',
    count: Array.isArray(pairs) ? pairs.length : 0,
  }
  const header = '```json meta\n' + JSON.stringify(headerObj, null, 2) + '\n```\n\n'
  const lines = [header]
  let idx = 0
  for (const p of pairs || []) {
    idx++
    const localTime = formatLocalYYYYMMDD_HHMM(p.createdAt)
    const flagLine = `Stars: ${p.stars ?? p.star ?? 0} · Flag: ${p.flagColor ?? p.colorFlag ?? 'grey'}`
    const err = p.errorState ? ' — error' : ''
    lines.push(`## ${idx}. ${p.topicPath || ''} — ${p.model || ''} — ${localTime}${err}`)
    lines.push(flagLine, '')
    const fenceU = computeFenceForText(p.userText)
    lines.push('### User', fenceU, p.userText || '', fenceU, '')
    lines.push('### Assistant')
    if (p.errorState && p.errorMessage) lines.push(`> Error: ${p.errorMessage}`)
    const fenceA = computeFenceForText(p.assistantText)
    lines.push(fenceA, p.assistantText || '', fenceA, '')
  }
  return lines.join('\n')
}
