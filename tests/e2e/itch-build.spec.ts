// itch.io build smoke (docs/ITCH.md): builds dist-itch with scripts/build-itch.mjs, unpacks the
// zip into a fresh temp folder and serves it from a nested path the way itch's CDN does
// (https://<cdn>/html/<upload id>/index.html), then loads it in the browser. The title screen must
// render and continue into the bench, every request must stay inside the nested folder and come
// back below 400 (an absolute /assets path would miss the nested root), the console must stay
// clean, and no service worker may register. Runs with pnpm test:e2e; the build adds a few seconds.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { createServer, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const ZIP = join(ROOT, 'dist-itch', 'nice-dice-itch.zip')
/** The nested folder the game is served from, like itch's /html/<upload id>/. */
const PREFIX = '/html/123456/'
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
}

let unpacked = ''
let server: Server | undefined
let origin = ''

/** Serves `dir` under PREFIX only; everything else, including paths that escape the folder, is a 404. */
function serveNested(dir: string): Server {
  return createServer((request, response) => {
    void (async () => {
      const url = new URL(request.url ?? '/', 'http://localhost')
      if (!url.pathname.startsWith(PREFIX)) return notFound(response)
      const relative = decodeURIComponent(url.pathname.slice(PREFIX.length))
      const file = resolve(dir, relative === '' ? 'index.html' : relative)
      if (!file.startsWith(dir + sep)) return notFound(response)
      try {
        const info = await stat(file)
        if (!info.isFile()) return notFound(response)
        response.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
        response.end(await readFile(file))
      } catch {
        notFound(response)
      }
    })()
  })
}

function notFound(response: ServerResponse): void {
  response.writeHead(404, { 'content-type': 'text/plain' })
  response.end('not found')
}

test.beforeAll(async () => {
  test.setTimeout(180_000)
  try {
    execFileSync(process.execPath, [join(ROOT, 'scripts', 'build-itch.mjs')], { cwd: ROOT, stdio: 'pipe' })
  } catch (error) {
    const failure = error as { stdout?: Buffer; stderr?: Buffer; message: string }
    throw new Error(`pnpm build:itch failed: ${failure.message}\n${failure.stdout ?? ''}\n${failure.stderr ?? ''}`)
  }
  unpacked = mkdtempSync(join(tmpdir(), 'nice-dice-itch-'))
  execFileSync('unzip', ['-q', ZIP, '-d', unpacked], { stdio: 'pipe' })
  server = serveNested(unpacked)
  await new Promise<void>((done) => server?.listen(0, '127.0.0.1', done))
  const { port } = server.address() as AddressInfo
  origin = `http://127.0.0.1:${port}`
})

test.afterAll(async () => {
  if (server !== undefined) await new Promise<void>((done) => server?.close(() => done()))
  if (unpacked !== '') rmSync(unpacked, { recursive: true, force: true })
})

test('the zipped itch build loads from a nested path and plays into the bench', async ({ page }) => {
  const requested: string[] = []
  const failed: string[] = []
  const errors: string[] = []
  page.on('request', (request) => requested.push(request.url()))
  page.on('requestfailed', (request) => failed.push(`${request.failure()?.errorText ?? 'failed'} ${request.url()}`))
  page.on('response', (response) => {
    if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`)
  })
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto(`${origin}${PREFIX}`)
  await expect(page.getByTestId('title-screen')).toBeVisible()
  // Disabled until boot has settled; Playwright waits for it to become enabled.
  await page.getByTestId('title-continue').click()
  await expect(page.getByTestId('roll-button')).toBeVisible()
  await expect(page.getByTestId('title-screen')).toHaveCount(0)
  await page.getByTestId('roll-button').click()
  await expect(page.getByTestId('points')).not.toHaveText('0')

  // Relative paths: every request resolved inside the nested folder, and all of them were served.
  const outside = requested.filter((url) => !url.startsWith(`${origin}${PREFIX}`))
  expect(outside).toEqual([])
  expect(requested.some((url) => url.includes('/assets/'))).toBe(true)
  expect(failed).toEqual([])
  expect(errors).toEqual([])

  // VITE_PLATFORM=itch: startServiceWorker returns before registerSW, and the zip carries no worker.
  const workers = await page.evaluate(() => navigator.serviceWorker.getRegistrations().then((list) => list.length))
  expect(workers).toBe(0)
  expect(requested.some((url) => /\/(sw|workbox-[^/]+)\.js$/.test(url))).toBe(false)
})
