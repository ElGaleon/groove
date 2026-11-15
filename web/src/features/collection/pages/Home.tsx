import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '@/shared/lib/api'
import { RecordSchema } from '@/shared/schemas'
import { CollectionSummary } from '@/features/collection/components/CollectionSummary'
import { FilterBar } from '@/features/collection/components/FilterBar'
import { RecordViews } from '@/features/collection/components/RecordViews'
import { ShelfView } from '@/features/collection/components/ShelfView'
import { useFilters, useRecordPages } from '@/features/collection/filters'
import { t } from '@/i18n'

/** The collection, laid out like the Vinyl Editions prototype: summary, toolbar, then shelf, grid or list. */
export function Home() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const { view, filters } = useFilters()
  const total = useRecordPages(filters).data?.pages[0]?.total
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
            .then(() => queryClient.invalidateQueries({ queryKey: ['records'] }))
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
      {view === 'shelf' ? <ShelfView count={total} /> : (
        <>
          <div className="mb-4"><FilterBar count={total} /></div>
          <RecordViews forceView={view === 'grid' ? 'grid' : 'list'} />
        </>
      )}
    </>
  )
}
