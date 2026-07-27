import type { BlockNode, BlockPageProject } from '@/apps/user-page/block/schema'

export interface BlockLocation {
  list: BlockNode[]
  index: number
  parentLayout: BlockNode | null
}

export function asBlockProps(value: unknown): Record<string, any> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, any>
}

export function getLayoutChildrenReadonly(layout: BlockNode): BlockNode[] | null {
  if (layout.type !== 'layout') return null
  const props = asBlockProps(layout.props)
  if (!props || !Array.isArray(props.children)) return null
  return props.children as BlockNode[]
}

export function blockContainsId(root: BlockNode, id: string): boolean {
  if (root.id === id) return true
  const children = getLayoutChildrenReadonly(root)
  return children?.some(child => blockContainsId(child, id)) ?? false
}

function findBlockLocationInList(list: BlockNode[], id: string, parentLayout: BlockNode | null): BlockLocation | null {
  for (let index = 0; index < list.length; index++) {
    const block = list[index]
    if (block.id === id) return { list, index, parentLayout }
    const children = getLayoutChildrenReadonly(block)
    if (!children) continue
    const location = findBlockLocationInList(children, id, block)
    if (location) return location
  }
  return null
}

export function findBlockLocation(project: BlockPageProject, id: string): BlockLocation | null {
  return findBlockLocationInList(project.blocks, id, null)
}

export function findBlockById(project: BlockPageProject, id: string): BlockNode | null {
  const location = findBlockLocation(project, id)
  return location?.list[location.index] ?? null
}

export function flattenBlocks(list: BlockNode[], output: BlockNode[] = []): BlockNode[] {
  for (const block of list) {
    output.push(block)
    const children = getLayoutChildrenReadonly(block)
    if (children) flattenBlocks(children, output)
  }
  return output
}
