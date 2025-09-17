import { describe, it, expect } from 'vitest'
import { sanitizeFilename, defaultFilenameUTC } from '../../../src/features/export/exportFormatting.js'

describe('filename utilities', ()=>{
  it('sanitizes illegal characters', ()=>{
    expect(sanitizeFilename('a/b\\c:*?"<>|.txt')).toBe('a_b_c_______.txt')
  })
  it('defaults to utc auto name', ()=>{
    const name = defaultFilenameUTC('json')
    expect(name.endsWith('.json')).toBe(true)
    expect(/export_chat-\d{8}-\d{6}\.json/.test(name)).toBe(true)
  })
})
