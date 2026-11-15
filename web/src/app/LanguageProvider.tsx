import { Fragment, useEffect, type ReactNode } from 'react'
import { useAuth } from '@/features/auth'
import { detectLanguage, isLanguage, setLanguage, useLanguage } from '@/i18n'

// Before anything renders: the language chosen earlier in this browser, or the browser's own.
setLanguage(detectLanguage(), false)

/** Applies the member's saved language once known, and re-renders the whole app when it changes. */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const language = useLanguage()
  const saved = user?.language
  useEffect(() => {
    if (isLanguage(saved)) setLanguage(saved)
  }, [saved])
  // Texts are read while rendering, so a new key is the simplest way to refresh every screen.
  return <Fragment key={language}>{children}</Fragment>
}
