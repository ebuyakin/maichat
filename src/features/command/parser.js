// Moved from src/filter/parser.js (Phase 6.3) – original now re-export stub.
import { lex } from './lexer.js'

// AST node helpers
const nFilter = (kind, args)=>({ type:'FILTER', kind, args })
const nAnd = (left,right)=>({ type:'AND', left, right })
const nOr = (left,right)=>({ type:'OR', left, right })
const nNot = (expr)=>({ type:'NOT', expr })

export function parse(input){
  const tokens = lex(input)
  let pos = 0
  const peek = ()=> tokens[pos]
  const consume = ()=> tokens[pos++]

  function parsePrimary(){
    const t = peek()
    if(t.type === 'OP' && t.value === '!'){ consume(); return nNot(parsePrimary()) }
    if(t.type === 'PAREN' && t.value === '('){
      consume(); const expr = parseExpr();
      if(peek().type !== 'PAREN' || peek().value !== ')') throw new Error('Unclosed parenthesis')
      consume(); return expr
    }
    if(t.type === 'COMMAND'){
      consume()
      // simplistic arg parse: optional OP + NUMBER or STRING or NUMBER alone for s / r
      let op = null, value = null
      if(peek().type === 'OP' && ['>','<','>=','<=','='].includes(peek().value)) op = consume().value
      const nxt = peek()
      if(nxt.type === 'NUMBER' || nxt.type === 'STRING'){ value = consume().value }
      return nFilter(t.value, { op, value })
    }
    throw new Error('Unexpected token: '+t.type+' '+t.value)
  }

  function parseAnd(){
    let left = parsePrimary()
    while(true){
      const t = peek()
      if(t.type === 'OP' && t.value === '&'){ consume(); left = nAnd(left, parsePrimary()); continue }
      // implicit AND: COMMAND after FILTER/paren/NOT result
      if(t.type === 'COMMAND' || (t.type === 'OP' && t.value === '!') || (t.type === 'PAREN' && t.value === '(')){
        // adjacency
        left = nAnd(left, parsePrimary()); continue
      }
      break
    }
    return left
  }

  function parseExpr(){
    let left = parseAnd()
    while(true){
      const t = peek()
      if(t.type === 'OP' && (t.value === '|' || t.value === '+')){ consume(); left = nOr(left, parseAnd()); continue }
      break
    }
    return left
  }

  if(!input.trim()) return { type:'ALL' }
  const ast = parseExpr()
  if(peek().type !== 'EOF') throw new Error('Unexpected trailing input')
  return ast
}
