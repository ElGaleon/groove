import { useState, useSyncExternalStore, type FocusEvent, type ReactNode } from 'react'
import { t } from '@/i18n'
import { BrandMark } from '@/shared/components/BrandMark'
import { LanguageSwitch } from '@/shared/components/LanguageSelect'
import { cn } from '@/shared/lib/utils'
import { useLanguageSetting } from '../use-language'
import { VinylArt } from './VinylArt'

const DARK = '(prefers-color-scheme: dark)'

/** These screens follow the system theme; the rest of the app has a single (light) theme. */
function usePrefersDark() {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia(DARK)
      query.addEventListener('change', notify)
      return () => query.removeEventListener('change', notify)
    },
    () => window.matchMedia(DARK).matches,
    () => false,
  )
}

function Wordmark({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2 text-sm font-semibold tracking-tight', className)}>
      <BrandMark />
      {t.appName}
    </div>
  )
}

/**
 * The frame of the sign-in, registration, invitation and reset screens.
 * Phone: a dark band with a half-hidden record above the form; the band shrinks while a field
 * has focus, so the form stays in view when the keyboard is open.
 * Wide screens: the form on one side, a dark panel with a big record on the other.
 * The form is always in the vertical middle of the screen: the footer is as tall as the band.
 */
export function AuthLayout({ title, subtitle, children }: { title?: string; subtitle?: string; children: ReactNode }) {
  const [language, setLanguage] = useLanguageSetting()
  const dark = usePrefersDark()
  const [typing, setTyping] = useState(false)
  const band = typing ? 'h-14 sm:h-14' : 'h-36 sm:h-44'

  const onFocus = (event: FocusEvent<HTMLElement>) => {
    if (event.target instanceof HTMLInputElement) setTyping(true)
  }
  const onBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setTyping(false)
  }

  return (
    <div className={cn('grid min-h-dvh bg-background text-foreground lg:grid-cols-2', dark && 'dark')}>
      <div className="flex min-h-dvh flex-col lg:min-h-0">
        <header
          className={cn(
            'relative shrink-0 overflow-hidden bg-neutral-950 text-white transition-[height] duration-200 lg:hidden',
            band,
          )}
        >
          <VinylArt
            className={cn(
              'absolute -right-16 -bottom-20 w-56 transition-opacity sm:-right-10 sm:w-72',
              typing && 'opacity-0',
            )}
          />
          <div
            className={cn(
              'relative flex h-full flex-col p-6 pt-[max(1.5rem,env(safe-area-inset-top))]',
              typing ? 'justify-center' : 'justify-between',
            )}
          >
            <Wordmark />
            {!typing && (
              <p className="max-w-[16ch] text-lg leading-tight font-semibold tracking-tight text-balance">
                {t.auth.tagline}
              </p>
            )}
          </div>
        </header>

        <Wordmark className="hidden h-20 items-center px-8 lg:flex" />

        <main
          onFocus={onFocus}
          onBlur={onBlur}
          className="flex flex-1 flex-col justify-center px-6 py-8 sm:items-center"
        >
          <div className="w-full max-w-sm">
            {title && (
              <div className="mb-6 grid gap-1.5 text-center sm:text-left">
                <h1 className="text-3xl font-semibold tracking-tight text-balance">{title}</h1>
                {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
              </div>
            )}
            <div className="grid gap-5 [&_input]:h-11 [&_input]:md:h-10">{children}</div>
          </div>
        </main>

        {/* As tall as the band above it, so the form sits in the exact middle of the screen */}
        <footer
          className={cn(
            'flex shrink-0 items-center justify-center px-6 transition-[height] duration-200 lg:h-20',
            band,
          )}
        >
          <LanguageSwitch value={language} onChange={(l) => void setLanguage(l)} />
        </footer>
      </div>

      <aside className="relative hidden overflow-hidden bg-neutral-950 text-white lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_70%_35%,rgb(232_163_61/.16),transparent)]" />
        <VinylArt className="absolute top-[12%] -right-[18%] w-[88%] max-w-[44rem]" />
        <div className="absolute inset-x-0 bottom-0 grid gap-3 bg-gradient-to-t from-neutral-950 via-neutral-950/80 to-transparent p-12 pt-40">
          <p className="max-w-[18ch] text-4xl leading-[1.05] font-semibold tracking-tight text-balance">
            {t.auth.tagline}
          </p>
          <p className="max-w-sm text-neutral-400">{t.auth.text}</p>
        </div>
      </aside>
    </div>
  )
}
