import { describe, it, expect } from 'vitest'
import { orderPairs } from '../../../src/features/export/exportOrdering.js'
import { buildJsonExport } from '../../../src/features/export/exportJsonSerializer.js'
import { buildMarkdownExport } from '../../../src/features/export/exportMarkdownSerializer.js'
import { buildTextExport } from '../../../src/features/export/exportTextSerializer.js'

const meta = { generatedAt: '2025-09-16T10:11:12Z', filterInput: "q :export", orderApplied: 'time' }

function mkPair(id, createdAtIso, topicId='root', extra={}){
  return { id, createdAt: createdAtIso, topicId, topicPath: topicId==='root'?'Root':`Root > T${topicId}`, model:'gpt', stars:0, flagColor:'grey', userText:'u', assistantText:'a', errorState:false, ...extra }
}

describe('export ordering', ()=>{
  it('orders by time ascending', ()=>{
    const pairs=[mkPair('b','2025-01-02T00:00:00Z'), mkPair('a','2025-01-01T00:00:00Z')]
    const out=orderPairs(pairs,{mode:'time'})
    expect(out.map(p=>p.id)).toEqual(['a','b'])
  })
})

describe('serializers', ()=>{
  it('json serializer includes meta and pairs', ()=>{
    const pairs=[mkPair('a','2025-01-01T00:00:00Z')]
    const s=buildJsonExport({pairs, meta})
    const obj=JSON.parse(s)
    expect(obj.pairs.length).toBe(1)
    expect(obj.orderApplied).toBe('time')
    expect(obj.pairs[0].id).toBe('a')
    expect(obj.pairs[0].createdAt).toBe('2025-01-01T00:00:00Z')
  })
  it('markdown renders header and sections', ()=>{
    const pairs=[mkPair('a','2025-01-01T00:00:00Z')]
    const s=buildMarkdownExport({pairs, meta})
    expect(s).toContain('```json meta')
    expect(s).toContain('## 1.')
  })
  it('text renders header and blocks', ()=>{
    const pairs=[mkPair('a','2025-01-01T00:00:00Z')]
    const s=buildTextExport({pairs, meta})
    expect(s).toContain('Meta:')
    expect(s).toContain('#1')
  })
})
