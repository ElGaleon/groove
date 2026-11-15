import { useId, useState, type InputHTMLAttributes } from 'react'
import { t } from '@/i18n'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

/** A password field with a control that shows or hides what was typed. */
export function PasswordField({ label, error, ...props }: { label: string; error?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const generated = useId()
  const id = props.id ?? generated
  const [shown, setShown] = useState(false)
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input id={id} type={shown ? 'text' : 'password'} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} autoCapitalize="off" autoCorrect="off" spellCheck={false} className="pr-20" {...props} />
        <button
          type="button"
          aria-pressed={shown}
          aria-controls={id}
          onClick={() => setShown((v) => !v)}
          className="absolute inset-y-0 right-0 flex items-center rounded-r-lg px-3 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {shown ? t.auth.hidePassword : t.auth.showPassword}
        </button>
      </div>
      {error && <p id={`${id}-error`} className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
