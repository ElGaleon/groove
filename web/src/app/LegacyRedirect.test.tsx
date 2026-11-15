import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { legacyRedirects } from '@/shared/lib/routes'
import { LegacyRedirect } from './LegacyRedirect'

function Where() {
  const l = useLocation()
  return <output data-testid="at">{l.pathname + l.search}</output>
}

function renderAt(url: string) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        {legacyRedirects.map((r) => <Route key={r.from} path={r.from} element={<LegacyRedirect to={r.to} />} />)}
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('former Italian addresses', () => {
  it.each([
    ['/accedi', '/sign-in'],
    ['/registrati', '/register'],
    ['/dischi/nuovo', '/records/new'],
    ['/mappa', '/map'],
    ['/famiglia', '/family'],
    ['/impostazioni', '/settings'],
    ['/importa', '/import'],
  ])('%s lands on %s', (from, to) => {
    renderAt(from)
    expect(screen.getByTestId('at')).toHaveTextContent(to)
  })

  it('keeps the invitation token and the query', () => {
    renderAt('/invito/abc123?lang=en')
    expect(screen.getByTestId('at')).toHaveTextContent('/invite/abc123?lang=en')
  })

  it('keeps the record id and the filters', () => {
    renderAt('/dischi/7f3a?view=list&q=blue')
    expect(screen.getByTestId('at')).toHaveTextContent('/records/7f3a?view=list&q=blue')
  })
})
