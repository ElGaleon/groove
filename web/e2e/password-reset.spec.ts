import { expect, test } from '@playwright/test'

const PASSWORD = 'correct horse battery'
const NEW = 'a brand new password'
const H = { 'X-Requested-With': 'groove' }

// Runs after invite-flow: Anna and Bob exist. Bob ends with the password he started with.
test('a member generates a reset link for another who forgot the password', async ({ browser }) => {
  const anna = await (await browser.newContext()).newPage()
  const login = await anna.request.post('/api/auth/login', { headers: H, data: { email: 'anna@example.com', password: PASSWORD } })
  expect(login.ok()).toBeTruthy()
  await anna.goto('/family')
  const bobRow = anna.getByRole('listitem').filter({ hasText: 'bob@example.com' })
  await bobRow.getByRole('button', { name: 'Reimposta la password' }).click()
  const link = await anna.getByLabel('Link per reimpostare la password').inputValue()
  expect(link).toMatch(/\/reset-password\/.+/)
  // nobody can reset themselves
  await expect(anna.getByRole('listitem').filter({ hasText: 'anna@example.com' }).getByRole('button', { name: 'Reimposta la password' })).toHaveCount(0)

  const bob = await (await browser.newContext()).newPage()
  await bob.goto(new URL(link).pathname)
  await expect(bob.getByRole('heading', { name: 'Nuova password', exact: true })).toBeVisible()
  await expect(bob.getByText('Ciao Bob')).toBeVisible()
  await bob.getByLabel(/^Nuova password/).fill(NEW)
  await bob.getByRole('button', { name: 'Salva la password' }).click()
  await expect(bob.getByRole('heading', { name: 'La collezione', exact: true })).toBeVisible()

  // the link works once
  const again = await (await browser.newContext()).newPage()
  await again.goto(new URL(link).pathname)
  await expect(again.getByText('Questo link è già stato usato.')).toBeVisible()
  await expect(again.getByLabel(/^Nuova password/)).toHaveCount(0)

  // leave the shared database as it was
  const restore = await bob.request.post('/api/auth/password', { headers: H, data: { current_password: NEW, new_password: PASSWORD } })
  expect(restore.ok()).toBeTruthy()
})

test('the sign-in screen tells how to recover access', async ({ browser }) => {
  const page = await (await browser.newContext()).newPage()
  await page.goto('/sign-in')
  await expect(page.getByText('Password dimenticata?')).toBeVisible()
  await page.goto('/reset-password/not-a-real-token')
  await expect(page.getByText('Questo link non è valido.')).toBeVisible()
})
