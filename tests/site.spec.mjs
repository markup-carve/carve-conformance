import { test, expect } from '@playwright/test'

const consoleErrors = page => {
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  return errors
}

test('landing page shows both lanes from the assembled summary', async ({ page }) => {
  const errors = consoleErrors(page)
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText("Do Carve's readers agree?")
  await expect(page.locator('#f-cases')).toHaveText(/^\d[\d,]*$/)
  await expect(page.locator('#f-compared')).toHaveText(/^\d[\d,]*$/)
  await expect(page.locator('#targets li')).not.toHaveCount(0)
  await expect(page.locator('#pin-rows tr')).toHaveCount(4)
  expect(errors).toEqual([])
})

test('specimen steps through cases and settles every reader', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#readers li')).toHaveCount(4)
  await expect(page.locator('#readers li.pending')).toHaveCount(0)
  const first = await page.locator('#case-id').textContent()
  await page.getByRole('button', { name: 'Next case' }).click()
  await expect(page.locator('#case-id')).not.toHaveText(first)
  await expect(page.locator('#case-count')).toHaveText(/^2 \/ \d+$/)
  await expect(page.locator('#case-note')).toContainText('readers agree')
  await page.getByRole('button', { name: 'Previous case' }).click()
  await expect(page.locator('#case-id')).toHaveText(first)
})

for (const [path, name] of [['/proofs/', 'Proofs'], ['/compat/', 'Compatibility']]) {
  test(`${name} lane carries the shared bar`, async ({ page }) => {
    await page.goto(path)
    const bar = page.getByRole('navigation', { name: 'Carve conformance' })
    await expect(bar.locator('[aria-current="page"]')).toHaveText(name)
    await bar.locator('.cc-home').click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.locator('h1')).toHaveText("Do Carve's readers agree?")
  })
}

test('landing page does not scroll sideways', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#readers li')).toHaveCount(4)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

test('comparison section shows edit and import results', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#edit-rows tr')).toHaveCount(4)
  await expect(page.locator('#edit-rows tr').first().locator('td')).toHaveCount(3)
  await expect(page.locator('#edit-rows td').first()).toHaveText(/^\d+ \/ \d+$/)
  await expect(page.locator('#import-rows tr')).not.toHaveCount(0)
  await expect(page.locator('#import-rows th').first()).toContainText('into Carve')
})
