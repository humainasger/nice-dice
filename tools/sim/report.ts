// Report shapes and rendering for the sim: the JSON written to docs/balance-report.json (stable,
// no timestamps, so a rerun on the same content is byte-identical), the Markdown tables, and the
// diff between two reports that run.ts prints against the committed JSON.
import { content, type Id, type RulesDef } from '@/content'
import { N } from '@/core'
import type { Strategy } from './bots'
import { ACT_EVERY_MS, HOUR_MS, TICK_MS, WINDOWS, type SimRun } from './sim'

export interface DieReport {
  readonly id: Id
  /** First ms a buyDie would succeed, null when not within this horizon. */
  readonly affordableMs: number | null
  /** First ms the die is owned, null when not within this horizon. */
  readonly boughtMs: number | null
  /** Level at the horizon (0 while unowned). */
  readonly level: number
}

export interface ThresholdReport {
  readonly threshold: number
  readonly ms: number | null
}

export interface RunReport {
  readonly strategy: Strategy
  readonly seed: number
  readonly hours: number
  readonly horizonMs: number
  readonly autoRollUnlockMs: number | null
  readonly dice: readonly DieReport[]
  readonly totalEarned: readonly ThresholdReport[]
  /** Dice never bought within the horizon. */
  readonly deadContent: readonly Id[]
  readonly end: {
    /** N.serialize text. */
    readonly points: string
    readonly totalEarned: string
    readonly rolls: number
    readonly incomePerSecond: string
  }
}

export interface ContentSnapshot {
  readonly dice: readonly {
    readonly id: Id
    readonly baseCost: number
    readonly costGrowth: number
    readonly baseMultiplier: number
    readonly unlock: string
  }[]
  readonly rules: RulesDef
}

export interface BalanceReport {
  /** The pnpm sim invocation that produced the report. */
  readonly command: string
  readonly tickMs: number
  readonly actEveryMs: number
  readonly content: ContentSnapshot
  readonly runs: readonly RunReport[]
}

export interface ReportArgs {
  readonly strategies: readonly Strategy[]
  readonly seeds: readonly number[]
  readonly hours: readonly number[]
}

export function commandLine(args: ReportArgs): string {
  return `pnpm sim --strategy ${args.strategies.join(',')} --seeds ${args.seeds.join(',')} --hours ${args.hours.join(',')}`
}

function describeUnlock(unlock: (typeof content.dice)[number]['unlock']): string {
  switch (unlock.kind) {
    case 'always':
      return 'always'
    case 'totalEarned':
      return `totalEarned >= ${unlock.amount}`
    case 'owned':
      return `${unlock.id} at level ${unlock.count}`
    case 'prestiges':
      return `${unlock.count} prestige(s)`
  }
}

export function snapshotContent(): ContentSnapshot {
  return {
    dice: content.dice.map((def) => ({
      id: def.id,
      baseCost: def.baseCost,
      costGrowth: def.costGrowth,
      baseMultiplier: def.baseMultiplier,
      unlock: describeUnlock(def.unlock),
    })),
    rules: content.rules,
  }
}

const clip = (ms: number | null, horizonMs: number): number | null => (ms !== null && ms <= horizonMs ? ms : null)

/** One RunReport per horizon of a SimRun, milestones clipped to that horizon. */
export function runReports(run: SimRun): RunReport[] {
  return run.horizons.map((horizon) => {
    const { state } = horizon
    const dice = run.milestones.dice.map((die) => ({
      id: die.id,
      affordableMs: clip(die.affordableMs, horizon.ms),
      boughtMs: clip(die.boughtMs, horizon.ms),
      level: state.dice.find((slot) => slot.id === die.id)?.level ?? 0,
    }))
    return {
      strategy: run.strategy,
      seed: run.seed,
      hours: horizon.hours,
      horizonMs: horizon.ms,
      autoRollUnlockMs: clip(run.milestones.autoRollUnlockMs, horizon.ms),
      dice,
      totalEarned: run.milestones.totalEarned.map((mark) => ({ threshold: mark.threshold, ms: clip(mark.ms, horizon.ms) })),
      deadContent: dice.filter((die) => die.boughtMs === null).map((die) => die.id),
      end: {
        points: N.serialize(state.points),
        totalEarned: N.serialize(state.totalEarned),
        rolls: state.rolls,
        incomePerSecond: N.serialize(horizon.incomePerSecond),
      },
    }
  })
}

export function buildReport(args: ReportArgs, runs: readonly SimRun[]): BalanceReport {
  return {
    command: commandLine(args),
    tickMs: TICK_MS,
    actEveryMs: ACT_EVERY_MS,
    content: snapshotContent(),
    runs: runs.flatMap(runReports),
  }
}

/** h:mm:ss of simulated play, or "not reached". */
export function formatMs(ms: number | null): string {
  if (ms === null) return 'not reached'
  const totalSeconds = Math.round(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return `${h}:${mm}:${ss}`
}

export function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`
  return `${hours} h`
}

const fmt = (serialized: string): string => N.format(N.parse(serialized))

function table(header: readonly string[], rows: readonly (readonly string[])[]): string {
  const line = (cells: readonly string[]) => `| ${cells.join(' | ')} |`
  return [line(header), line(header.map(() => '---')), ...rows.map(line)].join('\n')
}

const runKey = (run: Pick<RunReport, 'strategy' | 'seed'>): string => `${run.strategy}/${run.seed}`

/** Groups the per-horizon reports of one strategy and seed, in the order they first appear. */
function groupRuns(runs: readonly RunReport[]): Map<string, RunReport[]> {
  const groups = new Map<string, RunReport[]>()
  for (const run of runs) {
    const key = runKey(run)
    const group = groups.get(key)
    if (group === undefined) groups.set(key, [run])
    else group.push(run)
  }
  for (const group of groups.values()) group.sort((a, b) => a.horizonMs - b.horizonMs)
  return groups
}

function windowsTable(runs: readonly RunReport[]): string {
  const groups = groupRuns(runs.filter((run) => run.strategy === 'active'))
  const header = [
    'Seed',
    `die_2 affordable (target ${formatMs(WINDOWS.die2AffordableMs.min)} to ${formatMs(WINDOWS.die2AffordableMs.max)})`,
    `all five owned (target by ${formatMs(WINDOWS.allDiceOwnedMs)})`,
    `dead content at ${formatMs(WINDOWS.deadContentMs)}`,
  ]
  const rows: string[][] = []
  for (const group of groups.values()) {
    const longest = group.at(-1)
    if (longest === undefined) continue
    const die2 = longest.dice.find((die) => die.id === 'die_2')?.affordableMs ?? null
    const die2Ok = die2 !== null && die2 >= WINDOWS.die2AffordableMs.min && die2 <= WINDOWS.die2AffordableMs.max
    const bought = longest.dice.map((die) => die.boughtMs)
    const allOwnedMs = bought.every((ms) => ms !== null) ? Math.max(...bought.map((ms) => ms ?? 0)) : null
    const allOk = allOwnedMs !== null && allOwnedMs <= WINDOWS.allDiceOwnedMs
    const canJudgeAll = longest.horizonMs >= WINDOWS.allDiceOwnedMs || allOwnedMs !== null
    const canJudgeDead = longest.horizonMs >= WINDOWS.deadContentMs || bought.every((ms) => ms !== null)
    const dead = longest.dice.filter((die) => die.boughtMs === null || die.boughtMs > WINDOWS.deadContentMs).map((die) => die.id)
    rows.push([
      String(longest.seed),
      `${formatMs(die2)} ${die2Ok ? 'pass' : 'FAIL'}`,
      canJudgeAll ? `${formatMs(allOwnedMs)} ${allOk ? 'pass' : 'FAIL'}` : `horizon too short (${formatHours(longest.hours)})`,
      canJudgeDead ? (dead.length === 0 ? 'none, pass' : `${dead.join(', ')} FAIL`) : `horizon too short (${formatHours(longest.hours)})`,
    ])
  }
  if (rows.length === 0) return '_No active runs in this report._'
  return table(header, rows)
}

function runTable(group: readonly RunReport[]): string {
  const header = ['Metric', ...group.map((run) => formatHours(run.hours))]
  const rows: string[][] = []
  const row = (label: string, cell: (run: RunReport) => string) => rows.push([label, ...group.map(cell)])
  row('Auto-roll unlocked', (run) => formatMs(run.autoRollUnlockMs))
  const first = group[0]
  if (first === undefined) return ''
  for (const [index, die] of first.dice.entries()) {
    if (index === 0) continue
    row(`${die.id} affordable`, (run) => formatMs(run.dice[index]?.affordableMs ?? null))
    row(`${die.id} bought`, (run) => formatMs(run.dice[index]?.boughtMs ?? null))
  }
  for (const [index, mark] of first.totalEarned.entries()) {
    row(`Total earned ${N.format(N.from(mark.threshold))}`, (run) => formatMs(run.totalEarned[index]?.ms ?? null))
  }
  row('Income at end (points/s)', (run) => fmt(run.end.incomePerSecond))
  row('Total earned at end', (run) => fmt(run.end.totalEarned))
  row('Points unspent at end', (run) => fmt(run.end.points))
  row('Rolls at end', (run) => String(run.end.rolls))
  row('Die levels at end', (run) => run.dice.map((die) => die.level).join(' / '))
  row('Dead content', (run) => (run.deadContent.length === 0 ? 'none' : run.deadContent.join(', ')))
  return table(header, rows)
}

export function renderMarkdown(report: BalanceReport): string {
  const parts: string[] = []
  parts.push('# Balance report')
  parts.push(
    [
      `Generated by \`${report.command}\`. Written by \`tools/sim/run.ts\`; do not edit by hand.`,
      `The sim steps the real \`advance\` at ${report.tickMs} ms and lets the bot act once per ${report.actEveryMs} ms of simulated time.`,
      'Times are h:mm:ss of simulated play. "Total earned" milestones use lifetime `totalEarned`, not unspent points.',
      '"Income at end" is expected points per second: auto-roll plus the manual rolls the bot still makes.',
      '"not reached" means not within that horizon.',
    ].join(' '),
  )
  parts.push('## Content under test')
  parts.push(
    table(
      ['Die', 'baseCost', 'costGrowth', 'baseMultiplier', 'unlock'],
      report.content.dice.map((die) => [die.id, String(die.baseCost), String(die.costGrowth), String(die.baseMultiplier), die.unlock]),
    ),
  )
  const { autoRoll, offline } = report.content.rules
  parts.push(
    `Rules: auto-roll every ${autoRoll.baseIntervalMs} ms, unlocked by ${describeUnlock(autoRoll.unlock)}. Offline: ${offline.tickMs} ms ticks, at most ${offline.maxTicks} ticks, cap ${offline.capMs / HOUR_MS} h.`,
  )
  parts.push('## Pacing windows (GDD section 12 proposals, active bot)')
  parts.push(windowsTable(report.runs))
  for (const group of groupRuns(report.runs).values()) {
    const first = group[0]
    if (first === undefined) continue
    parts.push(`## ${first.strategy}, seed ${first.seed}`)
    parts.push(runTable(group))
  }
  return parts.join('\n\n') + '\n'
}

/** Field-by-field changes between two reports, one line each. Empty when nothing changed. */
export function diffReports(before: BalanceReport, after: BalanceReport): string[] {
  const lines: string[] = []
  const beforeDice = new Map(before.content.dice.map((die) => [die.id, die]))
  for (const die of after.content.dice) {
    const old = beforeDice.get(die.id)
    if (old === undefined) {
      lines.push(`content: ${die.id} added`)
      continue
    }
    for (const field of ['baseCost', 'costGrowth', 'baseMultiplier', 'unlock'] as const) {
      if (old[field] !== die[field]) lines.push(`content: ${die.id}.${field} ${old[field]} -> ${die[field]}`)
    }
  }
  for (const die of before.content.dice) {
    if (!after.content.dice.some((d) => d.id === die.id)) lines.push(`content: ${die.id} removed`)
  }
  const beforeRules = JSON.stringify(before.content.rules)
  const afterRules = JSON.stringify(after.content.rules)
  if (beforeRules !== afterRules) lines.push(`content: rules ${beforeRules} -> ${afterRules}`)

  const key = (run: RunReport) => `${run.strategy} seed ${run.seed} ${formatHours(run.hours)}`
  const beforeRuns = new Map(before.runs.map((run) => [key(run), run]))
  for (const run of after.runs) {
    const old = beforeRuns.get(key(run))
    if (old === undefined) {
      lines.push(`${key(run)}: new run`)
      continue
    }
    const changes: string[] = []
    const ms = (label: string, a: number | null, b: number | null) => {
      if (a !== b) changes.push(`${label} ${formatMs(a)} -> ${formatMs(b)}`)
    }
    ms('auto-roll unlocked', old.autoRollUnlockMs, run.autoRollUnlockMs)
    for (const die of run.dice) {
      const oldDie = old.dice.find((d) => d.id === die.id)
      if (oldDie === undefined) continue
      ms(`${die.id} affordable`, oldDie.affordableMs, die.affordableMs)
      ms(`${die.id} bought`, oldDie.boughtMs, die.boughtMs)
      if (oldDie.level !== die.level) changes.push(`${die.id} level ${oldDie.level} -> ${die.level}`)
    }
    for (const mark of run.totalEarned) {
      const oldMark = old.totalEarned.find((m) => m.threshold === mark.threshold)
      if (oldMark !== undefined) ms(`total earned ${N.format(N.from(mark.threshold))}`, oldMark.ms, mark.ms)
    }
    if (old.end.incomePerSecond !== run.end.incomePerSecond) {
      changes.push(`income ${fmt(old.end.incomePerSecond)} -> ${fmt(run.end.incomePerSecond)}`)
    }
    if (old.end.totalEarned !== run.end.totalEarned) {
      changes.push(`total earned ${fmt(old.end.totalEarned)} -> ${fmt(run.end.totalEarned)}`)
    }
    if (old.end.rolls !== run.end.rolls) changes.push(`rolls ${old.end.rolls} -> ${run.end.rolls}`)
    if (old.deadContent.join(',') !== run.deadContent.join(',')) {
      changes.push(`dead content [${old.deadContent.join(', ')}] -> [${run.deadContent.join(', ')}]`)
    }
    if (changes.length > 0) lines.push(`${key(run)}: ${changes.join('; ')}`)
  }
  for (const run of before.runs) {
    if (!after.runs.some((r) => key(r) === key(run))) lines.push(`${key(run)}: no longer in the report`)
  }
  return lines
}
