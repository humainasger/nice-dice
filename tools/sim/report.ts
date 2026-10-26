// Report shapes and rendering for the sim: the JSON written to docs/balance-report.json (stable,
// no timestamps, so a rerun on the same content is byte-identical), the Markdown tables, and the
// diff between two reports that run.ts prints against the committed JSON.
import { content, type ComboId, type Id, type LuckUpgradeId, type RulesDef } from '@/content'
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
  /** Ascensions at the horizon. */
  readonly ascensions: number
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
  readonly firstAscensionMs: number | null
  readonly firstCharmMs: number | null
  readonly firstLuckMs: number | null
  readonly secondLuckMs: number | null
  /** Longest stretch without a purchase inside this horizon. */
  readonly longestPurchaseGapMs: number
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
    /** Spendable luck. */
    readonly luck: number
    /** Lifetime luck. */
    readonly luckTotal: number
    readonly prestiges: number
    readonly charms: number
    /** Upgrade level per hand at the horizon, in content order. */
    readonly comboLevels: readonly number[]
    /** Level per luck upgrade at the horizon, in content order. */
    readonly luckUpgradeLevels: readonly number[]
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
  readonly combos: readonly { readonly id: ComboId; readonly base: number }[]
  /** Each charm as "<id> <rarity> <target> <op> <value>", so a value retune shows in the diff. */
  readonly charms: readonly string[]
  readonly luckUpgrades: readonly {
    readonly id: LuckUpgradeId
    readonly maxLevel: number
    readonly baseCost: number
    readonly costGrowth: number
    readonly effect: string
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
    combos: content.combos.map((def) => ({ id: def.id, base: def.base })),
    charms: content.charms.map((def) => `${def.id} ${def.rarity} ${def.effect.target} ${def.effect.op} ${def.effect.value}`),
    luckUpgrades: content.luckUpgrades.map((def) => ({
      id: def.id,
      maxLevel: def.maxLevel,
      baseCost: def.baseCost,
      costGrowth: def.costGrowth,
      effect: `${def.effect.kind} ${def.effect.value}`,
    })),
    rules: content.rules,
  }
}

const clip = (ms: number | null, horizonMs: number): number | null => (ms !== null && ms <= horizonMs ? ms : null)

/** One RunReport per horizon of a SimRun, milestones clipped to that horizon. */
export function runReports(run: SimRun): RunReport[] {
  return run.horizons.map((horizon) => {
    const { state } = horizon
    const dice = run.milestones.dice.map((die) => {
      const slot = state.dice.find((d) => d.id === die.id)
      return {
        id: die.id,
        affordableMs: clip(die.affordableMs, horizon.ms),
        boughtMs: clip(die.boughtMs, horizon.ms),
        level: slot?.level ?? 0,
        ascensions: slot?.ascensions ?? 0,
      }
    })
    return {
      strategy: run.strategy,
      seed: run.seed,
      hours: horizon.hours,
      horizonMs: horizon.ms,
      autoRollUnlockMs: clip(run.milestones.autoRollUnlockMs, horizon.ms),
      firstAscensionMs: clip(run.milestones.firstAscensionMs, horizon.ms),
      firstCharmMs: clip(run.milestones.firstCharmMs, horizon.ms),
      firstLuckMs: clip(run.milestones.firstLuckMs, horizon.ms),
      secondLuckMs: clip(run.milestones.secondLuckMs, horizon.ms),
      longestPurchaseGapMs: horizon.longestPurchaseGapMs,
      dice,
      totalEarned: run.milestones.totalEarned.map((mark) => ({ threshold: mark.threshold, ms: clip(mark.ms, horizon.ms) })),
      deadContent: dice.filter((die) => die.boughtMs === null).map((die) => die.id),
      end: {
        points: N.serialize(state.points),
        totalEarned: N.serialize(state.totalEarned),
        rolls: state.rolls,
        incomePerSecond: N.serialize(horizon.incomePerSecond),
        luck: state.luck,
        luckTotal: state.luckTotal,
        prestiges: state.prestiges,
        charms: state.charms.length,
        comboLevels: content.combos.map((def) => state.combos[def.id] ?? 0),
        luckUpgradeLevels: content.luckUpgrades.map((def) => state.luckUpgrades[def.id] ?? 0),
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

const inWindow = (ms: number | null, window: { readonly min: number; readonly max: number }): boolean =>
  ms !== null && ms >= window.min && ms <= window.max

/** The lifetime total at a horizon against its window, or "horizon too short" when the run did not reach it. */
function lifetimeCell(group: readonly RunReport[], hours: number, min: string | null, max: string): string {
  const at = group.find((run) => run.hours === hours)
  if (at === undefined) return `horizon too short (${formatHours(group.at(-1)?.hours ?? 0)})`
  const total = N.parse(at.end.totalEarned)
  const ok = N.lt(total, N.parse(max)) && (min === null || N.gte(total, N.parse(min)))
  return `${N.format(total)} ${ok ? 'pass' : 'FAIL'}`
}

function windowsTable(runs: readonly RunReport[]): string {
  const groups = groupRuns(runs.filter((run) => run.strategy === 'active'))
  const header = [
    'Seed',
    `die_2 affordable (target ${formatMs(WINDOWS.die2AffordableMs.min)} to ${formatMs(WINDOWS.die2AffordableMs.max)})`,
    `all five owned (target by ${formatMs(WINDOWS.allDiceOwnedMs)})`,
    `first luck (target ${formatMs(WINDOWS.firstLuckMs.min)} to ${formatMs(WINDOWS.firstLuckMs.max)})`,
    `second luck (target within ${formatMs(WINDOWS.secondLuckWithinMs)} of the first)`,
    `lifetime at ${formatHours(WINDOWS.lifetimeAt8h.hours)} (target ${WINDOWS.lifetimeAt8h.min} to ${WINDOWS.lifetimeAt8h.max})`,
    `lifetime at ${formatHours(WINDOWS.lifetimeAt24h.hours)} (target below ${WINDOWS.lifetimeAt24h.max})`,
    `longest purchase gap in ${formatHours(WINDOWS.purchaseGapHorizonMs / HOUR_MS)} (target at most ${formatMs(WINDOWS.purchaseGapMs)})`,
    `dead content at ${formatMs(WINDOWS.deadContentMs)}`,
  ]
  const rows: string[][] = []
  for (const group of groups.values()) {
    const longest = group.at(-1)
    if (longest === undefined) continue
    const die2 = longest.dice.find((die) => die.id === 'die_2')?.affordableMs ?? null
    const bought = longest.dice.map((die) => die.boughtMs)
    const allOwnedMs = bought.every((ms) => ms !== null) ? Math.max(...bought.map((ms) => ms ?? 0)) : null
    const allOk = allOwnedMs !== null && allOwnedMs <= WINDOWS.allDiceOwnedMs
    const canJudgeAll = longest.horizonMs >= WINDOWS.allDiceOwnedMs || allOwnedMs !== null
    const canJudgeLuck = longest.horizonMs >= WINDOWS.firstLuckMs.max || longest.firstLuckMs !== null
    const canJudgeSecond =
      longest.secondLuckMs !== null || (longest.firstLuckMs !== null && longest.horizonMs >= longest.firstLuckMs + WINDOWS.secondLuckWithinMs)
    const secondGap = longest.firstLuckMs !== null && longest.secondLuckMs !== null ? longest.secondLuckMs - longest.firstLuckMs : null
    const canJudgeDead = longest.horizonMs >= WINDOWS.deadContentMs || bought.every((ms) => ms !== null)
    const dead = longest.dice.filter((die) => die.boughtMs === null || die.boughtMs > WINDOWS.deadContentMs).map((die) => die.id)
    const gapRun = group.find((run) => run.horizonMs === WINDOWS.purchaseGapHorizonMs)
    const tooShort = `horizon too short (${formatHours(longest.hours)})`
    rows.push([
      String(longest.seed),
      `${formatMs(die2)} ${inWindow(die2, WINDOWS.die2AffordableMs) ? 'pass' : 'FAIL'}`,
      canJudgeAll ? `${formatMs(allOwnedMs)} ${allOk ? 'pass' : 'FAIL'}` : tooShort,
      canJudgeLuck ? `${formatMs(longest.firstLuckMs)} ${inWindow(longest.firstLuckMs, WINDOWS.firstLuckMs) ? 'pass' : 'FAIL'}` : tooShort,
      canJudgeSecond
        ? `${formatMs(longest.secondLuckMs)} (${formatMs(secondGap)} after the first) ${secondGap !== null && secondGap <= WINDOWS.secondLuckWithinMs ? 'pass' : 'FAIL'}`
        : tooShort,
      lifetimeCell(group, WINDOWS.lifetimeAt8h.hours, WINDOWS.lifetimeAt8h.min, WINDOWS.lifetimeAt8h.max),
      lifetimeCell(group, WINDOWS.lifetimeAt24h.hours, null, WINDOWS.lifetimeAt24h.max),
      gapRun === undefined
        ? tooShort
        : `${formatMs(gapRun.longestPurchaseGapMs)} ${gapRun.longestPurchaseGapMs <= WINDOWS.purchaseGapMs ? 'pass' : 'FAIL'}`,
      canJudgeDead ? (dead.length === 0 ? 'none, pass' : `${dead.join(', ')} FAIL`) : tooShort,
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
  row('First ascension', (run) => formatMs(run.firstAscensionMs))
  row('First charm', (run) => formatMs(run.firstCharmMs))
  row('First luck', (run) => formatMs(run.firstLuckMs))
  row('Second luck', (run) => formatMs(run.secondLuckMs))
  row('Longest purchase gap', (run) => formatMs(run.longestPurchaseGapMs))
  for (const [index, mark] of first.totalEarned.entries()) {
    row(`Total earned ${N.format(N.from(mark.threshold))}`, (run) => formatMs(run.totalEarned[index]?.ms ?? null))
  }
  row('Income at end (points/s)', (run) => fmt(run.end.incomePerSecond))
  row('Total earned at end', (run) => fmt(run.end.totalEarned))
  row('Points unspent at end', (run) => fmt(run.end.points))
  row('Rolls at end', (run) => String(run.end.rolls))
  row('Die levels at end', (run) => run.dice.map((die) => die.level).join(' / '))
  row('Ascensions at end', (run) => run.dice.map((die) => die.ascensions).join(' / '))
  row('Combo levels at end', (run) => run.end.comboLevels.join(' / '))
  row('Charms / luck / prestiges at end', (run) => `${run.end.charms} / ${run.end.luck} / ${run.end.prestiges}`)
  row('Lifetime luck at end', (run) => String(run.end.luckTotal))
  row('Luck upgrade levels at end', (run) => run.end.luckUpgradeLevels.join(' / '))
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
  parts.push(table(['Hand', 'base'], report.content.combos.map((combo) => [combo.id, String(combo.base)])))
  parts.push(
    table(
      ['Luck upgrade', 'maxLevel', 'baseCost', 'costGrowth', 'effect'],
      report.content.luckUpgrades.map((u) => [u.id, String(u.maxLevel), String(u.baseCost), String(u.costGrowth), u.effect]),
    ),
  )
  parts.push(`Charms: ${report.content.charms.join('; ')}.`)
  const { autoRoll, offline, ascension, combo, face, draft, luck, trophy } = report.content.rules
  parts.push(
    [
      `Rules: auto-roll every ${autoRoll.baseIntervalMs} ms, unlocked by ${describeUnlock(autoRoll.unlock)}.`,
      `Offline: ${offline.tickMs} ms ticks, at most ${offline.maxTicks} ticks, cap ${offline.capMs / HOUR_MS} h.`,
      `Ascension at level ${ascension.level}, x${ascension.multiplier}, level costs x${ascension.costMultiplier} per ascension. Combo upgrades ${combo.upgradeCost} x ${combo.costGrowth}^level, +${combo.step} of base per level.`,
      `Faces: cap ${face.cap}, cost baseCost x ${face.costFactor} x ${face.costGrowth}^n, from level ${face.unlockLevel}.`,
      `Draft: ceil(${draft.growth}^taken) ascensions, ${draft.offerSize} offered, weights ${draft.rarityWeights.common}/${draft.rarityWeights.rare}/${draft.rarityWeights.epic}.`,
      `Luck: from ${luck.threshold} run points, floor(${luck.perDecade} x log10(run / threshold)) + 1 per reset, +${luck.perPoint} points multiplier per lifetime luck, auto-level every ${luck.autoLevelEveryMs} ms. Trophies: x${trophy.multiplier} each.`,
    ].join(' '),
  )
  parts.push('## Pacing windows (GDD section 12 proposals, m3-game.md and m4-luck.md section 3, active bot)')
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
  const beforeCombos = new Map((before.content.combos ?? []).map((combo) => [combo.id, combo.base]))
  for (const combo of after.content.combos) {
    const old = beforeCombos.get(combo.id)
    if (old === undefined) lines.push(`content: ${combo.id} added`)
    else if (old !== combo.base) lines.push(`content: ${combo.id}.base ${old} -> ${combo.base}`)
  }
  const beforeCharms = (before.content.charms ?? []).join('; ')
  const afterCharms = after.content.charms.join('; ')
  if (beforeCharms !== afterCharms) lines.push(`content: charms ${beforeCharms} -> ${afterCharms}`)
  const beforeUpgrades = JSON.stringify(before.content.luckUpgrades ?? [])
  const afterUpgrades = JSON.stringify(after.content.luckUpgrades)
  if (beforeUpgrades !== afterUpgrades) lines.push(`content: luckUpgrades ${beforeUpgrades} -> ${afterUpgrades}`)
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
    const ms = (label: string, a: number | null | undefined, b: number | null) => {
      if ((a ?? null) !== b) changes.push(`${label} ${formatMs(a ?? null)} -> ${formatMs(b)}`)
    }
    ms('auto-roll unlocked', old.autoRollUnlockMs, run.autoRollUnlockMs)
    for (const die of run.dice) {
      const oldDie = old.dice.find((d) => d.id === die.id)
      if (oldDie === undefined) continue
      ms(`${die.id} affordable`, oldDie.affordableMs, die.affordableMs)
      ms(`${die.id} bought`, oldDie.boughtMs, die.boughtMs)
      if (oldDie.level !== die.level) changes.push(`${die.id} level ${oldDie.level} -> ${die.level}`)
    }
    ms('first ascension', old.firstAscensionMs, run.firstAscensionMs)
    ms('first charm', old.firstCharmMs, run.firstCharmMs)
    ms('first luck', old.firstLuckMs, run.firstLuckMs)
    ms('second luck', old.secondLuckMs, run.secondLuckMs)
    if ((old.longestPurchaseGapMs ?? null) !== run.longestPurchaseGapMs) {
      changes.push(`longest purchase gap ${formatMs(old.longestPurchaseGapMs ?? null)} -> ${formatMs(run.longestPurchaseGapMs)}`)
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
    if (old.end.prestiges !== run.end.prestiges) changes.push(`prestiges ${old.end.prestiges} -> ${run.end.prestiges}`)
    if ((old.end.luckTotal ?? null) !== run.end.luckTotal) changes.push(`lifetime luck ${old.end.luckTotal ?? 'none'} -> ${run.end.luckTotal}`)
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
