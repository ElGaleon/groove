import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function mockApi(routes: Record<string, { status: number; body: unknown }>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const r = routes[url] ?? { status: 404, body: { detail: 'not found' } }
      return new Response(JSON.stringify(r.body), { status: r.status })
    }),
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('App', () => {
  it('sends a signed-out visitor to the sign-in screen', async () => {
    mockApi({
      '/api/auth/me': { status: 401, body: { detail: 'Non autenticato' } },
      '/api/auth/status': { status: 200, body: { needs_setup: false, min_password_length: 10 } },
    })
    renderAt('/')
    expect(await screen.findByRole('heading', { name: 'Accedi' })).toBeInTheDocument()
  })

  it('offers first-time setup when no family exists yet', async () => {
    mockApi({
      '/api/auth/me': { status: 401, body: { detail: 'Non autenticato' } },
      '/api/auth/status': { status: 200, body: { needs_setup: true, min_password_length: 10 } },
    })
    renderAt('/')
    expect(await screen.findByRole('heading', { name: 'Crea la famiglia' })).toBeInTheDocument()
  })

  it('shows the collection to a signed-in member', async () => {
    mockApi({
      '/api/auth/me': {
        status: 200,
        body: {
          id: '11111111-1111-4111-8111-111111111111',
          email: 'a@x.it',
          display_name: 'Anna',
          household: { id: '22222222-2222-4222-8222-222222222222', name: 'Famiglia Rossi' },
        },
      },
      '/api/auth/status': { status: 200, body: { needs_setup: false, min_password_length: 10 } },
      '/api/records?sort=artist&order=asc&offset=0&limit=10': {
        status: 200,
        body: { items: [], total: 0, offset: 0, limit: 10 },
      },
      '/api/records/options': {
        status: 200,
        body: {
          genres: [],
          decades: [],
          labels: [],
          countries: [],
          formats: [],
          years: [],
          owners: [],
          shared_count: 0,
          total: 0,
        },
      },
      '/api/household': { status: 200, body: { id: '22222222-2222-4222-8222-222222222222', name: 'F', members: [] } },
    })
    renderAt('/?view=list')
    expect(await screen.findByRole('heading', { name: 'La collezione' })).toBeInTheDocument()
    expect(await screen.findByText('Nessun disco ancora. Aggiungi il primo.')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Aggiungi' }).length).toBeGreaterThan(0)
  })

  it('explains an expired invite instead of showing the form', async () => {
    mockApi({
      '/api/auth/me': { status: 401, body: { detail: 'Non autenticato' } },
      '/api/auth/status': { status: 200, body: { needs_setup: false, min_password_length: 10 } },
      '/api/invites/check?token=abc': { status: 200, body: { status: 'expired', household_name: null } },
    })
    renderAt('/invito/abc')
    expect(await screen.findByText(/scaduto/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
  })
})
