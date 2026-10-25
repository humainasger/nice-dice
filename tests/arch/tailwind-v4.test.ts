// Guard: Tailwind v4 only. Styles enter through @import "tailwindcss" in CSS, never the v3
// "@tailwind base/components/utilities" directives, and configuration lives in CSS, so the
// project root must have no tailwind.config.* and no postcss.config.* file.
// Files are read with node:fs, not import.meta.glob: under Vitest the ?raw import of a .css
// file resolves to "" (CSS processing is off), which let the directive check pass on any input.
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(import.meta.dirname, '../..')
const SRC = join(ROOT, 'src')

// Every .css file under src, keyed root-absolute (/src/index.css) like the other guards' paths.
function readCssFiles(dir: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const rel of readdirSync(dir, { recursive: true, encoding: 'utf8' })) {
    if (!rel.endsWith('.css')) continue
    out['/src/' + rel.split(sep).join('/')] = readFileSync(join(dir, rel), 'utf8')
  }
  return out
}

function rootFilesMatching(pattern: RegExp): string[] {
  return readdirSync(ROOT).filter((name) => pattern.test(name)).sort()
}

const cssFiles = readCssFiles(SRC)
const tailwindConfigs = rootFilesMatching(/^tailwind\.config\./)
const postcssConfigs = rootFilesMatching(/^postcss\.config\./)

const DIRECTIVE = '@tailwind '

interface Hit {
  line: number
  text: string
}

function findDirectives(css: string): Hit[] {
  const hits: Hit[] = []
  css.split('\n').forEach((text, i) => {
    if (text.includes(DIRECTIVE)) hits.push({ line: i + 1, text: text.trim() })
  })
  return hits
}

describe('tailwind v4', () => {
  it('reads real CSS through node:fs (the ?raw glob returned "" under Vitest)', () => {
    expect(Object.keys(cssFiles)).toContain('/src/index.css')
    expect(cssFiles['/src/index.css']).toContain('@import "tailwindcss"')
  })

  it('no "@tailwind " directives in src/**/*.css', () => {
    for (const path of Object.keys(cssFiles).sort()) {
      const hits = findDirectives(cssFiles[path] ?? '')
      const message =
        hits.length === 0
          ? ''
          : `${path} uses Tailwind v3 directives:\n${hits.map((h) => `  line ${h.line}: ${h.text}`).join('\n')}\nUse @import "tailwindcss" instead.`
      expect.soft(hits, message).toEqual([])
    }
  })

  it('no tailwind.config.* in the project root', () => {
    expect(tailwindConfigs, 'Tailwind v4 is configured in CSS (@theme), delete the config file').toEqual([])
  })

  it('no postcss.config.* in the project root', () => {
    expect(postcssConfigs, 'Tailwind v4 runs through @tailwindcss/vite, delete the PostCSS config').toEqual([])
  })

  it('self-check: detects the directive and accepts the v4 import', () => {
    expect(findDirectives('@import "tailwindcss";\n@tailwind base;\n@tailwind utilities;')).toEqual([
      { line: 2, text: '@tailwind base;' },
      { line: 3, text: '@tailwind utilities;' },
    ])
    expect(findDirectives('@import "tailwindcss";\n@theme inline { --font-sans: Geist; }')).toEqual([])
  })
})
