import { expect, test, type Page } from '@playwright/test'

const PASSWORD = 'correct horse battery'
const H = { 'X-Requested-With': 'groove' }
const MOCK = 'http://localhost:8020'

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

test('Discogs: locked, cancel, connect, search, import with progress, disconnect', async ({ browser, request }) => {
  const page = await (await browser.newContext()).newPage()
  await signInAsAnna(page)
  await request.get(`${MOCK}/__mode?cancel=0&delay=1.5`)

  // --- locked without a connection: only manual entry, pointing to Settings ------------------
  await page.goto('/records/new')
  await expect(page.getByText('Collega Discogs per trovare la versione esatta')).toBeVisible()
  await expect(page.getByRole('dialog').getByLabel('Titolo', { exact: true })).toBeVisible() // the manual form opens straight away
  await page.getByRole('link', { name: 'Collega', exact: true }).click()
  await expect(page.getByText('Non collegato.')).toBeVisible()

  // --- authorisation cancelled on Discogs ---------------------------------------------------
  await request.get(`${MOCK}/__mode?cancel=1`)
  await page.getByRole('button', { name: 'Collega a Discogs' }).click()
  await expect(page.getByText(/autorizzazione è stata annullata/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Collega a Discogs' })).toBeVisible() // can retry

  // --- connect ------------------------------------------------------------------------------
  await request.get(`${MOCK}/__mode?cancel=0`)
  await page.getByRole('button', { name: 'Collega a Discogs' }).click()
  await expect(page.getByText('Account Discogs collegato.')).toBeVisible()
  await expect(page.getByRole('dialog').getByText('anna_d')).toBeVisible()

  // --- search-first: adding opens on a live Discogs search --------------------------------------
  await page.goto('/records/new')
  const search = page.getByRole('searchbox', { name: 'Cerca su Discogs' })
  await expect(search).toBeFocused()
  await search.pressSequentially('wall', { delay: 60 }) // the search starts by itself after a pause
  await expect(page.getByText('Pink Floyd').first()).toBeVisible()
  await page.getByRole('button', { name: /The Wall.*SHDW 411/ }).click() // the UK 1979 pressing
  await expect(page.getByRole('dialog').getByLabel('Titolo', { exact: true })).toHaveValue('The Wall')
  await expect(page.getByRole('dialog').getByLabel('N. catalogo', { exact: true })).toHaveValue('SHDW 411')
  await expect(page.getByRole('dialog').getByLabel('Paese', { exact: true })).toHaveValue('UK')
  await expect(page.getByRole('dialog').getByLabel('Valore', { exact: true })).toHaveValue('61,50') // market value from Discogs
  await expect(page.getByText(/Fonte: Discogs/)).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Proprietario' })).toContainText('Condiviso')
  await page.getByRole('button', { name: 'Salva', exact: true }).click()
  await expect(page.getByText('Disco aggiunto')).toBeVisible()
  const saved = (await (await page.request.get('/api/records?q=wall')).json()).items[0]
  expect(saved.has_cover).toBe(true)
  expect(saved.value).toMatchObject({ amount_minor: 6150, source: 'discogs', num_for_sale: 12 })
  expect(saved.discogs_release_id).toBe(2001)

  // the same search flags only the pressing we have; barcode and "show more" work; manual entry stays one click away
  await page.goto('/records/new')
  await page.getByRole('searchbox', { name: 'Cerca su Discogs' }).fill('wall')
  await expect(page.getByText('Già in collezione (condiviso)')).toHaveCount(1)
  await page.getByRole('button', { name: 'Mostra altri risultati' }).click()
  await expect(page.getByText('PC 36183')).toBeVisible()
  await page.getByRole('searchbox', { name: 'Cerca su Discogs' }).fill('5099902988320') // barcode
  await expect(page.getByRole('button', { name: /The Wall.*SHDW 411/ })).toBeVisible()
  await page.getByRole('searchbox', { name: 'Cerca su Discogs' }).fill('zzzz nothing')
  await expect(page.getByText(/Nessun risultato per/)).toBeVisible()
  await page.getByRole('button', { name: 'Inserisci a mano' }).first().click()
  await expect(page.getByRole('dialog').getByLabel('Titolo', { exact: true })).toBeVisible()
  await expect(page.getByText('Inserimento manuale')).toBeVisible()

  // --- import: progress advances, survives closing the page, completes ----------------------
  await page.goto('/import')
  await page.getByRole('button', { name: 'Avvia l’importazione' }).click()
  await expect(page.getByRole('status').filter({ hasText: /Importati \d+ di 230/ })).toBeVisible({ timeout: 15_000 })
  await page.goto('/') // "close" the page while the import runs
  await page.goto('/import') // and reopen it
  // Reopened: either still running (progress shown) or already finished; it completes either way.
  await expect(page.getByText('Fatto: aggiunti 230 dischi.')).toBeVisible({ timeout: 40_000 })

  const list = await page.request.get('/api/records?limit=1&q=importato')
  expect((await list.json()).total).toBe(230)

  // --- disconnect: records stay, features lock again ----------------------------------------
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Scollega' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Scollega' }).click()
  await expect(page.getByText('Non collegato.')).toBeVisible()
  const after = await page.request.get('/api/records?limit=1&q=importato')
  expect((await after.json()).total).toBe(230)
})
