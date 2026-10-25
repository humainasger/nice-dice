#!/usr/bin/env node
// PreToolUse hook for the Bash tool. Reads the hook JSON from stdin, inspects
// tool_input.command, and exits 2 with a one-line reason on stderr when the command
// would destroy history or files, or edits src/core/save.ts without a migration test.
// Exit 0 lets the command run. These are best-effort string checks, not a shell
// parser: quotes are respected when splitting and tokenising, but variables, globs,
// heredoc bodies and anything read from a file or a script are not interpreted, and
// the Edit and Write tools are not covered by this hook.
//
// Blocked:
//   git push --force / -f / --force-with-lease / --force-if-includes / +refspec
//   git push --delete / -d / :refspec (deletes a remote branch)
//   git reset --hard
//   git clean with -f / --force (covers -fd, -fdx, -df)
//   rm -rf (any flag order, long flags too) unless every path is relative, has no
//   ".." segment and has node_modules or dist as a path component; any rm -rf fed
//   by xargs, since its paths are invisible here
//   sed -i, redirects, tee, cp or mv into src/core/save.ts unless the same command
//   also touches a *.migration.test.ts
//   all of the above inside bash/sh/zsh -c '<code>', eval <words>, node -e '<code>'
//   and python3 -c '<code>': the quoted code is checked recursively, and for node
//   and python the string literals inside it as well (execSync('rm -rf src'))
//
// Self-test: node .claude/hooks/guard-bash.test.mjs

import { readFileSync } from 'node:fs'

const MAX_DEPTH = 4

function readStdin() {
  try {
    return readFileSync(0, 'utf8')
  } catch {
    return ''
  }
}

function block(reason) {
  process.stderr.write(`guard-bash: ${reason}\n`)
  process.exit(2)
}

// Split a command line into simple commands on ; | & newline ( ) and backticks
// outside single and double quotes. && and || fall out of the single-character
// split as empty segments, which are dropped. Backslash escapes are kept intact.
const SEPARATORS = new Set([';', '|', '&', '\n', '(', ')', '`'])
function segments(command) {
  const out = []
  let cur = ''
  let quote = null
  for (let i = 0; i < command.length; i++) {
    const ch = command[i]
    if (ch === '\\' && quote !== "'" && i + 1 < command.length) {
      cur += ch + command[i + 1]
      i++
      continue
    }
    if (quote) {
      cur += ch
      if (ch === quote) quote = null
      continue
    }
    if (ch === "'" || ch === '"') {
      quote = ch
      cur += ch
      continue
    }
    if (SEPARATORS.has(ch)) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur)
  return out.map((s) => s.trim()).filter(Boolean)
}

// Whitespace-separated words with surrounding single or double quotes removed and
// backslash escapes outside single quotes resolved, so bash -c 'rm -rf src' yields
// three words and the third is the shell code it would run.
function tokens(segment) {
  const out = []
  let cur = ''
  let quote = null
  let inWord = false
  for (let i = 0; i < segment.length; i++) {
    const ch = segment[i]
    if (quote) {
      if (ch === quote) {
        quote = null
      } else if (ch === '\\' && quote === '"' && i + 1 < segment.length) {
        cur += segment[++i]
      } else {
        cur += ch
      }
      continue
    }
    if (ch === "'" || ch === '"') {
      quote = ch
      inWord = true
      continue
    }
    if (ch === '\\' && i + 1 < segment.length) {
      cur += segment[++i]
      inWord = true
      continue
    }
    if (/\s/.test(ch)) {
      if (inWord) {
        out.push(cur)
        cur = ''
        inWord = false
      }
      continue
    }
    cur += ch
    inWord = true
  }
  if (inWord) out.push(cur)
  return out
}

// Drop wrappers such as sudo, xargs, env, time, a brace-group opener and VAR=value prefixes.
const WRAPPERS = new Set(['sudo', 'xargs', 'env', 'time', 'nice', 'command', 'exec', 'nohup', 'builtin', '{', '!'])
function stripWrappers(toks) {
  let i = 0
  while (i < toks.length && (WRAPPERS.has(toks[i]) || /^[A-Za-z_][A-Za-z0-9_]*=/.test(toks[i]))) i++
  return toks.slice(i)
}

function isGit(toks, sub) {
  return toks[0] === 'git' && toks.includes(sub)
}

function checkGitPush(toks) {
  if (!isGit(toks, 'push')) return
  for (const t of toks.slice(toks.indexOf('push') + 1)) {
    if (t === '--force' || t.startsWith('--force-with-lease') || t.startsWith('--force-if-includes')) {
      block('git push --force is blocked. Open a new commit instead of rewriting shared history.')
    }
    if (/^-[A-Za-z]*f[A-Za-z]*$/.test(t)) {
      block('git push -f is blocked. Open a new commit instead of rewriting shared history.')
    }
    if (/^\+\S+/.test(t)) {
      block('git push with a +refspec is a force push and is blocked.')
    }
    if (t === '--delete' || /^-[A-Za-z]*d[A-Za-z]*$/.test(t)) {
      block('git push --delete removes a remote branch and is blocked. Delete branches in the GitHub UI after review.')
    }
    if (/^:\S+/.test(t)) {
      block('git push with an empty-source refspec (origin :branch) deletes the remote branch and is blocked.')
    }
  }
}

function checkGitReset(toks) {
  if (!isGit(toks, 'reset')) return
  if (toks.includes('--hard')) {
    block('git reset --hard is blocked. Use git stash or git restore on explicit paths.')
  }
}

function checkGitClean(toks) {
  if (!isGit(toks, 'clean')) return
  for (const t of toks.slice(toks.indexOf('clean') + 1)) {
    if (t === '--force' || /^-[A-Za-z]*f[A-Za-z]*$/.test(t)) {
      block('git clean -f deletes untracked files and is blocked. List the files and remove them explicitly.')
    }
  }
}

// A path is safe for rm -rf when it is relative, contains no ".." segment and has
// node_modules or dist as a path component. Separators are normalised first so
// 'dist\..\src' and 'dist//../src' read the same as dist/../src. A trailing /* is
// allowed (rm -rf dist/*); any other glob, ~ or $ is not.
function rmPathAllowed(path) {
  if (!path) return false
  const normalised = path.replace(/\\/g, '/').replace(/\/\*$/, '')
  if (/[~$*?]/.test(normalised)) return false
  if (normalised.startsWith('/')) return false
  const parts = normalised.split('/').filter((p) => p !== '' && p !== '.')
  if (parts.some((p) => p.includes('..'))) return false
  return parts.some((p) => p === 'node_modules' || p === 'dist')
}

function checkRm(toks, viaXargs) {
  if (toks[0] !== 'rm') return
  let recursive = false
  let force = false
  const paths = []
  let flagsDone = false
  for (const t of toks.slice(1)) {
    if (!flagsDone && t === '--') {
      flagsDone = true
      continue
    }
    if (!flagsDone && t.startsWith('--')) {
      if (t === '--recursive') recursive = true
      if (t === '--force') force = true
      continue
    }
    if (!flagsDone && t.startsWith('-') && t.length > 1) {
      if (/[rR]/.test(t)) recursive = true
      if (/f/.test(t)) force = true
      continue
    }
    paths.push(t)
  }
  if (!(recursive && force)) return
  if (viaXargs) {
    block('rm -rf fed by xargs removes paths this guard cannot see and is blocked. List the paths explicitly.')
  }
  for (const p of paths) {
    if (!rmPathAllowed(p)) {
      block(`rm -rf on "${p}" is blocked. Only relative paths under node_modules or dist, without "..", may be removed recursively.`)
    }
  }
}

const SHELLS = new Set(['bash', 'sh', 'zsh', 'dash', 'ksh'])
const PROGRAM_FLAGS = new Map([
  ['node', new Set(['-e', '--eval', '-p', '--print'])],
  ['python', new Set(['-c'])],
  ['python3', new Set(['-c'])],
])

// Code a wrapper command would execute, with how to read it: bash/sh/zsh -c '<code>'
// and eval <words> are shell; node -e '<code>' and python3 -c '<code>' are programs
// whose string literals may hold a shell command.
function embeddedCode(toks) {
  const [cmd = '', ...rest] = toks
  if (cmd === 'eval') return rest.length > 0 ? [{ code: rest.join(' '), kind: 'shell' }] : []
  const base = cmd.replace(/^.*\//, '')
  if (SHELLS.has(base)) {
    const i = rest.findIndex((t) => /^-[A-Za-z]*c[A-Za-z]*$/.test(t))
    return i >= 0 && rest[i + 1] !== undefined ? [{ code: rest[i + 1], kind: 'shell' }] : []
  }
  const flags = PROGRAM_FLAGS.get(base.replace(/^python3\.\d+$/, 'python3'))
  if (flags) {
    const i = rest.findIndex((t) => flags.has(t))
    return i >= 0 && rest[i + 1] !== undefined ? [{ code: rest[i + 1], kind: 'program' }] : []
  }
  return []
}

// String literals inside program code ('...', "...", `...`), where a shell command
// would sit: execSync('rm -rf src'), os.system("rm -rf src").
function stringLiterals(code) {
  const out = []
  const re = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g
  let m
  while ((m = re.exec(code)) !== null) out.push(m[1] ?? m[2] ?? m[3] ?? '')
  return out
}

function checkCommand(command, depth) {
  if (depth > MAX_DEPTH) return
  for (const seg of segments(command)) {
    const raw = tokens(seg)
    const toks = stripWrappers(raw)
    if (toks.length === 0) continue
    checkGitPush(toks)
    checkGitReset(toks)
    checkGitClean(toks)
    checkRm(toks, raw.includes('xargs'))
    for (const { code, kind } of embeddedCode(toks)) {
      checkCommand(code, depth + 1)
      if (kind === 'program') {
        for (const literal of stringLiterals(code)) checkCommand(literal, depth + 1)
      }
    }
  }
}

const SAVE_WRITE_PATTERNS = [
  /\bsed\b[^;&|\n]*\s-[A-Za-z]*i/,
  /\bsed\b[^;&|\n]*--in-place/,
  /\bperl\b[^;&|\n]*\s-[A-Za-z]*i/,
  />{1,2}\s*["']?[^\s"']*src\/core\/save\.ts/,
  /\btee\b[^;&|\n]*src\/core\/save\.ts/,
  /\b(cp|mv)\b[^;&|\n]*\s["']?[^\s"']*src\/core\/save\.ts/,
]

function checkSaveEdit(command) {
  if (!/src\/core\/save\.ts/.test(command)) return
  if (/\.migration\.test\.ts/.test(command)) return
  if (SAVE_WRITE_PATTERNS.some((re) => re.test(command))) {
    block(
      'editing src/core/save.ts without touching a *.migration.test.ts in the same command is blocked. A save shape change needs a SAVE_VERSION bump, a migration and a fixture test.',
    )
  }
}

let input
try {
  input = JSON.parse(readStdin())
} catch {
  process.exit(0)
}
if (input?.tool_name && input.tool_name !== 'Bash') process.exit(0)
const command = input?.tool_input?.command
if (typeof command !== 'string') process.exit(0)

checkCommand(command, 0)
checkSaveEdit(command)
process.exit(0)
