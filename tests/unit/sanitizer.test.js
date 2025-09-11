import { describe, it, expect } from 'vitest'
import { sanitizeAssistantText, _isIdempotent } from '../../src/features/interaction/sanitizeAssistant.js'

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
})
