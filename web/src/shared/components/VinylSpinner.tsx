import { cn } from '@/shared/lib/utils'

/** A tiny spinning record: the loading state of the app. It stands still for people who ask for less motion. */
export function VinylSpinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('size-4 animate-spin motion-reduce:animate-none [animation-duration:1.4s]', className)} aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="currentColor" />
      <circle cx="12" cy="12" r="8" fill="none" stroke="var(--background)" strokeOpacity=".35" strokeWidth=".7" strokeDasharray="14 5" />
      <circle cx="12" cy="12" r="4.2" fill="#e8a33d" />
      <circle cx="12" cy="12" r="1" fill="var(--background)" />
    </svg>
  )
}
