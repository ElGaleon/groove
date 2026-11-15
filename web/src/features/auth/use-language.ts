import { useCallback, useContext } from 'react'
import { getLanguage, setLanguage, useLanguage, type Language } from '@/i18n'
import { api } from '@/shared/lib/api'
import { UserSchema } from '@/shared/schemas'
import { AuthContext } from './auth-context'

/** The active language and a way to change it: applied at once, remembered in this browser and, for a
 * signed-in member, saved on the server so it follows them to other devices. */
export function useLanguageSetting(): [Language, (next: Language) => Promise<void>] {
  const language = useLanguage()
  const auth = useContext(AuthContext)
  const signedIn = !!auth?.user
  const refresh = auth?.refresh
  const change = useCallback(
    async (next: Language) => {
      setLanguage(next)
      if (signedIn) {
        await api('/api/auth/preferences', { method: 'PATCH', body: { language: next }, schema: UserSchema })
        await refresh?.()
      }
    },
    [signedIn, refresh],
  )
  return [language ?? getLanguage(), change]
}
