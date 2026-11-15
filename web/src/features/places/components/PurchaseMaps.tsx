import L from 'leaflet'
import { useEffect } from 'react'
import { useMap, useMapEvents } from 'react-leaflet'
import { Map, MapMarker, MapTileLayer, MapTooltip, MapZoomControl } from '@/shared/ui/map'
import { cn } from '@/shared/lib/utils'

export type MapPlace = { id: string; name: string; lat: number; lng: number; count: number }

/** Segnaposto numerato: colori dal tema shadcn, evidenziato quando selezionato. */
const Pin = ({ label, selected }: { label: string; selected: boolean }) => (
  <div className={cn('flex size-9 items-center justify-center rounded-full border-2 border-background text-sm font-semibold shadow-lg',
    selected ? 'bg-destructive text-white' : 'bg-primary text-primary-foreground')}>{label}</div>
)

function Resize() {
  const map = useMap()
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(map.getContainer()); return () => ro.disconnect()
  }, [map])
  return null
}

function Fit({ points }: { points: [number, number][] }) {
  const map = useMap()
  const key = points.map(p => p.join(',')).join('|')
  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) map.setView(points[0], 13)
    else map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 14 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map])
  return null
}

// z-0: sotto header e modali (il componente base usa z-50); l'altezza la decide il contenitore
const MAP_CLASS = 'z-0 h-full min-h-0 w-full flex-none rounded-[inherit]'

export function PurchaseMap({ places, selectedId, onSelect, dragging, className }: { places: MapPlace[]; selectedId?: string | null; onSelect: (id: string) => void; dragging: boolean; className?: string }) {
  return (
    <div className={cn('overflow-hidden', className)}>
    <Map center={[45, 10]} zoom={5} scrollWheelZoom={false} dragging={dragging} className={MAP_CLASS}>
      <MapTileLayer />
      <MapZoomControl />
      <Resize />
      <Fit points={places.map(p => [p.lat, p.lng])} />
      {places.map(p => (
        <MapMarker key={p.id} position={[p.lat, p.lng]} icon={<Pin label={String(p.count)} selected={p.id === selectedId} />} iconAnchor={[18, 18]}
          title={`${p.name}: ${p.count} ${p.count === 1 ? 'disco' : 'dischi'}`} keyboard
          eventHandlers={{
            click: () => onSelect(p.id),
            // tastiera: Invio o Spazio sul marcatore aprono il dettaglio
            keydown: e => { const k = (e.originalEvent as KeyboardEvent).key; if (k === 'Enter' || k === ' ') { e.originalEvent.preventDefault(); onSelect(p.id) } },
          }}>
          <MapTooltip side="top">{p.name}</MapTooltip>
        </MapMarker>
      ))}
    </Map>
    </div>
  )
}

function Clicker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: e => onPick(e.latlng.lat, e.latlng.lng) })
  return null
}

/** Selettore del punto: tocca la mappa o trascina il marcatore. */
export function PointPicker({ lat, lng, onChange, className }: { lat?: number; lng?: number; onChange: (lat: number, lng: number) => void; className?: string }) {
  const has = lat != null && lng != null
  return (
    <div className={cn('overflow-hidden', className)}>
    <Map center={has ? [lat!, lng!] : [45, 10]} zoom={has ? 15 : 5} scrollWheelZoom={false} className={MAP_CLASS}>
      <MapTileLayer />
      <MapZoomControl />
      <Resize /><Clicker onPick={onChange} />
      {has && (
        <>
          <Fit points={[[lat!, lng!]]} />
          <MapMarker position={[lat!, lng!]} icon={<Pin label="" selected />} iconAnchor={[18, 18]} draggable
            eventHandlers={{ dragend: e => { const p = (e.target as L.Marker).getLatLng(); onChange(p.lat, p.lng) } }} />
        </>
      )}
    </Map>
    </div>
  )
}
