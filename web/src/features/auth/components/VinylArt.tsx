import { cn } from '@/shared/lib/utils'

const GROOVES = Array.from({ length: 14 }, (_, i) => 94 - i * 3.4)

/**
 * A decorative record, drawn in SVG: the disc turns slowly (not at all for people who ask for
 * reduced motion) while the light on it stays still, so it reads as a real one.
 */
export function VinylArt({ className }: { className?: string }) {
  return (
    <div className={cn('relative aspect-square', className)} aria-hidden="true">
      <svg viewBox="0 0 200 200" className="size-full animate-[spin_24s_linear_infinite] motion-reduce:animate-none">
        <circle cx="100" cy="100" r="99" fill="#0b0b0c" stroke="#ffffff" strokeOpacity="0.14" />
        {GROOVES.map((r, i) => (
          <circle
            key={r}
            cx="100"
            cy="100"
            r={r}
            fill="none"
            stroke="#ffffff"
            strokeOpacity={i % 4 === 0 ? 0.12 : 0.05}
          />
        ))}
        <circle cx="100" cy="100" r="34" fill="#e8a33d" />
        <circle cx="100" cy="100" r="28" fill="none" stroke="#0b0b0c" strokeOpacity="0.25" strokeWidth="0.8" />
        <circle cx="100" cy="100" r="3.2" fill="#0b0b0c" />
      </svg>
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            'conic-gradient(from 25deg, transparent 0 18%, rgb(255 255 255 / .16) 24%, transparent 30% 68%, rgb(255 255 255 / .12) 74%, transparent 80%)',
        }}
      />
    </div>
  )
}
