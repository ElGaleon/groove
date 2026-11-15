import { LANGUAGES, t, type Language } from '@/i18n'
import { Button } from '@/shared/ui/button'

const NAMES: Record<Language, string> = { it: 'Italiano', en: 'English' }

/** A compact language switch for screens without a menu (sign-in, registration, invitation). */
export function LanguageSwitch({ value, onChange }: { value: Language; onChange: (l: Language) => void }) {
  return (
    <div className="flex justify-center gap-1" role="group" aria-label={t.nav.language}>
      {LANGUAGES.map((l) => (
        <Button
          key={l}
          type="button"
          size="sm"
          variant={l === value ? 'secondary' : 'ghost'}
          aria-pressed={l === value}
          onClick={() => onChange(l)}
        >
          {NAMES[l]}
        </Button>
      ))}
    </div>
  )
}

export const languageName = (l: Language) => NAMES[l]
