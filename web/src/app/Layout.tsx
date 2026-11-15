import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { VinylSpinner } from '@/shared/components/VinylSpinner'
import { RecordDialogProvider } from '@/features/records'
import { SiteHeader } from './SiteHeader'
import { Toaster } from '@/shared/ui/sonner'
import { useIsMobile } from '@/shared/hooks/use-mobile'

/** Header, then the page in the same centred column as the original prototype. */
export function Layout() {
  const mobile = useIsMobile()
  return (
    <RecordDialogProvider>
      <div className="min-h-dvh bg-background text-foreground">
        <SiteHeader />
        <main className="mx-auto max-w-7xl px-3 py-4 sm:px-5">
          {/* Keeps the header on screen while a page loaded on demand arrives. */}
          <Suspense fallback={<div className="flex justify-center py-16"><VinylSpinner className="size-6" /></div>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <Toaster position={mobile ? 'top-center' : 'bottom-right'} />
    </RecordDialogProvider>
  )
}
