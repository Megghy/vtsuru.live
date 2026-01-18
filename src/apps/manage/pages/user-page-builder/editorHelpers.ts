import type { BlockNode, BlockPageProject } from '@/apps/user-page/block/schema'
import type { UserPagesSettingsV1 } from '@/apps/user-page/types'
import { toRaw } from 'vue'

export function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function deepCloneJson<T>(v: T): T {
  const raw = toRaw(v as any) as unknown
  const g = globalThis as typeof globalThis & {
    window?: unknown
    document?: unknown
    Window?: unknown
    Document?: unknown
    Node?: unknown
    Event?: unknown
  }
  const seen = new WeakSet<object>()
  const json = JSON.stringify(raw, (_key: string, value: unknown): unknown => {
    if (typeof value === 'bigint') throw new Error('不支持 BigInt：无法序列化')
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
  return JSON.parse(json) as unknown as T
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
    const propsObj = cloned.props as Record<string, unknown>
    const children = propsObj.children
    if (Array.isArray(children)) {
      propsObj.children = children.map((it: unknown) => {
        if (!it || typeof it !== 'object' || Array.isArray(it)) return it
        const maybeNode = it as Record<string, unknown>
        if (typeof maybeNode.id !== 'string' || typeof maybeNode.type !== 'string') return it
        return cloneBlockNode(it as BlockNode)
      }) satisfies unknown[]
    }
  }
  return cloned
}

export interface DiffOp { kind: 'same' | 'add' | 'del', text: string }

export function stableStringify(v: unknown, indent = 2): string {
  const seen = new WeakSet<object>()
  const normalize = (x: unknown): unknown => {
    if (!x || typeof x !== 'object') return x
    if (Array.isArray(x)) return x.map(normalize)
    if (seen.has(x)) throw new Error('无法序列化循环引用对象')
    seen.add(x)
    const out: Record<string, unknown> = {}
    Object.keys(x).sort().forEach((k) => {
      out[k] = normalize((x as Record<string, unknown>)[k])
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

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== 'object') return null
  if (Array.isArray(v)) return null
  return v as Record<string, unknown>
}

function isEmptyRichText(html: unknown) {
  if (typeof html !== 'string') return true
  const bodyText = new DOMParser()
    .parseFromString(html, 'text/html')
    .body
    .textContent
  const text = (bodyText ?? '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length === 0
}

export function isEmptyBlock(block: BlockNode): boolean {
  const propsObj: Record<string, unknown> = (block.props && typeof block.props === 'object' && !Array.isArray(block.props))
    ? (block.props as Record<string, unknown>)
    : {}

  if (block.type === 'layout') {
    const children = Array.isArray(propsObj.children) ? propsObj.children : []
    if (children.length === 0) return true
    return children.every((it) => {
      const child = asRecord(it)
      if (!child) return true
      if (typeof child.id !== 'string' || typeof child.type !== 'string') return true
      return isEmptyBlock(it as BlockNode)
    })
  }
  if (block.type === 'spacer') return true
  if (block.type === 'heading') return isEmptyText(propsObj.text)
  if (block.type === 'text') return isEmptyText(propsObj.text)
  if (block.type === 'divider') return isEmptyText(propsObj.text)
  if (block.type === 'footer') return isEmptyText(propsObj.text)
  if (block.type === 'embed') return isEmptyText(propsObj.url)
  if (block.type === 'image') return !propsObj.imageFile
  if (block.type === 'imageGallery') {
    const items = Array.isArray(propsObj.items) ? propsObj.items : []
    if (items.length === 0) return true
    return items.every((it) => {
      const item = asRecord(it)
      if (!item) return true
      const hasFile = Boolean(item.imageFile)
      const url = typeof item.url === 'string' ? item.url.trim() : ''
      return !hasFile && url.length === 0
    })
  }
  if (block.type === 'links' || block.type === 'buttons') {
    const items = Array.isArray(propsObj.items) ? propsObj.items : []
    const hasAny = items.some((it) => {
      const item = asRecord(it)
      const label = item?.label
      return typeof label === 'string' && label.trim().length > 0
    }) || items.some((it) => {
      const item = asRecord(it)
      const page = typeof item?.page === 'string' ? item.page.trim() : ''
      if (page.length > 0) return true
      const url = typeof item?.url === 'string' ? item.url.trim() : ''
      return url.length > 0 && url !== 'https://'
    })
    return !hasAny
  }
  if (block.type === 'button') {
    const label = typeof propsObj.label === 'string' ? propsObj.label.trim() : ''
    const page = typeof propsObj.page === 'string' ? propsObj.page.trim() : ''
    const url = typeof propsObj.url === 'string' ? propsObj.url.trim() : ''
    return label.length === 0 && page.length === 0 && (url.length === 0 || url === 'https://')
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
    const hasAny = items.some((it) => {
      const item = asRecord(it)
      const text = item?.text
      return typeof text === 'string' && text.trim().length > 0
    })
    return !hasAny
  }
  if (block.type === 'socialLinks') {
    const items = Array.isArray(propsObj.items) ? propsObj.items : []
    const hasAny = items.some((it) => {
      const item = asRecord(it)
      const url = typeof item?.url === 'string' ? item.url.trim() : ''
      return url.length > 0 && url !== 'https://'
    })
    return !hasAny
  }
  if (block.type === 'videoList') {
    const source = String(propsObj.source || 'manual')
    if (source === 'userIndex') return false
    const items = Array.isArray(propsObj.items) ? propsObj.items : []
    const hasAny = items.some((it) => {
      const item = asRecord(it)
      const url = typeof item?.url === 'string' ? item.url.trim() : ''
      return url.length > 0 && url !== 'https://'
    })
    return !hasAny
  }
  if (block.type === 'musicPlayer') {
    const url = typeof propsObj.url === 'string' ? propsObj.url.trim() : ''
    return url.length === 0
  }
  if (block.type === 'faq') {
    const items = Array.isArray(propsObj.items) ? propsObj.items : []
    const hasAny = items.some((it) => {
      const item = asRecord(it)
      const q = item?.q
      return typeof q === 'string' && q.trim().length > 0
    }) || items.some((it) => {
      const item = asRecord(it)
      const a = item?.a
      return typeof a === 'string' && a.trim().length > 0
    })
    return !hasAny
  }
  if (block.type === 'milestone') {
    const items = Array.isArray(propsObj.items) ? propsObj.items : []
    const hasAny = items.some((it) => {
      const item = asRecord(it)
      const date = item?.date
      return typeof date === 'string' && date.trim().length > 0
    }) || items.some((it) => {
      const item = asRecord(it)
      const title = item?.title
      return typeof title === 'string' && title.trim().length > 0
    }) || items.some((it) => {
      const item = asRecord(it)
      const description = item?.description
      return typeof description === 'string' && description.trim().length > 0
    })
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
    const hasAny = items.some((it) => {
      const item = asRecord(it)
      const url = typeof item?.url === 'string' ? item.url.trim() : ''
      return url.length > 0 && url !== 'https://'
    })
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
