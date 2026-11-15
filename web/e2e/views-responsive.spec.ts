import { expect, test, type Page } from '@playwright/test'

const PASSWORD = 'correct horse battery'
const H = { 'X-Requested-With': 'groove' }

async function signInAsAnna(page: Page) {
  const login = await page.request.post('/api/auth/login', {
    headers: H,
    data: { email: 'anna@example.com', password: PASSWORD },
  })
  if (!login.ok()) {
    await page.request.post('/api/auth/register', {
      headers: H,
      data: { email: 'anna@example.com', password: PASSWORD, display_name: 'Anna', household_name: 'Famiglia Rossi' },
    })
  }
}

for (const [name, width, height] of [
  ['phone', 375, 800],
  ['desktop', 1280, 800],
] as const) {
  test(`list and grid fit the ${name} screen (${width}px)`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: name === 'phone' })
    const page = await context.newPage()
    await signInAsAnna(page)
    if ((await (await page.request.get('/api/records?limit=1')).json()).total === 0) {
      for (const [title, artist] of [
        ['Kind of Blue', 'Miles Davis'],
        ['Homogénic', 'Björk'],
        ['The Wall', 'Pink Floyd'],
      ]) {
        await page.request.post('/api/records', { headers: H, data: { title, artist, year: 1990, genres: ['Jazz'] } })
      }
    }
    for (const view of ['list', 'grid']) {
      await page.goto(`/?view=${view}`)
      await expect(page.locator(view === 'list' ? 'tbody tr' : 'ul.grid li').first()).toBeVisible()
      await page.waitForTimeout(500) // covers
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow).toBeLessThanOrEqual(0)
      await page.screenshot({ path: `screenshots/${name}-${view}.png` })
    }
    await page.goto('/records/new')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
}
