import type { ContribPageRef } from '../types'

type ContribPageImporter = () => Promise<unknown>

const contribPages = import.meta.glob('/src/apps/user/contrib/pages/**/*.vue')

function parseContribPagePath(path: string): ContribPageRef | null {
  const prefix = '/src/apps/user/contrib/pages/'
  if (!path.startsWith(prefix) || !path.endsWith('.vue')) return null
  const rest = path.slice(prefix.length, -'.vue'.length)
  if (!rest) return null
  const parts = rest.split('/')
  if (parts.length === 1) return { scope: 'global', pageId: parts[0] }
  const [first, ...remain] = parts
  if (!/^\d+$/.test(first)) return null
  const pageId = remain.join('/')
  if (!pageId) return null
  return { scope: 'streamer', streamerId: Number(first), pageId }
}

function buildContribPagePath(ref: ContribPageRef): string {
  if (ref.scope === 'global') return `/src/apps/user/contrib/pages/${ref.pageId}.vue`
  if (!ref.streamerId) throw new Error('Contrib Page scope=streamer 缺少 streamerId')
  return `/src/apps/user/contrib/pages/${ref.streamerId}/${ref.pageId}.vue`
}

export function getContribPageImporter(ref: ContribPageRef): ContribPageImporter {
  const path = buildContribPagePath(ref)
  const importer = contribPages[path]
  if (!importer) throw new Error(`未找到 Contrib Page: ${path}`)
  return importer
}

export function listContribPageRefs(): ContribPageRef[] {
  return Object.keys(contribPages)
    .map(parseContribPagePath)
    .filter((x): x is ContribPageRef => !!x)
}
