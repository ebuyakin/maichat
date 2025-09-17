import { describe, it, expect } from 'vitest'
import { buildMarkdownExport } from '../../../src/features/export/exportMarkdownSerializer.js'

const meta = { generatedAt: '2025-09-16T10:11:12Z', filterInput: ':export md', orderApplied: 'time' }

function mkPair(userText, assistantText){
  return { id:'x', createdAt:'2025-01-01T00:00:00Z', topicPath:'Root', topicId:'root', model:'gpt', stars:0, flagColor:'grey', userText, assistantText, errorState:false }
}

describe('markdown fencing', ()=>{
  it('uses dynamic fence when content contains triple backticks', ()=>{
    const s=buildMarkdownExport({ pairs:[mkPair('``` code ```','ok')], meta })
    // Should contain a fence longer than 3
    expect(/````+/.test(s)).toBe(true)
  })
  it('keeps default triple backticks when no collisions', ()=>{
    const s=buildMarkdownExport({ pairs:[mkPair('hello','world')], meta })
    const blocks = s.match(/```/g) || []
    expect(blocks.length).toBeGreaterThan(0)
  })
})
