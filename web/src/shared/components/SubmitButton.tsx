import type { ReactNode } from 'react'
import { Button } from '@/shared/ui/button'
import { VinylSpinner } from './VinylSpinner'

/** The submit button of a form: while the request is running a record spins next to the label. */
export function SubmitButton({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <Button type="submit" size="lg" disabled={busy} aria-busy={busy}>
      {busy && <VinylSpinner />}
      {children}
    </Button>
  )
}
