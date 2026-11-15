import type { ComponentProps } from 'react'
import { SearchIcon } from 'lucide-react'
import { Input } from '@/shared/ui/input'
import { cn } from '@/shared/lib/utils'

/** The app's one search box (collection filter, Discogs search), so both look and behave the same. */
export function SearchField({ className, inputClassName, ...props }: Omit<ComponentProps<typeof Input>, 'type'> & { inputClassName?: string }) {
  return (
    <div className={cn('relative', className)}>
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input type="search" inputMode="search" enterKeyHint="search" {...props}
        className={cn('h-11 rounded-xl border-border bg-muted/20 pl-9 text-base shadow-none duration-200 hover:border-border hover:bg-muted/40 focus-visible:border-ring/60 focus-visible:ring-2 focus-visible:ring-ring/20 md:h-9 md:text-sm', inputClassName)} />
    </div>
  )
}
