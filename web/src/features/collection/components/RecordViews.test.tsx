import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RecordViews, pageNumbers } from './RecordViews'
import { fakeApi, fakeRecord, offsets } from '../test-fakes'

function Where() {
  return <output data-testid="url">{useLocation().search}</output>
}
const url = () => screen.getByTestId('url').textContent ?? ''

function renderAt(path: string, view: 'grid' | 'list') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <RecordViews forceView={view} />
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** IntersectionObserver that the test drives: `scrollToEnd()` says the sentinel became visible. */
let observed: IntersectionObserverCallback[] = []
beforeEach(() => {
  observed = []
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: IntersectionObserverCallback) {
        observed.push(cb)
      }
      observe() {}
      disconnect() {}
    },
  )
})
afterEach(() => vi.unstubAllGlobals())
const scrollToEnd = () =>
  act(() => {
    observed.at(-1)?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
  })
const cards = () => screen.getAllByRole('listitem')

describe('grid', () => {
  it('loads the next block on its own when the end comes into view', async () => {
    const calls = fakeApi(30)
    renderAt('/?view=grid', 'grid')
    await waitFor(() => expect(cards()).toHaveLength(10))
    scrollToEnd()
    await waitFor(() => expect(cards()).toHaveLength(20))
    expect(offsets(calls)).toEqual(['0', '10'])
  })

  it('says when there is nothing more and stops asking', async () => {
    const calls = fakeApi(12)
    renderAt('/?view=grid', 'grid')
    await waitFor(() => expect(cards()).toHaveLength(10))
    scrollToEnd()
    expect(await screen.findByText('Non ci sono altri dischi.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mostra altri' })).toBeNull()
    scrollToEnd()
    expect(offsets(calls)).toEqual(['0', '10'])
  })

  it('"Show more" from the keyboard loads the next block and moves focus to it', async () => {
    fakeApi(15)
    renderAt('/?view=grid', 'grid')
    await waitFor(() => expect(cards()).toHaveLength(10))
    fireEvent.click(screen.getByRole('button', { name: 'Mostra altri' }), { detail: 0 })
    await waitFor(() => expect(cards()).toHaveLength(15))
    await waitFor(() => expect(document.activeElement).toBe(within(cards()[10]).getByRole('button')))
  })

  it('uses the chosen block size', async () => {
    const calls = fakeApi(60)
    renderAt('/?view=grid&size=25', 'grid')
    await waitFor(() => expect(cards()).toHaveLength(25))
    expect(calls.find((c) => c.startsWith('/api/records?'))).toContain('limit=25')
  })

  it('a card shows title, artist and value, not the version', async () => {
    fakeApi(2, (i) =>
      fakeRecord(i, {
        label: 'Blue Note',
        country: 'Italia',
        year: 1959,
        value:
          i === 0
            ? {
                amount_minor: 3500,
                currency: 'EUR',
                source: 'manual',
                measure: null,
                fetched_at: '2026-01-01T00:00:00Z',
                num_for_sale: null,
              }
            : null,
      }),
    )
    renderAt('/?view=grid', 'grid')
    await waitFor(() => expect(cards()).toHaveLength(2))
    const [withValue, without] = cards()
    expect(withValue).toHaveTextContent('Album 0')
    expect(withValue).toHaveTextContent('Artist')
    expect(withValue).toHaveTextContent('35,00')
    for (const card of [withValue, without]) {
      expect(card).not.toHaveTextContent('Blue Note')
      expect(card).not.toHaveTextContent('Italia')
      expect(card).not.toHaveTextContent('1959')
      expect(card).not.toHaveTextContent('Versione da completare')
    }
    expect(without).not.toHaveTextContent('€')
  })
})

describe('table', () => {
  const rows = () => within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row')

  it('shows 10 rows with the range, and the next page on "Next"', async () => {
    fakeApi(37)
    renderAt('/?view=list', 'list')
    await waitFor(() => expect(rows()).toHaveLength(10))
    expect(screen.getByText('1–10 di 37')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Successiva' }))
    expect(await screen.findByText('11–20 di 37')).toBeInTheDocument()
    expect(url()).toContain('page=2')
    expect(rows()[0]).toHaveTextContent('Album 10')
  })

  it('on the last page "Next" and "Last" are off and the page is marked current', async () => {
    fakeApi(37)
    renderAt('/?view=list&page=4', 'list')
    expect(await screen.findByText('31–37 di 37')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Successiva' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Ultima pagina' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Pagina 4' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Prima pagina' })).toBeEnabled()
  })

  it('a page past the end becomes the last page', async () => {
    fakeApi(37)
    renderAt('/?view=list&page=9', 'list')
    await waitFor(() => expect(url()).toContain('page=4'))
    expect(await screen.findByText('31–37 di 37')).toBeInTheDocument()
  })

  it('needs no page controls when everything fits', async () => {
    fakeApi(7)
    renderAt('/?view=list', 'list')
    expect(await screen.findByText('1–7 di 7')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Pagine della collezione' })).toBeNull()
  })

  it('still shows the version of each record', async () => {
    fakeApi(1, (i) => fakeRecord(i, { label: 'Blue Note', country: 'Italia', year: 1959 }))
    renderAt('/?view=list', 'list')
    await waitFor(() => expect(rows()).toHaveLength(1))
    expect(rows()[0]).toHaveTextContent('Blue Note')
  })

  it('the title opens the record keeping the filters', async () => {
    fakeApi(3)
    renderAt('/?view=list&format=LP', 'list')
    await waitFor(() => expect(rows()).toHaveLength(3))
    fireEvent.click(screen.getByRole('button', { name: 'Album 1' }))
    expect(url()).toContain('format=LP')
  })
})

describe('pageNumbers', () => {
  it('keeps first, last and neighbours with gaps between', () => {
    expect(pageNumbers(1, 1)).toEqual([1])
    expect(pageNumbers(1, 3)).toEqual([1, 2, 3])
    expect(pageNumbers(5, 10)).toEqual([1, 'gap', 4, 5, 6, 'gap', 10])
    expect(pageNumbers(10, 10)).toEqual([1, 'gap', 9, 10])
  })
})
