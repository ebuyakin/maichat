// Moved from src/filter/lexer.js (Phase 6.3) – original now re-export stub.
// Lexer (subset Phase 4 MVP) - tokens: COMMAND, NUMBER, STRING, OP, PAREN, EOF

const COMMANDS = new Set(['s', 'r', 't', 'm', 'b', 'g', 'c', 'd', 'e', 'o'])

/** @typedef {{type:string,value?:string,start:number,end:number}} Token */

export function lex(input) {
  const tokens = []
  let i = 0
  const len = input.length
  const push = (type, value, start, end) => tokens.push({ type, value, start, end })
  while (i < len) {
    const ch = input[i]
    const start = i
    if (/\s/.test(ch)) {
      i++
      continue
    }
    if (ch === '(' || ch === ')') {
      push('PAREN', ch, start, ++i)
      continue
    }
    if (ch === '&' || ch === '|' || ch === '+' || ch === '!') {
      push('OP', ch, start, ++i)
      continue
    }
    if (ch === '>' || ch === '<' || ch === '=') {
      let val = ch
      i++
      if ((ch === '>' || ch === '<') && input[i] === '=') {
        val += '='
        i++
      }
      push('OP', val, start, i)
      continue
    }
    if (COMMANDS.has(ch)) {
      // command letter; may be followed by number or quoted string parsed later by parser
      push('COMMAND', ch, start, ++i)
      continue
    }
    if (ch === "'" || ch === '"') {
      const quote = ch
      i++
      let str = ''
      while (i < len) {
        const c = input[i]
        if (c === '\\') {
          const next = input[i + 1]
          if (next) {
            str += next
            i += 2
            continue
          }
        }
        if (c === quote) {
          i++
          break
        }
        str += c
        i++
      }
      push('STRING', str, start, i)
      continue
    }
    if (/\d/.test(ch)) {
      // Scan digits; if followed by '-' treat the whole [0-9-]+ run as a STRING (date-like), else NUMBER
      let j = i + 1
      while (j < len && /\d/.test(input[j])) j++
      if (input[j] === '-') {
        let str = input.slice(i, j)
        let k = j
        while (k < len && /[0-9\-]/.test(input[k])) k++
        str = input.slice(i, k)
        push('STRING', str, start, k)
        i = k
        continue
      }
      let num = input.slice(i, j)
      i = j
      push('NUMBER', num, start, i)
      continue
    }
    // fallback: treat word chars as bare STRING (simplifies early impl)
    if (/[a-zA-Z_]/.test(ch)) {
      let w = ch
      i++
      while (i < len && /[a-zA-Z0-9_\-]/.test(input[i])) w += input[i++]
      push('STRING', w, start, i)
      continue
    }
    // unknown char
    push('ERR', ch, start, ++i)
  }
  push('EOF', '', len, len)
  return tokens
}
