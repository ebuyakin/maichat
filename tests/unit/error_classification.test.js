import { describe, it, expect } from 'vitest'
import { classifyErrorCode } from '../../src/features/history/historyView.js'

describe('error classification', () => {
  it('classifies model errors', () => {
    expect(classifyErrorCode('The model gpt-4o-mini was not found')).toBe('error: model')
    expect(classifyErrorCode('Unknown model: llama-3.1-405b')).toBe('error: model')
    expect(classifyErrorCode('Model has been deprecated')).toBe('error: model')
    expect(classifyErrorCode('404: model not found')).toBe('error: model')
    expect(classifyErrorCode('Invalid model blah')).toBe('error: model')
  })
  it('classifies auth errors', () => {
    expect(classifyErrorCode('401 Unauthorized')).toBe('error: auth')
    expect(classifyErrorCode('API key is missing')).toBe('error: auth')
    expect(classifyErrorCode('Forbidden')).toBe('error: auth')
  })
  it('classifies quota errors', () => {
    expect(classifyErrorCode('429 Too Many Requests')).toBe('error: quota')
    expect(classifyErrorCode('rate limit exceeded')).toBe('error: quota')
    expect(classifyErrorCode('quota exceeded')).toBe('error: quota')
    expect(classifyErrorCode('TPM limit reached')).toBe('error: quota')
    expect(classifyErrorCode('context window exceeded')).toBe('error: quota')
  })
  it('classifies network errors', () => {
    expect(classifyErrorCode('Network error: fetch failed')).toBe('error: net')
  })
  it('falls back to unknown', () => {
    expect(classifyErrorCode('Some other error')).toBe('error: unknown')
    expect(classifyErrorCode('')).toBe('error: unknown')
    expect(classifyErrorCode(null)).toBe('error: unknown')
  })
})
