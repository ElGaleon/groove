import { PencilLineIcon, RotateCwIcon } from 'lucide-react'
import { MIN_CHARS, useDiscogsSearch } from '@/features/discogs/hooks/use-discogs-search'
import type { SearchResult } from '@/features/discogs/discogs'
import { t } from '@/i18n'
import { SearchField } from '@/shared/components/SearchField'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'

const details = (r: SearchResult) => [r.label, r.catalog_no, r.country, r.year, r.format].filter(Boolean).join(' · ')

/** The first step of adding a record for a member who connected Discogs: live search, pick the pressing. */
export function DiscogsSearchStep({ onPick, onManual }: { onPick: (r: SearchResult) => void; onManual: () => void }) {
  const s = useDiscogsSearch()
  return (
    <div className="grid gap-3 pb-2">
      <SearchField autoFocus aria-label={t.add.searchTitle} value={s.q}
        onChange={(e) => s.setQ(e.target.value)} placeholder={t.add.placeholder} />

      <div aria-live="polite" className="grid gap-3">
        {s.status === 'idle' && <p className="text-sm text-muted-foreground">{t.add.hint.replace('3', String(MIN_CHARS))}</p>}

        {s.status === 'loading' && (
          <ul className="grid gap-2" aria-label={t.views.search}>
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex gap-3">
                <Skeleton className="size-16 shrink-0 rounded-lg" />
                <div className="grid flex-1 content-center gap-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/2" /></div>
              </li>
            ))}
          </ul>
        )}

        {s.status === 'error' && (
          <div role="alert" className="grid gap-2 rounded-lg border border-destructive/40 p-3 text-sm">
            <p className="text-destructive">{s.error}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="h-11 md:h-9" onClick={s.retry}><RotateCwIcon /> {t.add.retry}</Button>
              <Button variant="outline" className="h-11 md:h-9" onClick={onManual}><PencilLineIcon /> {t.add.manual}</Button>
            </div>
          </div>
        )}

        {s.status === 'done' && s.results.length === 0 && (
          <div className="grid gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            <p>{t.add.none(s.q.trim())}</p>
            <Button variant="outline" className="h-11 w-fit md:h-9" onClick={onManual}><PencilLineIcon /> {t.add.manual}</Button>
          </div>
        )}

        {s.status === 'done' && s.results.length > 0 && (
          <>
            <ul className="divide-y rounded-lg border">
              {s.results.map((r) => (
                <li key={r.release_id}>
                  <button type="button" onClick={() => onPick(r)}
                    className="flex min-h-20 w-full items-center gap-3 p-2 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring active:bg-accent">
                    {r.cover_url
                      ? <img src={r.cover_url} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-16 shrink-0 rounded-lg bg-muted object-cover" />
                      : <div className="size-16 shrink-0 rounded-lg bg-muted" />}
                    <span className="min-w-0 flex-1">
                      <span className="block text-base leading-tight font-medium">{r.title || '—'}</span>
                      <span className="block truncate text-sm text-muted-foreground">{r.artist}</span>
                      <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">{details(r)}</span>
                      {r.in_collection && <Badge variant="secondary" className="mt-1">{t.search.already(r.in_collection.owner_name)}</Badge>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {s.hasMore && (
              <Button variant="outline" className="h-11 md:h-9" disabled={s.loadingMore} onClick={() => void s.loadMore()}>
                {s.loadingMore ? t.add.loadingMore : t.add.more}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
