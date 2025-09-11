import { describe, it, expect } from 'vitest'
import { sanitizeAssistantText, _isIdempotent, _mergeSoftWrapsStrategy2 } from '../../src/features/interaction/sanitizeAssistant.js'

describe('sanitizeAssistantText (Phase 1)', ()=>{
  it('removes heading lines >= ###', ()=>{
    const input = 'Intro\n### Heading Title\nBody line'
    const out = sanitizeAssistantText(input)
    expect(out).toBe('Intro\nBody line')
  })
  it('strips bold ** ** and __ __ markers', ()=>{
    const input = 'This is **important** and __vital__.'
    const out = sanitizeAssistantText(input)
    expect(out).toBe('This is important and vital.')
  })
  it('removes all blank lines (paragraph compaction)', ()=>{
    const input = 'Line A\n\n\n\nLine B\n\nLine C'
    const out = sanitizeAssistantText(input)
    expect(out).toBe('Line A\nLine B\nLine C')
  })
  it('preserves numbered lists', ()=>{
    const input = 'Steps:\n1. Start\n2. Continue\n3. Finish'
    const out = sanitizeAssistantText(input)
    expect(out).toBe(input) // unchanged
  })
  it('is idempotent', ()=>{
    const input = 'Text with **bold** and\n\n\n### Heading\nmore text'
    expect(_isIdempotent(input)).toBe(true)
  })
  it('falls back if everything removed', ()=>{
    const input = '### Only Heading Line'
    const out = sanitizeAssistantText(input)
    // Would otherwise become empty -> fallback to original
    expect(out).toBe(input)
  })
  it('merges soft-wrapped mid sentence newline (phase 1.1)', ()=>{
    const input = 'cocido madrileño (a\nmeat and vegetable stew) and churros'
    const out = sanitizeAssistantText(input)
    expect(out).toBe('cocido madrileño (a meat and vegetable stew) and churros')
  })
  it('does not merge after period (sentence boundary)', ()=>{
    const merged = _mergeSoftWrapsStrategy2('This is the end.\nNext sentence starts here')
    expect(merged).toBe('This is the end.\nNext sentence starts here')
  })
  it('does not merge before numbered list', ()=>{
    const merged = _mergeSoftWrapsStrategy2('Intro line\n1. Step one')
    expect(merged).toBe('Intro line\n1. Step one')
  })
})
