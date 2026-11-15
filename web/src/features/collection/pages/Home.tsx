import { useQueryClient } from '@tanstack/react-query'
import { lazy, Suspense, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '@/shared/lib/api'
import { RecordSchema } from '@/shared/schemas'
import { CollectionSummary } from '@/features/collection/components/CollectionSummary'
import { FilterBar } from '@/features/collection/components/FilterBar'
import { RecordViews } from '@/features/collection/components/RecordViews'
import { useFilters, useSummary } from '@/features/collection/filters'
import { t } from '@/i18n'
import { invalidateCollection } from '@/shared/lib/queries'
import { VinylSpinner } from '@/shared/components/VinylSpinner'

// The shelf pulls in three.js and GSAP (most of the bundle): load them only when it is shown.
const ShelfView = lazy(() =>
  import('@/features/collection/components/ShelfView').then((m) => ({ default: m.ShelfView })),
)

/** The collection, laid out like the original prototype: summary, toolbar, then shelf, grid or list. */
export function Home() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const { view, filters } = useFilters()
  // The count comes with the summary (already loaded above), so the shelf fetches no page of records.
  const total = useSummary(filters).data?.total
  const removed = (location.state as { removed?: { id: string; title: string } } | null)?.removed
  const { pathname, search } = location

  // A record removed from its detail comes back here: offer to undo it for ten seconds.
  useEffect(() => {
    if (!removed) return
    toast(t.home.removed(removed.title), {
      duration: 10_000,
      action: {
        label: t.home.undo,
        onClick: () => {
          api(`/api/records/${removed.id}/restore`, { method: 'POST', schema: RecordSchema })
            .then(() => invalidateCollection(queryClient))
            .catch(() => toast.error(t.home.undoFailed))
        },
      },
    })
    navigate({ pathname, search }, { replace: true, state: null })
  }, [removed, navigate, pathname, search, queryClient])

  return (
    <>
      <h1 className="sr-only">{t.home.title}</h1>
      <CollectionSummary />
      {view === 'shelf' ? (
        <Suspense
          fallback={
            <div className="flex justify-center py-16">
              <VinylSpinner />
            </div>
          }
        >
          <ShelfView count={total} />
        </Suspense>
      ) : (
        <>
          <div className="mb-4">
            <FilterBar count={total} />
          </div>
          <RecordViews forceView={view === 'grid' ? 'grid' : 'list'} />
        </>
      )}
    </>
  )
}
