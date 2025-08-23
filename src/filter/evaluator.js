// Evaluator for subset filters

/** Evaluate AST against list of pairs.
 * @param {any} ast
 * @param {import('../models/messagePair.js').MessagePair[]} pairs
 * @returns {import('../models/messagePair.js').MessagePair[]} filtered in chronological order
 */
export function evaluate(ast, pairs){
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
      case 'a': return pairs.filter(p=>p.includeInContext)
      case 'x': return pairs.filter(p=>!p.includeInContext)
      case 't': {
        if(!value) return pairs
        // basic substring match on topic name resolved externally (pass in pre-resolved names via pair?)
        // For now assume topicId not meaningful substring; we treat value as substring on stored topicId path placeholder.
        return pairs.filter(p=> p.topicId && p.topicId.toLowerCase().includes(String(value).toLowerCase()))
      }
      case 'd': throw new Error('Date filtering (d) not yet implemented')
      case 'm': return value ? pairs.filter(p=> p.model.toLowerCase() === String(value).toLowerCase()) : pairs
      case 'c': return value ? pairs.filter(p=> (p.userText+"\n"+p.assistantText).toLowerCase().includes(String(value).toLowerCase())) : pairs
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
    // preserve chronological order by sorting by original index
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
