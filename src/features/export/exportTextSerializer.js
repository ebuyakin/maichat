import { formatLocalYYYYMMDD_HHMM } from './exportFormatting.js'

export function buildTextExport({ pairs, meta }){
  const header = [
    'Meta:',
    `  generatedAt: ${meta?.generatedAt || new Date().toISOString()}`,
    meta?.app ? `  app: ${meta.app}` : null,
    `  filterInput: ${meta?.filterInput || ''}`,
    `  orderApplied: ${meta?.orderApplied || 'time'}`,
    `  count: ${Array.isArray(pairs) ? pairs.length : 0}`,
    '',
    '---'
  ].filter(Boolean).join('\n')

  const blocks = []
  let idx = 0
  for (const p of (pairs||[])){
    idx++
    const time = formatLocalYYYYMMDD_HHMM(p.createdAt)
    const err = p.errorState ? ' [error]' : ''
    const headerLine = `#${idx} ${p.topicPath || ''} — ${p.model || ''} — ${time}${err}`
    const metaLine = `Stars: ${p.stars ?? p.star ?? 0} · Flag: ${p.flagColor ?? p.colorFlag ?? 'grey'}`
    blocks.push(
      headerLine,
      metaLine,
      '',
      '[User]',
      p.userText || '',
      '',
      '[Assistant]',
      p.errorState && p.errorMessage ? `Error: ${p.errorMessage}` : '',
      p.assistantText || '',
      ''.padEnd(80, '-')
    )
  }

  return [header, blocks.join('\n')].filter(Boolean).join('\n\n')
}
