import type { BlockNode, BlockPageProject } from '@/apps/user-page/block/schema'
import { validateBlockPageProject } from '@/apps/user-page/block/schema'
import { toRaw } from 'vue'
import { getLayoutChildrenReadonly } from '../userPageBlockTree'

function resolveBlockId(blocks: BlockNode[], path: number[]) {
  let list = blocks
  let block: BlockNode | undefined
  for (const [depth, index] of path.entries()) {
    block = list[index]
    if (!block) return null
    if (depth === path.length - 1) return block.id
    const children = getLayoutChildrenReadonly(block)
    if (!children) return null
    list = children
  }
  return null
}

function parseBlockPath(error: string) {
  const root = /blocks\[(\d+)\]/.exec(error)
  if (!root) return null
  return [Number(root[1]), ...Array.from(error.matchAll(/\.children\[(\d+)\]/g), match => Number(match[1]))]
}

export function collectInvalidBlockIds(project: BlockPageProject | null) {
  if (!project) return new Set<string>()
  const rawProject = toRaw(project)
  const validation = validateBlockPageProject(rawProject)
  if (validation.ok) return new Set<string>()

  const ids = new Set<string>()
  for (const error of validation.errors) {
    const path = parseBlockPath(error)
    if (!path) continue
    const id = resolveBlockId(rawProject.blocks, path)
    if (id) ids.add(id)
  }
  return ids
}
