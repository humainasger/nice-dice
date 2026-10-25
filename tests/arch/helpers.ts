// Shared helpers for the architecture guard tests in tests/arch: test-file detection,
// line numbers, a comment and string stripper that keeps line structure intact, import
// statement parsing and import specifier resolution. Plain TypeScript, no vitest import,
// so the guard files stay small and agree on one definition of "code".

export function isTestFile(path: string): boolean {
  return /\.test\.tsx?$/.test(path)
}

// 1-based line number of a character index.
export function lineAt(source: string, index: number): number {
  let line = 1
  for (let i = 0; i < index && i < source.length; i++) {
    if (source.charCodeAt(i) === 10) line++
  }
  return line
}

export type StripMode = 'comments' | 'comments-and-strings'

// Characters after which a "/" starts a regex literal rather than a division.
const REGEX_PRECEDERS = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^'])
const REGEX_KEYWORDS = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'yield', 'await'])

// Returns the source with comments (and, in 'comments-and-strings' mode, the contents of
// string, template and regex literals) replaced by spaces. Newlines are kept, so indexes
// and line numbers in the result map 1:1 onto the original. Template expressions `${...}`
// stay as code. This is a tolerant scanner, not a parser: an unterminated quote gives up
// at the end of its line.
export function stripSource(source: string, mode: StripMode): string {
  const out = source.split('')
  const blankStrings = mode === 'comments-and-strings'
  const n = source.length

  const blank = (from: number, to: number): void => {
    for (let k = from; k < to && k < n; k++) {
      if (out[k] !== '\n') out[k] = ' '
    }
  }

  const regexAllowedAt = (slash: number): boolean => {
    let j = slash - 1
    while (j >= 0 && /\s/.test(out[j] ?? '')) j--
    if (j < 0) return true
    const c = out[j] ?? ''
    if (REGEX_PRECEDERS.has(c)) return true
    if (/[\w$]/.test(c)) {
      let k = j
      while (k >= 0 && /[\w$]/.test(out[k] ?? '')) k--
      return REGEX_KEYWORDS.has(out.slice(k + 1, j + 1).join(''))
    }
    return false
  }

  const scanQuoted = (start: number, quote: string): number => {
    let i = start + 1
    while (i < n) {
      const c = source.charAt(i)
      if (c === '\\') {
        i += 2
        continue
      }
      if (c === quote) {
        if (blankStrings) blank(start + 1, i)
        return i + 1
      }
      if (c === '\n') break
      i++
    }
    if (blankStrings) blank(start + 1, i)
    return i
  }

  const scanRegex = (start: number): number => {
    let i = start + 1
    let inClass = false
    while (i < n) {
      const c = source.charAt(i)
      if (c === '\\') {
        i += 2
        continue
      }
      if (c === '\n') return start + 1
      if (inClass) {
        if (c === ']') inClass = false
      } else if (c === '[') {
        inClass = true
      } else if (c === '/') {
        if (blankStrings) blank(start + 1, i)
        i++
        while (i < n && /[a-z]/i.test(source.charAt(i))) i++
        return i
      }
      i++
    }
    return start + 1
  }

  // Scans code from `start`. With `untilBrace` it stops at the "}" that closes a template
  // expression and returns that index; otherwise it returns the source length.
  const scanCode = (start: number, untilBrace: boolean): number => {
    let i = start
    let depth = 0
    while (i < n) {
      const c = source.charAt(i)
      const d = source.charAt(i + 1)
      if (c === '/' && d === '/') {
        const end = source.indexOf('\n', i)
        const stop = end === -1 ? n : end
        blank(i, stop)
        i = stop
        continue
      }
      if (c === '/' && d === '*') {
        const end = source.indexOf('*/', i + 2)
        const stop = end === -1 ? n : end + 2
        blank(i, stop)
        i = stop
        continue
      }
      if (c === '"' || c === "'") {
        i = scanQuoted(i, c)
        continue
      }
      if (c === '`') {
        i = scanTemplate(i)
        continue
      }
      if (c === '/' && regexAllowedAt(i)) {
        i = scanRegex(i)
        continue
      }
      if (untilBrace) {
        if (c === '{') depth++
        else if (c === '}') {
          if (depth === 0) return i
          depth--
        }
      }
      i++
    }
    return n
  }

  const scanTemplate = (start: number): number => {
    let i = start + 1
    let segment = i
    while (i < n) {
      const c = source.charAt(i)
      if (c === '\\') {
        i += 2
        continue
      }
      if (c === '`') {
        if (blankStrings) blank(segment, i)
        return i + 1
      }
      if (c === '$' && source.charAt(i + 1) === '{') {
        if (blankStrings) blank(segment, i)
        i = scanCode(i + 2, true) + 1
        segment = i
        continue
      }
      i++
    }
    if (blankStrings) blank(segment, n)
    return n
  }

  scanCode(0, false)
  return out.join('')
}

export interface ImportRef {
  specifier: string
  line: number
}

// Every static import, export-from and string-literal dynamic import in a file, with comments
// removed first so commented-out imports do not count. Regex based, as the contract asks.
export function findImports(source: string): ImportRef[] {
  const code = stripSource(source, 'comments')
  const patterns = [
    /\bfrom\s*(['"])([^'"\n]+)\1/g, // import ... from 'x' and export ... from 'x'
    /(?<![\w$.])import\s*(['"])([^'"\n]+)\1/g, // import 'x'
    /(?<![\w$.])import\s*\(\s*(['"])([^'"\n]+)\1\s*\)/g, // import('x')
  ]
  const refs: ImportRef[] = []
  for (const pattern of patterns) {
    for (const match of code.matchAll(pattern)) {
      refs.push({ specifier: match[2] ?? '', line: lineAt(code, match.index ?? 0) })
    }
  }
  return refs.sort((a, b) => a.line - b.line)
}

export type ImportTarget = { kind: 'file'; path: string } | { kind: 'package'; name: string }

// Resolves an import specifier seen in `fromFile` (a root-absolute path such as
// /src/core/sim.ts). Relative paths resolve against the file, "@/x" means /src/x, a leading
// "/" is Vite root-absolute, and anything else is an npm package (scoped names keep two
// segments, subpaths and ?query suffixes are dropped).
export function resolveImport(fromFile: string, specifier: string): ImportTarget {
  const spec = specifier.split('?')[0] ?? ''
  if (spec.startsWith('@/')) return { kind: 'file', path: normalizePath('/src/' + spec.slice(2)) }
  if (spec.startsWith('/')) return { kind: 'file', path: normalizePath(spec) }
  if (spec === '.' || spec === '..' || spec.startsWith('./') || spec.startsWith('../')) {
    return { kind: 'file', path: normalizePath(dirname(fromFile) + '/' + spec) }
  }
  const parts = spec.split('/')
  const name = spec.startsWith('@') && parts.length > 1 ? `${parts[0]}/${parts[1]}` : (parts[0] ?? spec)
  return { kind: 'package', name }
}

export function isUnder(path: string, dir: string): boolean {
  return path === dir || path.startsWith(dir + '/')
}

function dirname(path: string): string {
  const at = path.lastIndexOf('/')
  return at <= 0 ? '/' : path.slice(0, at)
}

function normalizePath(path: string): string {
  const out: string[] = []
  for (const segment of path.split('/')) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') {
      out.pop()
      continue
    }
    out.push(segment)
  }
  return '/' + out.join('/')
}
