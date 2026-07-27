import { Buffer } from 'node:buffer'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { file as bunFile } from 'bun'

const DIST_DIR = path.resolve(import.meta.dirname, '..', 'dist')
const MANIFEST_PATH = path.join(DIST_DIR, '.vite', 'manifest.json')
const BUDGETS = [
  {
    name: '公开用户页',
    source: 'src/apps/user/pages/UserPageEntryView.vue',
    maxEntryGzipBytes: 8 * 1024,
    maxRouteGzipBytes: 650 * 1024,
    maxStaticJsRequests: 26,
  },
  {
    name: '用户页编辑器',
    source: 'src/apps/manage/pages/UserPageBuilderView.vue',
    maxEntryGzipBytes: 64 * 1024,
    maxRouteGzipBytes: 1024 * 1024,
    maxStaticJsRequests: 44,
  },
]

const manifest = await bunFile(MANIFEST_PATH).json()

function findEntryKey(source) {
  const entryKey = Object.keys(manifest).find(key => key.endsWith(source))
  if (!entryKey) throw new Error(`构建 manifest 中未找到 ${source}`)
  return entryKey
}

function collectStaticChunks(key, collected = new Set()) {
  if (collected.has(key)) return collected
  collected.add(key)
  manifest[key]?.imports?.forEach(imported => collectStaticChunks(imported, collected))
  return collected
}

async function gzipBytes(relativeFile) {
  const bytes = await bunFile(path.join(DIST_DIR, relativeFile)).arrayBuffer()
  return gzipSync(Buffer.from(bytes)).byteLength
}

async function measureBudget(budget) {
  const entryKey = findEntryKey(budget.source)
  const routeKeys = [...collectStaticChunks(entryKey)]
  const jsFiles = routeKeys.map(key => manifest[key]?.file).filter(file => file?.endsWith('.js'))
  const cssFiles = [...new Set(routeKeys.flatMap(key => manifest[key]?.css ?? []))]
  const routeFiles = [...new Set([...jsFiles, ...cssFiles])]
  const routeSizes = await Promise.all(routeFiles.map(async file => ({ file, gzipBytes: await gzipBytes(file) })))
  const routeGzipBytes = routeSizes.reduce((sum, item) => sum + item.gzipBytes, 0)
  const entryGzipBytes = await gzipBytes(manifest[entryKey].file)
  return { ...budget, routeSizes, routeGzipBytes, entryGzipBytes, staticJsRequests: jsFiles.length }
}

const measurements = await Promise.all(BUDGETS.map(measureBudget))
const failures = []

for (const result of measurements) {
  console.log(`\n${result.name}`)
  console.table(result.routeSizes.toSorted((a, b) => b.gzipBytes - a.gzipBytes))
  console.log(`入口 gzip: ${(result.entryGzipBytes / 1024).toFixed(1)} KiB / ${result.maxEntryGzipBytes / 1024} KiB`)
  console.log(`静态依赖 gzip: ${(result.routeGzipBytes / 1024).toFixed(1)} KiB / ${result.maxRouteGzipBytes / 1024} KiB`)
  console.log(`静态 JS 请求: ${result.staticJsRequests} / ${result.maxStaticJsRequests}`)

  if (result.entryGzipBytes > result.maxEntryGzipBytes) failures.push(`${result.name}入口体积超出预算`)
  if (result.routeGzipBytes > result.maxRouteGzipBytes) failures.push(`${result.name}静态依赖体积超出预算`)
  if (result.staticJsRequests > result.maxStaticJsRequests) failures.push(`${result.name}静态 JS 请求数超出预算`)
}

if (failures.length) throw new Error(failures.join('；'))
