// Message part splitting & navigation utilities
// Initial implementation: single-part splitting (placeholder) with pluggable strategy later.

import { partitionMessage } from '../partition/partitioner.js'

/** Split raw text into logical parts using current partitioner. */
export function splitText(text, role, pairId){
  return partitionMessage({ text, role, pairId })
}

/** Build flattened parts list from ordered message pairs. */
export function buildParts(pairs){
  const parts = []
  for(const pair of pairs){
  const userParts = splitText(pair.userText, 'user', pair.id)
  userParts.forEach((p)=> parts.push(p))
    parts.push({ id:`${pair.id}:meta`, pairId:pair.id, role:'meta', index:0, text:null })
  const assistantParts = splitText(pair.assistantText, 'assistant', pair.id)
  assistantParts.forEach((p)=> parts.push(p))
  }
  return parts
}

/** Active part state */
export class ActivePartController {
  constructor(){ this.parts=[]; this.activeIndex=0; this.lastActiveMeta=null }
  setParts(parts){
    const prev = this.active()
    this.parts = parts
    if(prev){
      // Try exact id
      let idx = this.parts.findIndex(p=>p.id===prev.id)
      if(idx === -1){
        // Approximate (A1): same pair, same role, closest index
        const candidates = this.parts.filter(p=> p.pairId===prev.pairId && p.role===prev.role)
        if(candidates.length){
          // choose closest index (simple for now: same index or clamp)
          const targetIdx = Math.min(prev.index, candidates.length-1)
          const chosen = candidates[targetIdx]
          idx = this.parts.findIndex(p=>p.id===chosen.id)
        }
      }
      if(idx !== -1) this.activeIndex = idx
    }
    if(this.activeIndex >= this.parts.length) this.activeIndex = this.parts.length? this.parts.length-1:0
  }
  setActiveById(id){ const idx = this.parts.findIndex(p=>p.id===id); if(idx!==-1){ this.activeIndex=idx } }
  active(){ return this.parts[this.activeIndex] }
  first(){ if(this.parts.length){ this.activeIndex=0 } }
  last(){ if(this.parts.length){ this.activeIndex=this.parts.length-1 } }
  next(){ if(this.activeIndex < this.parts.length-1) this.activeIndex++ }
  prev(){ if(this.activeIndex > 0) this.activeIndex-- }
}
