// Message part splitting & navigation utilities
// Initial implementation: single-part splitting (placeholder) with pluggable strategy later.

/** Split raw text into logical parts. Placeholder: returns single part. */
export function splitText(text, role){
  if(!text) return []
  return [text]
}

/** Build flattened parts list from ordered message pairs. */
export function buildParts(pairs){
  const parts = []
  for(const pair of pairs){
    const userParts = splitText(pair.userText, 'user')
    userParts.forEach((t,i)=> parts.push({ id:`${pair.id}:u:${i}`, pairId:pair.id, role:'user', index:i, text:t }))
    parts.push({ id:`${pair.id}:meta`, pairId:pair.id, role:'meta', index:0, text:null })
    const assistantParts = splitText(pair.assistantText, 'assistant')
    assistantParts.forEach((t,i)=> parts.push({ id:`${pair.id}:a:${i}`, pairId:pair.id, role:'assistant', index:i, text:t }))
  }
  return parts
}

/** Active part state */
export class ActivePartController {
  constructor(){ this.parts=[]; this.activeIndex=0 }
  setParts(parts){ this.parts = parts; if(this.activeIndex >= parts.length) this.activeIndex = parts.length? parts.length-1:0 }
  setActiveById(id){ const idx = this.parts.findIndex(p=>p.id===id); if(idx!==-1){ this.activeIndex=idx } }
  active(){ return this.parts[this.activeIndex] }
  first(){ if(this.parts.length){ this.activeIndex=0 } }
  last(){ if(this.parts.length){ this.activeIndex=this.parts.length-1 } }
  next(){ if(this.activeIndex < this.parts.length-1) this.activeIndex++ }
  prev(){ if(this.activeIndex > 0) this.activeIndex-- }
}

export function scrollActiveIntoView(container, activeId){
  const el = container.querySelector(`[data-part-id="${activeId}"]`)
  if(el) el.scrollIntoView({ block:'center', inline:'nearest' })
}
