import { describe, it, expect } from 'vitest'
import { computeDailyCounts } from '../../src/features/config/dailyStatsOverlay.js'

describe('computeDailyCounts', () => {
  it('groups by local day and sorts ascending', () => {
    const mk = (y,m,d)=> new Date(y,m-1,d, 10,0,0).getTime()
    const pairs = [
      { id:'a', createdAt: mk(2025,9,5) },
      { id:'b', createdAt: mk(2025,9,7) },
      { id:'c', createdAt: mk(2025,9,7) },
      { id:'d', createdAt: mk(2025,9,6) },
    ]
    const rows = computeDailyCounts(pairs)
  expect(rows.map(r=>r.day)).toEqual(['2025-09-05','2025-09-06','2025-09-07'])
  expect(rows.map(r=>r.count)).toEqual([1,1,2])
  })
})
