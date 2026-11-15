import { expect, test, type Page } from '@playwright/test'

const SIZES = [
  { name: 'phone', width: 375, height: 812 },
  { name: 'desktop', width: 1280, height: 800 },
] as const

// The screen must not depend on the database of the run: say that a family already exists.
async function openSignIn(page: Page, size: { width: number; height: number }) {
  await page.setViewportSize({ width: size.width, height: size.height })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/api/auth/status', (route) => route.fulfill({ json: { needs_setup: false } }))
  await page.goto('/sign-in')
  await expect(page.getByRole('heading', { name: 'Accedi', exact: true })).toBeVisible()
}

for (const size of SIZES) {
  test.describe(size.name, () => {
    test('the sign-in form is centred on the screen and nothing scrolls sideways', async ({ page }) => {
      await openSignIn(page, size)
      const box = await page.locator('main > div').boundingBox()
      expect(box).not.toBeNull()
      expect(Math.abs(box!.y + box!.height / 2 - size.height / 2)).toBeLessThanOrEqual(2)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
      expect(overflow).toBe(false)
    })

    test('the sign-in screen looks as designed', async ({ page }) => {
      await openSignIn(page, size)
      await expect(page).toHaveScreenshot(`sign-in-${size.name}.png`, { animations: 'disabled', maxDiffPixelRatio: 0.02 })
    })
  })
}

test('the password can be shown and hidden', async ({ page }) => {
  await openSignIn(page, SIZES[0])
  const password = page.getByLabel('Password', { exact: true })
  await password.fill('correct horse battery')
  await expect(password).toHaveAttribute('type', 'password')
  const toggle = page.getByRole('button', { name: 'Mostra' })
  await toggle.click()
  await expect(password).toHaveAttribute('type', 'text')
  await expect(page.getByRole('button', { name: 'Nascondi' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Nascondi' }).click()
  await expect(password).toHaveAttribute('type', 'password')
})

test('on a phone the dark band shrinks while a field has focus', async ({ page }) => {
  await openSignIn(page, SIZES[0])
  const band = page.locator('header').first()
  const before = (await band.boundingBox())!.height
  await page.getByLabel('Email').focus()
  await expect.poll(async () => (await band.boundingBox())!.height).toBeLessThan(before / 2)
  await page.getByRole('heading', { name: 'Accedi', exact: true }).click()
  await expect.poll(async () => (await band.boundingBox())!.height).toBeGreaterThan(before - 2)
})

test('the button shows a record while the request is running', async ({ page }) => {
  await openSignIn(page, SIZES[0])
  await page.route('**/api/auth/login', async (route) => {
    await new Promise((r) => setTimeout(r, 800))
    await route.fulfill({ status: 401, json: { code: 'invalid_credentials', detail: 'x' } })
  })
  await page.getByLabel('Email').fill('anna@example.com')
  await page.getByLabel('Password', { exact: true }).fill('wrong password 123')
  await page.getByRole('button', { name: 'Accedi' }).click()
  const submit = page.getByRole('button', { name: 'Accedi' })
  await expect(submit).toBeDisabled()
  await expect(submit.locator('svg')).toHaveCount(1)
  await expect(page.getByRole('alert')).toHaveText('Email o password non corretti.')
  await expect(submit.locator('svg')).toHaveCount(0)
})

test('the screens follow a dark system theme and download no shelf fonts', async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: 'dark', locale: 'it-IT' })
  const page = await context.newPage()
  const fontRequests: string[] = []
  page.on('request', (r) => { if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) fontRequests.push(r.url()) })
  await openSignIn(page, SIZES[0])
  await expect(page.locator('div.dark').first()).toBeVisible()
  const bg = await page.evaluate(() => getComputedStyle(document.querySelector('div.dark')!).backgroundColor)
  expect(bg).not.toBe('rgb(255, 255, 255)')
  expect(fontRequests).toEqual([])
  await context.close()
})

test('the favicon is served', async ({ request }) => {
  const r = await request.get('/favicon.svg')
  expect(r.ok()).toBeTruthy()
  expect(r.headers()['content-type']).toContain('svg')
})
