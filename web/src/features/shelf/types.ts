export interface ShelfRecord {
  id: string
  title: string
  artist: string
  year: number | null
  label: string | null
  catalogNo: string | null
  country: string | null
  genres: string[]
  format: string | null
  note: string | null
  coverUrl: string | null // authenticated same-origin cover endpoint, or null for a generated cover
  backUrl: string | null // the real back of the sleeve, when the family has added it
}

/** Where the selected sleeve's buttons go, in pixels of the host. */
export interface ShelfPills {
  x: number
  flipY: number
  openY: number
}

/** The hovered sleeve and the pointer position, in pixels of the host. */
export interface ShelfHover {
  id: string
  x: number
  y: number
}

export interface ShelfOptions {
  onSelect?: (id: string | null) => void
  onFlip?: (id: string, flipped: boolean) => void
  onPills?: (pills: ShelfPills) => void
  onCursor?: (pointer: boolean) => void
  onReady?: (ready: boolean) => void
  onHover?: (hover: ShelfHover | null) => void
}

export interface ShelfHandle {
  setRecords(records: ShelfRecord[]): void
  select(id: string | null): void
  flip(): void
  dispose(): void
}

export class ShelfUnavailableError extends Error {
  constructor() {
    super('WebGL unavailable')
  }
}
