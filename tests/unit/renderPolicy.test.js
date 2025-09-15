import { describe, it, expect } from 'vitest'
import { decideRenderAction, diffChangedKeys, __INTERNAL } from '../../src/runtime/renderPolicy.js'

describe('renderPolicy', ()=>{
  it('returns none when no changes', ()=>{
    const prev = { a: 1 }
    const next = { a: 1 }
    expect(decideRenderAction(prev, next)).toBe('none')
  })

  it('ignores topicOrderMode changes', ()=>{
    const prev = { topicOrderMode: 'manual' }
    const next = { topicOrderMode: 'alpha' }
    expect(decideRenderAction(prev, next)).toBe('none')
  })

  it('restyles on fade/spacing UI-only changes', ()=>{
    const prev = { gapOuterPx: 10 }
    const next = { gapOuterPx: 12 }
    expect(decideRenderAction(prev, next)).toBe('restyle')
  })

  it('rebuilds on partFraction change', ()=>{
    const prev = { partFraction: 0.2 }
    const next = { partFraction: 0.3 }
    expect(decideRenderAction(prev, next)).toBe('rebuild')
  })

  it('rebuilds on charsPerToken change', ()=>{
    const prev = { charsPerToken: 4 }
    const next = { charsPerToken: 3.5 }
    expect(decideRenderAction(prev, next)).toBe('rebuild')
  })

  it('prefers rebuild if both restyle and rebuild keys changed', ()=>{
    const prev = { partFraction: 0.2, gapOuterPx: 10 }
    const next = { partFraction: 0.25, gapOuterPx: 12 }
    expect(decideRenderAction(prev, next)).toBe('rebuild')
  })

  it('diffChangedKeys returns correct set', ()=>{
    const prev = { a:1, b:2 }
    const next = { a:2, c:3 }
    const diff = diffChangedKeys(prev, next)
    expect(new Set(diff)).toEqual(new Set(['a','b','c']))
  })
})
