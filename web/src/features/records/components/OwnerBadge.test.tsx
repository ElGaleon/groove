import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ownerColor } from '@/shared/lib/members'
import { OwnerBadge } from './OwnerBadge'

const ANNA = '11111111-1111-4111-8111-111111111111'
const BOB = '33333333-3333-4333-8333-333333333333'
const household = { id: '22222222-2222-4222-8222-222222222222', name: 'F', members: [
  { id: ANNA, display_name: 'Anna', email: 'a@x.it' },
  { id: BOB, display_name: 'Bob', email: 'b@x.it' },
] }

function renderBadge(ownerId: string | null) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(household))))
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><OwnerBadge ownerId={ownerId} /></QueryClientProvider>)
}

afterEach(() => vi.unstubAllGlobals())

describe('OwnerBadge', () => {
  it('says "shared" in words for a record of the whole family', async () => {
    renderBadge(null)
    const badge = await screen.findByText('Condiviso')
    expect(badge.closest('[data-owner]')?.getAttribute('data-owner')).toBe('shared')
  })

  it('names the member, with their colour, for a record that belongs to someone', async () => {
    const { container } = renderBadge(BOB)
    expect(await screen.findByText('Bob')).toBeTruthy()
    const dot = container.querySelector('[data-owner] span[aria-hidden]') as HTMLElement
    expect(dot.style.backgroundColor).toContain('--owner-2') // Bob is the second member
  })

  it('shows a record of a member who left as shared', async () => {
    renderBadge('99999999-9999-4999-8999-999999999999')
    expect(await screen.findByText('Condiviso')).toBeTruthy()
  })
})

describe('ownerColor', () => {
  it('is stable for a member and repeats only after the palette is used up', () => {
    expect(ownerColor(0)).toBe('var(--owner-1)')
    expect(ownerColor(1)).toBe('var(--owner-2)')
    expect(ownerColor(6)).toBe('var(--owner-1)')
  })
})
