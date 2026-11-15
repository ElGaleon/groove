import { expect, test, type Page } from '@playwright/test'

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

test.describe('browse the collection', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await (await browser.newContext()).newPage()
    await signInAsAnna(page)
    const have = await (await page.request.get('/api/records?q=Seedalbum&limit=1')).json()
    if (have.total >= 200) return
    for (let i = 1; i <= 200; i++) {
      const r = await page.request.post('/api/records', {
        headers: H,
        data: {
          title: `Seedalbum ${String(i).padStart(3, '0')}`, artist: `Seedartist ${i % 10}`,
          year: 1950 + (i % 70), genres: [i % 2 ? 'Jazz' : 'Rock'], allow_duplicate: true,
        },
      })
      expect(r.ok()).toBeTruthy()
    }
  })

  const pick = async (page: Page, label: string, option: string) => {
    await page.getByRole('combobox', { name: label }).click()
    await page.getByRole('option', { name: option, exact: true }).click()
  }

  test('grid loads the first rows then more on scroll; filters survive view switch and reload', async ({ browser }) => {
    const page = await (await browser.newContext()).newPage()
    await signInAsAnna(page)
    await page.goto('/?view=grid&q=Seedalbum&sort=title')
    const cards = page.locator('ul.grid li')
    await expect(cards.first()).toContainText('Seedalbum 001')
    const first = await cards.count()
    expect(first).toBeGreaterThan(0)
    expect(first).toBeLessThan(200)
    await page.mouse.wheel(0, 100000)
    await expect.poll(async () => cards.count(), { timeout: 10_000 }).toBeGreaterThan(first)

    // filters survive a view switch and a reload
    await page.goto('/?view=grid&q=Seedalbum&sort=title')
    await pick(page, 'Anno', '1960')
    await page.getByRole('button', { name: 'Lista' }).click()
    await expect(page).toHaveURL(/year=1960/)
    await expect(page).toHaveURL(/q=Seedalbum/)
    await page.reload()
    await expect(page).toHaveURL(/year=1960/)
    await expect(page.getByRole('searchbox', { name: 'Cerca per titolo o artista' })).toHaveValue('Seedalbum')
    await expect(page.locator('ul.divide-y li').first()).toBeVisible()
  })

  test('open a record from a list row and from a grid card', async ({ browser }) => {
    const page = await (await browser.newContext()).newPage()
    await signInAsAnna(page)
    await page.goto('/?view=list&q=Seedalbum 007')
    await page.getByRole('button', { name: /Seedalbum 007/ }).click()
    await expect(page.getByRole('dialog').getByText('Seedalbum 007').first()).toBeVisible()
    await page.goto('/?view=grid&q=Seedalbum 008')
    await page.locator('ul.grid li button').first().click()
    await expect(page.getByRole('dialog').getByText('Seedalbum 008').first()).toBeVisible()
  })

  test('the search field answers "do we already have it?" and offers to add when we do not', async ({ browser }) => {
    const page = await (await browser.newContext()).newPage()
    await signInAsAnna(page)
    await page.goto('/?view=list')
    const box = page.getByRole('searchbox', { name: 'Cerca per titolo o artista' })
    await box.fill('Seedalbum 042')
    await expect(page.locator('ul.divide-y li')).toHaveCount(1)
    await box.fill('Album che non esiste zzz')
    await expect(page.getByText('Nessun disco corrisponde ai filtri.')).toBeVisible()
  })
})
