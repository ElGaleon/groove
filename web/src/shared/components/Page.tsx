import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

export const Page = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('mx-auto grid w-full max-w-5xl gap-6 py-2', className)}>{children}</div>
)

export const Section = ({ title, children }: { title?: string; children: ReactNode }) => (
  <section className="grid gap-3 rounded-xl border bg-card p-4 text-card-foreground shadow-xs">
    {title && <h2 className="text-lg font-semibold tracking-tight">{title}</h2>}
    {children}
  </section>
)
