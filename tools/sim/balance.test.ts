// Balance assertions on the committed content (docs/plans/active/m1-core.md, Sim): the GDD
// section 12 windows for the active bot on seeds 1 to 3, dead content within 2 h, applyOffline
// against 8 h stepped at 100 ms, and determinism of the sim itself. A failing window here means
// tuning src/content within the spec bounds plus a docs/BALANCE_LOG.md entry, not editing the test.
import { describe, expect, it } from 'vitest'
import { content } from '@/content'
import { advance, applyOffline, N, serializeState, type GameState, type Num } from '@/core'
import { bestPurchase, bots } from './bots'
import { buildReport, diffReports, formatMs, renderMarkdown, type BalanceReport, type ReportArgs } from './report'
import { HOUR_MS, simulate, TICK_MS, WINDOWS, type SimRun } from './sim'

const SEEDS = [1, 2, 3] as const
const SIM_TIMEOUT_MS = 120_000

/** One active run per seed to the dead-content horizon, computed on first use and shared. */
const activeRuns = new Map<number, SimRun>()
function activeRun(seed: number): SimRun {
  let run = activeRuns.get(seed)
  if (run === undefined) {
    run = simulate('active', seed, [0.25, WINDOWS.deadContentMs / HOUR_MS])
    activeRuns.set(seed, run)
  }
  return run
}

const die = (run: SimRun, id: string) => {
  const found = run.milestones.dice.find((d) => d.id === id)
  if (found === undefined) throw new Error(`no die ${id} in the run`)
  return found
}

const abs = (x: Num): Num => N.max(x, N.sub(0, x))

describe('pacing windows, active bot (GDD section 12 proposals)', () => {
  it.each(SEEDS)('P1: die_2 is affordable between minute 1 and 3 (seed %i)', { timeout: SIM_TIMEOUT_MS }, (seed) => {
    const at = die(activeRun(seed), 'die_2').affordableMs
    expect(at, 'die_2 never became affordable').not.toBeNull()
    const { min, max } = WINDOWS.die2AffordableMs
    expect(at, `die_2 affordable at ${formatMs(at)}, window ${formatMs(min)} to ${formatMs(max)}`).toBeGreaterThanOrEqual(min)
    expect(at, `die_2 affordable at ${formatMs(at)}, window ${formatMs(min)} to ${formatMs(max)}`).toBeLessThanOrEqual(max)
  })

  it.each(SEEDS)('all five dice are owned within 45 minutes (seed %i)', { timeout: SIM_TIMEOUT_MS }, (seed) => {
    const run = activeRun(seed)
    const bought = run.milestones.dice.map((d) => `${d.id} ${formatMs(d.boughtMs)}`).join(', ')
    for (const d of run.milestones.dice) {
      expect(d.boughtMs, `${d.id} never bought (${bought})`).not.toBeNull()
      expect(d.boughtMs, `${d.id} bought at ${formatMs(d.boughtMs)}, target by ${formatMs(WINDOWS.allDiceOwnedMs)} (${bought})`).toBeLessThanOrEqual(
        WINDOWS.allDiceOwnedMs,
      )
    }
  })
})

describe('dead content', () => {
  it.each(SEEDS)('every die is bought within 2 hours of active play (seed %i)', { timeout: SIM_TIMEOUT_MS }, (seed) => {
    const run = activeRun(seed)
    const dead = run.milestones.dice.filter((d) => d.boughtMs === null || d.boughtMs > WINDOWS.deadContentMs).map((d) => d.id)
    expect(dead, `dead content within ${formatMs(WINDOWS.deadContentMs)}: ${dead.join(', ')}`).toEqual([])
  })
})

describe('applyOffline', () => {
  it('matches 8 h stepped at 100 ms within 5 percent in points, with the same roll count', { timeout: SIM_TIMEOUT_MS }, () => {
    // A mid-game state with auto-roll unlocked and a few dice: the active bot's 15 minute snapshot.
    const start = activeRun(1).horizons[0]?.state
    if (start === undefined) throw new Error('setup: no 15 minute snapshot')
    expect(start.autoRoll.unlocked && start.autoRoll.enabled).toBe(true)

    const elapsed = 8 * HOUR_MS
    let stepped: GameState = start
    for (let t = 0; t < elapsed; t += TICK_MS) stepped = advance(stepped, TICK_MS)

    const offline = applyOffline(start, elapsed, { tickMs: TICK_MS, maxTicks: content.rules.offline.maxTicks })
    expect(offline.summary.simulatedMs).toBe(content.rules.offline.maxTicks * TICK_MS)
    expect(offline.summary.estimatedMs).toBe(elapsed - offline.summary.simulatedMs)
    expect(offline.state.playMs).toBe(stepped.playMs)
    expect(offline.state.rolls).toBe(stepped.rolls)

    const steppedGain = N.sub(stepped.points, start.points)
    const offlineGain = N.sub(offline.state.points, start.points)
    const relative = N.toNumber(N.div(abs(N.sub(offlineGain, steppedGain)), steppedGain))
    expect(relative, `offline ${N.format(offlineGain)} vs stepped ${N.format(steppedGain)}`).toBeLessThan(WINDOWS.offlineTolerance)
  })
})

describe('sim', () => {
  it('is deterministic for a seed', () => {
    const a = simulate('active', 7, [0.1])
    const b = simulate('active', 7, [0.1])
    const stateA = a.horizons[0]?.state
    const stateB = b.horizons[0]?.state
    if (stateA === undefined || stateB === undefined) throw new Error('setup: no snapshot')
    expect(serializeState(stateA)).toBe(serializeState(stateB))
    expect(a.milestones).toEqual(b.milestones)
  })

  it('differs between seeds', () => {
    const a = simulate('active', 1, [0.1]).horizons[0]?.state
    const b = simulate('active', 2, [0.1]).horizons[0]?.state
    if (a === undefined || b === undefined) throw new Error('setup: no snapshot')
    expect(serializeState(a)).not.toBe(serializeState(b))
  })

  it('stamps the starting die as owned and affordable at 0 and snapshots at the exact horizon', () => {
    const run = simulate('active', 1, [0.05])
    expect(die(run, 'die_1')).toEqual({ id: 'die_1', affordableMs: 0, boughtMs: 0 })
    expect(run.horizons.map((h) => h.ms)).toEqual([180_000])
    expect(run.horizons[0]?.state.playMs).toBe(180_000)
  })
})

describe('report', () => {
  it('clips milestones per horizon, renders the tables and diffs field by field', () => {
    const args: ReportArgs = { strategies: ['active'], seeds: [1], hours: [0.05, 0.1] }
    const report = buildReport(args, [simulate('active', 1, args.hours)])
    expect(report.command).toBe('pnpm sim --strategy active --seeds 1 --hours 0.05,0.1')
    expect(report.runs.map((run) => run.hours)).toEqual([0.05, 0.1])
    const short = report.runs[0]
    if (short === undefined) throw new Error('setup: no run')
    expect(short.horizonMs).toBe(180_000)
    expect(short.autoRollUnlockMs).not.toBeNull()
    expect(short.deadContent).toContain('die_5')
    for (const die of short.dice) {
      if (die.boughtMs !== null) expect(die.boughtMs).toBeLessThanOrEqual(short.horizonMs)
    }

    const die5 = content.dice.find((def) => def.id === 'die_5')
    if (die5 === undefined) throw new Error('setup: no die_5 in content')
    const markdown = renderMarkdown(report)
    expect(markdown).toContain('## active, seed 1')
    expect(markdown).toContain('| Metric | 3 min | 6 min |')
    expect(markdown).toContain(`| die_5 | ${die5.baseCost} | ${die5.costGrowth} | ${die5.baseMultiplier} | die_4 at level 1 |`)

    expect(diffReports(report, report)).toEqual([])
    const retuned = die5.baseCost * 2
    const changed: BalanceReport = {
      ...report,
      content: {
        ...report.content,
        dice: report.content.dice.map((die) => (die.id === 'die_5' ? { ...die, baseCost: retuned } : die)),
      },
      runs: report.runs.map((run, index) => (index === 0 ? { ...run, end: { ...run.end, rolls: run.end.rolls + 1 } } : run)),
    }
    expect(diffReports(report, changed)).toEqual([
      `content: die_5.baseCost ${die5.baseCost} -> ${retuned}`,
      `active seed 1 3 min: rolls ${short.end.rolls} -> ${short.end.rolls + 1}`,
    ])
  })
})

describe('bots', () => {
  it('the active bot rolls by hand while auto-roll is locked and stops once it unlocks', () => {
    const run = simulate('active', 1, [0.05])
    const snapshot = run.horizons[0]?.state
    if (snapshot === undefined) throw new Error('setup: no snapshot')
    expect(run.milestones.autoRollUnlockMs).not.toBeNull()
    expect(bots.active.manualRollsPerSecond(snapshot)).toBe(0)
    const fresh = simulate('idle', 1, [0.001]).horizons[0]?.state
    if (fresh === undefined) throw new Error('setup: no snapshot')
    expect(fresh.autoRoll.unlocked).toBe(false)
    expect(bots.active.manualRollsPerSecond(fresh)).toBe(1)
  })

  it('the idle bot never rolls by hand', () => {
    const run = simulate('idle', 1, [0.25])
    const snapshot = run.horizons[0]?.state
    if (snapshot === undefined) throw new Error('setup: no snapshot')
    expect(snapshot.rolls).toBe(0)
    expect(bots.idle.manualRollsPerSecond(snapshot)).toBe(0)
  })

  it('ranks the first level of die_1 above buying die_2 at the start', () => {
    const start = simulate('active', 1, [0.001]).horizons[0]?.state
    if (start === undefined) throw new Error('setup: no snapshot')
    const best = bestPurchase({ ...start, points: N.from(1e9) })
    expect(best?.command).toEqual({ type: 'levelDie', id: 'die_1', count: 1 })
  })
})
