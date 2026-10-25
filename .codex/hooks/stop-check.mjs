#!/usr/bin/env node
// Stop hook. Runs "pnpm check" (typecheck, lint, test) when a turn ends so a turn
// cannot end red. Reads the hook JSON from stdin.
//
// Behaviour:
//   stop_hook_active is true      exit 0 at once. We are already inside a stop-hook
//                                 continuation; running again would loop.
//   git missing or no commit yet  exit 0. There is no HEAD to compare against.
//   no changes versus HEAD        exit 0. Tracked and untracked files are both
//                                 considered; a conversational turn is not taxed.
//   pnpm check fails              print the last 40 lines of its output to stderr and
//                                 exit 2 so the agent sees the red and keeps working.
//   pnpm check passes             exit 0.
//
// The project root is resolved from this file's location (.claude/hooks/), not from
// the current working directory, so the hook works from any cwd.

import { execSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const TAIL_LINES = 40

function readStdin() {
  try {
    return readFileSync(0, 'utf8')
  } catch {
    return ''
  }
}

function git(args) {
  return spawnSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
}

let input = {}
try {
  input = JSON.parse(readStdin() || '{}')
} catch {
  input = {}
}
if (input.stop_hook_active === true) process.exit(0)

const head = git(['rev-parse', '--verify', 'HEAD'])
if (head.error || head.status !== 0) process.exit(0)

const status = git(['status', '--porcelain'])
if (status.error || status.status !== 0) process.exit(0)
if (status.stdout.trim() === '') process.exit(0)

try {
  execSync('pnpm check', {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0', CI: '1' },
  })
  process.exit(0)
} catch (err) {
  const out = [err.stdout, err.stderr]
    .filter(Boolean)
    .map((b) => b.toString())
    .join('\n')
  const lines = out.split('\n').filter((l) => l.trim() !== '')
  const tail = lines.slice(-TAIL_LINES).join('\n')
  process.stderr.write(`stop-check: pnpm check failed. Fix before ending the turn.\n${tail}\n`)
  process.exit(2)
}
