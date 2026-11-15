import { useLayoutEffect, useRef } from 'react'
import { mainFormat, OwnerBadge, type VinylRecord } from '@/features/records'
import type { ShelfHover } from '@/features/shelf'

/** A glass preview that stays inside the shelf and never intercepts the pointer. */
export function ShelfHoverCard({ record, anchor }: { record: VinylRecord; anchor: ShelfHover }) {
  const cardRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const card = cardRef.current
    const stage = card?.offsetParent
    if (!card || !(stage instanceof HTMLElement)) return
    const margin = 16
    const x = Math.max(margin, Math.min(anchor.x + 20, stage.clientWidth - card.offsetWidth - margin))
    const below = anchor.y + 20
    const y = Math.max(margin, Math.min(
      below + card.offsetHeight <= stage.clientHeight - margin ? below : anchor.y - card.offsetHeight - 20,
      stage.clientHeight - card.offsetHeight - margin,
    ))
    card.style.transform = `translate3d(${x}px, ${y}px, 0)`
  }, [anchor, record])

  return (
    <div ref={cardRef} id="shelf-record-preview" role="tooltip" className="pointer-events-none absolute top-0 left-0 z-10 w-68 max-w-[calc(100%-2rem)] animate-in rounded-2xl border border-white/70 bg-white/90 p-4 text-neutral-900 shadow-lg ring-1 ring-black/5 backdrop-blur-xl duration-600 ease-out fade-in-0 supports-backdrop-filter:bg-white/65 motion-reduce:animate-none">
      {(record.format || record.year != null) && (
        <div className="mb-2 flex items-center justify-between gap-3 text-xs font-medium tracking-wide text-neutral-600">
          {record.format && <span>{mainFormat(record.format)}</span>}
          {record.year != null && <span className="ml-auto tabular-nums">{record.year}</span>}
        </div>
      )}
      <h3 className="line-clamp-2 text-base leading-tight font-semibold tracking-tight">{record.title}</h3>
      <p className="mt-1 line-clamp-2 text-sm text-neutral-600">{record.artist}</p>
      <OwnerBadge ownerId={record.owner_id} className="mt-3" />
    </div>
  )
}
