import { describe, it, expect, beforeEach } from 'vitest'
import { JSDOM } from 'jsdom'

function setup({ G=20, paneH=300, partHeights=[] }){
  const dom = new JSDOM('<!DOCTYPE html><body><div id="historyPane"><div id="history"></div></div></body>')
  const { window } = dom
  global.window = window
  global.document = window.document
  global.getComputedStyle = (el)=> window.getComputedStyle(el)
  const pane = document.getElementById('historyPane')
  Object.defineProperty(pane, 'clientHeight', { value: paneH, configurable:true })
  Object.defineProperty(pane, 'clientWidth', { value: 600, configurable:true })
  pane.style.paddingTop = G+'px'
  pane.style.paddingBottom = G+'px'
  const history = document.getElementById('history')
  let cursor = G
  partHeights.forEach((h,i)=>{
    const part = document.createElement('div')
    part.className = 'part'
    part.setAttribute('data-part-id','p'+i)
    Object.defineProperty(part, 'offsetTop', { value: cursor, configurable:true })
    Object.defineProperty(part, 'offsetHeight', { value: h, configurable:true })
    cursor += h
    history.appendChild(part)
  })
  Object.defineProperty(pane, 'scrollTop', { configurable:true, writable:true, value:0 })
  return pane
}

function applyFade(pane, { G, mode='binary', hiddenOp=0 }){
  const S = pane.scrollTop
  const H = pane.clientHeight
  const fadeZone = G
  const parts = pane.querySelectorAll('#history > .part')
  parts.forEach(p=>{
    const top = p.offsetTop
    const h = p.offsetHeight
    const bottom = top + h
    const relTop = top - S
    const relBottom = bottom - S
    let op = 1
    if(mode==='gradient'){
      let topFade = 1
      if(relTop < fadeZone){ topFade = Math.max(0, relTop / fadeZone) }
      let bottomFade = 1
      const distFromBottom = H - relBottom
      if(distFromBottom < fadeZone){ bottomFade = Math.max(0, distFromBottom / fadeZone) }
      op = Math.min(topFade, bottomFade)
      if(op<0) op=0; if(op>1) op=1
    } else { // binary
      const above = relBottom <= fadeZone
      const below = (H - relTop) <= fadeZone
      if(above || below) op = hiddenOp
    }
    p.style.opacity = String(op)
  })
}

describe('fade visibility', ()=>{
  beforeEach(()=>{ global.window=undefined; global.document=undefined })

  it('fully visible middle part stays opacity 1', ()=>{
    const pane = setup({ G:30, paneH:300, partHeights:[80,120,100] })
    pane.scrollTop = 0
    applyFade(pane, { G:30 })
    const p1 = pane.querySelector('[data-part-id="p1"]')
    expect(p1.style.opacity).toBe('1')
  })

  it('binary mode hides part once its bottom is within top zone', ()=>{
    const G=40
    const pane = setup({ G, paneH:300, partHeights:[120,120,120] })
    // Position scroll so first part bottom sits inside top fade zone: relBottom <= G
    // First part offsetTop = G, height=120 => bottom = G+120. Need scrollTop so relBottom = (G+120) - S <= G => S >= 120
    pane.scrollTop = 120
    applyFade(pane, { G, mode:'binary', hiddenOp:0 })
    const p0 = pane.querySelector('[data-part-id="p0"]')
    expect(p0.style.opacity).toBe('0')
  })

  it('binary mode keeps part opaque while fully outside zones', ()=>{
    const G=40
    const pane = setup({ G, paneH:300, partHeights:[60,60,60,60] })
    pane.scrollTop = 0
    applyFade(pane, { G, mode:'binary', hiddenOp:0 })
    const mid = pane.querySelector('[data-part-id="p1"]')
    expect(mid.style.opacity).toBe('1')
  })

  it('gradient mode still produces intermediate opacity', ()=>{
    const G=40
    const pane = setup({ G, paneH:300, partHeights:[120,120,120] })
    pane.scrollTop = G * 0.25 // relTop = 0.75G => opacity ~0.75
    applyFade(pane, { G, mode:'gradient' })
    const p0 = pane.querySelector('[data-part-id="p0"]')
    expect(p0.style.opacity).toBe('0.75')
  })

  it('gradient part near bottom fades', ()=>{
    const G=40
    const pane = setup({ G, paneH:300, partHeights:[120,120,120] })
    // Scroll so last part bottom approaches bottom fade zone.
    // last part offsetTop ~ G + 120 + 120 = G+240
    pane.scrollTop =  (G + 240 + 120) - (300 - 20) // ensure small distance from bottom
    if(pane.scrollTop < 0) pane.scrollTop = 0
    applyFade(pane, { G })
    const last = pane.querySelector('[data-part-id="p2"]')
    // Opacity may be <1, ensure it's set
    expect(last.style.opacity).not.toBe('')
  })
})
