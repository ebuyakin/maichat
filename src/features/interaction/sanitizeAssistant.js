// Phase 1 plain-text sanitizer (see docs/plain_text_policy.md)
// Removes: heading lines starting with ### (or more, space required), bold markers ** ** and __ __,
// collapses 3+ blank lines to max 2, trims leading/trailing blank lines, trims trailing spaces.
// Preserves numbered lists and other content. Idempotent and safe.

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
  // 7. Safety fallback: if sanitization erased all visible content but original had some
  if(s.length===0 && original.trim().length){ return original }
  return s
}

// Idempotency helper for tests (not used in production runtime)
export function _isIdempotent(sample){
  return sanitizeAssistantText(sanitizeAssistantText(sample)) === sanitizeAssistantText(sample)
}
