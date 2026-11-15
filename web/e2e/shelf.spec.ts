import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'

const PASSWORD = 'correct horse battery'
const H = { 'X-Requested-With': 'groove' }

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

async function seed(page: Page) {
  const have = await (await page.request.get('/api/records?q=Shelfalbum&limit=1')).json()
  if (have.total >= 30) return
  for (let i = 1; i <= 30; i++) {
    const r = await page.request.post('/api/records', {
      headers: H,
      data: {
        title: `Shelfalbum ${String(i).padStart(2, '0')}`,
        artist: `Shelfartist ${i % 7}`,
        year: 1960 + i,
        genres: ['Rock'],
        allow_duplicate: true,
      },
    })
    expect(r.ok()).toBeTruthy()
  }
}

const contexts: BrowserContext[] = []
/** Every test gets its own browser context, closed afterwards: WebGL contexts are scarce. */
async function newPage(browser: Browser, options: Parameters<Browser['newContext']>[0] = {}) {
  const context = await browser.newContext({ locale: 'it-IT', viewport: { width: 1280, height: 900 }, ...options })
  contexts.push(context)
  return context.newPage()
}

test.describe('3D shelf', () => {
  test.setTimeout(120_000)
  test.afterEach(async () => {
    await Promise.all(contexts.splice(0).map((c) => c.close()))
  })
  test.beforeAll(async ({ browser }) => {
    const page = await newPage(browser)
    await signInAsAnna(page)
    await seed(page)
  })

  const timeline = (page: Page) => page.getByRole('navigation', { name: 'Dischi sullo scaffale' }).getByRole('button')

  async function open(page: Page, query = '') {
    await signInAsAnna(page)
    await page.goto(`/?view=shelf&${query}`)
    await expect(page.locator('canvas').first()).toBeAttached({ timeout: 30_000 })
  }

  test('shows the shelf with its records, selects one, flips it and returns', async ({ browser }) => {
    const page = await newPage(browser)
    await open(page, 'q=Shelfalbum')
    await expect(timeline(page)).toHaveCount(10)
    await expect(page.getByText('Tocca un disco per aprirlo.')).toBeVisible()

    await timeline(page).first().click()
    await expect(page.getByRole('button', { name: 'Retro' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Dettagli' })).toBeVisible()
    await page.getByRole('button', { name: 'Retro' }).click()
    await expect(page.getByRole('button', { name: 'Fronte' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Retro' })).toHaveCount(0)
  })

  test('"Dettagli" opens the record in a dialog over the shelf', async ({ browser }) => {
    const page = await newPage(browser)
    await open(page, 'q=Shelfalbum')
    await timeline(page).first().click()
    await page.getByRole('button', { name: 'Dettagli' }).click({ timeout: 15_000 })
    await expect(
      page
        .getByRole('dialog')
        .getByText(/Shelfalbum \d\d/)
        .first(),
    ).toBeVisible()
    await expect(page).toHaveURL(/\/records\//)
  })

  test('"Mostra altri 10" never repeats the set on screen', async ({ browser }) => {
    const page = await newPage(browser)
    const sets: string[][] = []
    page.on('response', async (r) => {
      if (r.url().includes('/api/records/random')) sets.push((await r.json()).map((x: { id: string }) => x.id))
    })
    await open(page, 'q=Shelfalbum')
    await expect.poll(() => sets.length).toBeGreaterThan(0)
    // Dev StrictMode may draw the first set twice: let both answers arrive before fixing the set on screen.
    await expect(page.getByRole('button', { name: 'Mostra altri 10' })).toBeEnabled()
    await page.waitForLoadState('networkidle')
    const shown = sets.length - 1 // the set on screen
    for (let i = 0; i < 4; i++) {
      const before = sets.length
      await page.getByRole('button', { name: 'Mostra altri 10' }).click()
      await expect.poll(() => sets.length).toBeGreaterThan(before)
    }
    for (let i = shown + 1; i < sets.length; i++) {
      expect(sets[i]).toHaveLength(10)
      expect(sets[i].filter((id) => sets[i - 1].includes(id))).toEqual([])
    }
  })

  test('with filters that match one record the shelf says so', async ({ browser }) => {
    const page = await newPage(browser)
    await open(page, 'q=Shelfalbum 30')
    await expect(page.getByText('Con questi filtri c’è un solo disco.')).toBeVisible()
    await page.goto('/?view=shelf&q=zzznonesiste')
    await expect(page.getByText('Nessun disco corrisponde ai filtri.')).toBeVisible()
  })

  test('falls back to the grid with a message when WebGL cannot be created', async ({ browser }) => {
    const page = await newPage(browser)
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function (type: string, ...rest: unknown[]) {
        if (/webgl/.test(type)) return null
        return (original as (...a: unknown[]) => unknown).call(this, type, ...rest) as never
      } as never
    })
    await signInAsAnna(page)
    await page.goto('/?view=shelf&q=Shelfalbum')
    await expect(page.getByText('La grafica 3D non è disponibile')).toBeVisible()
    await expect(page.locator('ul.grid li').first()).toBeVisible()
  })
})
