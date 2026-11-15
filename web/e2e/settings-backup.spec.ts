import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'

const PASSWORD = 'correct horse battery'
const H = { 'X-Requested-With': 'groove' }
const FILE = path.join(process.cwd(), 'e2e', 'fixtures', 'prototype-backup.json')

async function signInAsAnna(page: Page) {
  const login = await page.request.post('/api/auth/login', {
    headers: H,
    data: { email: 'anna@example.com', password: PASSWORD },
  })
  if (!login.ok()) {
    const created = await page.request.post('/api/auth/register', {
      headers: H,
      data: { email: 'anna@example.com', password: PASSWORD, display_name: 'Anna', household_name: 'Famiglia Rossi' },
    })
    expect(created.ok()).toBeTruthy()
  }
}

test('settings: default currency follows the member; backup export and import of a prototype file', async ({
  browser,
}) => {
  const page = await (await browser.newContext({ acceptDownloads: true })).newPage()
  await signInAsAnna(page)

  // --- default currency is saved on the server, so it survives a reload ----------------------
  await page.goto('/settings')
  await page.getByRole('combobox', { name: 'Valuta' }).click()
  await page.getByRole('option', { name: 'GBP' }).click()
  await expect(page.getByText('Valuta salvata.')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('combobox', { name: 'Valuta' })).toContainText('GBP')
  const me = await (await page.request.get('/api/auth/me')).json()
  expect(me.default_currency).toBe('GBP')

  // --- import the file exported by the browser prototype ------------------------------------
  await page.getByLabel('File di backup (.json)').setInputFiles(FILE)
  await expect(page.getByText(/Importati \d+ dischi/)).toBeVisible()

  await page.goto('/?view=list&q=Kind of Blue')
  await expect(page.getByRole('button', { name: /Kind of Blue/ }).first()).toBeVisible()
  await page.goto('/map')
  await expect(page.getByText('Disco Club').first()).toBeVisible()

  // importing again adds nothing
  await page.goto('/settings')
  await page.getByLabel('File di backup (.json)').setInputFiles(FILE)
  await expect(page.getByText(/Importati 0 dischi \(\d+ già presenti, saltati\)/)).toBeVisible()

  // --- export downloads a JSON file with the same records ------------------------------------
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Esporta' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^collezione-\d{4}-\d{2}-\d{2}\.json$/)
  const saved = path.join(process.cwd(), 'test-results', 'export.json')
  await download.saveAs(saved)
  const data = JSON.parse(await (await import('node:fs/promises')).readFile(saved, 'utf8'))
  expect(data.version).toBe(1)
  expect(data.vinyls.map((v: { title: string }) => v.title)).toEqual(
    expect.arrayContaining(['Kind of Blue', 'Homogénic']),
  )
})
