import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SettingsDialog } from './Settings'

function renderSettings(status: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(status), { status: 200 })),
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SettingsDialog onClose={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('Settings, Discogs section', () => {
  it('shows the expired state and offers to reconnect', async () => {
    renderSettings({ configured: true, connected: true, status: 'expired', username: 'anna_d' })
    expect(await screen.findByText(/collegamento è scaduto/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ricollega Discogs' })).toBeInTheDocument()
  })

  it('shows the connected username with import and disconnect', async () => {
    renderSettings({ configured: true, connected: true, status: 'active', username: 'anna_d' })
    expect(await screen.findByText('anna_d')).toBeInTheDocument()
    expect(screen.getByText('Collegato')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Importa la mia collezione' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Scollega' })).toBeInTheDocument()
  })

  it('offers connecting when not connected, and says so when the server has no Discogs keys', async () => {
    renderSettings({ configured: true, connected: false, status: null, username: null })
    expect(await screen.findByRole('button', { name: 'Collega a Discogs' })).toBeInTheDocument()
  })

  it('explains an unconfigured server', async () => {
    renderSettings({ configured: false, connected: false, status: null, username: null })
    expect(await screen.findByText(/non è configurato/)).toBeInTheDocument()
  })
})
