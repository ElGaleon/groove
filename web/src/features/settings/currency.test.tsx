import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { AuthContext, type AuthValue } from '@/features/auth'
import { useCurrency } from './currency'

const wrap =
  (currency: string | null) =>
  ({ children }: { children: ReactNode }) => (
    <AuthContext.Provider
      value={
        {
          user: {
            id: '1',
            email: 'a@x.it',
            display_name: 'A',
            default_currency: currency,
            household: { id: 'h', name: 'F' },
          },
          loading: false,
          needsSetup: false,
          refresh: async () => undefined,
        } as unknown as AuthValue
      }
    >
      {children}
    </AuthContext.Provider>
  )

describe('useCurrency', () => {
  it('is the member preference, or euro until they choose', () => {
    expect(renderHook(() => useCurrency()[0], { wrapper: wrap('GBP') }).result.current).toBe('GBP')
    expect(renderHook(() => useCurrency()[0], { wrapper: wrap(null) }).result.current).toBe('EUR')
    expect(renderHook(() => useCurrency()[0]).result.current).toBe('EUR')
  })
})
