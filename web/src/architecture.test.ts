import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname)

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return files(path)
    return /\.(ts|tsx)$/.test(path) ? [path] : []
  })
}

const IMPORT = /(?:from|import\s*\(|import|vi\.mock\()\s*['"]([^'"\n]+)['"]/g

function importsOf(file: string): string[] {
  return [...readFileSync(file, 'utf8').matchAll(IMPORT)].map((m) => m[1])
}

/** The feature a file belongs to (`features/<name>/...`), or null for app, shared and i18n code. */
const featureOf = (file: string) => {
  const parts = relative(ROOT, file).split(sep)
  return parts[0] === 'features' ? parts[1] : null
}

describe('folder structure rules', () => {
  const all = files(ROOT)

  it('features reach other features only through their index', () => {
    const offenders: string[] = []
    for (const file of all) {
      const own = featureOf(file)
      for (const spec of importsOf(file)) {
        const m = spec.match(/^@\/features\/([^/]+)(\/.+)?$/)
        if (m && m[1] !== own && m[2]) offenders.push(`${relative(ROOT, file)} -> ${spec}`)
        if (spec.startsWith('.') && spec.split('/').filter((p) => p === '..').length > 1 && own)
          offenders.push(`${relative(ROOT, file)} -> ${spec} (reaches outside its folder with ..)`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('shared code and translations never import a feature or the app shell', () => {
    const offenders: string[] = []
    for (const file of all) {
      const top = relative(ROOT, file).split(sep)[0]
      if (top !== 'shared' && top !== 'i18n') continue
      for (const spec of importsOf(file))
        if (/^@\/(features|app)(\/|$)/.test(spec)) offenders.push(`${relative(ROOT, file)} -> ${spec}`)
    }
    expect(offenders).toEqual([])
  })

  it('features do not import the app shell, and no two features depend on each other in a loop', () => {
    const edges = new Map<string, Set<string>>()
    const offenders: string[] = []
    for (const file of all) {
      const own = featureOf(file)
      if (!own) continue
      for (const spec of importsOf(file)) {
        if (/^@\/app(\/|$)/.test(spec)) offenders.push(`${relative(ROOT, file)} -> ${spec}`)
        const m = spec.match(/^@\/features\/([^/]+)/)
        if (m && m[1] !== own) edges.set(own, (edges.get(own) ?? new Set()).add(m[1]))
      }
    }
    const loops: string[] = []
    const walk = (start: string, at: string, path: string[]) => {
      for (const next of edges.get(at) ?? []) {
        if (next === start) loops.push([...path, next].join(' -> '))
        else if (!path.includes(next)) walk(start, next, [...path, next])
      }
    }
    for (const f of edges.keys()) walk(f, f, [f])
    expect(offenders).toEqual([])
    expect(loops).toEqual([])
  })
})
