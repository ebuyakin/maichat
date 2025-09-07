// Moved from src/filter/evaluator.js (Phase 6.3) – original now re-export stub.

/** Evaluate AST against list of pairs.
 * @param {any} ast
 * @param {import('../../models/messagePair.js').MessagePair[]} pairs
 * @returns {import('../../models/messagePair.js').MessagePair[]} filtered in chronological order
 */
import { resolveTopicFilter } from './topicResolver.js'

export function evaluate(ast, pairs, opts = {}){
  if(!ast || ast.type === 'ALL') return pairs

  const byId = new Map(pairs.map(p=>[p.id,p]))
  const idOrder = pairs.map(p=>p.id)

  function evalNode(node){
    switch(node.type){
      case 'FILTER': return evalFilter(node)
      case 'AND': return intersect(evalNode(node.left), evalNode(node.right))
      case 'OR': return union(evalNode(node.left), evalNode(node.right))
      case 'NOT': return negate(evalNode(node.expr))
      default: throw new Error('Unknown node '+node.type)
    }
  }

  function evalFilter(f){
    const kind = f.kind
    const { op, value } = f.args
    switch(kind){
      case 's': return filterStar(op, value)
      case 'r': return filterRecent(value)
      case 'b': return pairs.filter(p=>p.colorFlag === 'b')
      case 'g': return pairs.filter(p=>p.colorFlag === 'g')
  case 'e': return pairs.filter(p=> p.lifecycleState === 'error' || (p.errorMessage && String(p.errorMessage).trim()!=='') )
      case 't': {
        // Resolve topic expression to a set of topicIds (supports bare t, wildcards, paths, descendants)
        const topicIds = resolveTopicFilter(value, { store: opts.store, currentTopicId: opts.currentTopicId })
        if(!topicIds || topicIds.size===0) return []
        return pairs.filter(p=> topicIds.has(p.topicId))
      }
  case 'd': return filterDate(op, value)
  case 'm': return filterModel(value)
  case 'c': return filterContent(value)
      default: return pairs
    }
  }

  function filterStar(op, valStr){
    if(valStr == null) return pairs
    const v = Number(valStr)
    return pairs.filter(p=> compare(p.star, op || '=', v))
  }
  function filterRecent(valStr){
    const n = Number(valStr)
    if(!n || n <= 0) return []
    return pairs.slice(-n)
  }
  function parseRelative(value){
    if(value == null) return null
    const m = String(value).match(/^\s*(\d+)\s*([a-zA-Z]*)\s*$/)
    if(!m) return null
    const n = Number(m[1])
    const unit = (m[2]||'d').toLowerCase()
    const ms = {
      min: 60*1000,
      m: 60*1000,
      h: 60*60*1000,
      d: 24*60*60*1000,
      w: 7*24*60*60*1000,
      mo: 30*24*60*60*1000, // approx
      y: 365*24*60*60*1000  // approx
    }
    let mult = ms[unit]
    if(mult == null){
      // try explicit units
      if(unit === 'min') mult = ms.min
    }
    if(!mult) return null
    return n * mult
  }
  function parseAbsolute(str){
    // Accept YYYY-MM-DD or YY-MM-DD; map YY to 2000+YY
    const s = String(str).trim()
    const m = s.match(/^(\d{2,4})-(\d{2})-(\d{2})$/)
    if(!m) return null
    let year = Number(m[1])
    if(year < 100) year = 2000 + year
    const month = Number(m[2]) - 1
    const day = Number(m[3])
    const dt = new Date(year, month, day)
    if(isNaN(dt.getTime())) return null
    return dt
  }
  function startOfLocalDay(d){ return new Date(d.getFullYear(), d.getMonth(), d.getDate()) }
  function endOfLocalDay(d){ return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23,59,59,999) }
  function filterDate(op, raw){
    // Relative age: compare (now - createdAt) vs threshold
    const now = opts.now instanceof Date ? opts.now : new Date()
    const relMs = parseRelative(raw)
    if(relMs != null){
      return pairs.filter(p=>{
        const age = now.getTime() - p.createdAt
        return compare(age, op || '<=', relMs) // e.g., d<7d means age < 7d
      })
    }
    const abs = parseAbsolute(raw)
    if(abs){
      const start = startOfLocalDay(abs).getTime()
      const end = endOfLocalDay(abs).getTime()
      return pairs.filter(p=>{
        const t = p.createdAt
        switch(op){
          case '>': return t > end
          case '>=': return t >= start
          case '<': return t < start
          case '<=': return t <= end
          case '=':
          default:
            return t >= start && t <= end
        }
      })
    }
    throw new Error('Invalid date value')
  }

  function globToRegExp(pattern){
    const esc = String(pattern).replace(/[.+^${}()|[\]\\]/g, '\\$&')
    const re = '^' + esc.replace(/\*/g, '.*') + '$'
    return new RegExp(re, 'i')
  }
  function filterModel(raw){
    const pattern = (raw != null && String(raw).trim() !== '')
      ? String(raw).trim()
      : (opts.currentModel ? String(opts.currentModel).trim() : '')
    if(!pattern) return pairs
    const hasWildcard = pattern.includes('*')
    if(hasWildcard){
      const re = globToRegExp(pattern)
      return pairs.filter(p=> re.test((p.model||'').toString()))
    }
    const target = pattern.toLowerCase()
    return pairs.filter(p=> (p.model||'').toString().toLowerCase() === target)
  }

  function filterContent(raw){
    if(raw == null || String(raw).trim()==='') return pairs
    const textOf = (p)=> ((p.userText||'')+"\n"+(p.assistantText||''))
    const pattern = String(raw)
    if(pattern.includes('*')){
      const re = globToContentRegExp(pattern)
      return pairs.filter(p=> re.test(textOf(p)))
    }
    const sub = pattern.toLowerCase()
    return pairs.filter(p=> textOf(p).toLowerCase().includes(sub))
  }

  function globToContentRegExp(pattern){
    const esc = String(pattern).replace(/[.+^${}()|[\]\\]/g, '\\$&')
  const re = esc.replace(/\*/g, '[\\s\\S]*')
  return new RegExp(re, 'i')
  }
  function compare(actual, op, target){
    switch(op){
      case '=': return actual === target
      case '>': return actual > target
      case '>=': return actual >= target
      case '<': return actual < target
      case '<=': return actual <= target
      default: return actual === target
    }
  }

  function intersect(a,b){
    const set = new Set(b.map(p=>p.id))
    return a.filter(p=> set.has(p.id))
  }
  function union(a,b){
    const seen = new Set()
    const out = []
    for(const arr of [a,b]){
      for(const p of arr){ if(!seen.has(p.id)){ seen.add(p.id); out.push(p) } }
    }
    const idx = new Map(idOrder.map((id,i)=>[id,i]))
    out.sort((p1,p2)=> idx.get(p1.id)-idx.get(p2.id))
    return out
  }
  function negate(arr){
    const set = new Set(arr.map(p=>p.id))
    return pairs.filter(p=> !set.has(p.id))
  }

  return evalNode(ast)
}
