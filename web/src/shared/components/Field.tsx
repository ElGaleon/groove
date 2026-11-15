import { useId, type InputHTMLAttributes } from 'react'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

export function Field({ label, error, ...props }: { label: string; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={props.id ?? id}>{label}</Label>
      <Input id={props.id ?? id} aria-invalid={error ? true : undefined} aria-describedby={error ? `${props.id ?? id}-error` : undefined} {...props} />
      {error && <p id={`${props.id ?? id}-error`} className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
