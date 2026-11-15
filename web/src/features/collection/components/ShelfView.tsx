import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShuffleIcon } from 'lucide-react'
import { api, errorMessage } from '@/shared/lib/api'
import { RecordArraySchema } from '@/shared/schemas'
import { useDiscogsStatus } from '@/features/discogs'
import { randomQuery, useFilters } from '@/features/collection/filters'
import { backCoverUrl, coverUrl, type VinylRecord } from '@/features/records'
import {
  mountShelf,
  SHELF_SLOTS,
  ShelfUnavailableError,
  type ShelfHandle,
  type ShelfHover,
  type ShelfPills,
  type ShelfRecord,
} from '@/features/shelf'
import { t } from '@/i18n'
import { FilterBar } from '@/features/collection/components/FilterBar'
import { Notice } from '@/shared/components/Notice'
import { ShelfHoverCard } from './ShelfHoverCard'
import { useRecordDialog } from '@/features/records'
import { Button, buttonVariants } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'
import { RecordViews, useOpenRecord } from '@/features/collection/components/RecordViews'
import { routes } from '@/shared/lib/routes'

interface RandomSet {
  n: number
  items: VinylRecord[]
}

declare global {
  interface Window {
    __grooveShelf?: ShelfHandle
  }
}

/** The 3D shelf of the original prototype: 10 random records that follow the filters, with a button to draw 10 others. */
export function ShelfView({ count }: { count?: number } = {}) {
  const open = useOpenRecord()
  const { filters, active } = useFilters()
  const discogs = useDiscogsStatus()
  const hostRef = useRef<HTMLDivElement>(null)
  const handle = useRef<ShelfHandle | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [scene, setScene] = useState<ShelfHandle | null>(null) // the mounted 3D scene
  const [set, setSet] = useState<RandomSet | null>(null)
  const [drawing, setDrawing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hover, setHover] = useState<ShelfHover | null>(null)
  const [pills, setPills] = useState<ShelfPills | null>(null)
  const [pointer, setPointer] = useState(false)
  const [ready, setReady] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const { openAdd } = useRecordDialog()

  const itemsRef = useRef<VinylRecord[]>([])
  itemsRef.current = set?.items ?? []
  const toShelf = useCallback(
    (r: VinylRecord): ShelfRecord => ({
      id: r.id,
      title: r.title,
      artist: r.artist,
      year: r.year,
      label: r.label,
      catalogNo: r.catalog_no,
      country: r.country,
      genres: r.genres,
      format: r.format,
      note: r.note,
      coverUrl: r.has_cover ? coverUrl(r) : null,
      backUrl: r.has_back_cover ? backCoverUrl(r) : null,
    }),
    [],
  )

  // --- mount the 3D scene once; fall back to the grid when WebGL is not available --------------
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    try {
      const shelf = mountShelf(host, {
        onSelect: (id) => {
          setSelectedId(id)
          setHover(null)
          setFlipped(false)
          if (!id) setPills(null)
        },
        onHover: setHover,
        onPills: setPills,
        onCursor: setPointer,
        onReady: setReady,
        onFlip: (_id, isFlipped) => setFlipped(isFlipped),
      })
      handle.current = shelf
      if (import.meta.env.DEV) window.__grooveShelf = shelf
      setScene(shelf)
    } catch (e) {
      if (e instanceof ShelfUnavailableError) setUnavailable(true)
      else throw e
    }
    return () => {
      handle.current?.dispose()
      handle.current = null
      setScene(null)
      if (import.meta.env.DEV) delete window.__grooveShelf
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- draw 10 records (the server avoids the ones just shown whenever enough others exist) ----
  const filterKey = randomQuery(filters).toString()
  const draw = useCallback(
    async (exclude: string[]) => {
      setDrawing(true)
      setError(null)
      setHover(null)
      try {
        const p = new URLSearchParams(filterKey)
        p.set('count', String(SHELF_SLOTS))
        if (exclude.length) p.set('exclude', exclude.join(','))
        const items = await api(`/api/records/random?${p}`, { schema: RecordArraySchema })
        setSet((prev) => ({ n: (prev?.n ?? 0) + 1, items }))
      } catch (e) {
        setError(errorMessage(e, t.shelf.error))
      } finally {
        setDrawing(false)
      }
    },
    [filterKey],
  )

  useEffect(() => {
    void draw([])
  }, [draw])

  // Hand a new set to the scene (only when drawn: edits update one sleeve in place).
  const setN = set?.n
  useEffect(() => {
    if (!scene || setN === undefined) return
    scene.setRecords(itemsRef.current.map(toShelf))
  }, [scene, setN, toShelf])

  const selected = set?.items.find((r) => r.id === selectedId) ?? null

  if (unavailable) {
    return (
      <div className="grid gap-4">
        <Notice>{t.shelf.unavailable}</Notice>
        <FilterBar count={count} />
        <RecordViews forceView="grid" />
      </div>
    )
  }

  const items = set?.items ?? []
  const empty = set !== null && items.length === 0
  const hovered = !selectedId && !drawing ? items.find((r) => r.id === hover?.id) : null

  return (
    <div
      className="relative"
      onKeyDownCapture={(e) => {
        if (e.key === 'Escape') setHover(null)
      }}
    >
      <div className="mb-4">
        <FilterBar
          compact
          count={count}
          viewActions={
            <Button
              type="button"
              variant="outline"
              className="h-11 md:h-9"
              disabled={drawing || !set || empty}
              onClick={() => void draw(items.map((r) => r.id))}
            >
              <ShuffleIcon className={drawing ? 'animate-spin motion-reduce:animate-none' : ''} />
              {drawing ? t.shelf.drawing : t.shelf.more}
            </Button>
          }
        />
      </div>
      <div
        className={cn(
          'relative aspect-[1340/760] max-h-[calc(100dvh-14rem)] min-h-[420px] w-full select-none overflow-hidden rounded-2xl',
          pointer && 'cursor-pointer',
        )}
        style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 48%, #f1f1f2 0%, #e1e1e3 55%, #cfcfd2 100%)' }}
      >
        <div ref={hostRef} className="shelf-stage absolute inset-0" aria-label={t.shelf.view} role="group" />
        {hovered && hover && <ShelfHoverCard record={hovered} anchor={hover} />}
        {error && (
          <div className="absolute top-5 left-5 z-10">
            <Notice kind="error">{error}</Notice>
          </div>
        )}
        {!set && (
          <div className="absolute inset-0 z-[3] grid place-content-center text-sm text-muted-foreground">
            {t.shelf.loading}
          </div>
        )}
        {empty && (
          <div className="absolute inset-0 z-[3] grid place-content-center justify-items-center gap-2 p-4 text-center">
            {active ? (
              <p>{t.shelf.noMatches}</p>
            ) : (
              <div className="grid max-w-sm justify-items-center gap-3 rounded-2xl bg-background/80 p-6 shadow-sm backdrop-blur">
                <h2 className="text-lg font-semibold">{t.shelf.emptyTitle}</h2>
                <p className="text-sm text-muted-foreground">{t.shelf.emptyText}</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button type="button" onClick={openAdd}>
                    {t.shelf.addFirst}
                  </Button>
                  {discogs.data?.connected && discogs.data.status === 'active' && (
                    <Link className={buttonVariants({ variant: 'outline' })} to={routes.import}>
                      {t.shelf.importDiscogs}
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div
          className="shelf-caption pointer-events-none absolute top-5 left-6 z-[1] max-w-[260px] text-neutral-900"
          aria-live="polite"
        >
          {selected ? (
            <>
              <h2 className="text-xl font-medium tracking-tight">{selected.title}</h2>
              <p className="mt-1 text-sm text-neutral-600">{selected.artist}</p>
            </>
          ) : (
            set &&
            !empty && (
              <p className="text-sm leading-snug text-neutral-600">
                {t.shelf.tagline.split('\n').map((l, i) => (
                  <span key={l}>
                    {i > 0 && <br />}
                    {l}
                  </span>
                ))}
              </p>
            )
          )}
        </div>

        {selected && pills && (
          <div
            className={cn('absolute z-[3] transition-opacity', ready ? 'opacity-100' : 'pointer-events-none opacity-0')}
            style={{ left: pills.x }}
          >
            <div
              className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-2"
              style={{ top: pills.openY }}
            >
              <Button variant="secondary" size="sm" onClick={() => handle.current?.flip()}>
                {flipped ? t.shelf.flipBack : t.shelf.flip}
              </Button>
              <Button size="sm" onClick={() => open(selected.id)}>
                {t.shelf.open}
              </Button>
            </div>
          </div>
        )}
      </div>

      {set && !empty && items.length < SHELF_SLOTS && (
        <p className="mt-3 text-center text-sm text-muted-foreground">{t.shelf.fewer(items.length)}</p>
      )}
      <nav aria-label={t.shelf.nav} className="mt-4 flex gap-5 overflow-x-auto pb-1 [justify-content:safe_center]">
        {items.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => handle.current?.select(r.id)}
            onFocus={() =>
              setHover({
                id: r.id,
                x: (hostRef.current?.clientWidth ?? 0) / 2,
                y: (hostRef.current?.clientHeight ?? 0) / 2,
              })
            }
            onBlur={() => setHover(null)}
            aria-describedby={hovered?.id === r.id ? 'shelf-record-preview' : undefined}
            className="shrink-0 rounded-md px-1 text-left text-xs leading-tight text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="block">{r.year ?? r.artist}</span>
            <b
              className={cn('block max-w-32 truncate font-medium text-foreground', selectedId === r.id && 'underline')}
            >
              {r.title}
            </b>
          </button>
        ))}
      </nav>
    </div>
  )
}
