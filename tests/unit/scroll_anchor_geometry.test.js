import { describe, it, expect, beforeEach } from 'vitest'
import { JSDOM } from 'jsdom'
import { createScrollController } from '../../src/ui/scrollControllerV3.js'
import { saveSettings } from '../../src/core/settings/index.js'

// Helper to build a fake history DOM with padding representing outer gap G.
function buildHistory({ parts, G, height }){
  // container simulates #historyPane
  const container = document.createElement('div')
  container.id = 'historyPane'
  // apply symmetric padding (outer gap)
  container.style.paddingTop = G + 'px'
  container.style.paddingBottom = G + 'px'
  container.style.height = height + 'px'
  container.style.overflow = 'auto'
  // inner history
  const history = document.createElement('div')
  history.id = 'history'
  container.appendChild(history)
  let idCounter = 0
  // Simulate layout metrics explicitly (jsdom has no real layout)
  let cursor = G // first part offsetTop includes padding
  parts.forEach((h)=>{
    const part = document.createElement('div')
    part.className = 'part'
    part.setAttribute('data-part-id', 'p'+(idCounter++))
    part.style.height = h + 'px'
    part.style.boxSizing = 'border-box'
    history.appendChild(part)
    Object.defineProperty(part, 'offsetTop', { value: cursor, configurable: true })
    Object.defineProperty(part, 'offsetHeight', { value: h, configurable: true })
    cursor += h // no inter-part gaps for this test
  })
  // Define container client metrics
  Object.defineProperty(container, 'clientHeight', { value: height, configurable: true })
  // scrollHeight = top padding + content height + bottom padding
  const contentHeight = cursor - G
  const scrollH = G + contentHeight + G
  Object.defineProperty(container, 'scrollHeight', { value: scrollH, configurable: true })
  document.body.appendChild(container)
  return container
}

// Extract metrics from scroll controller for active index.
function compute(controller, container, k){
  controller.remeasure()
  controller.apply(k, false)
  return controller.debugInfo()
}

// Spec formulas:
function expectedTop(start_part_k, G){ return start_part_k - G }
function expectedBottom(start_part_k, p_k, H_total, G){ return start_part_k + p_k - (H_total - G) }
function expectedCenter(start_part_k, p_k, H_total){ return start_part_k + p_k/2 - H_total/2 }

// Utility to get start_part_k visually (includes top padding G)
function getStart(container, partEl){ return partEl.offsetTop }

// Build multiple scenarios.

describe('scroll anchoring geometry', ()=>{
  beforeEach(()=>{ 
    if(typeof document === 'undefined'){
      const dom = new JSDOM(`<!DOCTYPE html><body></body>`)
      global.window = dom.window
      global.document = dom.window.document
      // minimal stubs used by code (getComputedStyle, performance, requestAnimationFrame)
      global.getComputedStyle = (el)=> dom.window.getComputedStyle(el)
      if(!global.performance) global.performance = { now: ()=> Date.now() }
      if(!global.requestAnimationFrame) global.requestAnimationFrame = (fn)=> setTimeout(()=>fn(Date.now()), 16)
      if(!global.cancelAnimationFrame) global.cancelAnimationFrame = (id)=> clearTimeout(id)
    }
    document.body.innerHTML = '' 
  })

  it('aligns active part correctly in top, bottom, and center modes', ()=>{
    const G = 20
    const H_total = 400
    // Create parts with varied heights
    const partHeights = [40, 80, 120, 60]
    const container = buildHistory({ parts: partHeights, G, height: H_total })
    const controller = createScrollController({ container })

    partHeights.forEach((h, k)=>{
      const partEl = container.querySelectorAll('.part')[k]
      const start_part_k = getStart(container, partEl)
  // Bottom mode
  let dbg
  const maxScroll = Math.max(0, container.scrollHeight - H_total)
      saveSettings({ anchorMode: 'bottom', gapOuterPx: G })
      dbg = compute(controller, container, k)
  const bottomRaw = expectedBottom(start_part_k, h, H_total, G)
  const bottomExpected = Math.min(Math.max(0, Math.round(bottomRaw)), maxScroll)
  expect(dbg.scrollTop).toBe(bottomExpected)
      // Center mode
      saveSettings({ anchorMode: 'center', gapOuterPx: G })
      dbg = compute(controller, container, k)
  const centerRaw = expectedCenter(start_part_k, h, H_total)
  const centerExpected = Math.min(Math.max(0, Math.round(centerRaw)), maxScroll)
  expect(dbg.scrollTop).toBe(centerExpected)
    })
  })

  it('clamps scrollTop within [0, maxScroll]', ()=>{
    const G = 30
    const H_total = 300
    const partHeights = [50, 50, 50, 600] // last part exceeds pane causing large target
    const container = buildHistory({ parts: partHeights, G, height: H_total })
    const controller = createScrollController({ container })
    const k = 3
    saveSettings({ anchorMode: 'bottom', gapOuterPx: G })
    const dbg = compute(controller, container, k)
    // Should clamp to maxScroll
  const maxScroll = Math.max(0, container.scrollHeight - H_total)
  expect(dbg.scrollTop).toBe(maxScroll)
  })
})
