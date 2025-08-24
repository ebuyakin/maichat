import { describe, it, expect } from 'vitest'
import { computeScrollFor } from '../../src/ui/anchorManager.js'

function makeContainer({ clientHeight, scrollHeight }){
  return { clientHeight, scrollHeight }
}

describe('anchor manager computeScrollFor', ()=>{
  it('top mode aligns element top to viewport top', ()=>{
    const c = makeContainer({ clientHeight: 1000, scrollHeight: 3000 })
    const scroll = computeScrollFor(1200, 200, c, 'top', 'adaptive')
    expect(scroll).toBe(1200)
  })
  it('bottom mode places element bottom at viewport bottom', ()=>{
    const c = makeContainer({ clientHeight: 1000, scrollHeight: 3000 })
    // element at offset 1200 height 200 -> bottom offset 1400, desired bottom alignment: scroll + 1000 = 1400 => scroll=400
    const scroll = computeScrollFor(1200, 200, c, 'bottom', 'adaptive')
    expect(scroll).toBe(400)
  })
  it('center mode centers element', ()=>{
    const c = makeContainer({ clientHeight: 1000, scrollHeight: 3000 })
    // center align Y = (1000-200)/2=400 -> scroll = 1200-400=800
    const scroll = computeScrollFor(1200, 200, c, 'center', 'adaptive')
    expect(scroll).toBe(800)
  })
  it('adaptive clamps low', ()=>{
    const c = makeContainer({ clientHeight: 1000, scrollHeight: 1500 })
    const scroll = computeScrollFor(100, 800, c, 'bottom', 'adaptive')
    expect(scroll).toBe(0)
  })
  it('adaptive clamps high', ()=>{
    const c = makeContainer({ clientHeight: 1000, scrollHeight: 1500 })
    // maxScroll=500
    const scroll = computeScrollFor(1400, 200, c, 'top', 'adaptive')
    expect(scroll).toBe(500)
  })
})
