import { describe, it, expect } from 'vitest'
import { buildJsonExport } from '../../../src/features/export/exportJsonSerializer.js'
import { buildMarkdownExport } from '../../../src/features/export/exportMarkdownSerializer.js'
import { buildTextExport } from '../../../src/features/export/exportTextSerializer.js'

const baseMeta = { generatedAt: '2025-09-16T10:11:12Z', filterInput: ':export', orderApplied: 'time' }

const errPair = { id:'e1', createdAt:'2025-01-01T00:00:00Z', topicPath:'Root', topicId:'root', model:'gpt', stars:0, flagColor:'grey', userText:'u', assistantText:'', errorState:true, errorMessage:'Timeout' }

describe('empty selection', ()=>{
  it('json: meta only with count 0', ()=>{
    const s=buildJsonExport({ pairs:[], meta:baseMeta })
    const obj=JSON.parse(s)
    expect(obj.count).toBe(0)
    expect(obj.pairs.length).toBe(0)
  })
  it('md/txt: header only', ()=>{
    const md=buildMarkdownExport({ pairs:[], meta:baseMeta })
    const txt=buildTextExport({ pairs:[], meta:baseMeta })
    expect(md.trim().startsWith('```json meta')).toBe(true)
    expect(txt.trim().startsWith('Meta:')).toBe(true)
  })
})

describe('error annotations', ()=>{
  it('json includes error fields when errorState=true', ()=>{
    const s=buildJsonExport({ pairs:[errPair], meta:baseMeta })
    const obj=JSON.parse(s)
    expect(obj.pairs[0].errorState).toBe(true)
    expect(obj.pairs[0].errorMessage).toBe('Timeout')
  })
  it('markdown adds error tag and message', ()=>{
    const md=buildMarkdownExport({ pairs:[errPair], meta:baseMeta })
    expect(md).toContain('— error')
    expect(md).toContain('> Error: Timeout')
  })
  it('text includes error line before assistant', ()=>{
    const txt=buildTextExport({ pairs:[errPair], meta:baseMeta })
    expect(txt).toContain('Error: Timeout')
  })
})
