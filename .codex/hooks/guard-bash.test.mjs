#!/usr/bin/env node
// Self-test for guard-bash.mjs. Feeds each fixture to the hook over stdin as the
// PreToolUse JSON the Bash tool sends and compares the exit code (0 allow, 2 block).
// Run: node .claude/hooks/guard-bash.test.mjs   (exits 1 when any fixture fails)

import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const hook = resolve(dirname(fileURLToPath(import.meta.url)), 'guard-bash.mjs')

const ALLOW = 0
const BLOCK = 2

// [command, expected exit code]
const cases = [
  // rm -rf: allowlist and the ".." escapes
  ['rm -rf dist', ALLOW],
  ['rm -rf dist/*', ALLOW],
  ['rm -rf node_modules', ALLOW],
  ['rm -rf node_modules/.cache', ALLOW],
  ['rm -rf node_modules/.vite dist', ALLOW],
  ['rm -rf dist/../src', BLOCK],
  ['rm -rf node_modules/../src', BLOCK],
  ['rm -rf ./dist/..', BLOCK],
  ['rm -rf dist//../src', BLOCK],
  ["rm -rf 'dist\\..\\src'", BLOCK],
  ['rm -fr -- dist/../src', BLOCK],
  ['rm --recursive --force src', BLOCK],
  ['rm -rf src', BLOCK],
  ['rm -rf /', BLOCK],
  ['rm -rf ~/dist', BLOCK],
  ['rm -rf $HOME/dist', BLOCK],
  ['rm -rf ../dist', BLOCK],
  ['find . -name "*.log" | xargs rm -rf', BLOCK],
  ['sleep 1 & rm -rf src', BLOCK],
  ['true || rm -rf src', BLOCK],
  ['cd /tmp && rm -rf node_modules', ALLOW],
  ['echo "rm -rf src"', ALLOW],

  // interpreter wrappers: the quoted code is checked recursively
  ["bash -c 'rm -rf src'", BLOCK],
  ["sh -c 'rm -rf dist/../src'", BLOCK],
  ['zsh -lc "rm -rf src"', BLOCK],
  ['bash -c "rm -rf \\"src\\""', BLOCK],
  ["bash -c 'cd src && rm -rf dist/../core'", BLOCK],
  ["bash -c 'rm -rf node_modules'", ALLOW],
  ['eval rm -rf src', BLOCK],
  ["eval 'git push --force origin main'", BLOCK],
  ["node -e \"require('child_process').execSync('rm -rf src')\"", BLOCK],
  ['node --eval "require(\'child_process\').execSync(`git push -f origin main`)"', BLOCK],
  ["python3 -c \"import os; os.system('rm -rf src')\"", BLOCK],
  ["node -e \"console.log('hello')\"", ALLOW],
  ['node script.mjs', ALLOW],
  ['$(rm -rf src)', BLOCK],
  ['echo `rm -rf src`', BLOCK],

  // git push
  ['git push origin main', ALLOW],
  ['git push -u origin feature/hook-fixes', ALLOW],
  ['git push origin HEAD:main', ALLOW],
  ['git push --force origin main', BLOCK],
  ['git push -f', BLOCK],
  ['git push --force-with-lease', BLOCK],
  ['git push origin +main', BLOCK],
  ['git push --delete origin main', BLOCK],
  ['git push -d origin main', BLOCK],
  ['git push origin :main', BLOCK],

  // git reset and clean
  ['git reset --hard', BLOCK],
  ['git reset --soft HEAD~1', ALLOW],
  ['git clean -fd', BLOCK],
  ['git clean -n', ALLOW],

  // save.ts without a migration test
  ["sed -i '' 's/a/b/' src/core/save.ts", BLOCK],
  ["sed -i '' 's/a/b/' src/core/save.ts src/core/v2.migration.test.ts", ALLOW],
  ['cat src/core/save.ts', ALLOW],

  // benign everyday commands
  ['pnpm check', ALLOW],
  ['pnpm exec vitest run tests/arch', ALLOW],
  ['ls -la', ALLOW],
  ['git status --porcelain', ALLOW],
]

function runRaw(stdin) {
  const res = spawnSync(process.execPath, [hook], { input: stdin, encoding: 'utf8' })
  return { status: res.status, stderr: (res.stderr ?? '').trim() }
}

function run(command) {
  return runRaw(JSON.stringify({ tool_name: 'Bash', tool_input: { command } }))
}

let failed = 0
function report(ok, label, status, expected, stderr) {
  if (!ok) failed++
  const detail = !ok && stderr ? `\n       ${stderr}` : ''
  console.log(`${ok ? 'ok  ' : 'FAIL'} exit ${status} (want ${expected})  ${label}${detail}`)
}

for (const [command, expected] of cases) {
  const { status, stderr } = run(command)
  report(status === expected, command, status, expected, stderr)
}

// Input the hook must ignore: other tools and malformed JSON.
const other = runRaw(JSON.stringify({ tool_name: 'Edit', tool_input: { command: 'rm -rf src' } }))
report(other.status === ALLOW, '[tool_name Edit is ignored]', other.status, ALLOW, other.stderr)
const malformed = runRaw('not json')
report(malformed.status === ALLOW, '[malformed stdin is ignored]', malformed.status, ALLOW, malformed.stderr)

const total = cases.length + 2
console.log(`\nguard-bash.test: ${total - failed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
