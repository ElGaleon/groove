import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RecordSummary } from '@/features/collection/filters'
import { CollectionSummary } from './CollectionSummary'

function renderSummary(summary: RecordSummary) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(summary))))
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter><CollectionSummary /></MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('CollectionSummary', () => {
  it('counts every record in the statistics, including records without price data', async () => {
    renderSummary({ total: 12, totals: [{ currency: 'EUR', spent: 10000, value: 15000, diff: 5000, included: 10, excluded: 1 }], without_data: 1 })
    const stats = await screen.findByRole('region', { name: 'Statistiche della collezione' })
    expect(within(stats).getByText('Vinili').parentElement).toHaveTextContent('12')
    expect(stats).toHaveTextContent('100,00')
    expect(stats).toHaveTextContent('150,00')
    expect(stats).toHaveTextContent('+50,00')
    expect(screen.queryByText(/esclusi per dati mancanti/)).toBeNull()
    expect(screen.queryByText('12 vinili')).toBeNull()
  })

  it('keeps the count visible when no records have comparable amounts', async () => {
    renderSummary({ total: 5, totals: [], without_data: 5 })
    const stats = await screen.findByRole('region', { name: 'Statistiche della collezione' })
    expect(within(stats).getByText('Vinili').parentElement).toHaveTextContent('5')
    expect(within(stats).getAllByText('—')).toHaveLength(3)
  })

  it('keeps currencies separate and shows the record count once', async () => {
    renderSummary({ total: 20, without_data: 0, totals: [
      { currency: 'EUR', spent: 10000, value: 15000, diff: 5000, included: 10, excluded: 0 },
      { currency: 'USD', spent: 20000, value: 30000, diff: 10000, included: 10, excluded: 0 },
    ] })
    const stats = await screen.findByRole('region', { name: 'Statistiche della collezione' })
    expect(within(stats).getAllByText('Vinili')).toHaveLength(1)
    expect(within(stats).getByText('Vinili').parentElement).toHaveTextContent('20')
    const spent = within(stats).getByText('Speso').parentElement!
    expect(spent).toHaveTextContent('100,00')
    expect(spent).toHaveTextContent('200,00')
    expect(spent).toHaveTextContent('€')
    expect(spent).toHaveTextContent('USD')
  })
})
