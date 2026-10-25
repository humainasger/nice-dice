// Guard: no tuning numbers hide in src/core. Numeric literals belong in src/content tables.
// Non-test core files may use only 0, 1, 2, 10, 100 and 1000 (compared by value, so 1e3 and
// 1_000 pass), anything goes in src/core/num.ts and src/core/rng.ts, and a line carrying the
// comment "// literal-ok" is exempt. Comments and string contents are stripped before the scan,
// except that a numeric string handed to N.from(...) or N.parse(...) is checked by value first,
// so N.from('1.08') cannot smuggle a constant. A line that declares a type alias
// (type Face = 1 | 2 | 3 | 4 | 5 | 6) is a literal union, not tuning, and is skipped.
import { describe, expect, it } from 'vitest'
import { isTestFile, lineAt, stripSource } from './helpers'

const files = import.meta.glob('/src/core/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const EXEMPT_FILES = new Set(['/src/core/num.ts', '/src/core/rng.ts'])
const ALLOWED_VALUES = new Set([0, 1, 2, 10, 100, 1000])
const ESCAPE_COMMENT = '// literal-ok'
// A line that opens a type alias: its literals are type positions, not values.
const TYPE_LINE = /^\s*(export\s+)?type\s+\w+/

// Hex, octal, binary, decimal with optional fraction and exponent, or a leading-dot fraction,
// with an optional BigInt suffix. The lookbehind rejects digits inside identifiers and property
// names (d6, xoroshiro128plus, obj.v2, $1); the lookahead rejects a trailing identifier char.
const NUMERIC_LITERAL =
  /(?<![\w$.])(?:0[xX][\da-fA-F_]+|0[oO][0-7_]+|0[bB][01_]+|\d[\d_]*(?:\.[\d_]*)?(?:[eE][+-]?\d[\d_]*)?|\.\d[\d_]*(?:[eE][+-]?\d[\d_]*)?)n?(?![\w$])/g

// N.from('1.08') or N.parse("1.15e2"): a numeric string as the first argument. Scanned with
// strings intact, before the string stripper blanks the digits.
const NUMERIC_STRING_ARG = /\bN\.(?:from|parse)\(\s*(['"])([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\1/g

interface Hit {
  line: number
  literal: string
}

function findLiterals(source: string): Hit[] {
  const skippedLines = new Set<number>()
  source.split('\n').forEach((text, i) => {
    if (text.includes(ESCAPE_COMMENT) || TYPE_LINE.test(text)) skippedLines.add(i + 1)
  })
  const found: Array<Hit & { index: number }> = []
  const record = (code: string, index: number, literal: string, value: number): void => {
    if (ALLOWED_VALUES.has(value)) return
    const line = lineAt(code, index)
    if (skippedLines.has(line)) return
    found.push({ line, literal, index })
  }

  // Pass 1, strings intact: numeric strings passed to N.from / N.parse.
  const withStrings = stripSource(source, 'comments')
  for (const match of withStrings.matchAll(NUMERIC_STRING_ARG)) {
    const quote = match[1] ?? ''
    const digits = match[2] ?? ''
    record(withStrings, match.index ?? 0, `${quote}${digits}${quote}`, Number(digits))
  }

  // Pass 2, strings blanked: bare numeric literals.
  const code = stripSource(source, 'comments-and-strings')
  for (const match of code.matchAll(NUMERIC_LITERAL)) {
    const literal = match[0]
    record(code, match.index ?? 0, literal, Number(literal.replace(/_/g, '').replace(/n$/, '')))
  }

  return found.sort((a, b) => a.index - b.index).map(({ line, literal }) => ({ line, literal }))
}

function describeHits(path: string, hits: Hit[]): string {
  if (hits.length === 0) return ''
  const lines = hits.map((hit) => `  line ${hit.line}: ${hit.literal}`)
  return `${path} has numeric literals outside the allowlist:\n${lines.join('\n')}\nMove the number to a src/content table (a numeric string in N.from or N.parse counts too), or append "${ESCAPE_COMMENT}" to the line if it is structural.`
}

describe('core numeric literals', () => {
  it('non-test src/core files use only allowlisted literals', () => {
    for (const path of Object.keys(files).sort()) {
      if (isTestFile(path) || EXEMPT_FILES.has(path)) continue
      const hits = findLiterals(files[path] ?? '')
      expect.soft(hits, describeHits(path, hits)).toEqual([])
    }
  })

  it('self-check: ignores identifiers, comments, strings, type lines and escaped lines', () => {
    const sample = [
      'const growth = 1.08',
      "const label = 'costs 1.08 per level'",
      '/* 3.5 in a block comment */ const a = 1 // and 7 here',
      'const faces = d6 + xoroshiro128plus + obj.v2 + $3 + e2e',
      'const ok = 0 + 1 + 2 + 10 + 100 + 1000 + 1e3 + 1_000 + 0x0 + 2n',
      'const marked = 0.15 // literal-ok',
      'const tpl = `${0.5} of ${count} faces, 99 total`',
      'const big = 42n',
      'const re = /\\d{3}/.test(s) ? .25 : 1e2',
      'type Face = 1 | 2 | 3 | 4 | 5 | 6',
      'export type Weight = 0.5 | 1.5',
      "const hidden = N.from('1.08')",
      'const hidden2 = N.parse("1.15e2")',
      "const two = N.from('2')",
      "const marked2 = N.parse('0.3') // literal-ok",
      'const fromVar = N.parse(label)',
    ].join('\n')
    expect(findLiterals(sample)).toEqual([
      { line: 1, literal: '1.08' },
      { line: 7, literal: '0.5' },
      { line: 8, literal: '42n' },
      { line: 9, literal: '.25' },
      { line: 12, literal: "'1.08'" },
      { line: 13, literal: '"1.15e2"' },
    ])
  })
})
