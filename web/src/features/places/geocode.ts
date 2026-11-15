interface GeoPoint {
  lat: number
  lng: number
  label: string
}

let chain: Promise<unknown> = Promise.resolve()
let last = 0

/** Address to coordinates with Nominatim: one request at a time, at least 1.1 s apart. Only the address is sent. */
export function geocode(
  address: string,
  fetchImpl: typeof fetch = (...a) => fetch(...a),
  gapMs = 1100,
): Promise<GeoPoint | null> {
  const run = async () => {
    const wait = last + gapMs - Date.now()
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    last = Date.now()
    const res = await fetchImpl(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=it&q=${encodeURIComponent(address)}`,
    )
    if (!res.ok) throw new Error('Geocodifica non disponibile')
    const d = (await res.json()) as { lat: string; lon: string; display_name: string }[]
    return d[0] ? { lat: Number(d[0].lat), lng: Number(d[0].lon), label: d[0].display_name } : null
  }
  const p = chain.then(run, run)
  chain = p.catch(() => undefined)
  return p
}
