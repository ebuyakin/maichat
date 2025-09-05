import { describe, it, expect } from 'vitest'
import { partitionMessage, invalidatePartitionCacheOnResize } from '../../src/features/history/partitioner.js'

// Basic smoke tests; DOM-dependent metrics faked via jsdom sizes.

describe('partitionMessage', ()=>{
  it('splits long text into multiple parts respecting fraction', ()=>{
    const long = Array.from({length:200}, (_,i)=> 'Line '+i).join('\n')
    const parts = partitionMessage({ text: long, role:'user', pairId:'p1' })
    expect(parts.length).toBeGreaterThan(1)
    // lines coverage
    const totalLines = parts.reduce((a,p)=> a + p.lineCount, 0)
    expect(totalLines).toBeGreaterThan(150)
  })

  it('cache invalidates on resize', ()=>{
    const txt = 'A\nB\nC\nD\nE\nF\nG\nH'
    const p1 = partitionMessage({ text: txt, role:'assistant', pairId:'p2' })
    invalidatePartitionCacheOnResize()
    const p2 = partitionMessage({ text: txt, role:'assistant', pairId:'p2' })
    expect(p2.length).toBeGreaterThan(0)
    expect(p2[0].id).toBe(p1[0].id) // id pattern consistent
  })
})
