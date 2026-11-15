import { useCallback, useContext } from 'react'
import { api } from '@/shared/lib/api'
import { UserSchema } from '@/shared/schemas'
import { AuthContext } from '@/features/auth'

const DEFAULT_CURRENCY = 'EUR'
export const CURRENCIES = ['EUR', 'USD', 'GBP', 'JPY', 'CHF'] as const

/** The member's default currency for new prices: stored on the server, so it follows them across
 * devices. Until they choose one it is euro. */
export function useCurrency(): [string, (c: string) => Promise<void>] {
  // Read the context directly: screens rendered without a signed-in member (tests) get the default.
  const auth = useContext(AuthContext)
  const user = auth?.user
  const refresh = auth?.refresh
  const set = useCallback(
    async (c: string) => {
      await api('/api/auth/preferences', { method: 'PATCH', body: { default_currency: c }, schema: UserSchema })
      await refresh?.()
    },
    [refresh],
  )
  return [user?.default_currency ?? DEFAULT_CURRENCY, set]
}
