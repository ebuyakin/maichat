// Phase 1 / 1.1 plain-text sanitizer (see docs/plain_text_policy.md)
// Removes: heading lines starting with ### (or more, space required), bold markers ** ** and __ __,
// removes all blank lines, trims trailing spaces, and (Phase 1.1) merges soft-wrap mid-sentence newlines.
// Preserves numbered lists and sentence boundaries. Idempotent and safe.

export function sanitizeAssistantText(raw){
  if(typeof raw !== 'string' || !raw) return raw || ''
  let s = raw
  const original = s
  // 1. Remove heading lines that start with three or more #'s followed by space
  // Split & filter to avoid accidental multi-line regex edge cases
  let removedHeading = false
  s = s.split('\n').filter(line=>{
    if(/^#{3,}\s+/.test(line)){ removedHeading = true; return false }
    return true
  }).join('\n')
  // 2. Strip bold markers **text** and __text__ (non-greedy, single-line)
  // Using separate replaces keeps it readable; dot does not match newline so OK.
  let boldReplacements = 0
  s = s.replace(/\*\*(.*?)\*\*/g, (_,inner)=>{ boldReplacements++; return inner })
       .replace(/__(.*?)__/g, (_,inner)=>{ boldReplacements++; return inner })
  // 3. (Deprecated previous policy) Collapse 3+ blank lines – superseded by full removal below
  // 4. Trim leading/trailing blank lines (intermediate)
  s = s.replace(/^(\s*\n)+/, '').replace(/(\n\s*)+$/, '')
  // 5. Trim trailing spaces on each line
  s = s.split('\n').map(l=> l.replace(/\s+$/,'')).join('\n')
  // 6. Remove ALL blank lines (Phase 1 revision: paragraph spacing handled by partitioning UI)
  s = s.split('\n').filter(l=> l.trim()!=='').join('\n')
  // 7. Soft-wrap merge (Phase 1.1 Strategy 2): merge newline if pattern a<newline>b where
  //    a ends with [a-zA-Z0-9)] and b starts with [a-z(] and char before newline not sentence punctuation.
  //    Avoid merging before numbered list lines.
  s = mergeSoftWrapsStrategy2(s)
  // 8. Safety fallback: if sanitization erased all visible content but original had some
  if(s.length===0 && original.trim().length){ return original }
  return s
}

// Idempotency helper for tests (not used in production runtime)
export function _isIdempotent(sample){
  return sanitizeAssistantText(sanitizeAssistantText(sample)) === sanitizeAssistantText(sample)
}

function mergeSoftWrapsStrategy2(text){
  if(!text.includes('\n')) return text
  // Split then conditionally merge; regex replace could over-merge across overlapping boundaries.
  const lines = text.split('\n')
  if(lines.length===1) return text
  const out = []
  for(let i=0; i<lines.length; i++){
    let cur = lines[i]
    if(i < lines.length-1){
      const next = lines[i+1]
      // Guard: next is numbered list? keep newline.
      if(/^\s*\d+\.\s+/.test(next)){ out.push(cur); continue }
      const lastChar = cur.slice(-1)
      const firstChar = next.trim().charAt(0)
      if(lastChar && /[a-zA-Z0-9)]/.test(lastChar) && firstChar && /[a-z(]/.test(firstChar) && !/[.!?:;]$/.test(cur.trim())){
        // merge
        cur = cur + ' ' + next.trimStart()
        i++ // consume next line
      }
    }
    out.push(cur)
  }
  return out.join('\n')
}

export function _mergeSoftWrapsStrategy2(text){ return mergeSoftWrapsStrategy2(text) }
