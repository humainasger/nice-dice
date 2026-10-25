// The sim CLI: pnpm sim --strategy active,idle --seeds 1,2,3 --hours 0.25,1,8. Runs every
// strategy and seed to the longest horizon, prints a table per strategy and seed, writes
// docs/balance-report.json and docs/balance-report.md, and prints the diff against the JSON
// committed at HEAD (the first run creates it).
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { isStrategy, STRATEGIES, type Strategy } from './bots'
import { buildReport, diffReports, renderMarkdown, type BalanceReport, type ReportArgs } from './report'
import { simulate } from './sim'

const DEFAULTS: ReportArgs = { strategies: [...STRATEGIES], seeds: [1, 2, 3], hours: [0.25, 1, 8] }
const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const JSON_PATH = 'docs/balance-report.json'
const MD_PATH = 'docs/balance-report.md'

const USAGE = `Usage: pnpm sim [--strategy ${STRATEGIES.join(',')}] [--seeds 1,2,3] [--hours 0.25,1,8]

Plays each strategy and seed to the longest horizon with 100 ms ticks of the real advance, prints
a table per strategy and seed, writes ${JSON_PATH} and ${MD_PATH}, and diffs against the JSON
committed at HEAD. Defaults: --strategy ${DEFAULTS.strategies.join(',')} --seeds ${DEFAULTS.seeds.join(',')} --hours ${DEFAULTS.hours.join(',')}.`

function list(value: string | undefined, fallback: readonly string[]): string[] {
  if (value === undefined) return [...fallback]
  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
  if (items.length === 0) throw new Error('expected a comma-separated list')
  return items
}

export function parseCliArgs(argv: readonly string[]): ReportArgs | 'help' {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      strategy: { type: 'string' },
      seeds: { type: 'string' },
      hours: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
  })
  if (values.help) return 'help'
  const strategies = list(values.strategy, DEFAULTS.strategies).map((name): Strategy => {
    if (!isStrategy(name)) throw new Error(`unknown strategy "${name}", expected one of ${STRATEGIES.join(', ')}`)
    return name
  })
  const seeds = list(values.seeds, DEFAULTS.seeds.map(String)).map((text) => {
    const seed = Number(text)
    if (!Number.isSafeInteger(seed)) throw new Error(`seed "${text}" is not an integer`)
    return seed
  })
  const hours = list(values.hours, DEFAULTS.hours.map(String)).map((text) => {
    const h = Number(text)
    if (!Number.isFinite(h) || h <= 0) throw new Error(`hours "${text}" is not a positive number`)
    return h
  })
  return { strategies, seeds, hours }
}

/** The report committed at HEAD, or null when there is none (first run) or git is unavailable. */
function committedReport(): BalanceReport | null {
  try {
    const text = execFileSync('git', ['show', `HEAD:${JSON_PATH}`], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return JSON.parse(text) as BalanceReport
  } catch {
    return null
  }
}

function main(argv: readonly string[]): number {
  let args: ReportArgs | 'help'
  try {
    args = parseCliArgs(argv)
  } catch (error) {
    console.error(`sim: ${error instanceof Error ? error.message : String(error)}`)
    console.error(USAGE)
    return 2
  }
  if (args === 'help') {
    console.log(USAGE)
    return 0
  }

  const started = performance.now()
  const runs = args.strategies.flatMap((strategy) =>
    args.seeds.map((seed) => {
      const t0 = performance.now()
      const run = simulate(strategy, seed, args.hours)
      console.error(`sim: ${strategy} seed ${seed} done in ${((performance.now() - t0) / 1000).toFixed(1)} s`)
      return run
    }),
  )
  const report = buildReport(args, runs)
  const markdown = renderMarkdown(report)
  console.log(markdown)

  mkdirSync(join(ROOT, 'docs'), { recursive: true })
  writeFileSync(join(ROOT, JSON_PATH), JSON.stringify(report, null, 2) + '\n')
  writeFileSync(join(ROOT, MD_PATH), markdown)
  console.log(`Wrote ${JSON_PATH} and ${MD_PATH} in ${((performance.now() - started) / 1000).toFixed(1)} s.`)

  const committed = committedReport()
  if (committed === null) {
    console.log(`No ${JSON_PATH} committed at HEAD; this run creates it.`)
  } else {
    const lines = diffReports(committed, report)
    if (lines.length === 0) console.log(`No change against the committed ${JSON_PATH}.`)
    else console.log([`Changes against the committed ${JSON_PATH}:`, ...lines.map((line) => `  ${line}`)].join('\n'))
  }
  return 0
}

process.exitCode = main(process.argv.slice(2))
