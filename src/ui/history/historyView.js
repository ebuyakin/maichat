// HistoryView: encapsulates rendering of message parts list.
// Currently performs full re-render; future optimization may diff or virtualize.

import { escapeHtml } from '../util.js'
import { getSettings } from '../../settings/index.js'

export function createHistoryView({ store, onActivePartRendered }){
  const container = document.getElementById('history')
  if(!container) throw new Error('history container missing')

  function render(parts){
    // Build flat token list with explicit gap nodes between parts replacing margin model.
    const tokens = []
    for(let i=0;i<parts.length;i++){
      const cur = parts[i]
      if(i>0){
        const prev = parts[i-1]
        const gapType = classifyGap(prev, cur)
        if(gapType){
          const h = gapHeightFor(gapType)
          tokens.push(`<div class="gap gap-${gapType}" data-gap-type="${gapType}" style="height:${h}px"></div>`)
        }
      }
      tokens.push(partHtml(cur))
    }
    container.innerHTML = tokens.join('')
    if(onActivePartRendered) onActivePartRendered()
  }

  function gapHeightFor(type){
    const s = getSettings()
    if(type==='between') return s.gapBetweenPx||0
    if(type==='meta') return s.gapMetaPx||0
    if(type==='intra') return s.gapIntraPx||0
    return 0
  }

  function classifyGap(prev, cur){
    if(prev.pairId !== cur.pairId) return 'between'
    if(prev.role==='user' && cur.role==='meta') return 'meta'
    if(prev.role==='meta' && cur.role==='assistant') return 'meta'
    if(prev.role===cur.role && (cur.role==='user'||cur.role==='assistant')) return 'intra'
    return null
  }

  function partHtml(pt){
    if(pt.role === 'meta'){
      const pair = store.pairs.get(pt.pairId)
      const topic = store.topics.get(pair.topicId)
      const ts = formatTimestamp(pair.createdAt)
  const topicPath = topic ? formatTopicPath(store, topic.id) : '(no topic)'
  const modelName = pair.model || '(model)'
  return `<div class="part meta" data-part-id="${pt.id}" data-meta="1" tabindex="-1" aria-hidden="true"><div class="part-inner">
        <div class="meta-left">
          <span class="badge include" data-include="${pair.includeInContext}">${pair.includeInContext? 'in':'out'}</span>
          <span class="badge stars">${'★'.repeat(pair.star)}${'☆'.repeat(Math.max(0,3-pair.star))}</span>
          <span class="badge topic" title="${escapeHtml(topicPath)}">${escapeHtml(middleTruncate(topicPath, 72))}</span>
        </div>
        <div class="meta-right">
          <span class="badge model">${escapeHtml(modelName)}</span>
          <span class="badge timestamp" data-ts="${pair.createdAt}">${ts}</span>
        </div>
      </div></div>`
    }
    return `<div class="part ${pt.role}" data-part-id="${pt.id}"><div class="part-inner">${escapeHtml(pt.text)}</div></div>`
  }

  return { render }
}

function formatTimestamp(ts){
  const d = new Date(ts)
  const yy = String(d.getFullYear()).slice(-2)
  const dd = String(d.getDate()).padStart(2,'0')
  const mm = String(d.getMonth()+1).padStart(2,'0')
  const hh = String(d.getHours()).padStart(2,'0')
  const mi = String(d.getMinutes()).padStart(2,'0')
  const ss = String(d.getSeconds()).padStart(2,'0')
  return `${yy}-${dd}-${mm} ${hh}:${mi}:${ss}`
}

function formatTopicPath(store, id){
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
