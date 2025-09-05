import { describe, it, expect } from 'vitest'
import { shouldAutoSwitchToView } from '../../src/features/history/newMessageLifecycle.js'

describe('auto-switch heuristic v2', ()=>{
  it('switches when mode is input, inputEmpty, and replyHeight > paneHeight', ()=>{
    expect(shouldAutoSwitchToView({ mode:'input', inputEmpty:true, replyHeight:801, paneHeight:800 })).toBe(true)
  })
  it('no switch if reply fits exactly', ()=>{
    expect(shouldAutoSwitchToView({ mode:'input', inputEmpty:true, replyHeight:800, paneHeight:800 })).toBe(false)
  })
  it('no switch if mode is view', ()=>{
    expect(shouldAutoSwitchToView({ mode:'view', inputEmpty:true, replyHeight:1200, paneHeight:800 })).toBe(false)
  })
  it('no switch if input not empty even if tall', ()=>{
    expect(shouldAutoSwitchToView({ mode:'input', inputEmpty:false, replyHeight:1200, paneHeight:800 })).toBe(false)
  })
})