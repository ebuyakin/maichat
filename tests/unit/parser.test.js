import { describe, it, expect } from 'vitest'
import { parse } from '../../src/filter/parser.js'

describe('parser basic', () => {
  it('parses simple star filter', () => {
    const ast = parse('s>=2')
    expect(ast.type).toBe('FILTER')
    expect(ast.kind).toBe('s')
    expect(ast.args.op).toBe('>=')
    expect(ast.args.value).toBe('2')
  })
  it('parses implicit AND', () => {
    const ast = parse('s2 r5')
    expect(ast.type).toBe('AND')
  })
  it('returns ALL on empty', () => {
    const ast = parse('   ')
    expect(ast.type).toBe('ALL')
  })
})
