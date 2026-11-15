import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sources(path)
    return path.endsWith('.tsx') && !path.endsWith('.test.tsx') && !path.includes('/shared/ui/') ? [path] : []
  })
}

describe('user-facing text', () => {
  it('lives in the catalogs: no literal words in JSX text or visible attributes', () => {
    const offenders: string[] = []
    for (const file of sources(join(__dirname, '..'))) {
      const code = readFileSync(file, 'utf8')
      const text = [...code.matchAll(/(?<=<[A-Za-z][\w.]*(?:\s[^<>]*)?[^=]>)([^<>{}\n]*[A-Za-zÀ-ú]{3,}[^<>{}\n]*)</g)].map((m) => m[1].trim())
      const attrs = [...code.matchAll(/(?:aria-label|placeholder|title|alt)="([^"]*[A-Za-z]{3}[^"]*)"/g)].map((m) => m[1])
      for (const found of [...text, ...attrs].filter(Boolean)) offenders.push(`${file}: ${found}`)
    }
    expect(offenders).toEqual([])
  })
})
