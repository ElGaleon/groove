import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BackupSection } from './BackupSection'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
const fetchMock = vi.fn()

function renderIt() {
  vi.stubGlobal('fetch', fetchMock)
  render(
    <QueryClientProvider client={new QueryClient()}>
      <BackupSection />
    </QueryClientProvider>,
  )
}

const pick = (name: string, content: string) =>
  fireEvent.change(screen.getByLabelText('File di backup (.json)'), {
    target: { files: [new File([content], name, { type: 'application/json' })] },
  })

afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
  vi.mocked(toast.success).mockClear()
  vi.mocked(toast.error).mockClear()
})

describe('BackupSection', () => {
  it('imports a file and says what was added and skipped', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ records_added: 3, records_skipped: 1, locations_added: 2, locations_reused: 0 })),
    )
    renderIt()
    pick('b.json', JSON.stringify({ version: 1, vinyls: [], locations: [] }))
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringMatching(/Importati 3 dischi \(1 già presenti, saltati\) e 2 nuovi luoghi/),
      ),
    )
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/backup/import?shared=false')
    expect(init.method).toBe('POST')
  })

  it('can import as shared', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ records_added: 0, records_skipped: 0, locations_added: 0, locations_reused: 0 })),
    )
    renderIt()
    fireEvent.click(screen.getByRole('radio', { name: /condivisi/ }))
    pick('b.json', JSON.stringify({ version: 1, vinyls: [], locations: [] }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(fetchMock.mock.calls[0][0]).toBe('/api/backup/import?shared=true')
  })

  it('refuses a file that is not JSON without calling the server', async () => {
    renderIt()
    pick('b.json', 'not json at all')
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/non è un backup valido/)))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refuses JSON that is not a backup, naming nothing and sending nothing', async () => {
    renderIt()
    pick('b.json', '{"vinyls": 1}')
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/non è un backup valido/)))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows the server message when the file is invalid, and nothing changed', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          detail: 'File di backup non valido: la collezione non è stata modificata.',
          code: 'invalid_backup',
        }),
        { status: 422 },
      ),
    )
    renderIt()
    pick('b.json', JSON.stringify({ version: 1, vinyls: [{ id: '1', title: 'x', artist: 'y' }], locations: [] }))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('la collezione non è stata modificata')),
    )
  })
})
