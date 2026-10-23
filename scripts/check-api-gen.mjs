import { spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const generated = resolve(root, 'src/api/generated')

rmSync(generated, { recursive: true, force: true })

const gen = spawnSync('bun', ['run', 'api:gen'], { cwd: root, stdio: 'inherit', shell: true })
if (gen.status) process.exit(gen.status)

const fmt = spawnSync('bun', ['x', 'oxfmt', '--write', 'src/api/generated'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
})
if (fmt.status) process.exit(fmt.status)

const status = spawnSync('git', ['status', '--porcelain', '--', 'src/api/generated'], {
  cwd: root,
  encoding: 'utf8',
  shell: true,
})
if (status.status) {
  process.stderr.write(status.stderr)
  process.exit(status.status)
}

const dirty = status.stdout.trim()
if (dirty) {
  console.error('src/api/generated is stale. Run: bun run api:gen && bun x oxfmt --write src/api/generated')
  console.error(dirty)
  spawnSync('git', ['diff', '--', 'src/api/generated'], { cwd: root, stdio: 'inherit', shell: true })
  process.exit(1)
}

console.log('generated API types match openapi.json')
