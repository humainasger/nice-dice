// M2 smoke test (docs/plans/active/m2-demo.md): the game loads at 0, rolling earns points, a save
// survives a reload, settings export an ND1: string, a second tab is refused and the roll button
// and the settings Done button stay tappable on a phone. M6 (docs/plans/active/m6-mobile.md): the
// desktop bench shows full cards with the breakdown open, and a phone shows the play card with the
// last roll's faces, two compact cards in view, a card that expands and the automation sheet.
// Drives the UI through the data-testid contract only. Playwright gives every test a fresh browser context (own IndexedDB, localStorage
// and Web Locks), so state starts empty; the first test also wipes the origin's save explicitly,
// as a belt for the braces.
import { expect, test } from '@playwright/test'
import { MIN_TAP_PX, PHONE, POINTS_PATTERN, clearSave, continueFromTitle, openGame, rollTimes } from './helpers'

test('a fresh game reads 0 and rolling earns points', async ({ page }) => {
  await clearSave(page)
  await openGame(page)
  const points = page.getByTestId('points')
  await expect(points).toHaveText('0')

  await rollTimes(page, 3)

  await expect(points).not.toHaveText('0')
  await expect(points).toHaveText(POINTS_PATTERN)
})

test('a save survives a reload', async ({ page }) => {
  await openGame(page)
  const points = page.getByTestId('points')
  await rollTimes(page, 3)
  await expect(points).not.toHaveText('0')
  const before = (await points.textContent()) ?? ''

  // pagehide saves synchronously to the mirror and IndexedDB keeps the autosaved copy; a quick
  // reload is under rules.offline.minAwayMs, so nothing is credited and the number comes back as is.
  await page.reload()
  await continueFromTitle(page)

  await expect(page.getByTestId('roll-button')).toBeVisible()
  await expect(page.getByTestId('points')).toHaveText(before)
})

test('settings show an export string that starts with ND1:', async ({ page }) => {
  await openGame(page)
  await page.getByTestId('settings-button').click()
  await expect(page.getByTestId('export-text')).toHaveValue(/^ND1:/)
})

test('the desktop bench shows full cards and the breakdown open', async ({ page }) => {
  await openGame(page)
  await rollTimes(page, 1)
  await expect(page.getByTestId('last-roll-faces')).toBeVisible()
  // Full layout at lg: the +10 button is on the card itself and there is no expand chevron.
  await expect(page.getByTestId('level10-die_1')).toBeVisible()
  await expect(page.getByTestId('die-expand-die_1')).toHaveCount(0)
  await expect(page.getByTestId('breakdown-toggle')).toHaveAttribute('aria-expanded', 'true')
})

test('a second tab shows the locked screen while the first is open', async ({ page, context }) => {
  await openGame(page)

  // Same context, so the same origin storage and the same Web Lock namespace as the first tab.
  const second = await context.newPage()
  await second.goto('/')

  await expect(second.getByTestId('locked-screen')).toBeVisible()
  await expect(second.getByTestId('roll-button')).toHaveCount(0)
  // The first tab is untouched.
  await expect(page.getByTestId('roll-button')).toBeVisible()
  await second.close()
})

test.describe('phone viewport', () => {
  test.use({ viewport: PHONE, isMobile: true, hasTouch: true })

  test('the roll button is visible and at least 44 px tall', async ({ page }) => {
    await openGame(page)
    const roll = page.getByTestId('roll-button')
    await expect(roll).toBeVisible()
    await expect(roll).toBeInViewport()

    const box = await roll.boundingBox()
    expect(box).not.toBeNull()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(MIN_TAP_PX)
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(MIN_TAP_PX)
  })

  test('the settings dialog closes through a 44 px Done button', async ({ page }) => {
    await openGame(page)
    await page.getByTestId('settings-button').click()
    const done = page.getByTestId('settings-done')
    await expect(done).toBeVisible()
    // The dialog zooms in from 95 % over 100 ms; measure once the animation has settled.
    await expect.poll(async () => (await done.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(MIN_TAP_PX)
    await expect.poll(async () => (await done.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(MIN_TAP_PX)
    await done.click()
    await expect(page.getByTestId('settings-dialog')).toHaveCount(0)
  })

  test('the bench shows the last roll, two compact cards, an expanding card and the automation sheet', async ({ page }) => {
    await openGame(page)
    await rollTimes(page, 1)
    const faces = page.getByTestId('last-roll-faces')
    await expect(faces).toBeInViewport()
    await expect(faces.locator('li')).not.toHaveCount(0)
    await expect(page.getByTestId('breakdown-toggle')).toHaveAttribute('aria-expanded', 'false')

    // Two compact cards without scrolling, and the chevron is a 44 px target.
    await expect(page.getByTestId('die-card-die_1')).toBeInViewport()
    await expect(page.getByTestId('die-card-die_2')).toBeInViewport()
    const expand = page.getByTestId('die-expand-die_1')
    await expect(expand).toBeInViewport()
    expect((await expand.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(MIN_TAP_PX)
    expect((await expand.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(MIN_TAP_PX)
    await expect(page.getByTestId('level10-die_1')).toHaveCount(0)
    await expand.click()
    await expect(expand).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByTestId('level10-die_1')).toBeVisible()

    // The automation sheet holds the one auto-level and the one auto-refine switch.
    await page.getByTestId('automation-button').click()
    await expect(page.getByTestId('automation-sheet')).toBeVisible()
    await expect(page.getByTestId('auto-level-switch')).toHaveCount(1)
    await expect(page.getByTestId('auto-ascend-switch')).toHaveCount(1)
    const done = page.getByTestId('automation-done')
    await expect.poll(async () => (await done.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(MIN_TAP_PX)
    await done.click()
    await expect(page.getByTestId('automation-sheet')).toHaveCount(0)
  })
})
