// Guard: UI never subscribes to the whole game store or to a fresh value. In src/ui and
// src/components a useGameStore call must pass a selector, never the identity (s => s, or
// function (s) { return s }), and a selector that builds a new object or array on every run
// (an object or array literal, a block body that returns one, or a body ending in a .map /
// .filter / .slice / Object.entries / Object.values / Object.keys call) must be wrapped in
// useShallow(...). Zustand v5 uses strict equality, so a fresh value every tick re-renders
// everything or loops forever.
import { describe, expect, it } from 'vitest'
import { isTestFile, lineAt, stripSource } from './helpers'

const files = import.meta.glob(['/src/ui/**/*.{ts,tsx}', '/src/components/**/*.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const CALL = /\buseGameStore(?:<[^>()]*>)?\(/g
const SINGLE_PARAM = /^(?:\(\s*([A-Za-z_$][\w$]*)\s*(?::[^)]*)?\)|([A-Za-z_$][\w$]*))$/
// function (s) { ... }, function name(s: T): R { ... }
const FUNCTION_EXPR = /^(?:async\s+)?function\b[^(]*\(([^)]*)\)\s*(?::[^{]*)?(\{[\s\S]*\})$/
// A callee that returns a new array or object every time it runs. Tested against the text
// before the body's final "(...)".
const FRESH_TAIL_CALL = /(?:\.(?:map|filter|slice)|(?:^|[^\w$.])Object\.(?:entries|values|keys))$/
const WRAP_HINT = 'wrap it in useShallow(...) or select primitives'

interface Hit {
  line: number
  problem: string
}

// Index of the ")" closing the "(" at `open`, or -1 when unbalanced.
function matchParen(code: string, open: number): number {
  let depth = 0
  for (let i = open; i < code.length; i++) {
    const c = code.charAt(i)
    if (c === '(') depth++
    else if (c === ')') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

// Index of the "(" opening the ")" at `close`, or -1 when unbalanced.
function matchParenBack(code: string, close: number): number {
  let depth = 0
  for (let i = close; i >= 0; i--) {
    const c = code.charAt(i)
    if (c === ')') depth++
    else if (c === '(') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

// Splits "params => body" at the first top-level arrow, or returns null for anything else
// (a named selector, a call expression, a function expression).
function splitArrow(arg: string): { params: string; body: string } | null {
  let depth = 0
  for (let i = 0; i < arg.length - 1; i++) {
    const c = arg.charAt(i)
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') depth--
    else if (depth === 0 && c === '=' && arg.charAt(i + 1) === '>') {
      return { params: arg.slice(0, i).trim(), body: arg.slice(i + 2).trim() }
    }
  }
  return null
}

// "(x)" wrapped as a whole in one pair of parentheses becomes "x"; anything else is unchanged.
function unwrapParens(text: string): { inner: string; wrapped: boolean } {
  if (text.startsWith('(') && matchParen(text, 0) === text.length - 1) {
    return { inner: text.slice(1, -1).trim(), wrapped: true }
  }
  return { inner: text, wrapped: false }
}

// Problems inside a "{ ... }" body: returning the parameter itself, or an object or array literal.
function classifyBlock(block: string, name: string, shape: string): string | null {
  if (name !== '') {
    const identity = new RegExp(`\\breturn\\s+${name.replace(/\$/g, '\\$')}\\s*(?:;|\\}|$)`)
    if (identity.test(block)) return `identity selector ${shape} subscribes to the whole store`
  }
  if (/\breturn\s*\(?\s*[[{]/.test(block)) {
    return `selector block returns an object or array literal; ${WRAP_HINT}`
  }
  return null
}

function classify(arg: string): string | null {
  if (arg === '') return 'useGameStore() has no selector and subscribes to the whole store'
  if (/^useShallow\s*\(/.test(arg)) return null

  const fn = FUNCTION_EXPR.exec(arg)
  if (fn) {
    const name = /^\s*([A-Za-z_$][\w$]*)/.exec(fn[1] ?? '')?.[1] ?? ''
    return classifyBlock(fn[2] ?? '', name, `useGameStore(function (${name}) { return ${name} })`)
  }

  const arrow = splitArrow(arg)
  if (!arrow) return null
  const param = SINGLE_PARAM.exec(arrow.params)
  const name = param ? (param[1] ?? param[2] ?? '') : ''
  const { inner: body, wrapped } = unwrapParens(arrow.body)

  if (name !== '' && body === name) {
    return `identity selector useGameStore(${name} => ${name}) subscribes to the whole store`
  }
  if (body.startsWith('{')) {
    if (wrapped) return `selector returns an object literal; ${WRAP_HINT}`
    return classifyBlock(body, name, `useGameStore(${name} => { return ${name} })`)
  }
  if (body.startsWith('[')) return `selector returns a fresh array literal; ${WRAP_HINT}`
  if (body.endsWith(')')) {
    const open = matchParenBack(body, body.length - 1)
    const callee = open === -1 ? '' : body.slice(0, open).trimEnd()
    const tail = FRESH_TAIL_CALL.exec(callee)
    if (tail) {
      const call = tail[0].replace(/^[^\w$.]/, '')
      return `selector ends in ${call}(...), a fresh array or object on every run; ${WRAP_HINT}`
    }
  }
  return null
}

function findMisuse(source: string): Hit[] {
  const code = stripSource(source, 'comments')
  const hits: Hit[] = []
  for (const match of code.matchAll(CALL)) {
    const start = match.index ?? 0
    const open = start + match[0].length - 1
    const close = matchParen(code, open)
    const raw = close === -1 ? code.slice(open + 1) : code.slice(open + 1, close)
    const arg = raw.trim().replace(/,\s*$/, '').trim() // a trailing comma in a multi-line call is not part of the selector
    const problem = classify(arg)
    if (problem) hits.push({ line: lineAt(code, start), problem })
  }
  return hits
}

function describeHits(path: string, hits: Hit[]): string {
  if (hits.length === 0) return ''
  return `${path} misuses useGameStore:\n${hits.map((h) => `  line ${h.line}: ${h.problem}`).join('\n')}`
}

describe('store selectors', () => {
  it('src/ui and src/components select narrowly from useGameStore', () => {
    for (const path of Object.keys(files).sort()) {
      if (isTestFile(path)) continue
      const hits = findMisuse(files[path] ?? '')
      expect.soft(hits, describeHits(path, hits)).toEqual([])
    }
  })

  it('self-check: flags whole-store and fresh-value selectors, accepts narrow ones', () => {
    const sample = [
      'const whole = useGameStore()',
      'const same = useGameStore(s => s)',
      'const same2 = useGameStore((state) => state)',
      'const obj = useGameStore(s => ({ a: s.a, b: s.b }))',
      'const ok1 = useGameStore(s => s.points)',
      'const ok2 = useGameStore(useShallow(s => ({ a: s.a, b: s.b })))',
      'const ok3 = useGameStore(selectPoints)',
      '// useGameStore() in a comment is fine',
      'const typed = useGameStore((s: GameState) => ({ a: s.a }))',
      'const mapped = useGameStore(s => s.dice.map((d) => d.level))',
      'const arr = useGameStore(s => [s.a, s.b])',
      'const blockObj = useGameStore(s => { return { a: s.a } })',
      'const blockArr = useGameStore((s) => { const x = s.a; return [x] })',
      'const fnIdentity = useGameStore(function (state) { return state })',
      'const values = useGameStore(s => Object.values(s.dice))',
      'const sliced = useGameStore((s) => s.log.slice(0, 5))',
      'const ok4 = useGameStore(useShallow(s => s.dice.map((d) => d.level)))',
      'const ok5 = useGameStore(s => s.dice.map((d) => d.level).length)',
      'const ok6 = useGameStore(function (s) { return s.points })',
      'const ok7 = useGameStore(useShallow((s) => [s.a, s.b]))',
      'const ok8 = useGameStore(s => Object.keys(s.dice).length)',
      'const ok9 = useGameStore((s: GameState): string => N.format(s.points))',
      'const multi = useGameStore(',
      '  (s) => s,',
      ')',
    ].join('\n')
    expect(findMisuse(sample).map((h) => h.line)).toEqual([1, 2, 3, 4, 9, 10, 11, 12, 13, 14, 15, 16, 23])
  })

  it('self-check: names the shape in the message', () => {
    const problem = (line: string): string => findMisuse(line)[0]?.problem ?? ''
    expect(problem('useGameStore(s => s.dice.map((d) => d.level))')).toContain('.map(...)')
    expect(problem('useGameStore(s => Object.entries(s.dice))')).toContain('Object.entries(...)')
    expect(problem('useGameStore(s => [s.a])')).toContain('fresh array literal')
    expect(problem('useGameStore(s => { return [s.a] })')).toContain('block returns an object or array literal')
    expect(problem('useGameStore(function (state) { return state })')).toContain('identity selector')
    expect(problem('useGameStore(s => { return s })')).toContain('identity selector')
  })
})
