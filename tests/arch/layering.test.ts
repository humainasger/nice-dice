// Guard: dependency direction content -> core -> app -> ui. Each lower layer may import only
// the src directories and npm packages the contract allows. src/ui and src/components may
// import anything, src/lib (shadcn utilities) is exempt, and *.test.ts(x) files are exempt.
// Imports are found with a regex over the comment-stripped source; relative specifiers
// resolve against the importing file, "@/x" means src/x, bare specifiers are npm packages.
// A rule may also confine a package to one file: break_infinity.js belongs to src/core/num.ts
// and pure-rand (any subpath) to src/core/rng.ts, so a library swap stays a one-file change.
import { describe, expect, it } from 'vitest'
import { findImports, isTestFile, isUnder, resolveImport } from './helpers'

type RawFiles = Record<string, string>

const contentFiles = import.meta.glob('/src/content/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as RawFiles
const coreFiles = import.meta.glob('/src/core/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as RawFiles
const appFiles = import.meta.glob('/src/app/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as RawFiles

interface LayerRule {
  layer: string
  files: RawFiles
  allowedDirs: string[] // root-absolute src directories this layer may import from
  allowedPackages: string[] | 'any' // npm package names, or 'any'
  forbiddenDirs: string[] // named in the message when hit
  confinedPackages?: Record<string, string> // npm package -> the one root-absolute file allowed to import it
}

// The Decimal and RNG wrappers are the only importers of their libraries (ARCHITECTURE.md,
// number policy). Checked after the allowlist, in every layer that may import packages.
const CONFINED_PACKAGES: Record<string, string> = {
  'break_infinity.js': '/src/core/num.ts',
  'pure-rand': '/src/core/rng.ts',
}

const RULES: LayerRule[] = [
  {
    layer: 'src/content',
    files: contentFiles,
    allowedDirs: ['/src/content'],
    allowedPackages: ['zod'],
    forbiddenDirs: [],
  },
  {
    layer: 'src/core',
    files: coreFiles,
    allowedDirs: ['/src/core', '/src/content'],
    allowedPackages: ['break_infinity.js', 'pure-rand', 'zod'],
    forbiddenDirs: [],
    confinedPackages: CONFINED_PACKAGES,
  },
  {
    layer: 'src/app',
    files: appFiles,
    allowedDirs: ['/src/app', '/src/core', '/src/content'],
    allowedPackages: 'any',
    forbiddenDirs: ['/src/ui', '/src/components'],
    confinedPackages: CONFINED_PACKAGES,
  },
]

interface Violation {
  line: number
  specifier: string
  reason: string
}

function violationsFor(rule: LayerRule, path: string, source: string): Violation[] {
  const out: Violation[] = []
  for (const ref of findImports(source)) {
    const target = resolveImport(path, ref.specifier)
    if (target.kind === 'file') {
      if (rule.allowedDirs.some((dir) => isUnder(target.path, dir))) continue
      const named = rule.forbiddenDirs.find((dir) => isUnder(target.path, dir))
      const reason = named
        ? `${rule.layer} must never import ${named.slice(1)}`
        : `resolves to ${target.path}, outside ${rule.allowedDirs.map((d) => d.slice(1)).join(', ')}`
      out.push({ line: ref.line, specifier: ref.specifier, reason })
    } else if (rule.allowedPackages !== 'any' && !rule.allowedPackages.includes(target.name)) {
      out.push({
        line: ref.line,
        specifier: ref.specifier,
        reason: `npm package "${target.name}" is not allowed in ${rule.layer} (allowed: ${rule.allowedPackages.join(', ')})`,
      })
    } else {
      const owner = rule.confinedPackages?.[target.name]
      if (owner !== undefined && owner !== path) {
        out.push({ line: ref.line, specifier: ref.specifier, reason: `${target.name} may be imported only by ${owner}` })
      }
    }
  }
  return out
}

function describeViolations(path: string, violations: Violation[]): string {
  if (violations.length === 0) return ''
  const lines = violations.map((v) => `  line ${v.line}: import "${v.specifier}" ${v.reason}`)
  return `${path} breaks the layering rules:\n${lines.join('\n')}`
}

function describeAllowed(rule: LayerRule): string {
  const dirs = rule.allowedDirs.map((d) => d.slice(1)).join(', ')
  const pkgs = rule.allowedPackages === 'any' ? 'any npm package' : rule.allowedPackages.join(', ')
  return `${dirs} and ${pkgs}`
}

describe('layering', () => {
  for (const rule of RULES) {
    it(`${rule.layer} imports only ${describeAllowed(rule)}`, () => {
      for (const path of Object.keys(rule.files).sort()) {
        if (isTestFile(path)) continue
        const violations = violationsFor(rule, path, rule.files[path] ?? '')
        expect.soft(violations, describeViolations(path, violations)).toEqual([])
      }
    })
  }

  it('self-check: finds and resolves imports', () => {
    const sample = [
      "import { z } from 'zod'",
      "import type { Die } from '@/content/dice'",
      "import { clamp } from '../num'",
      "import 'side-effect'",
      "export * from './tables'",
      "// import x from 'react' is commented out",
      "const lazy = await import('./lazy')",
      "import Decimal from 'break_infinity.js'",
    ].join('\n')
    expect(findImports(sample).map((ref) => [ref.line, ref.specifier])).toEqual([
      [1, 'zod'],
      [2, '@/content/dice'],
      [3, '../num'],
      [4, 'side-effect'],
      [5, './tables'],
      [7, './lazy'],
      [8, 'break_infinity.js'],
    ])
    const from = '/src/core/sim/tick.ts'
    expect(resolveImport(from, '../num')).toEqual({ kind: 'file', path: '/src/core/num' })
    expect(resolveImport(from, './step.ts?raw')).toEqual({ kind: 'file', path: '/src/core/sim/step.ts' })
    expect(resolveImport(from, '@/content')).toEqual({ kind: 'file', path: '/src/content' })
    expect(resolveImport(from, 'pure-rand/lib/pure-rand')).toEqual({ kind: 'package', name: 'pure-rand' })
    expect(resolveImport(from, '@tanstack/react-query/devtools')).toEqual({ kind: 'package', name: '@tanstack/react-query' })
    expect(resolveImport(from, 'break_infinity.js')).toEqual({ kind: 'package', name: 'break_infinity.js' })
  })

  it('self-check: applies the allowlists', () => {
    const core = RULES[1]
    const app = RULES[2]
    if (!core || !app) throw new Error('rules missing')
    const coreSource = [
      "import React from 'react'",
      "import { loop } from '@/app/loop'",
      "import { z } from 'zod'",
      "import { dice } from '../content/dice'",
      "import Decimal from 'break_infinity.js'",
      "import { xoroshiro128plus } from 'pure-rand'",
    ].join('\n')
    expect(violationsFor(core, '/src/core/sim.ts', coreSource).map((v) => [v.line, v.specifier])).toEqual([
      [1, 'react'],
      [2, '@/app/loop'],
      [5, 'break_infinity.js'],
      [6, 'pure-rand'],
    ])
    const appSource = [
      "import { Button } from '@/components/ui/button'",
      "import { Board } from '../ui/Board'",
      "import { get, set } from 'idb-keyval'",
      "import { advance } from '@/core/sim'",
    ].join('\n')
    const appViolations = violationsFor(app, '/src/app/loop.ts', appSource)
    expect(appViolations.map((v) => v.specifier)).toEqual(['@/components/ui/button', '../ui/Board'])
    expect(appViolations[0]?.reason).toBe('src/app must never import src/components')
  })

  it('self-check: confines break_infinity.js to num.ts and pure-rand to rng.ts', () => {
    const core = RULES[1]
    const app = RULES[2]
    if (!core || !app) throw new Error('rules missing')
    const decimal = "import Decimal from 'break_infinity.js'"
    const rng = "import { xoroshiro128plus } from 'pure-rand/generator/xoroshiro128plus'"
    expect(violationsFor(core, '/src/core/num.ts', decimal)).toEqual([])
    expect(violationsFor(core, '/src/core/rng.ts', rng)).toEqual([])
    expect(violationsFor(core, '/src/core/sim.ts', decimal).map((v) => v.reason)).toEqual([
      'break_infinity.js may be imported only by /src/core/num.ts',
    ])
    expect(violationsFor(core, '/src/core/sim.ts', rng).map((v) => v.reason)).toEqual([
      'pure-rand may be imported only by /src/core/rng.ts',
    ])
    expect(violationsFor(app, '/src/app/store.ts', decimal).map((v) => v.reason)).toEqual([
      'break_infinity.js may be imported only by /src/core/num.ts',
    ])
  })
})
