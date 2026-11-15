import { expect, test } from '@playwright/test'

const PASSWORD = 'correct horse battery'
const MOCK = 'http://localhost:8020'

// The whole journey on an empty database: set up the family, invite a second member, add a record
// by hand, connect Discogs (a mock), import, browse the three views, then select and flip on the shelf.
test('release path: register, invite, add by hand, connect Discogs, import, browse, shelf', async ({ browser, request }) => {
  test.setTimeout(240_000)
  await request.get(`${MOCK}/__mode?cancel=0&delay=0.2`)

  // 1. The first member creates the family
  const anna = await (await browser.newContext({ locale: 'it-IT', viewport: { width: 1280, height: 900 } })).newPage()
  await anna.goto('/')
  await expect(anna).toHaveURL(/\/register$/)
  await anna.getByLabel('Nome della famiglia').fill('Famiglia Rossi')
  await anna.getByLabel('Il tuo nome').fill('Anna')
  await anna.getByLabel('Email').fill('anna@example.com')
  await anna.getByLabel(/^Password/).fill(PASSWORD)
  await anna.getByRole('button', { name: 'Registrati' }).click()
  await expect(anna.getByRole('heading', { name: 'La collezione', exact: true })).toBeVisible()

  // 2. She invites a second member, who joins with the link
  await anna.getByRole('button', { name: 'Account' }).click()
  await anna.getByRole('menuitem', { name: 'Famiglia' }).click()
  await anna.getByRole('button', { name: 'Crea un invito' }).click()
  const link = await anna.getByLabel('Link di invito').inputValue()
  const bob = await (await browser.newContext({ locale: 'it-IT' })).newPage()
  await bob.goto(new URL(link).pathname)
  await bob.getByLabel('Il tuo nome').fill('Bob')
  await bob.getByLabel('Email').fill('bob@example.com')
  await bob.getByLabel(/^Password/).fill(PASSWORD)
  await bob.getByRole('button', { name: 'Registrati' }).click()
  await expect(bob.getByRole('heading', { name: 'La collezione', exact: true })).toBeVisible()

  // 3. Anna adds a record by hand, owned by her
  await anna.goto('/')
  await anna.getByRole('button', { name: 'Aggiungi', exact: true }).first().click()
  await anna.getByRole('dialog').getByLabel('Titolo', { exact: true }).fill('Kind of Blue')
  await anna.getByRole('dialog').getByLabel('Artista', { exact: true }).fill('Miles Davis')
  await anna.getByRole('dialog').getByLabel('Anno', { exact: true }).fill('1959')
  await anna.getByRole('combobox', { name: 'Proprietario' }).click()
  await anna.getByRole('option', { name: 'Anna' }).click()
  await anna.getByRole('button', { name: 'Salva', exact: true }).click()
  await expect(anna.getByText('Disco aggiunto')).toBeVisible()

  // 4. Anna connects her Discogs account (mock) and imports her collection
  await anna.goto('/settings')
  await anna.getByRole('button', { name: 'Collega a Discogs' }).click()
  await expect(anna.getByRole('dialog').getByText('anna_d')).toBeVisible()
  await anna.goto('/import')
  await anna.getByRole('button', { name: 'Avvia l’importazione' }).click()
  await expect(anna.getByText('Fatto: aggiunti 230 dischi.')).toBeVisible({ timeout: 60_000 })

  // 5. Browse in the three views
  const total = async (q = '') => (await (await anna.request.get(`/api/records?limit=1&q=${encodeURIComponent(q)}`)).json()).total as number
  expect(await total()).toBe(231)
  await anna.goto('/?view=list')
  await expect(anna.locator('ul.divide-y li').first()).toBeVisible()
  await anna.getByLabel('Cerca per titolo o artista').fill('Kind of Blue')
  await expect(anna.locator('ul.divide-y li')).toHaveCount(1)
  await anna.goto('/?view=grid')
  await expect(anna.locator('ul.grid li').first()).toBeVisible()

  // 6. The shelf: ten records, select one, flip it, return it
  await anna.goto('/?view=shelf')
  const timeline = anna.getByRole('navigation', { name: 'Dischi sullo scaffale' }).getByRole('button')
  await expect(anna.locator('canvas').first()).toBeAttached({ timeout: 30_000 })
  await expect(timeline).toHaveCount(10, { timeout: 30_000 })
  await timeline.first().click()
  await expect(anna.getByRole('button', { name: 'Retro' })).toBeVisible({ timeout: 15_000 })
  await anna.getByRole('button', { name: 'Retro' }).click()
  await expect(anna.getByRole('button', { name: 'Fronte' })).toBeVisible()
  await anna.keyboard.press('Escape')
  await expect(anna.getByRole('button', { name: 'Retro' })).toHaveCount(0)

  // 7. Bob sees the same collection: his own Discogs is still locked
  expect((await (await bob.request.get('/api/records?limit=1')).json()).total).toBe(231)
  await bob.goto('/records/new')
  await expect(bob.getByText('Collega Discogs per trovare la versione esatta')).toBeVisible()
})
