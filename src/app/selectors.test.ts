// The pure text helpers in selectors.ts that carry a rule: the away summary says "partly
// estimated" only once at least one auto-roll interval was settled at expected value, and a
// stored copy's time reads as "N min ago" inside a day and as a date beyond it.
import { describe, expect, it } from 'vitest'
import { content } from '@/content'
import { N, type OfflineSummary } from '@/core'
import { formatBackupTime, formatDateTime, formatOffline, isEstimated } from './selectors'

function summary(elapsedMs: number, estimatedMs: number): OfflineSummary {
  return { elapsedMs, simulatedMs: elapsedMs - estimatedMs, estimatedMs, rolls: 10, gained: N.from(100) }
}

const INTERVAL = content.rules.autoRoll.baseIntervalMs
const TICK = content.rules.offline.tickMs

describe('isEstimated', () => {
  it('needs at least one auto-roll interval of estimate, not one tick', () => {
    expect(isEstimated(summary(60_000, INTERVAL - 1), INTERVAL)).toBe(false)
    expect(isEstimated(summary(60_000, INTERVAL), INTERVAL)).toBe(true)
    expect(isEstimated(summary(60_000, TICK), INTERVAL)).toBe(false)
  })

  it('never drops below one tick, whatever the interval says', () => {
    expect(isEstimated(summary(60_000, 1), 1)).toBe(false)
    expect(isEstimated(summary(60_000, TICK), 1)).toBe(true)
  })

  it('formats the note into the one-line summary on the same rule', () => {
    expect(formatOffline(summary(60_000, INTERVAL), INTERVAL)).toBe('Away 1 min: 10 rolls, 100 points, partly estimated')
    expect(formatOffline(summary(60_000, INTERVAL - 1), INTERVAL)).toBe('Away 1 min: 10 rolls, 100 points')
    expect(formatOffline(null, INTERVAL)).toBe('')
  })
})

describe('formatBackupTime', () => {
  const now = Date.UTC(2026, 9, 26, 12, 0, 0)

  it('reads as time ago inside a day and as a date beyond it', () => {
    expect(formatBackupTime(now - 5 * 60_000, now)).toBe('5 min ago')
    expect(formatBackupTime(now - 3 * 3_600_000, now)).toBe('3 h ago')
    const twoDaysAgo = now - 2 * 24 * 3_600_000
    expect(formatBackupTime(twoDaysAgo, now)).toBe(formatDateTime(twoDaysAgo))
    expect(formatBackupTime(twoDaysAgo, now)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
    expect(formatBackupTime(0, now)).toBe('unknown time')
  })

  it('pads the date and time to two digits without Intl', () => {
    const d = new Date(2026, 0, 5, 9, 7)
    expect(formatDateTime(d.getTime())).toBe('2026-01-05 09:07')
  })
})
