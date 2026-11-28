import { filterUsedRichTextImages, resolveRichTextImageUrls } from '@/apps/user-page/block/richTextImages'
import type { BlockNode, BlockPageProject } from '@/apps/user-page/block/schema'
import type { UserPagesSettings } from '@/apps/user-page/types'

export interface FileRefEntry {
  id: number
  path?: string
  name?: string
  locations: string[]
}

export function collectFileRefsFromSettings(settings: UserPagesSettings): FileRefEntry[] {
  const map = new Map<number, { id: number; path?: string; name?: string; locations: Set<string> }>()

  const add = (obj: any, loc: string) => {
    if (!obj || typeof obj !== 'object') return
    const id = obj.id
    if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) return
    const entry = map.get(id) ?? { id, locations: new Set<string>() }
    if (typeof obj.path === 'string') entry.path = obj.path
    if (typeof obj.name === 'string') entry.name = obj.name
    entry.locations.add(loc)
    map.set(id, entry)
  }

  const walk = (node: any, loc: string) => {
    if (!node) return
    if (Array.isArray(node)) {
      node.forEach((it, idx) => walk(it, `${loc}[${idx}]`))
      return
    }
    if (typeof node !== 'object') return
    Object.entries(node as Record<string, any>).forEach(([k, v]) => {
      const nextLoc = loc ? `${loc}.${k}` : k
      if (k.toLowerCase().endsWith('file')) {
        if (Array.isArray(v)) v.forEach((it, idx) => add(it, `${nextLoc}[${idx}]`))
        else add(v, nextLoc)
        return
      }
      walk(v, nextLoc)
    })
  }

  walk(settings as any, 'settings')

  return Array.from(map.values())
    .map((x) => ({ id: x.id, path: x.path, name: x.name, locations: Array.from(x.locations).toSorted() }))
    .toSorted((a, b) => a.id - b.id)
}

export function normalizeRichTextImagesFile(
  settings: UserPagesSettings,
  ensurePropsObject: (block: BlockNode) => Record<string, any>,
) {
  const normalizeProject = (p: BlockPageProject | undefined) => {
    if (!p) return
    const walk = (blocks: BlockNode[]) => {
      blocks.forEach((b) => {
        if (b.type === 'layout') {
          const propsObj = ensurePropsObject(b)
          if (Array.isArray(propsObj.children)) walk(propsObj.children as BlockNode[])
          return
        }
        if (b.type !== 'richText') return
        const propsObj = ensurePropsObject(b)
        if (typeof propsObj.html !== 'string') return
        if (!Array.isArray(propsObj.imagesFile)) return
        propsObj.html = resolveRichTextImageUrls(propsObj.html, propsObj.imagesFile)
        propsObj.imagesFile = filterUsedRichTextImages(propsObj.html, propsObj.imagesFile)
      })
    }
    walk(p.blocks)
  }

  if (settings.home?.mode === 'block') normalizeProject(settings.home.block)
  Object.values(settings.pages ?? {}).forEach((cfg) => {
    if (cfg.mode === 'block') normalizeProject(cfg.block)
  })
}
