import { expect, test, type Page } from '@playwright/test'

const PASSWORD = 'correct horse battery'
const H = { 'X-Requested-With': 'groove' }
const SEED = 'Pagealbum'
const COUNT = 37

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

const rows = (page: Page) => page.locator('tbody tr')
const cards = (page: Page) => page.locator('ul.grid li')

test.describe('paging the collection', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await (await browser.newContext()).newPage()
    await signInAsAnna(page)
    const have = await (await page.request.get(`/api/records?q=${SEED}&limit=1`)).json()
    for (let i = have.total + 1; i <= COUNT; i++) {
      const r = await page.request.post('/api/records', {
        headers: H,
        data: {
          title: `${SEED} ${String(i).padStart(2, '0')}`,
          artist: 'Pageartist',
          year: 1970,
          label: 'Pagelabel',
          country: 'UK',
          format: i % 2 ? 'LP' : '7"',
          allow_duplicate: true,
        },
      })
      expect(r.ok()).toBeTruthy()
    }
  })

  test('table: 10 per page, next page, size change, filter goes back to page 1', async ({ browser }) => {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage()
    await signInAsAnna(page)
    await page.goto(`/?view=list&q=${SEED}&sort=title`)
    await expect(rows(page)).toHaveCount(10)
    await expect(page.getByText(`1–10 di ${COUNT}`)).toBeVisible()
    await expect(rows(page).first()).toContainText('Pagelabel') // the version is in the table

    await page.getByRole('button', { name: 'Successiva' }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.getByText(`11–20 di ${COUNT}`)).toBeVisible()
    await expect(rows(page).first()).toContainText(`${SEED} 11`)

    await page.getByRole('button', { name: 'Ultima pagina' }).click()
    await expect(page.getByText(`31–${COUNT} di ${COUNT}`)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Successiva' })).toBeDisabled()

    await page.getByRole('combobox', { name: 'Dischi per pagina' }).click()
    await page.getByRole('option', { name: '25 per pagina' }).click()
    await expect(page).toHaveURL(/size=25/)
    await expect(page).not.toHaveURL(/page=/)
    await expect(rows(page)).toHaveCount(25)

    await page.getByRole('button', { name: 'Successiva' }).click()
    await expect(page).toHaveURL(/page=2/)
    await page.getByRole('combobox', { name: 'Formato' }).click()
    await page.getByRole('option', { name: 'LP', exact: true }).click()
    await expect(page).not.toHaveURL(/page=/)
    await expect(page.getByText('1–19 di 19')).toBeVisible()
  })

  test('table: coming back from a record keeps the page; a page past the end is corrected', async ({ browser }) => {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage()
    await signInAsAnna(page)
    await page.goto(`/?view=list&q=${SEED}&sort=title&page=3`)
    await expect(page.getByText(`21–30 di ${COUNT}`)).toBeVisible()
    await page.getByRole('button', { name: `${SEED} 22` }).click()
    await expect(page.getByRole('dialog').getByText(`${SEED} 22`).first()).toBeVisible()
    await page.goBack()
    await expect(page).toHaveURL(/page=3/)
    await expect(page.getByText(`21–30 di ${COUNT}`)).toBeVisible()

    await page.goto(`/?view=list&q=${SEED}&sort=title&page=9`)
    await expect(page).toHaveURL(/page=4/)
    await expect(page.getByText(`31–${COUNT} di ${COUNT}`)).toBeVisible()
  })

  test('table fits a 375px phone without sideways scrolling', async ({ browser }) => {
    const page = await (await browser.newContext({ viewport: { width: 375, height: 800 }, hasTouch: true })).newPage()
    await signInAsAnna(page)
    await page.goto(`/?view=list&q=${SEED}&sort=title`)
    await expect(rows(page)).toHaveCount(10)
    await expect(rows(page).first()).toContainText(`${SEED} 01`)
    await expect(rows(page).first()).toContainText('Pagelabel')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('grid: loads the next block on scroll, says when it is over, keeps blocks after a record', async ({
    browser,
  }) => {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage()
    await signInAsAnna(page)
    await page.goto(`/?view=grid&q=${SEED}&sort=title`)
    await expect(cards(page)).toHaveCount(10)
    await expect(cards(page).first()).not.toContainText('Pagelabel') // no version in the grid
    for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 100000)
    await expect(page.getByText('Non ci sono altri dischi.')).toBeVisible({ timeout: 20_000 })
    await expect(cards(page)).toHaveCount(COUNT)

    await cards(page).nth(30).locator('button').click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.goBack()
    await expect(cards(page)).toHaveCount(COUNT)
  })
})
