// Moved from src/filter/parser.js (Phase 6.3) – original now re-export stub.
import { lex } from './lexer.js'

// AST node helpers
const nFilter = (kind, args) => ({ type: 'FILTER', kind, args })
const nAnd = (left, right) => ({ type: 'AND', left, right })
const nOr = (left, right) => ({ type: 'OR', left, right })
const nNot = (expr) => ({ type: 'NOT', expr })

export function parse(input) {
  const tokens = lex(input)
  let pos = 0
  const peek = () => tokens[pos]
  const consume = () => tokens[pos++]

  function parsePrimary() {
    const t = peek()
    if (t.type === 'OP' && t.value === '!') {
      consume()
      return nNot(parsePrimary())
    }
    if (t.type === 'PAREN' && t.value === '(') {
      consume()
      const expr = parseExpr()
      if (peek().type !== 'PAREN' || peek().value !== ')') throw new Error('Unclosed parenthesis')
      consume()
      return expr
    }
    if (t.type === 'COMMAND') {
      consume()
      // simplistic arg parse: optional OP + NUMBER or STRING or NUMBER alone for s / r
      let op = null,
        value = null
      if (peek().type === 'OP' && ['>', '<', '>=', '<=', '='].includes(peek().value))
        op = consume().value
      const nxt = peek()
      if (nxt.type === 'NUMBER') {
        // combine with following STRING unit if present (e.g., 24h, 7d, 2w, 6mo, 1y)
        const numTok = consume()
        const after = peek()
        if (after.type === 'STRING' && /^(min|m|h|d|w|mo|y)$/i.test(after.value || '')) {
          const unitTok = consume()
          value = String(numTok.value) + String(unitTok.value)
        } else {
          value = numTok.value
        }
      } else if (nxt.type === 'STRING') {
        value = consume().value
      }
      return nFilter(t.value, { op, value })
    }
    throw new Error('Unexpected token: ' + t.type + ' ' + t.value)
  }

  function parseAnd() {
    let left = parsePrimary()
    while (true) {
      const t = peek()
      if (t.type === 'OP' && t.value === '&') {
        consume()
        left = nAnd(left, parsePrimary())
        continue
      }
      // implicit AND: COMMAND after FILTER/paren/NOT result
      if (
        t.type === 'COMMAND' ||
        (t.type === 'OP' && t.value === '!') ||
        (t.type === 'PAREN' && t.value === '(')
      ) {
        // adjacency
        left = nAnd(left, parsePrimary())
        continue
      }
      break
    }
    return left
  }

  function parseExpr() {
    let left = parseAnd()
    while (true) {
      const t = peek()
      if (t.type === 'OP' && (t.value === '|' || t.value === '+')) {
        consume()
        left = nOr(left, parseAnd())
        continue
      }
      break
    }
    return left
  }

  if (!input.trim()) return { type: 'ALL' }
  const ast = parseExpr()
  if (peek().type !== 'EOF') throw new Error('Unexpected trailing input')
  return ast
}

/**
 * Check if the filter AST contains an unargumented 't' filter
 * Used to detect if history should refresh when topic changes in INPUT mode
 * Matches: 't' (plain) and 'tN' (last N from pending topic)
 * Does NOT match: 't"name"' (specific named topic)
 * @param {Object} ast - Parsed filter AST from parse()
 * @returns {boolean} - True if contains 't' or 'tN' (depends on pending topic)
 */
export function hasUnargumentedTopicFilter(ast) {
  if (!ast) return false

  function check(node) {
    if (!node) return false

    // Check if this is a 't' filter that depends on pending topic
    if (node.type === 'FILTER' && node.kind === 't') {
      // No value = plain 't'
      if (!node.args || !node.args.value) return true
      
      // Numeric value = 'tN' (last N from pending topic)
      const val = node.args.value
      if (typeof val === 'number' || /^\d+$/.test(String(val))) return true
      
      // String value = 't"name"' (specific topic) - does NOT depend on pending
      return false
    }

    // Recursively check child nodes
    if (node.type === 'NOT') return check(node.expr)
    if (node.type === 'AND' || node.type === 'OR') {
      return check(node.left) || check(node.right)
    }

    return false
  }

  return check(ast)
}

export function hasUnargumentedModelFilter(ast) {
  if (!ast) return false

  function check(node) {
    if (!node) return false

    // Check if this is an 'm' filter without value
    if (node.type === 'FILTER' && node.kind === 'm') {
      // Check if args.value is null/undefined/empty (means unargumented)
      return !node.args || !node.args.value
    }

    // Recursively check child nodes
    if (node.type === 'NOT') return check(node.expr)
    if (node.type === 'AND' || node.type === 'OR') {
      return check(node.left) || check(node.right)
    }

    return false
  }

  return check(ast)
}
