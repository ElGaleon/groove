import { cn } from '@/shared/lib/utils'

/** The mark of the app: a small record with an amber label. It takes the colour of the text around it. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block size-4 shrink-0 rounded-full bg-[radial-gradient(circle,#e8a33d_0_30%,currentColor_32%)]',
        className,
      )}
      aria-hidden="true"
    />
  )
}
