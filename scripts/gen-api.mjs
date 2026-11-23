import { spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const generated = resolve(root, 'src/api/generated')

function run(command, args) {
  const res = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: true })
  if (res.status !== 0) {
    process.exit(res.status ?? 1)
  }
}

rmSync(generated, { recursive: true, force: true })
run('node', ['./node_modules/orval/dist/bin/orval.mjs'])
run('bun', ['x', 'oxfmt', '--write', 'src/api/generated'])
