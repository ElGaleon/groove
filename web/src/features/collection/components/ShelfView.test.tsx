import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RecordDialogProvider } from '@/features/records'
import { ShelfView } from './ShelfView'
import type { ShelfOptions } from '@/features/shelf'

// The 3D scene itself is checked in the browser tests; here a stub stands in for it.
const setRecords = vi.fn()
let sceneOptions: ShelfOptions
vi.mock('@/features/shelf', () => ({
  SHELF_SLOTS: 10,
  ShelfUnavailableError: class extends Error {},
  mountShelf: (_host: HTMLElement, options: ShelfOptions) => {
    sceneOptions = options
    return { setRecords, select: vi.fn(), flip: vi.fn(), dispose: vi.fn() }
  },
}))

const recId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const rec = (n: number) => ({
  id: recId(n),
  title: `Disco ${n}`,
  artist: 'A',
  year: 1990,
  label: null,
  genres: [],
  format: null,
  note: null,
  catalog_no: null,
  country: null,
  purchase: null,
  value: null,
  owner_id: null,
  has_cover: false,
  cover_version: null,
  has_back_cover: false,
  discogs_release_id: null,
  created_by: null,
  created_at: '2026-11-14T10:00:00Z',
  updated_at: '2026-11-14T10:00:00Z',
})

function renderShelf(opts: { items: unknown[]; discogs: unknown; url?: string }) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.startsWith('/api/records/random')) return new Response(JSON.stringify(opts.items))
      if (url === '/api/household')
        return new Response(JSON.stringify({ id: '22222222-2222-4222-8222-222222222222', name: 'F', members: [] }))
      if (url === '/api/discogs/status') return new Response(JSON.stringify(opts.discogs))
      if (url === '/api/records/options')
        return new Response(
          JSON.stringify({
            genres: [],
            decades: [],
            labels: [],
            countries: [],
            formats: [],
            years: [],
            owners: [],
            shared_count: 0,
            total: opts.items.length,
          }),
        )
      return new Response('{}', { status: 404 })
    }),
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[opts.url ?? '/']}>
        <RecordDialogProvider>
          <ShelfView />
        </RecordDialogProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const none = { configured: true, connected: false, status: null, username: null }
const linked = { configured: true, connected: true, status: 'active', username: 'anna' }

afterEach(() => {
  vi.unstubAllGlobals()
  setRecords.mockClear()
})

describe('ShelfView states', () => {
  it('empty collection: offers to add, no import without Discogs', async () => {
    renderShelf({ items: [], discogs: none })
    expect(await screen.findByText('La collezione è ancora vuota.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aggiungi un disco' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Importa da Discogs' })).toBeNull()
  })

  it('empty collection: offers the import when Discogs is connected', async () => {
    renderShelf({ items: [], discogs: linked })
    expect(await screen.findByRole('link', { name: 'Importa da Discogs' })).toBeInTheDocument()
  })

  it('filters with no match say so instead of showing the empty-collection invite', async () => {
    renderShelf({ items: [], discogs: none, url: '/?q=zzz' })
    expect(await screen.findByText('Nessun disco corrisponde ai filtri.')).toBeInTheDocument()
    expect(screen.queryByText('La collezione è ancora vuota.')).toBeNull()
  })

  it('fewer than 10 records: shows them all and says there are few', async () => {
    renderShelf({ items: [rec(1), rec(2), rec(3)], discogs: none })
    expect(await screen.findByText('Con questi filtri ci sono solo 3 dischi.')).toBeInTheDocument()
    expect(
      await vi.waitFor(() => {
        expect(setRecords).toHaveBeenCalled()
        return setRecords.mock.calls[0][0]
      }),
    ).toHaveLength(3)
  })

  it('draws 10 others from the view controls, excluding the current records', async () => {
    renderShelf({ items: Array.from({ length: 10 }, (_, i) => rec(i)), discogs: none })
    const more = await screen.findByRole('button', { name: 'Mostra altri 10' })
    expect(
      more.compareDocumentPosition(screen.getByRole('group', { name: 'Scaffale' })) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(within(more.parentElement!).getByRole('group', { name: 'Vista' })).toBeInTheDocument()
    fireEvent.click(more)
    await vi.waitFor(() => {
      const urls = vi.mocked(fetch).mock.calls.map(([url]) => String(url))
      const redraw = urls.find((url) => url.includes('exclude='))
      expect(redraw).toBeDefined()
      const params = new URL(redraw!, 'http://localhost').searchParams
      expect(params.get('count')).toBe('10')
      expect(params.get('exclude')?.split(',')).toEqual(Array.from({ length: 10 }, (_, i) => recId(i)))
    })
  })

  it('previews the hovered record and clears the card on leave or selection', async () => {
    const first = {
      ...rec(1),
      artist: 'Artista uno',
      label: 'Blue Note',
      country: 'IT',
      format: 'Vinyl, LP',
      catalog_no: 'BN-123',
      value: {
        amount_minor: 2500,
        currency: 'EUR',
        source: 'discogs',
        measure: null,
        fetched_at: '2026-11-14T10:00:00Z',
        num_for_sale: null,
      },
    }
    renderShelf({ items: [first, rec(2)], discogs: none })
    await screen.findByText('Con questi filtri ci sono solo 2 dischi.')
    act(() => sceneOptions.onHover?.({ id: recId(1), x: 100, y: 100 }))
    const card = screen.getByRole('tooltip')
    expect(card).toHaveTextContent('Disco 1')
    expect(card).toHaveTextContent('Artista uno')
    expect(card).toHaveTextContent('LP')
    expect(card).toHaveTextContent('1990')
    expect(card).not.toHaveTextContent('Blue Note')
    expect(card).not.toHaveTextContent('BN-123')
    expect(card).not.toHaveTextContent('25,00')
    act(() => sceneOptions.onHover?.({ id: recId(2), x: 200, y: 100 }))
    expect(screen.getByRole('tooltip')).toHaveTextContent('Disco 2')
    expect(screen.getByRole('tooltip')).not.toHaveTextContent('Blue Note')
    act(() => sceneOptions.onHover?.(null))
    expect(screen.queryByRole('tooltip')).toBeNull()
    act(() => sceneOptions.onHover?.({ id: recId(1), x: 100, y: 100 }))
    act(() => sceneOptions.onSelect?.(recId(1)))
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('shows the preview on keyboard focus and dismisses it with Escape or blur', async () => {
    renderShelf({ items: [rec(1)], discogs: none })
    const record = await screen.findByRole('button', { name: /Disco 1/ })
    fireEvent.focus(record)
    expect(screen.getByRole('tooltip')).toHaveTextContent('Disco 1')
    expect(record).toHaveAttribute('aria-describedby', 'shelf-record-preview')
    fireEvent.keyDown(record, { key: 'Escape' })
    expect(screen.queryByRole('tooltip')).toBeNull()
    fireEvent.focus(record)
    fireEvent.blur(record)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
})
