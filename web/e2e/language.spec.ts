import { expect, test, type Page } from '@playwright/test'

const PASSWORD = 'correct horse battery'
const H = { 'X-Requested-With': 'groove' }

async function ensureAnna(page: Page) {
  const login = await page.request.post('/api/auth/login', { headers: H, data: { email: 'anna@example.com', password: PASSWORD } })
  if (!login.ok()) {
    const created = await page.request.post('/api/auth/register', {
      headers: H,
      data: { email: 'anna@example.com', password: PASSWORD, display_name: 'Anna', household_name: 'Famiglia Rossi' },
    })
    expect(created.ok()).toBeTruthy()
  }
}

test('a visitor whose browser is English sees the sign-in screen in English and can switch', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'en-GB' })
  const page = await context.newPage()
  await page.goto('/sign-in')
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await page.getByRole('button', { name: 'Italiano' }).click()
  await expect(page.getByRole('heading', { name: 'Accedi' })).toBeVisible()
  await context.close()
})

test('the language changes live from the menu and from Settings, and follows the member', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'it-IT' })
  const page = await context.newPage()
  await ensureAnna(page)
  await page.goto('/?view=list')
  await expect(page.getByRole('button', { name: 'Aggiungi', exact: true })).toBeVisible()

  // from the account menu
  await page.getByRole('button', { name: 'Account' }).click()
  await page.getByRole('menuitem', { name: 'English' }).click()
  await expect(page.getByRole('button', { name: 'Add', exact: true })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')

  // Settings show the same language
  await page.getByRole('button', { name: 'Account' }).click()
  await page.getByRole('menuitem', { name: 'Settings' }).click()
  await expect(page.getByRole('combobox', { name: 'Language' })).toContainText('English')

  // and change it back from there
  await page.getByRole('combobox', { name: 'Language' }).click()
  await page.getByRole('option', { name: 'Italiano' }).click()
  await expect(page.getByRole('combobox', { name: 'Lingua' })).toContainText('Italiano')
  await page.getByRole('combobox', { name: 'Lingua' }).click()
  await page.getByRole('option', { name: 'English' }).click()
  await expect.poll(async () => (await (await page.request.get('/api/auth/me')).json()).language).toBe('en')
  await context.close()

  // a new browser (another device) with an Italian browser still opens in English after sign-in
  const other = await browser.newContext({ locale: 'it-IT' })
  const phone = await other.newPage()
  await phone.goto('/sign-in')
  await phone.getByLabel('Email').fill('anna@example.com')
  await phone.getByLabel('Password').fill(PASSWORD)
  await phone.getByRole('button', { name: 'Accedi' }).click()
  await expect(phone.getByRole('button', { name: 'Add', exact: true })).toBeVisible()

  // leave Anna in Italian: the other specs share this database and expect Italian
  const reset = await phone.request.patch('/api/auth/preferences', {
    headers: { 'X-Requested-With': 'groove' },
    data: { language: 'it' },
  })
  expect(reset.ok()).toBeTruthy()
  await other.close()
})
