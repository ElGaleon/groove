import { drawPlaceholderBack, drawPlaceholderFront, mk } from './placeholder-covers'
import { createShelf } from './shelf-scene'
import { ShelfUnavailableError, type ShelfHandle, type ShelfOptions, type ShelfRecord } from './types'

export { ShelfUnavailableError } from './types'
export type { ShelfHandle, ShelfHover, ShelfOptions, ShelfPills, ShelfRecord } from './types'

/** The 3D shelf of the original prototype: two rows of five sleeves. */
export const SHELF_SLOTS = 10

const COVER_FONTS_CSS =
  'https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700&family=Yellowtail&family=IBM+Plex+Mono:wght@400&display=swap'

/** The covers are drawn with web fonts that no other page uses, so they are requested only here. */
function ensureCoverFonts() {
  if (document.querySelector('link[data-cover-fonts]')) return
  for (const href of ['https://fonts.googleapis.com', 'https://fonts.gstatic.com']) {
    const link = document.createElement('link')
    link.rel = 'preconnect'
    link.href = href
    if (href.includes('gstatic')) link.crossOrigin = 'anonymous'
    document.head.append(link)
  }
  const sheet = document.createElement('link')
  sheet.rel = 'stylesheet'
  sheet.href = COVER_FONTS_CSS
  sheet.dataset.coverFonts = ''
  document.head.append(sheet)
}

let fontsReady: Promise<void> | null = null
const loadFonts = () => {
  ensureCoverFonts()
  return (fontsReady ??= Promise.all(['500 40px Inter', '400 40px Anton', '400 40px Yellowtail', '400 20px "IBM Plex Mono"'].map((f) => document.fonts.load(f))).then(
    () => undefined,
    () => undefined,
  ))
}

const versionLines = (r: ShelfRecord) =>
  [r.label, r.catalogNo, [r.country, r.year].filter(Boolean).join(' '), r.format, r.note].filter(Boolean) as string[]

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/** Front canvas: the real cover when there is one, otherwise the generated placeholder. */
async function frontFor(r: ShelfRecord): Promise<HTMLCanvasElement> {
  const img = r.coverUrl ? await loadImage(r.coverUrl) : null
  if (!img) return drawPlaceholderFront(r.title, r.artist)
  const [c, g] = mk()
  g.drawImage(img, 0, 0, c.width, c.height)
  return c
}

/** Back canvas: the real back cover when there is one, otherwise the generated details sheet. */
async function backFor(r: ShelfRecord): Promise<HTMLCanvasElement> {
  const img = r.backUrl ? await loadImage(r.backUrl) : null
  if (!img) return drawPlaceholderBack({ title: r.title, artist: r.artist, lines: versionLines(r) })
  const [c, g] = mk()
  g.drawImage(img, 0, 0, c.width, c.height)
  return c
}

function webglAvailable() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'))
  } catch {
    return false
  }
}

/** Mounts the shelf into `host`. Throws ShelfUnavailableError when WebGL cannot be created. */
export function mountShelf(host: HTMLElement, options: ShelfOptions = {}): ShelfHandle {
  if (!webglAvailable()) throw new ShelfUnavailableError()
  let scene: ReturnType<typeof createShelf> | null = null
  let current: ShelfRecord[] = []
  let token = 0
  let flipped = false
  let selectedIndex: number | null = null

  const teardown = () => {
    scene?.dispose()
    scene = null
    selectedIndex = null
    flipped = false
    options.onSelect?.(null)
    options.onHover?.(null)
    options.onCursor?.(false)
    options.onReady?.(false)
  }

  const onKey = (e: KeyboardEvent) => {
    if (!scene) return
    if (e.key === 'Escape') {
      scene.unpick()
      options.onHover?.(null)
    }
    if ((e.key === 'f' || e.key === 'F') && selectedIndex !== null) {
      flipped = Boolean(scene.flip())
      options.onFlip?.(current[selectedIndex].id, flipped)
    }
  }
  addEventListener('keydown', onKey)

  return {
    setRecords(records) {
      const mine = ++token
      teardown()
      current = records.slice(0, SHELF_SLOTS)
      if (current.length === 0) return
      const snapshot = current
      void Promise.all([loadFonts(), Promise.all(snapshot.map(frontFor)), Promise.all(snapshot.map(backFor))]).then(([, fronts, backs]) => {
        if (mine !== token) return
        scene = createShelf(
          host,
          {
            onSelect: (i) => {
              selectedIndex = i
              flipped = false
              options.onSelect?.(i === null ? null : snapshot[i].id)
            },
            onReady: (ready) => options.onReady?.(ready),
            onCursor: (pointer) => options.onCursor?.(pointer),
            onPills: (p) => options.onPills?.(p),
            onHover: (hover) => options.onHover?.(hover ? { id: snapshot[hover.i].id, x: hover.x, y: hover.y } : null),
          },
          { count: snapshot.length, front: (i) => fronts[i], back: (i) => backs[i] },
        )
      })
    },
    select(id) {
      if (!scene) return
      if (id === null) scene.unpick()
      else {
        const i = current.findIndex((r) => r.id === id)
        if (i >= 0) scene.pick(i)
      }
    },
    flip() {
      if (!scene || selectedIndex === null) return
      flipped = Boolean(scene.flip())
      options.onFlip?.(current[selectedIndex].id, flipped)
    },
    dispose() {
      token++
      removeEventListener('keydown', onKey)
      teardown()
    },
  }
}
