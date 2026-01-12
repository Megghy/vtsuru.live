import type { BlockNode, BlockPageProject } from '@/apps/user-page/block/schema'
import type { UserPagesSettingsV1 } from '@/apps/user-page/types'
import { toRaw } from 'vue'

export function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function deepCloneJson<T>(v: T): T {
  const raw = toRaw(v as any)
  const g = globalThis as any
  const seen = new WeakSet<object>()
  const json = JSON.stringify(raw, (_key, value) => {
    if (typeof value === 'bigint') throw new Error('不支持 BigInt（无法序列化）')
    if (!value || typeof value !== 'object') return value

    if (g.window && value === g.window) return undefined
    if (g.document && value === g.document) return undefined

    const WindowCtor = g.Window
    if (typeof WindowCtor === 'function' && value instanceof WindowCtor) return undefined
    const DocumentCtor = g.Document
    if (typeof DocumentCtor === 'function' && value instanceof DocumentCtor) return undefined
    const NodeCtor = g.Node
    if (typeof NodeCtor === 'function' && value instanceof NodeCtor) return undefined
    const EventCtor = g.Event
    if (typeof EventCtor === 'function' && value instanceof EventCtor) return undefined

    if (seen.has(value)) return undefined
    seen.add(value)
    return value
  })
  return JSON.parse(json) as T
}

export function cloneBlockNode(block: BlockNode): BlockNode {
  const cloned: BlockNode = {
    id: createId(),
    type: block.type,
    name: block.name,
    hidden: block.hidden,
    props: block.props === undefined ? undefined : deepCloneJson(block.props),
  }
  if (cloned.type === 'layout' && cloned.props && typeof cloned.props === 'object' && !Array.isArray(cloned.props)) {
    const propsObj: any = cloned.props
    if (Array.isArray(propsObj.children)) {
      propsObj.children = propsObj.children.map((it: any) => {
        if (!it || typeof it !== 'object' || Array.isArray(it)) return it
        if (typeof it.id !== 'string' || typeof it.type !== 'string') return it
        return cloneBlockNode(it as BlockNode)
      })
    }
  }
  return cloned
}

export interface DiffOp { kind: 'same' | 'add' | 'del', text: string }

export function stableStringify(v: unknown, indent = 2) {
  const seen = new WeakSet<object>()
  const normalize = (x: any): any => {
    if (!x || typeof x !== 'object') return x
    if (Array.isArray(x)) return x.map(normalize)
    if (seen.has(x)) throw new Error('无法序列化循环引用对象')
    seen.add(x)
    const out: Record<string, any> = {}
    Object.keys(x).sort().forEach((k) => {
      out[k] = normalize(x[k])
    })
    return out
  }
  return JSON.stringify(normalize(v), null, indent)
}

export function diffByLines(aText: string, bText: string): DiffOp[] {
  const a = aText.split('\n')
  const b = bText.split('\n')
  const n = a.length
  const m = b.length
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j]
        ? (dp[i + 1][j + 1] + 1)
        : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const ops: DiffOp[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ kind: 'same', text: a[i] })
      i++
      j++
      continue
    }
    if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ kind: 'del', text: a[i] })
      i++
    } else {
      ops.push({ kind: 'add', text: b[j] })
      j++
    }
  }
  while (i < n) ops.push({ kind: 'del', text: a[i++] })
  while (j < m) ops.push({ kind: 'add', text: b[j++] })
  return ops
}

export function estimateUtf8Bytes(text: string) {
  try {
    return new TextEncoder().encode(text).length
  } catch {
    return text.length
  }
}

function isEmptyText(v: unknown) {
  return typeof v !== 'string' || v.trim().length === 0
}

function isEmptyRichText(html: unknown) {
  if (typeof html !== 'string') return true
  const text = html
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length === 0
}

export function isEmptyBlock(block: BlockNode): boolean {
  const propsObj = (block.props && typeof block.props === 'object' && !Array.isArray(block.props)) ? (block.props as any) : {}

  if (block.type === 'layout') {
    const children = Array.isArray(propsObj.children) ? (propsObj.children as unknown[]) : []
    if (children.length === 0) return true
    return children.every((it) => {
      if (!it || typeof it !== 'object' || Array.isArray(it)) return true
      const child: any = it
      if (typeof child.id !== 'string' || typeof child.type !== 'string') return true
      return isEmptyBlock(child as BlockNode)
    })
  }
  if (block.type === 'spacer') return true
  if (block.type === 'heading') return isEmptyText(propsObj.text)
  if (block.type === 'text') return isEmptyText(propsObj.text)
  if (block.type === 'divider') return isEmptyText(propsObj.text)
  if (block.type === 'footer') return isEmptyText(propsObj.text)
  if (block.type === 'embed') return isEmptyText(propsObj.url)
  if (block.type === 'image') return isEmptyText(propsObj.url) && !propsObj.imageFile
  if (block.type === 'imageGallery') {
    const items = Array.isArray(propsObj.items) ? propsObj.items : []
    if (items.length === 0) return true
    return items.every((it: any) => {
      if (!it || typeof it !== 'object' || Array.isArray(it)) return true
      const hasFile = !!it.imageFile
      const hasUrl = typeof it.url === 'string' && it.url.trim().length > 0
      return !hasFile && !hasUrl
    })
  }
  if (block.type === 'links' || block.type === 'buttons') {
    const items = Array.isArray(propsObj.items) ? propsObj.items : []
    const hasAny = items.some((it: any) => typeof it?.label === 'string' && it.label.trim().length)
      || items.some((it: any) => typeof it?.url === 'string' && it.url.trim().length && it.url.trim() !== 'https://')
    return !hasAny
  }
  if (block.type === 'richText') {
    const imagesFile = Array.isArray(propsObj.imagesFile) ? propsObj.imagesFile : []
    return imagesFile.length === 0 && isEmptyRichText(propsObj.html)
  }
  if (block.type === 'profile') {
    const hasAny = !isEmptyText(propsObj.avatarUrl)
      || !!propsObj.avatarFile
      || !isEmptyText(propsObj.displayName)
      || !isEmptyText(propsObj.bio)
    return !hasAny
  }
  if (block.type === 'tags') {
    const items = Array.isArray(propsObj.items) ? propsObj.items : []
    const hasAny = items.some((it: any) => typeof it?.text === 'string' && it.text.trim().length)
    return !hasAny
  }
  if (block.type === 'socialLinks') {
    const items = Array.isArray(propsObj.items) ? propsObj.items : []
    const hasAny = items.some((it: any) => typeof it?.url === 'string' && it.url.trim().length && it.url.trim() !== 'https://')
    return !hasAny
  }
  if (block.type === 'videoList') {
    const source = String(propsObj.source || 'manual')
    if (source === 'userIndex') return false
    const items = Array.isArray(propsObj.items) ? propsObj.items : []
    const hasAny = items.some((it: any) => typeof it?.url === 'string' && it.url.trim().length && it.url.trim() !== 'https://')
    return !hasAny
  }
  if (block.type === 'musicPlayer') {
    const url = typeof propsObj.url === 'string' ? propsObj.url.trim() : ''
    return url.length === 0
  }
  if (block.type === 'faq') {
    const items = Array.isArray(propsObj.items) ? propsObj.items : []
    const hasAny = items.some((it: any) => typeof it?.q === 'string' && it.q.trim().length)
      || items.some((it: any) => typeof it?.a === 'string' && it.a.trim().length)
    return !hasAny
  }
  if (block.type === 'milestone') {
    const items = Array.isArray(propsObj.items) ? propsObj.items : []
    const hasAny = items.some((it: any) => typeof it?.date === 'string' && it.date.trim().length)
      || items.some((it: any) => typeof it?.title === 'string' && it.title.trim().length)
      || items.some((it: any) => typeof it?.description === 'string' && it.description.trim().length)
    return !hasAny
  }
  if (block.type === 'quote') {
    return isEmptyText(propsObj.text)
  }
  if (block.type === 'marquee') {
    return isEmptyText(propsObj.text)
  }
  if (block.type === 'countdown') {
    return isEmptyText(propsObj.target)
  }
  if (block.type === 'feedback') {
    const url = typeof propsObj.url === 'string' ? propsObj.url.trim() : ''
    return url.length === 0
  }
  if (block.type === 'supporter') {
    const items = Array.isArray(propsObj.items) ? propsObj.items : []
    const hasAny = items.some((it: any) => typeof it?.url === 'string' && it.url.trim().length && it.url.trim() !== 'https://')
    return !hasAny
  }
  return false
}

export function pruneHiddenEmptyBlocks(settingsToPrune: UserPagesSettingsV1): number {
  let removed = 0
  const pruneProject = (p: BlockPageProject | undefined) => {
    if (!p) return
    const before = p.blocks.length
    p.blocks = p.blocks.filter(b => !(b.hidden && isEmptyBlock(b)))
    removed += before - p.blocks.length
  }

  if (settingsToPrune.home?.mode === 'block') pruneProject(settingsToPrune.home.block)
  Object.values(settingsToPrune.pages ?? {}).forEach((cfg) => {
    if (cfg.mode === 'block') pruneProject(cfg.block)
  })
  return removed
}
