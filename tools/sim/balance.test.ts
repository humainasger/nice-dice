// Balance assertions on the committed content (docs/plans/active/m1-core.md, m3-game.md and
// m4-luck.md section 3, Sim): the GDD section 12 windows for the active bot on seeds 1 to 3, first
// luck between 30 and 60 minutes, the second within 60 minutes of the first, lifetime points at 8 h
// between 1e25 and 1e45 and at 24 h below 1e80 (seed 1 only, to keep the suite fast), no stretch
// longer than 20 minutes without a purchase in the first 8 h, dead content within 2 h, applyOffline
// against 8 h stepped at 100 ms, and determinism of the sim itself. A failing window here means
// tuning src/content within the brief's levers plus a docs/BALANCE_LOG.md entry, not editing the test.
import { describe, expect, it } from 'vitest'
import { content } from '@/content'
import { advance, applyOffline, dispatch, expectedPointsPerSecond, luckOnReset, N, serializeState, type GameState, type Num } from '@/core'
import { bestPurchase, bots, buyLuckUpgrades, pickCharms, rankLuckUpgrades, shouldPrestige, PRESTIGE_COOLDOWN_MS } from './bots'
import { buildReport, diffReports, formatMs, renderMarkdown, type BalanceReport, type ReportArgs } from './report'
import { HOUR_MS, simulate, TICK_MS, WINDOWS, type SimRun } from './sim'

const SEEDS = [1, 2, 3] as const
/** The one seed that runs to 24 h. */
const LONG_SEED = 1
const SHORT_HOURS: readonly number[] = [0.25, WINDOWS.deadContentMs / HOUR_MS, WINDOWS.lifetimeAt8h.hours]
const LONG_HOURS: readonly number[] = [...SHORT_HOURS, WINDOWS.lifetimeAt24h.hours]
const SIM_TIMEOUT_MS = 600_000

/** One active run per seed to its longest horizon, computed on first use and shared. */
const activeRuns = new Map<number, SimRun>()
function activeRun(seed: number): SimRun {
  let run = activeRuns.get(seed)
  if (run === undefined) {
    run = simulate('active', seed, seed === LONG_SEED ? LONG_HOURS : SHORT_HOURS)
    activeRuns.set(seed, run)
  }
  return run
}

const horizonAt = (run: SimRun, hours: number) => {
  const found = run.horizons.find((horizon) => horizon.hours === hours)
  if (found === undefined) throw new Error(`no ${hours} h horizon in the run`)
  return found
}

const die = (run: SimRun, id: string) => {
  const found = run.milestones.dice.find((d) => d.id === id)
  if (found === undefined) throw new Error(`no die ${id} in the run`)
  return found
}

const abs = (x: Num): Num => N.max(x, N.sub(0, x))

describe('pacing windows, active bot (GDD section 12 proposals, m3-game.md and m4-luck.md section 3)', () => {
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

  it.each(SEEDS)('first luck lands between 30 and 60 minutes of active play (seed %i)', { timeout: SIM_TIMEOUT_MS }, (seed) => {
    const at = activeRun(seed).milestones.firstLuckMs
    const { min, max } = WINDOWS.firstLuckMs
    expect(at, 'the bot never prestiged').not.toBeNull()
    expect(at, `first luck at ${formatMs(at)}, window ${formatMs(min)} to ${formatMs(max)}`).toBeGreaterThanOrEqual(min)
    expect(at, `first luck at ${formatMs(at)}, window ${formatMs(min)} to ${formatMs(max)}`).toBeLessThanOrEqual(max)
  })

  it.each(SEEDS)('the second luck lands within 60 minutes of the first (seed %i)', { timeout: SIM_TIMEOUT_MS }, (seed) => {
    const { firstLuckMs, secondLuckMs } = activeRun(seed).milestones
    expect(firstLuckMs, 'the bot never prestiged').not.toBeNull()
    expect(secondLuckMs, `second luck never came (first at ${formatMs(firstLuckMs)})`).not.toBeNull()
    const gap = (secondLuckMs ?? 0) - (firstLuckMs ?? 0)
    expect(gap, `second luck at ${formatMs(secondLuckMs)}, ${formatMs(gap)} after the first at ${formatMs(firstLuckMs)}`).toBeLessThanOrEqual(
      WINDOWS.secondLuckWithinMs,
    )
  })

  it.each(SEEDS)('lifetime points at 8 h sit between 1e25 and 1e45 (seed %i)', { timeout: SIM_TIMEOUT_MS }, (seed) => {
    const total = horizonAt(activeRun(seed), WINDOWS.lifetimeAt8h.hours).state.totalEarned
    const { min, max } = WINDOWS.lifetimeAt8h
    expect(N.gte(total, N.parse(min)), `lifetime ${N.format(total)} at 8 h, target ${min} to ${max}`).toBe(true)
    expect(N.lte(total, N.parse(max)), `lifetime ${N.format(total)} at 8 h, target ${min} to ${max}`).toBe(true)
  })

  it(`lifetime points at 24 h stay below 1e80 (seed ${LONG_SEED})`, { timeout: SIM_TIMEOUT_MS }, () => {
    const total = horizonAt(activeRun(LONG_SEED), WINDOWS.lifetimeAt24h.hours).state.totalEarned
    expect(N.lt(total, N.parse(WINDOWS.lifetimeAt24h.max)), `lifetime ${N.format(total)} at 24 h, target below ${WINDOWS.lifetimeAt24h.max}`).toBe(true)
  })

  it.each(SEEDS)('no stretch longer than 20 minutes without a purchase in the first 8 h (seed %i)', { timeout: SIM_TIMEOUT_MS }, (seed) => {
    const gap = horizonAt(activeRun(seed), WINDOWS.purchaseGapHorizonMs / HOUR_MS).longestPurchaseGapMs
    expect(gap, `longest purchase gap ${formatMs(gap)}, target at most ${formatMs(WINDOWS.purchaseGapMs)}`).toBeLessThanOrEqual(WINDOWS.purchaseGapMs)
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

  it('records the M3 and M4 milestones in order on the long active run', { timeout: SIM_TIMEOUT_MS }, () => {
    const { milestones } = activeRun(1)
    expect(milestones.firstAscensionMs).not.toBeNull()
    expect(milestones.firstCharmMs).not.toBeNull()
    expect(milestones.firstLuckMs).not.toBeNull()
    expect(milestones.secondLuckMs).not.toBeNull()
    expect(milestones.firstAscensionMs ?? 0).toBeLessThanOrEqual(milestones.firstCharmMs ?? 0)
    expect(milestones.firstLuckMs ?? 0).toBeLessThan(milestones.secondLuckMs ?? 0)
    expect(milestones.longestPurchaseGapMs).toBeGreaterThan(0)
  })

  it('measures the purchase gap: the first buy comes within seconds and the gap grows with the horizon', () => {
    const run = simulate('active', 1, [0.01, 0.1])
    const [short, long] = run.horizons
    if (short === undefined || long === undefined) throw new Error('setup: no snapshots')
    expect(short.longestPurchaseGapMs).toBeGreaterThan(0)
    expect(short.longestPurchaseGapMs).toBeLessThan(60_000)
    expect(long.longestPurchaseGapMs).toBeGreaterThanOrEqual(short.longestPurchaseGapMs)
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
    expect(short.secondLuckMs).toBeNull()
    expect(short.longestPurchaseGapMs).toBeGreaterThan(0)
    expect(short.end.luckTotal).toBe(0)
    expect(short.end.luckUpgradeLevels).toEqual(content.luckUpgrades.map(() => 0))
    for (const die of short.dice) {
      if (die.boughtMs !== null) expect(die.boughtMs).toBeLessThanOrEqual(short.horizonMs)
    }

    const die5 = content.dice.find((def) => def.id === 'die_5')
    if (die5 === undefined) throw new Error('setup: no die_5 in content')
    const markdown = renderMarkdown(report)
    expect(markdown).toContain('## active, seed 1')
    expect(markdown).toContain('| Metric | 3 min | 6 min |')
    expect(markdown).toContain('| First luck |')
    expect(markdown).toContain('| Second luck |')
    expect(markdown).toContain('| Longest purchase gap |')
    expect(markdown).toContain('| Luck upgrade levels at end |')
    expect(markdown).toContain(`| die_5 | ${die5.baseCost} | ${die5.costGrowth} | ${die5.baseMultiplier} | die_4 at level 1 |`)
    expect(markdown).toContain('| five_kind | 50 |')
    expect(markdown).toContain('| head_start | 5 | 2 | 1.6 | head_start 10 |')

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
    expect(best?.command).toMatchObject({ type: 'levelDie', id: 'die_1' })
  })

  it('picks the offered charm that lifts income most', () => {
    // A die at the cap ascends and opens the first draft; the pick must beat or match every alternative.
    const start = simulate('active', 1, [0.001]).horizons[0]?.state
    if (start === undefined) throw new Error('setup: no snapshot')
    const capped: GameState = {
      ...start,
      dice: start.dice.map((d, i) => (i === 0 ? { ...d, level: content.rules.ascension.level } : d)),
    }
    const opened = dispatch(capped, { type: 'ascend', id: 'die_1' })
    expect(opened.draft.offer).not.toBeNull()
    const picked = pickCharms(opened)
    expect(picked.charms).toHaveLength(1)
    expect(picked.draft.offer).toBeNull()
    const alternatives = (opened.draft.offer ?? []).map((_, index) => dispatch(opened, { type: 'pickCharm', index }))
    for (const alternative of alternatives) {
      expect(N.gte(expectedPointsPerSecond(picked), expectedPointsPerSecond(alternative))).toBe(true)
    }
  })

  it('prestiges once luck on reset is at least 2 and the cooldown has passed', () => {
    const start = simulate('active', 1, [0.001]).horizons[0]?.state
    if (start === undefined) throw new Error('setup: no snapshot')
    const threshold = content.rules.luck.threshold
    const rich = (run: number, extra: Partial<GameState> = {}): GameState => ({
      ...start,
      totalEarned: N.from(run),
      totalEarnedRun: N.from(run),
      ...extra,
    })
    expect(luckOnReset(rich(threshold))).toBe(1)
    expect(shouldPrestige(rich(threshold))).toBe(false)
    expect(shouldPrestige(rich(10 * threshold))).toBe(true)
    const recent = rich(10 * threshold, { prestiges: 1, playMs: 10 * 60_000, stats: { ...start.stats, lastLuckAt: 0 } })
    expect(shouldPrestige(recent)).toBe(false)
    const cooled = rich(10 * threshold, { prestiges: 1, playMs: PRESTIGE_COOLDOWN_MS, stats: { ...start.stats, lastLuckAt: 0 } })
    expect(shouldPrestige(cooled)).toBe(true)
  })

  it('ranks luck upgrades by income lift per luck and buys the affordable ones greedily after a reset', () => {
    const start = simulate('active', 1, [0.05]).horizons[0]?.state
    if (start === undefined) throw new Error('setup: no snapshot')
    const rich: GameState = { ...start, luck: 6, luckTotal: 6 }
    const ranked = rankLuckUpgrades(rich)
    expect(ranked.map((p) => p.id).sort()).toEqual([...content.luckUpgrades.map((u) => u.id)].sort())
    for (let i = 1; i < ranked.length; i++) expect(ranked[i - 1]?.ratio ?? 0).toBeGreaterThanOrEqual(ranked[i]?.ratio ?? 0)
    // The measured lifts match the content: x1.2 for deep_pockets, 1 / 0.92 for quick_hands.
    const pockets = ranked.find((p) => p.id === 'deep_pockets')
    const quick = ranked.find((p) => p.id === 'quick_hands')
    expect(pockets?.lift).toBeCloseTo(0.2, 6)
    expect(quick?.lift).toBeCloseTo(1 / 0.92 - 1, 6)
    expect(ranked.filter((p) => p.affordable).length).toBeGreaterThan(0)
    const spent = buyLuckUpgrades(rich)
    expect(spent.luckTotal).toBe(6)
    expect(spent.luck).toBeLessThan(6)
    const owned = Object.values(spent.luckUpgrades).reduce((sum, level) => sum + (level ?? 0), 0)
    expect(owned).toBeGreaterThan(0)
    // Nothing affordable is left on the table.
    expect(rankLuckUpgrades(spent).some((p) => p.affordable)).toBe(false)
    // A full run with luck earned shows upgrades bought right after the first reset.
    const longer = activeRun(1)
    const atTwoHours = horizonAt(longer, WINDOWS.deadContentMs / HOUR_MS).state
    expect(atTwoHours.prestiges).toBeGreaterThan(0)
    expect(Object.keys(atTwoHours.luckUpgrades).length).toBeGreaterThan(0)
  })
})
