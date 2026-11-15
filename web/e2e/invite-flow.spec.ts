import { expect, test } from '@playwright/test'

const PASSWORD = 'correct horse battery'

test('the first member creates the family and a second joins by invite link', async ({ browser }) => {
  // --- Anna: first-time setup -----------------------------------------------------------
  const anna = await (await browser.newContext()).newPage()
  await anna.goto('/')
  await expect(anna).toHaveURL(/\/register$/)
  await expect(anna.getByRole('heading', { name: 'Crea la famiglia' })).toBeVisible()

  await anna.getByLabel('Nome della famiglia').fill('Famiglia Rossi')
  await anna.getByLabel('Il tuo nome').fill('Anna')
  await anna.getByLabel('Email').fill('anna@example.com')
  await anna.getByLabel(/^Password/).fill(PASSWORD)
  await anna.getByRole('button', { name: 'Registrati' }).click()
  await expect(anna.getByRole('heading', { name: 'La collezione', exact: true })).toBeVisible()

  // --- Anna creates an invite -----------------------------------------------------------
  await anna.getByRole('button', { name: 'Account' }).click()
  await anna.getByRole('menuitem', { name: 'Famiglia' }).click()
  await anna.getByRole('button', { name: 'Crea un invito' }).click()
  const link = await anna.getByLabel('Link di invito').inputValue()
  expect(link).toMatch(/\/invite\/.+/)

  // --- Bob: opens the link in a separate browser and joins -------------------------------
  const bob = await (await browser.newContext()).newPage()
  await bob.goto(new URL(link).pathname)
  await expect(bob.getByText('Sei stato invitato in “Famiglia Rossi”.')).toBeVisible()
  await bob.getByLabel('Il tuo nome').fill('Bob')
  await bob.getByLabel('Email').fill('bob@example.com')
  await bob.getByLabel(/^Password/).fill(PASSWORD)
  await bob.getByRole('button', { name: 'Registrati' }).click()
  await expect(bob.getByRole('heading', { name: 'La collezione', exact: true })).toBeVisible()

  await bob.getByRole('button', { name: 'Account' }).click()
  await bob.getByRole('menuitem', { name: 'Famiglia' }).click()
  await expect(bob.getByRole('listitem').filter({ hasText: 'Anna' })).toBeVisible()
  await expect(bob.getByRole('listitem').filter({ hasText: 'Bob' })).toBeVisible()

  // --- The link is single use ------------------------------------------------------------
  const carla = await (await browser.newContext()).newPage()
  await carla.goto(new URL(link).pathname)
  await expect(carla.getByText(/già stato usato/)).toBeVisible()
  await expect(carla.getByLabel('Email')).toHaveCount(0)

  // --- Anna sees the invite as used, and Bob is listed ----------------------------------
  await anna.reload()
  await expect(anna.getByText(/usato/)).toBeVisible()
  await expect(anna.getByRole('listitem').filter({ hasText: 'Bob' })).toBeVisible()
})

test('someone without an invite cannot register once the family exists', async ({ browser }) => {
  const stranger = await (await browser.newContext()).newPage()
  await stranger.goto('/register')
  await expect(stranger.getByText('La famiglia esiste già')).toBeVisible()
  await stranger.goto('/')
  await expect(stranger).toHaveURL(/\/sign-in$/)
})

test('a member signs out and back in', async ({ browser }) => {
  const page = await (await browser.newContext()).newPage()
  await page.goto('/sign-in')
  await page.getByLabel('Email').fill('bob@example.com')
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Accedi' }).click()
  await expect(page.getByRole('heading', { name: 'La collezione', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Account' }).click()
  await page.getByRole('menuitem', { name: 'Esci' }).click()
  await expect(page).toHaveURL(/\/sign-in$/)
  await page.goto('/')
  await expect(page).toHaveURL(/\/sign-in$/)

  await page.getByLabel('Email').fill('bob@example.com')
  await page.getByLabel('Password').fill('wrong password 123')
  await page.getByRole('button', { name: 'Accedi' }).click()
  await expect(page.getByRole('alert')).toHaveText('Email o password non corretti.')
})

test('an invitation link sent before the change (/invito/...) still works', async ({ browser }) => {
  const anna = await (await browser.newContext()).newPage()
  const login = await anna.request.post('/api/auth/login', {
    headers: { 'X-Requested-With': 'groove' },
    data: { email: 'anna@example.com', password: PASSWORD },
  })
  expect(login.ok()).toBeTruthy()
  const invite = await anna.request.post('/api/invites', { headers: { 'X-Requested-With': 'groove' } })
  const { token } = await invite.json()

  const guest = await (await browser.newContext()).newPage()
  await guest.goto(`/invito/${token}`)
  await expect(guest).toHaveURL(new RegExp(`/invite/${token}$`))
  await expect(guest.getByLabel('Il tuo nome')).toBeVisible()
  await guest.goto('/accedi?x=1')
  await expect(guest).toHaveURL(/\/sign-in\?x=1$/)
})
