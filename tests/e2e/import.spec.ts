// Import (docs/plans/active/m2-demo.md storage bullet): the import button checks the string, then
// asks for confirmation with the export in view; only the second click replaces the game. A string
// that is not a save is refused on the first click and nothing changes.
import { expect, test } from '@playwright/test'
import { clearSave, openGame, rollTimes } from './helpers'

test('import asks for confirmation before replacing the game', async ({ page }) => {
  await clearSave(page)
  await openGame(page)
  await rollTimes(page, 2)
  const points = page.getByTestId('points')
  const exportedPoints = (await points.textContent()) ?? ''

  await page.getByTestId('settings-button').click()
  const exported = await page.getByTestId('export-text').inputValue()
  expect(exported).toMatch(/^ND1:/)
  await page.getByTestId('settings-done').click()
  await expect(page.getByTestId('settings-dialog')).toHaveCount(0)

  // Play on, so the current game differs from the export.
  await rollTimes(page, 3)
  await expect(points).not.toHaveText(exportedPoints)
  const currentPoints = (await points.textContent()) ?? ''

  await page.getByTestId('settings-button').click()
  await page.getByTestId('import-text').fill(exported)
  await page.getByTestId('import-button').click()

  // Armed, not imported: the confirmation is up and the game behind the dialog is unchanged.
  const confirm = page.getByTestId('import-confirm-button')
  await expect(confirm).toBeVisible()
  await expect(page.getByTestId('import-cancel-button')).toBeVisible()
  await expect(points).toHaveText(currentPoints)

  await confirm.click()

  await expect(page.getByTestId('import-result')).toHaveText(/imported/i)
  await expect(points).toHaveText(exportedPoints)
})

test('a string that is not a save is refused on the first click', async ({ page }) => {
  await clearSave(page)
  await openGame(page)
  await rollTimes(page, 2)
  const points = page.getByTestId('points')
  const before = (await points.textContent()) ?? ''

  await page.getByTestId('settings-button').click()
  await page.getByTestId('import-text').fill('hello world')
  await page.getByTestId('import-button').click()

  const result = page.getByTestId('import-result')
  await expect(result).toBeVisible()
  await expect(result).toHaveAttribute('role', 'alert')
  await expect(page.getByTestId('import-confirm-button')).toHaveCount(0)
  await expect(points).toHaveText(before)
})
