import type { ComputedRef, InjectionKey } from 'vue'
import type { BlockNode, BlockVisibilityContext } from './schemaTypes'
import { isBlockVisible } from './visibility'

export interface PageSection {
  blockId: string
  anchorId: string
  text: string
  level: 1 | 2 | 3
}

export const PageSectionsKey: InjectionKey<ComputedRef<PageSection[]>> = Symbol('user-page-sections')

export function getHeadingAnchorId(blockId: string) {
  return `user-section-${blockId}`
}

export function collectPageSections(blocks: BlockNode[], context: BlockVisibilityContext): PageSection[] {
  const sections: PageSection[] = []

  function visit(nodes: BlockNode[]) {
    for (const block of nodes) {
      if (block.hidden || !isBlockVisible(block, context)) continue
      const props = block.props && typeof block.props === 'object' && !Array.isArray(block.props)
        ? block.props as Record<string, unknown>
        : {}

      if (block.type === 'heading') {
        const text = typeof props.text === 'string' ? props.text.trim() : ''
        const level = [1, 2, 3].includes(Number(props.level)) ? Number(props.level) as 1 | 2 | 3 : 2
        if (text) sections.push({ blockId: block.id, anchorId: getHeadingAnchorId(block.id), text, level })
      }

      if (block.type === 'layout' && Array.isArray(props.children)) visit(props.children as BlockNode[])
    }
  }

  visit(blocks)
  return sections
}
