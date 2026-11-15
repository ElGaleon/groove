import { useSyncExternalStore } from 'react'
import type { Catalog } from './catalog'
import { en } from './locales/en'
import { it } from './locales/it'

export const LANGUAGES = ['it', 'en'] as const
export type Language = (typeof LANGUAGES)[number]
export const DEFAULT_LANGUAGE: Language = 'it'
const STORAGE_KEY = 'groove.language'

const catalogs: Record<Language, unknown> = { it, en } // a new language must be listed here
export const LOCALES: Record<Language, string> = { it: 'it-IT', en: 'en-GB' }

type Plain = Record<string, unknown>
const isPlain = (v: unknown): v is Plain => typeof v === 'object' && v !== null && !Array.isArray(v)

/** `base` with the values of `over` on top; anything missing in `over` stays as in `base`. */
export function merge(base: unknown, over: unknown): unknown {
  if (!isPlain(base) || !isPlain(over)) return over === undefined || over === '' ? base : over
  const out: Plain = { ...base }
  for (const key of Object.keys(over)) out[key] = key in base ? merge(base[key], over[key]) : over[key]
  return out
}

const build = (lang: Language) => merge(it, lang === 'it' ? undefined : catalogs[lang]) as Catalog

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value)
}

/** The member's language, else the one chosen before signing in, else the browser's, else Italian. */
export function detectLanguage(preferred?: string | null): Language {
  if (isLanguage(preferred)) return preferred
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (isLanguage(stored)) return stored
  } catch {
    /* storage blocked: go on */
  }
  const browser = (typeof navigator !== 'undefined' ? navigator.language : '').slice(0, 2).toLowerCase()
  return isLanguage(browser) ? browser : DEFAULT_LANGUAGE
}

let language: Language = DEFAULT_LANGUAGE
let current: Catalog = build(language)
const listeners = new Set<() => void>()

export const getLanguage = () => language

/** Switch language; `remember` keeps the choice in this browser (the server copy is the caller's job). */
export function setLanguage(next: Language, remember = true): void {
  if (next === language) return
  language = next
  current = build(next)
  if (typeof document !== 'undefined') document.documentElement.lang = next
  if (remember) {
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* storage blocked: the language still applies for this visit */
    }
  }
  listeners.forEach((l) => l())
}

/** The texts of the active language. Read it while rendering; the app re-renders on a switch. */
export const t: Catalog = new Proxy({} as Catalog, { get: (_, key) => (current as unknown as Plain)[key as string] })

/** Re-renders the component when the language changes, and returns it. */
export function useLanguage(): Language {
  return useSyncExternalStore((cb) => (listeners.add(cb), () => listeners.delete(cb)), getLanguage)
}

/** Everything the catalogs of a language define, for tests: the catalog as stored (no fallback). */
export const rawCatalog = (lang: Language): unknown => catalogs[lang]
