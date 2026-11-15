import type { ReactNode } from 'react'
import { Alert } from '@/shared/ui/alert'

/** Messages to the member: errors are announced as alerts, confirmations as status. */
export function Notice({ kind = 'info', children }: { kind?: 'error' | 'ok' | 'info'; children: ReactNode }) {
  return (
    <Alert
      role={kind === 'error' ? 'alert' : 'status'}
      variant={kind === 'error' ? 'destructive' : 'default'}
      className={kind === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : undefined}
    >
      {children}
    </Alert>
  )
}
