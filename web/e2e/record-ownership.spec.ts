import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'

const PASSWORD = 'correct horse battery'
const H = { 'X-Requested-With': 'groove' }

async function signInAsAnna(page: Page) {
  const login = await page.request.post('/api/auth/login', { headers: H, data: { email: 'anna@example.com', password: PASSWORD } })
  if (!login.ok()) {
    const created = await page.request.post('/api/auth/register', {
      headers: H,
      data: { email: 'anna@example.com', password: PASSWORD, display_name: 'Anna', household_name: 'Famiglia Rossi' },
    })
    expect(created.ok()).toBeTruthy()
  }
}

// Runs after invite-flow (Anna and Bob exist). The two records it makes are removed at the end.
test('ownership is visible in every view and can be changed from the detail at any time', async ({ browser }) => {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 } })).newPage()
  await signInAsAnna(page)
  const members = (await (await page.request.get('/api/household')).json()).members as { id: string; display_name: string }[]
  const anna = members.find((m) => m.display_name === 'Anna')!.id
  const bob = members.find((m) => m.display_name === 'Bob')!.id
  const make = async (title: string, owner_id: string | null) =>
    (await (await page.request.post('/api/records', { headers: H, data: { title, artist: 'Ownerlp Band', owner_id } })).json()).id as string
  const sharedId = await make('Ownerlp Shared', null)
  const annaId = await make('Ownerlp Anna', anna)

  try {
    // --- list and grid tell shared from owned -------------------------------------------------
    await page.goto('/?view=list&q=Ownerlp')
    const sharedRow = page.locator('ul.divide-y li').filter({ hasText: 'Ownerlp Shared' })
    const annaRow = page.locator('ul.divide-y li').filter({ hasText: 'Ownerlp Anna' })
    await expect(sharedRow.getByText('Condiviso')).toBeVisible()
    await expect(annaRow.getByText('Anna', { exact: true })).toBeVisible()
    await expect(sharedRow.locator('[data-owner="shared"]')).toHaveCount(1)
    await expect(annaRow.locator(`[data-owner="${anna}"]`)).toHaveCount(1)
    await page.screenshot({ path: path.join('test-results', 'ownership-list-phone.png') })

    await page.goto('/?view=grid&q=Ownerlp')
    await expect(page.locator('ul.grid li').filter({ hasText: 'Ownerlp Shared' }).locator('[data-owner="shared"]')).toBeVisible()
    await expect(page.locator('ul.grid li').filter({ hasText: 'Ownerlp Anna' }).locator(`[data-owner="${anna}"]`)).toBeVisible()
    await page.screenshot({ path: path.join('test-results', 'ownership-grid-phone.png') })

    // --- hand the shared record to Bob from its detail ----------------------------------------
    await page.getByRole('button', { name: /Ownerlp Shared/ }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('combobox', { name: 'Proprietario' }).click()
    await page.getByRole('option', { name: 'Bob' }).click()
    await expect(page.getByText('Ora è di Bob.')).toBeVisible()
    await expect(dialog.getByRole('combobox', { name: 'Proprietario' })).toContainText('Bob')
    await page.screenshot({ path: path.join('test-results', 'ownership-detail-phone.png') })
    await page.keyboard.press('Escape')

    // the views follow without reloading, and the owner filter finds it
    await expect(page.locator('ul.grid li').filter({ hasText: 'Ownerlp Shared' }).locator(`[data-owner="${bob}"]`)).toBeVisible()
    expect((await (await page.request.get(`/api/records?owner=${bob}&q=Ownerlp`)).json()).total).toBe(1)

    // --- and back to the family, whenever we like -----------------------------------------------
    await page.getByRole('button', { name: /Ownerlp Shared/ }).click()
    await page.getByRole('dialog').getByRole('combobox', { name: 'Proprietario' }).click()
    await page.getByRole('option', { name: 'Condiviso' }).click()
    await expect(page.getByText('Ora è condiviso.')).toBeVisible()
    expect((await (await page.request.get(`/api/records/${sharedId}`)).json()).owner_id).toBeNull()
    await page.keyboard.press('Escape')

    // --- the owner filter in the bar (inline on a wide screen) -----------------------------------
    const wide = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage()
    await signInAsAnna(wide)
    await wide.goto('/?view=list&q=Ownerlp')
    await expect(wide.locator('ul.divide-y li')).toHaveCount(2)
    await wide.getByRole('combobox', { name: 'Proprietario' }).click()
    await wide.getByRole('option', { name: /^Anna/ }).click()
    await expect(wide).toHaveURL(new RegExp(`owner=${anna}`))
    await expect(wide.locator('ul.divide-y li')).toHaveCount(1)
    await expect(wide.locator('ul.divide-y li').first()).toContainText('Ownerlp Anna')
    await wide.screenshot({ path: path.join('test-results', 'ownership-filter-desktop.png') })
  } finally {
    await page.request.delete(`/api/records/${sharedId}`, { headers: H })
    await page.request.delete(`/api/records/${annaId}`, { headers: H })
  }
})
