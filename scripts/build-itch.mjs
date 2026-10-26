// itch.io build (docs/ITCH.md): a relative-path production build into dist-itch/ with
// VITE_PLATFORM=itch, so src/app/swUpdate.ts skips the service worker, then one zip with
// index.html at its root for the itch uploader. Run with `pnpm build:itch`.
//
// The build goes through Vite's JS API with the repo's vite.config.ts: the inline overrides set
// base './' and the output folder, and the two env vars are set before Vite loads so that the
// config (VITE_BASE feeds the PWA manifest's start_url and scope) and the app code
// (import.meta.env.VITE_PLATFORM) both see them.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const outDir = join(root, 'dist-itch')
const zipName = 'nice-dice-itch.zip'
const zipPath = join(outDir, zipName)

process.env.VITE_PLATFORM = 'itch'
process.env.VITE_BASE = './'

await build({
  root,
  configFile: join(root, 'vite.config.ts'),
  base: './',
  build: { outDir, emptyOutDir: true },
})

const html = readFileSync(join(outDir, 'index.html'), 'utf8')
checkRelativeUrls(html)

if (existsSync(zipPath)) rmSync(zipPath)
// Zip the folder's contents, not the folder: itch wants index.html at the root of the archive.
// -X drops the extra file attributes macOS adds. Excluded: the archive itself, Finder metadata,
// and the generated service worker files (vite-plugin-pwa still emits them; the app never
// registers a worker on itch, so they would only be dead weight in the upload).
const excluded = [zipName, '*.DS_Store', 'sw.js', 'workbox-*.js']
execFileSync('zip', ['-r', '-X', '-q', zipName, '.', ...excluded.flatMap((pattern) => ['-x', pattern])], {
  cwd: outDir,
  stdio: 'inherit',
})

const listing = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' }).trim().split('\n')
if (!listing.includes('index.html')) throw new Error(`${zipName} has no index.html at its root: ${listing.join(', ')}`)
const bytes = statSync(zipPath).size
console.log(
  `\n${relativeToRoot(zipPath)}: ${(bytes / 1024 / 1024).toFixed(2)} MB (${bytes} bytes), ${listing.filter((entry) => !entry.endsWith('/')).length} files, index.html at the zip root`,
)

/**
 * Every src and href in the built index.html must be relative: itch serves the game from a nested
 * path on its CDN, so a leading slash would point at the CDN root and 404. Vite's bundled assets
 * must appear as ./assets/... for the same reason.
 */
function checkRelativeUrls(indexHtml) {
  const urls = [...indexHtml.matchAll(/\b(?:src|href)="([^"]*)"/g)].map((match) => match[1])
  const absolute = urls.filter((url) => url.startsWith('/') || /^[a-z]+:/i.test(url))
  if (absolute.length > 0) {
    throw new Error(`dist-itch/index.html has absolute URLs, the build is not relative: ${absolute.join(', ')}`)
  }
  const assets = urls.filter((url) => url.includes('assets/'))
  if (assets.length === 0 || !assets.every((url) => url.startsWith('./assets/'))) {
    throw new Error(`dist-itch/index.html does not reference ./assets paths: ${urls.join(', ')}`)
  }
  console.log(`index.html references ${urls.length} relative URLs (${assets.length} under ./assets/)`)
}

function relativeToRoot(path) {
  return path.startsWith(root) ? path.slice(root.length + 1) : path
}
