import { toRaw } from 'vue'

import { isEmptyBlock } from '@/apps/user-page/block/emptyBlock'
import type { BlockNode, BlockPageProject } from '@/apps/user-page/block/schema'
import type { UserPagesSettings } from '@/apps/user-page/types'

export { isEmptyBlock }

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
  return JSON.parse(json)
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

export interface DiffOp {
  kind: 'same' | 'add' | 'del'
  text: string
}

export function stableStringify(v: unknown, indent = 2): string {
  const seen = new WeakSet<object>()
  const normalize = (x: unknown): unknown => {
    if (!x || typeof x !== 'object') return x
    if (Array.isArray(x)) return x.map(normalize)
    if (seen.has(x)) throw new Error('无法序列化循环引用对象')
    seen.add(x)
    const out: Record<string, unknown> = {}
    Object.keys(x)
      .toSorted()
      .forEach((k) => {
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
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
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

export function pruneHiddenEmptyBlocks(settingsToPrune: UserPagesSettings): number {
  let removed = 0
  const pruneProject = (p: BlockPageProject | undefined) => {
    if (!p) return
    const before = p.blocks.length
    p.blocks = p.blocks.filter((b) => !(b.hidden && isEmptyBlock(b)))
    removed += before - p.blocks.length
  }

  if (settingsToPrune.home?.mode === 'block') pruneProject(settingsToPrune.home.block)
  Object.values(settingsToPrune.pages ?? {}).forEach((cfg) => {
    if (cfg.mode === 'block') pruneProject(cfg.block)
  })
  return removed
}
