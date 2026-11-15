import { expect, test, type Page } from '@playwright/test'

const PASSWORD = 'correct horse battery'
const H = { 'X-Requested-With': 'groove' }

/** Signs Anna in through the API; creates the family first if this spec runs on an empty database. */
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
  await page.goto('/?view=list')
}

async function fillRecord(
  page: Page,
  f: { title?: string; artist?: string; year?: string; label?: string; genres?: string },
) {
  const dialog = page.getByRole('dialog') // the page behind has filters with the same names
  if (f.title !== undefined) await dialog.getByLabel('Titolo', { exact: true }).fill(f.title)
  if (f.artist !== undefined) await dialog.getByLabel('Artista', { exact: true }).fill(f.artist)
  if (f.year) await dialog.getByLabel('Anno', { exact: true }).fill(f.year)
  if (f.label) await dialog.getByLabel('Etichetta', { exact: true }).fill(f.label)
  if (f.genres) await dialog.getByLabel(/^Generi/).fill(f.genres)
}

test.setTimeout(90_000) // the dev server and the software-rendered 3D shelf are slow on a cold start

/** Opens the add dialog over the list view (the shelf's WebGL scene would only slow the test down). */
async function openAdd(page: Page) {
  await page.goto('/?view=list')
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).first().click()
}

/** How many records the collection holds (optionally matching a search), from the API. */
const total = async (page: Page, q = '') =>
  (await (await page.request.get(`/api/records?limit=1&q=${encodeURIComponent(q)}`)).json()).total as number

const save = (page: Page) => page.getByRole('button', { name: 'Salva', exact: true })

test('add records by hand with and without an owner, with duplicate warning', async ({ browser }) => {
  const page = await (await browser.newContext()).newPage()
  await signInAsAnna(page)

  // --- without an owner: it is shared ---------------------------------------------------
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).first().click()
  await fillRecord(page, {
    title: 'Kind of Blue',
    artist: 'Miles Davis',
    year: '1959',
    label: 'Columbia',
    genres: 'Jazz, Modal',
  })
  await expect(page.getByRole('combobox', { name: 'Proprietario' })).toContainText('Condiviso')
  await save(page).click()
  await expect(page.getByText('Disco aggiunto')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Kind of Blue' })).toBeVisible()
  await page.getByRole('button', { name: /Kind of Blue/ }).click() // the owner is shown in the detail
  await expect(page.getByRole('dialog').getByText('Condiviso', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')

  // --- with an owner --------------------------------------------------------------------
  await openAdd(page)
  await fillRecord(page, { title: 'Homogénic', artist: 'Björk', year: '1997' })
  await page.getByRole('combobox', { name: 'Proprietario' }).click()
  await page.getByRole('option', { name: 'Anna' }).click()
  await save(page).click()
  await expect(page.getByText('Disco aggiunto')).toBeVisible()
  await page.goto('/?view=list') // the add address lands on the home (the shelf on desktop)
  await expect(page.getByRole('button', { name: 'Homogénic' })).toBeVisible()
  await page.getByRole('button', { name: /Homogénic/ }).click()
  await expect(page.getByRole('dialog').getByText('Anna', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')

  // --- required fields are named next to the field --------------------------------------
  await openAdd(page)
  await fillRecord(page, { artist: 'Qualcuno' })
  await save(page).click()
  await expect(page.getByRole('alert')).toHaveText('Manca il titolo.')
  await page.getByRole('dialog').getByLabel('Titolo', { exact: true }).fill('Senza artista')
  await page.getByRole('dialog').getByLabel('Artista', { exact: true }).fill('')
  await save(page).click()
  await expect(page.getByRole('alert')).toHaveText('Manca l’artista.')

  // --- duplicate: cancel adds nothing, "another copy" adds one --------------------------
  await openAdd(page)
  await fillRecord(page, { title: 'kind of blue', artist: 'MILES DAVIS' })
  await save(page).click()
  await expect(page.getByText(/Questo disco sembra già presente:/)).toBeVisible()
  await page.getByRole('button', { name: 'Non aggiungere' }).click()
  expect(await total(page)).toBe(2)

  await openAdd(page)
  await fillRecord(page, { title: 'Kind of Blue', artist: 'Miles Davis' })
  await save(page).click()
  await page.getByRole('button', { name: 'Aggiungi un’altra copia' }).click()
  await expect(page.getByText('Disco aggiunto')).toBeVisible()
  expect(await total(page)).toBe(3)
})

test('a different pressing of the same album is not a duplicate', async ({ browser }) => {
  const page = await (await browser.newContext()).newPage()
  await signInAsAnna(page)
  for (const [catalog, country] of [
    ['PCS 7088', 'UK'],
    ['B0030', 'Europe'],
  ]) {
    await openAdd(page)
    await fillRecord(page, { title: 'Abbey Road', artist: 'The Beatles', year: '1969' })
    await page.getByRole('dialog').getByLabel('N. catalogo', { exact: true }).fill(catalog)
    await page.getByRole('dialog').getByLabel('Paese', { exact: true }).fill(country)
    await save(page).click()
    await expect(page.getByText('Disco aggiunto')).toBeVisible()
    await expect(page.getByText(/Questo disco sembra già presente:/)).toHaveCount(0)
  }
  expect(await total(page, 'Abbey Road')).toBe(2)
})

test('price, value and place of a purchase show up with the gain', async ({ browser }) => {
  const page = await (await browser.newContext()).newPage()
  await signInAsAnna(page)
  await openAdd(page)
  await fillRecord(page, { title: 'Blue', artist: 'Joni Mitchell', year: '1971' })
  await page.getByRole('dialog').getByLabel('Prezzo pagato').fill('20')
  await page.getByRole('dialog').getByLabel('Valore', { exact: true }).fill('35')
  await save(page).click()
  await expect(page.getByText('Disco aggiunto')).toBeVisible()
  await page.goto('/?view=list&q=Joni')
  await expect(page.getByRole('row').filter({ hasText: 'Blue' })).toContainText('+15,00 € (+75%)')
  await page.getByRole('button', { name: 'Blue' }).click()
  await expect(page.getByText('Pagato')).toBeVisible()
  await expect(page.getByText('manuale')).toBeVisible()
})

test('edit a record, change and clear its owner', async ({ browser }) => {
  const page = await (await browser.newContext()).newPage()
  await signInAsAnna(page)
  await page.getByRole('button', { name: /Homogénic/ }).click()
  await expect(page.locator('dd', { hasText: 'Anna' })).toBeVisible()

  await page.getByRole('button', { name: 'Modifica', exact: true }).click()
  await page.getByRole('dialog').getByLabel('Note').fill('Copia in ottime condizioni')
  await page.getByRole('combobox', { name: 'Proprietario' }).click() // back to shared
  await page.getByRole('option', { name: /Condiviso/ }).click()
  await save(page).click()
  await expect(page.getByText('Disco aggiornato')).toBeVisible()
  // the form closes the detail, as in the prototype: open it again to see the change
  await page.getByRole('button', { name: /Homogénic/ }).click()
  await expect(page.locator('dd', { hasText: 'Copia in ottime condizioni' })).toBeVisible()
  await expect(page.locator('dd', { hasText: 'Condiviso' })).toBeVisible()
})

test('upload a cover, then remove a record and undo within ten seconds', async ({ browser }) => {
  const page = await (await browser.newContext()).newPage()
  await signInAsAnna(page)
  await page.getByRole('button', { name: /Homogénic/ }).click()

  // A tiny valid PNG as the new cover.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
    'base64',
  )
  await page
    .getByRole('dialog')
    .getByLabel('Copertina (JPEG, PNG o WebP, max 5 MB)')
    .first()
    .setInputFiles({ name: 'c.png', mimeType: 'image/png', buffer: png })
  const img = page.getByRole('dialog').locator('img.cover').first()
  await expect(img).toBeVisible()
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0)

  // Remove with confirmation, then undo.
  await page.getByRole('button', { name: 'Elimina' }).click()
  await page.getByRole('button', { name: 'Rimuovi', exact: true }).click()
  await expect(page.getByText('“Homogénic” rimosso.').first()).toBeVisible()
  await page.locator('[data-sonner-toast]').getByRole('button', { name: 'Annulla' }).first().click()
  await page.goto('/?view=list')
  await expect(page.getByRole('button', { name: /Homogénic/ })).toBeVisible()
})
