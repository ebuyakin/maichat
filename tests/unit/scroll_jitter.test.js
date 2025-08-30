import { describe, it, expect, beforeEach } from 'vitest'
import { JSDOM } from 'jsdom'
import { createScrollController } from '../../src/ui/scrollControllerV3.js'
import { saveSettings } from '../../src/settings/index.js'

// Utility to build a simple history pane with N parts of equal height
function build({ partHeights, G=20, paneH=300 }){
  const container = document.createElement('div')
  container.id = 'historyPane'
  container.style.paddingTop = G+'px'
  container.style.paddingBottom = G+'px'
  container.style.height = paneH+'px'
  container.style.overflow = 'auto'
  const history = document.createElement('div')
  history.id = 'history'
  container.appendChild(history)
  let cursor = G
  partHeights.forEach((h,i)=>{
    const part = document.createElement('div')
    part.className = 'part'
    part.setAttribute('data-part-id', 'p'+i)
    Object.defineProperty(part, 'offsetTop', { value: cursor, configurable:true })
    Object.defineProperty(part, 'offsetHeight', { value: h, configurable:true })
    cursor += h
    history.appendChild(part)
  })
  Object.defineProperty(container, 'clientHeight', { value: paneH, configurable:true })
  Object.defineProperty(container, 'scrollHeight', { value: cursor + G, configurable:true })
  Object.defineProperty(container, 'scrollTop', { value: 0, writable:true, configurable:true })
  document.body.appendChild(container)
  return container
}

// Flush queued rAF / timeouts
function tick(){ return new Promise(r=> setTimeout(r, 5)) }

describe('scroll jitter harness', ()=>{
  beforeEach(()=>{
    const dom = new JSDOM('<!DOCTYPE html><body></body>')
    global.window = dom.window
    global.document = dom.window.document
    global.getComputedStyle = (el)=> dom.window.getComputedStyle(el)
    global.performance = { now: ()=> Date.now() }
    global.requestAnimationFrame = (fn)=> setTimeout(()=>fn(Date.now()), 0)
    global.cancelAnimationFrame = (id)=> clearTimeout(id)
    document.body.innerHTML = ''
    saveSettings({ anchorMode:'bottom', gapOuterPx:20 })
  })

  it('suppresses correction for ≤2px drift (dead-band)', async ()=>{
    const container = build({ partHeights:[80,90,100], G:20, paneH:300 })
    const controller = createScrollController({ container })
    controller.remeasure()
    controller.setAnimationEnabled && controller.setAnimationEnabled(false)
    controller.apply(2, false) // anchor last part
    await tick()
    const target = container.scrollTop
    // introduce 1px artificial drift (simulate sub-pixel rounding or external nudge)
    container.scrollTop = target + 1
    // trigger re-validate
    controller.remeasure()
    controller.apply(2, false)
    await tick()
    // Expect unchanged (no snap back) because diff <=2
    expect(container.scrollTop).toBe(target + 1)
  })

  it('corrects drift >2px exactly once', async ()=>{
    const container = build({ partHeights:[80,90,100,110], G:20, paneH:320 })
    const controller = createScrollController({ container })
    controller.setAnimationEnabled && controller.setAnimationEnabled(false)
    controller.remeasure()
    controller.apply(3, false)
    await tick()
    const canonical = container.scrollTop
    // introduce large drift
    container.scrollTop = canonical + 10
    controller.remeasure()
    controller.apply(3, false)
    await tick()
    expect(container.scrollTop).toBe(canonical) // corrected
    const after = container.scrollTop
    // second validate should not change again
    controller.remeasure(); controller.apply(3, false); await tick()
    expect(container.scrollTop).toBe(after)
  })
})
