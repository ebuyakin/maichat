// HistoryView: encapsulates rendering of message parts list.
// Currently performs full re-render; future optimization may diff or virtualize.

import { escapeHtml } from '../util.js'

export function createHistoryView({ store, onActivePartRendered }){
  const container = document.getElementById('history')
  if(!container) throw new Error('history container missing')

  function render(parts){
    const byPair = {}
    for(const part of parts){ (byPair[part.pairId] ||= []).push(part) }
    container.innerHTML = Object.entries(byPair).map(([pairId, parts])=>{
      return `<div class="pair" data-pair-id="${pairId}">${parts.map(pt=> partHtml(pt)).join('')}</div>`
    }).join('')
    if(onActivePartRendered) onActivePartRendered()
  }

  function partHtml(pt){
    if(pt.role === 'meta'){
      const pair = store.pairs.get(pt.pairId)
      const topic = store.topics.get(pair.topicId)
      const ts = formatTimestamp(pair.createdAt)
      const topicPath = topic ? formatTopicPath(store, topic.id) : ''
      return `<div class="part meta" data-part-id="${pt.id}">
        <div class="meta-left">
          <span class="badge include" data-include="${pair.includeInContext}">${pair.includeInContext? 'in':'out'}</span>
          <span class="badge stars">${'★'.repeat(pair.star)}${'☆'.repeat(Math.max(0,3-pair.star))}</span>
          <span class="badge topic" title="${topic?escapeHtml(topicPath):''}">${topic?escapeHtml(middleTruncate(topicPath, 72)):''}</span>
        </div>
        <div class="meta-right">
          <span class="badge model">${pair.model}</span>
          <span class="badge timestamp" data-ts="${pair.createdAt}">${ts}</span>
        </div>
      </div>`
    }
    return `<div class="part ${pt.role}" data-part-id="${pt.id}">${escapeHtml(pt.text)}</div>`
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
