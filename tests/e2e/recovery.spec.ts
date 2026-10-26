// Recovery (CLAUDE.md rule 12, docs/plans/active/m2-demo.md storage bullet): a save this build
// cannot read opens a blocking dialog instead of a silent fresh start. The player restores a
// backup slot or starts fresh; nothing runs or saves until then, and the damaged save sits under
// a quarantine key either way.
import { expect, test } from '@playwright/test'
import { QUARANTINE_PREFIX, SAVE_KEY, backupKey, clearSave, continueFromTitle, leaveGame, openGame, readMirror, readSaves, restamp, rollTimes, seedSaves } from './helpers'

const GARBAGE = 'garbage{{{'

test('a damaged save opens the recovery dialog and a backup slot can be restored', async ({ page }) => {
  await clearSave(page)
  await openGame(page)
  await rollTimes(page, 3)
  const points = (await page.getByTestId('points').textContent()) ?? ''
  expect(points).not.toBe('0')

  // Leaving the page writes the current game to the mirror synchronously; that envelope becomes the backup.
  await leaveGame(page)
  const envelope = await readMirror(page)
  expect(envelope).not.toBeNull()
  await seedSaves(page, { [SAVE_KEY]: GARBAGE, [backupKey(5)]: restamp(envelope ?? '', Date.now()) }, { [SAVE_KEY]: GARBAGE })

  await page.goto('/')
  const dialog = page.getByTestId('recovery-dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('5 min backup slot')
  await expect(dialog).toContainText('3 rolls')
  // The game has not started: no roll button behind the dialog.
  await expect(page.getByTestId('roll-button')).toHaveCount(0)

  await page.getByTestId('recovery-restore-0').click()

  await expect(dialog).toHaveCount(0)
  // The title stays up until Continue; the restored game is behind it.
  await continueFromTitle(page)
  await expect(page.getByTestId('roll-button')).toBeVisible()
  await expect(page.getByTestId('points')).toHaveText(points)
  // The restored game is saved and the damaged copy is kept under quarantine.
  await expect.poll(async () => {
    const saves = await readSaves(page)
    const main = saves[SAVE_KEY]
    const quarantined = Object.entries(saves).filter(([key]) => key.startsWith(QUARANTINE_PREFIX))
    return main !== undefined && main !== GARBAGE && quarantined.some(([, value]) => value === GARBAGE)
  }).toBe(true)
})

test('a damaged save with no backup offers a fresh start and keeps the damaged copy', async ({ page }) => {
  await clearSave(page)
  await seedSaves(page, { [SAVE_KEY]: GARBAGE }, { [SAVE_KEY]: GARBAGE })

  await page.goto('/')
  const dialog = page.getByTestId('recovery-dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('No backup this version can read')
  await expect(page.getByTestId('roll-button')).toHaveCount(0)
  // Escape does not dismiss it: the choice has to be made.
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()

  await page.getByTestId('recovery-fresh').click()

  await expect(dialog).toHaveCount(0)
  await continueFromTitle(page)
  await expect(page.getByTestId('roll-button')).toBeVisible()
  await expect(page.getByTestId('points')).toHaveText('0')
  await expect(page.getByTestId('error-banner')).toHaveCount(0)
  await expect.poll(async () => {
    const saves = await readSaves(page)
    const main = saves[SAVE_KEY]
    const quarantined = Object.entries(saves).filter(([key]) => key.startsWith(QUARANTINE_PREFIX))
    return main !== undefined && main !== GARBAGE && quarantined.some(([, value]) => value === GARBAGE)
  }).toBe(true)
})
