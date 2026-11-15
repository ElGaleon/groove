// Generates src/shared/schemas/generated/zod.gen.ts from src/shared/schemas/openapi.json.
//   npm run schemas          export the OpenAPI document from the API, then generate
//   npm run schemas:check    fail if the committed schemas are not what the document produces
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const tool = join(root, 'tools/schema-gen')
const spec = join(root, 'src/shared/schemas/openapi.json')
const out = join(root, 'src/shared/schemas/generated')
const check = process.argv.includes('--check')
const run = (cmd, args, cwd = root) => execFileSync(cmd, args, { cwd, stdio: 'inherit' })

if (!existsSync(join(tool, 'node_modules'))) run('npm', ['install', '--no-audit', '--no-fund'], tool)

if (!check && !process.argv.includes('--no-export')) {
  run('uv', ['run', 'python', '-m', 'scripts.export_openapi', spec], resolve(root, '../api'))
}

const generate = (dir) => run(join(tool, 'node_modules/.bin/openapi-ts'), ['-i', spec, '-o', dir, '-p', 'zod'])

if (!check) {
  generate(out)
} else {
  const tmp = mkdtempSync(join(tmpdir(), 'schemas-'))
  try {
    generate(tmp)
    const fresh = readFileSync(join(tmp, 'zod.gen.ts'), 'utf8')
    const committed = existsSync(join(out, 'zod.gen.ts')) ? readFileSync(join(out, 'zod.gen.ts'), 'utf8') : ''
    if (fresh !== committed) {
      console.error('The generated schemas are out of date: run `npm run schemas` and commit the result.')
      process.exit(1)
    }
    console.log('Schemas are up to date.')
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}
