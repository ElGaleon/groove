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

// Places and purchases are created through the API; the map itself is what is under test.
test('purchase map: markers, place detail by mouse and keyboard, online list, reassign before delete', async ({ browser }) => {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage()
  await signInAsAnna(page)
  const post = async (url: string, data: unknown) => {
    const r = await page.request.post(url, { headers: H, data })
    expect(r.ok(), await r.text()).toBeTruthy()
    return r.json()
  }
  const shop = await post('/api/locations', { name: 'Disco Club Mappa', kind: 'physical', address: 'Via Savona 1, Milano', lat: 45.4527, lng: 9.1676 })
  const other = await post('/api/locations', { name: 'Rhythm Mappa', kind: 'physical', address: 'Via del Pigneto 12, Roma', lat: 41.8873, lng: 12.5295 })
  await post('/api/locations', { name: 'Bandcamp Mappa', kind: 'online', url: 'https://bandcamp.com' })
  const web = (await (await page.request.get('/api/locations?q=Bandcamp Mappa')).json())[0]
  for (const [title, loc, amount] of [['Mappa A', shop.id, 1000], ['Mappa B', shop.id, 2000], ['Mappa C', other.id, 500], ['Mappa D', web.id, 700]] as const) {
    await post('/api/records', { title, artist: 'Artista Mappa', allow_duplicate: true, purchase: { amount_minor: amount, currency: 'EUR', date: '2025-05-01', location_id: loc } })
  }

  await page.goto('/map')
  await expect(page.getByRole('heading', { name: 'Mappa degli acquisti' })).toBeVisible()
  // other specs share this database, so look only at the places created here
  const markers = page.locator('.leaflet-marker-icon[title*="Mappa:"]')
  await expect(markers).toHaveCount(2, { timeout: 20_000 })
  await expect(markers.first()).toHaveAttribute('title', /Disco Club Mappa: 2 (dischi|vinili)|Rhythm Mappa: 1 (disco|vinile)/)

  // the list holds the same places and totals (it is the non-visual equivalent of the map)
  await expect(page.getByRole('button', { name: /Disco Club Mappa/ })).toContainText('2 vinili')
  await expect(page.getByRole('button', { name: /Disco Club Mappa/ })).toContainText('30,00')

  // a marker opens the place detail with its records; Enter works too
  await page.locator('.leaflet-marker-icon[title^="Disco Club Mappa"]').focus()
  await page.keyboard.press('Enter')
  const detail = page.getByRole('dialog')
  await expect(detail).toContainText('Disco Club Mappa')
  await expect(detail).toContainText('Mappa A')
  await expect(detail).toContainText('Mappa B')
  await page.keyboard.press('Escape')

  // online purchases are listed apart from the map
  await page.getByRole('tab', { name: 'Online' }).click()
  await expect(page.getByRole('button', { name: /Bandcamp Mappa/ })).toContainText('1 vinile')

  // the period filter changes the places
  await page.getByRole('tab', { name: 'Mappa' }).click()
  await page.getByRole('combobox', { name: 'Periodo' }).click()
  await expect(page.getByRole('listbox')).toBeVisible() // Escape is ignored while the menu is still opening
  await expect(page.getByRole('option', { name: 'Tutti' }).first()).toBeVisible() // the menu is open and has its entries
  await page.keyboard.press('Escape')
  // wait until the closing menu has released the page (its overlay would swallow the next click)
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(page.locator('[data-base-ui-inert]')).toHaveCount(0)

  // a place in use cannot be deleted: it offers to move its purchases first
  await page.getByRole('tab', { name: 'Luoghi' }).click()
  await page.getByRole('button', { name: 'Elimina Disco Club Mappa' }).click()
  const ask = page.getByRole('alertdialog')
  await expect(ask).toContainText('è usato da 2 dischi')
  await ask.getByRole('combobox', { name: 'Sposta gli acquisti su…' }).click()
  await page.getByRole('option', { name: 'Rhythm Mappa' }).click()
  await ask.getByRole('button', { name: 'Sposta ed elimina' }).click()
  await expect(page.getByText('Acquisti spostati e luogo eliminato')).toBeVisible()
  const places = await (await page.request.get('/api/purchases/places')).json()
  const ours = places.mapped.filter((p: { location: { name: string } }) => p.location.name.endsWith('Mappa'))
  expect(ours).toHaveLength(1)
  expect(ours[0].location.name).toBe('Rhythm Mappa')
  expect(ours[0].count).toBe(3)
})

test('the phone map does not take over scrolling until asked, and the filters fit', async ({ browser }) => {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 800 }, hasTouch: true, isMobile: true })).newPage()
  await signInAsAnna(page)
  await page.goto('/map')
  await expect(page.getByRole('switch', { name: 'Sposta la mappa' })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
  await page.goto('/')
  await page.getByRole('button', { name: 'Filtri' }).click()
  await expect(page.getByRole('dialog')).toContainText('Paese')
  await expect(page.getByRole('dialog').getByRole('button', { name: /^Mostra/ })).toBeVisible()
})
