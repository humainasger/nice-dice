// Guard: src/core is pure simulation. Non-test files there must not reach React, the DOM,
// browser storage, clocks, randomness, timers or the network. Comments are ignored, string
// contents are not (a string-keyed globalThis['localStorage'] still counts). One soft
// assertion per offending file, naming each token and line.
import { describe, expect, it } from 'vitest'
import { isTestFile, lineAt, stripSource } from './helpers'

const files = import.meta.glob('/src/core/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const FORBIDDEN_TOKENS = [
  "from 'react'",
  'from "react"',
  'window.',
  'document.',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'Date.now(',
  'new Date(',
  'Math.random(',
  'performance.now(',
  'setTimeout(',
  'setInterval(',
  'requestAnimationFrame(',
  'fetch(',
  'navigator.',
]

interface Hit {
  line: number
  token: string
}

// A token counts when it is not the tail of a longer identifier (prefetch( is not fetch().
function findForbidden(source: string): Hit[] {
  const code = stripSource(source, 'comments')
  const hits: Hit[] = []
  for (const token of FORBIDDEN_TOKENS) {
    let from = 0
    for (;;) {
      const at = code.indexOf(token, from)
      if (at === -1) break
      from = at + token.length
      const before = at === 0 ? '' : code.charAt(at - 1)
      if (/[\w$]/.test(before)) continue
      hits.push({ line: lineAt(code, at), token })
    }
  }
  return hits.sort((a, b) => a.line - b.line || a.token.localeCompare(b.token))
}

function describeHits(path: string, hits: Hit[]): string {
  if (hits.length === 0) return ''
  const lines = hits.map((hit) => `  line ${hit.line}: ${hit.token}`)
  return `${path} is not pure. Forbidden tokens:\n${lines.join('\n')}\nMove the side effect to src/app and pass the value (time, random, storage) into core.`
}

describe('core purity', () => {
  it('non-test src/core files contain no forbidden tokens', () => {
    for (const path of Object.keys(files).sort()) {
      if (isTestFile(path)) continue
      const hits = findForbidden(files[path] ?? '')
      expect.soft(hits, describeHits(path, hits)).toEqual([])
    }
  })

  it('self-check: flags real uses, ignores comments and longer identifiers', () => {
    const sample = [
      '// Date.now( inside a comment is fine',
      'const t = Date.now()',
      'const r = Math.random()',
      'prefetch(url)',
      'const w = globalThis.window.innerWidth',
      "import type { FC } from 'react'",
      '/* localStorage in a block comment */ const ok = 1',
    ].join('\n')
    expect(findForbidden(sample)).toEqual([
      { line: 2, token: 'Date.now(' },
      { line: 3, token: 'Math.random(' },
      { line: 5, token: 'window.' },
      { line: 6, token: "from 'react'" },
    ])
  })
})
