// messageList.js
// Build a message-oriented representation from pairs. Minimal, stable shape.

/**
 * @typedef {Object} MsgPart
 * @property {string} id       Unique part id (stable for DOM)
 * @property {string} role     'meta' | 'user' | 'assistant'
 * @property {string} pairId   Underlying pair id
 * @property {string} [text]   Text for user/assistant; meta has none
 */
/**
 * @typedef {Object} Message
 * @property {string} id
 * @property {MsgPart[]} parts  In visual order: user -> meta -> assistant (if present)
 */

export function buildMessages(pairs){
  const out = []
  const safe = (v)=> (v==null? '': String(v))
  for(const p of pairs){
    const id = p.id
    /** @type {MsgPart[]} */
    const parts = []
    // user
    parts.push({ id: `${id}:u`, role:'user', pairId:id, text: safe(p.userText||'') })
    // meta
    parts.push({ id: `${id}:meta`, role:'meta', pairId:id })
    // assistant (may be empty during sending)
    const aText = safe(p.assistantText||'')
    if(aText || p.lifecycleState){
      parts.push({ id: `${id}:a`, role:'assistant', pairId:id, text: aText })
    }
    out.push({ id, parts })
  }
  return out
}

// Temporary helper: convert message parts back to legacy flat parts for current renderer.
export function flattenMessagesToParts(messages){
  const flat = []
  for(const m of messages){
    for(const pt of m.parts){ if(pt.role !== 'meta') flat.push(pt) }
  }
  return flat
}
