import type { UserPageConfig, UserPagesSettingsV1 } from './types'
import type { BlockNode, BlockPageProject } from './block/schema'

function asObject(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== 'object') return null
  if (Array.isArray(v)) return null
  return v as Record<string, unknown>
}

function normalizeBlockNodesInPlace(blocks: unknown) {
  if (!Array.isArray(blocks)) return

  blocks.forEach((b) => {
    const blockObj = asObject(b) as unknown as BlockNode | null
    if (!blockObj) return

    if (blockObj.type === 'layout') {
      const propsObj = asObject(blockObj.props)
      if (!propsObj) return
      normalizeBlockNodesInPlace(propsObj.children)
      return
    }

    if (blockObj.type === 'countdown') {
      const propsObj = asObject(blockObj.props)
      if (!propsObj) return
      const target = propsObj.target

      if (typeof target === 'number' && Number.isFinite(target)) {
        try {
          // Historical data may store seconds (10-digit unix timestamp) instead of ms.
          const ms = target > 0 && target < 1_000_000_000_000 ? target * 1000 : target
          propsObj.target = new Date(ms).toISOString()
        } catch {
          // keep original value and let validation surface the problem
        }
      } else if (target instanceof Date) {
        try {
          propsObj.target = target.toISOString()
        } catch {
          // keep original value and let validation surface the problem
        }
      }
    }
  })
}

function normalizeBlockProjectInPlace(project: BlockPageProject | undefined) {
  if (!project) return
  normalizeBlockNodesInPlace(project.blocks)
}

function normalizePageInPlace(cfg: UserPageConfig | undefined) {
  if (!cfg) return
  if (cfg.mode !== 'block') return
  normalizeBlockProjectInPlace(cfg.block)
}

export function normalizeUserPagesSettingsV1InPlace(settings: UserPagesSettingsV1) {
  normalizePageInPlace(settings.home)
  Object.values(settings.pages ?? {}).forEach((cfg) => normalizePageInPlace(cfg))
}
