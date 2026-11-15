// @ts-nocheck — procedural placeholder covers (canvas 2D), ported from the original prototype
const S = 1024
export const mk = (): [HTMLCanvasElement, CanvasRenderingContext2D] => {
  const c = document.createElement('canvas')
  c.width = c.height = S
  return [c, c.getContext('2d')!]
}
// finitura: colori pieni e contrastati, nessuna grana né graffi
function finish(g) {
  const img = g.getImageData(0, 0, S, S),
    d = img.data
  for (let k = 0; k < d.length; k += 4) {
    const gr = 0.3 * d[k] + 0.59 * d[k + 1] + 0.11 * d[k + 2]
    for (let j = 0; j < 3; j++) {
      const c = gr + (d[k + j] - gr) * 1.18 // saturazione
      let x = Math.min(1, Math.max(0, c / 255))
      x = x + (x * x * (3 - 2 * x) - x) * 0.5 // curva a S morbida
      d[k + j] = x * 255
    }
  }
  g.putImageData(img, 0, 0)
}

// ---- copertine segnaposto per i vinili aggiunti dall'utente (nessuna immagine disponibile) ----
const hash = (s: string) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
function wrap(g, text: string, x: number, y: number, maxW: number, lh: number, maxLines = 4) {
  const words = text.split(/\s+/)
  let line = '',
    n = 0
  for (const w of words) {
    const t = line ? line + ' ' + w : w
    if (g.measureText(t).width > maxW && line) {
      g.fillText(line, x, y + n * lh)
      line = w
      if (++n >= maxLines) return
    } else line = t
  }
  g.fillText(line, x, y + n * lh)
}
export function drawPlaceholderFront(title: string, artist: string): HTMLCanvasElement {
  const [c, g] = mk(),
    h = hash(title + artist),
    hue = h % 360
  const gr = g.createLinearGradient(0, 0, S, S)
  gr.addColorStop(0, `hsl(${hue} 70% 38%)`)
  gr.addColorStop(1, `hsl(${(hue + 50) % 360} 75% 18%)`)
  g.fillStyle = gr
  g.fillRect(0, 0, S, S)
  g.strokeStyle = 'rgba(255,255,255,.14)'
  g.lineWidth = 3
  for (let r = 120; r <= 420; r += 30) {
    g.beginPath()
    g.arc(700, 700, r, 0, 7)
    g.stroke()
  }
  g.fillStyle = `hsl(${(hue + 25) % 360} 85% 62%)`
  g.beginPath()
  g.arc(700, 700, 90, 0, 7)
  g.fill()
  g.fillStyle = '#111'
  g.beginPath()
  g.arc(700, 700, 12, 0, 7)
  g.fill()
  g.fillStyle = '#fff'
  g.textBaseline = 'alphabetic'
  g.font = '700 96px Inter'
  wrap(g, title, 70, 150, S - 140, 106, 4)
  g.fillStyle = 'rgba(255,255,255,.82)'
  g.font = '500 54px Inter'
  wrap(g, artist, 70, 900, 520, 62, 2)
  finish(g)
  return c
}
export function drawPlaceholderBack(v: { title: string; artist: string; lines: string[] }): HTMLCanvasElement {
  const [c, g] = mk(),
    hue = hash(v.title + v.artist) % 360
  g.fillStyle = `hsl(${hue} 45% 14%)`
  g.fillRect(0, 0, S, S)
  g.fillStyle = '#fff'
  g.font = '700 64px Inter'
  wrap(g, v.title, 70, 130, S - 140, 72, 2)
  g.fillStyle = 'rgba(255,255,255,.8)'
  g.font = '500 40px Inter'
  g.fillText(v.artist, 70, 270)
  g.font = '400 30px "IBM Plex Mono", monospace'
  v.lines.slice(0, 12).forEach((t, k) => g.fillText(t, 70, 380 + k * 52))
  finish(g)
  return c
}
