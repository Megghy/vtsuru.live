import type { ContribPageRef } from '../types'

type ContribPageImporter = () => Promise<unknown>

const contribPages = import.meta.glob('/src/apps/user/contrib/pages/**/*.vue')

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

