import type { BlockNode, BlockPageProject, BlockType } from '@/apps/user-page/block/schema'
import { createBlockNode } from '@/apps/user-page/block/registry'
import { cloneBlockNode, createId, deepCloneJson } from './editorHelpers'
import type { ComputedRef, Ref } from 'vue'
import { computed } from 'vue'
import { useStorage } from '@vueuse/core'
import { USER_PAGE_BLOCK_CLIPBOARD_KEY } from './storageKeys'

export interface UseUserPageBlocksOptions {
  currentProject: ComputedRef<BlockPageProject | null>
  selectedBlockIds: Ref<string[]>
  history: { batch: (fn: () => void) => void }
  notify: {
    success: (content: string) => void
    warning: (content: string) => void
  }
}

function asObject(v: unknown): Record<string, any> | null {
  if (!v || typeof v !== 'object' || v === null || Array.isArray(v)) return null
  return v as Record<string, any>
}

function getLayoutChildrenReadonly(layout: BlockNode): BlockNode[] | null {
  if (layout.type !== 'layout') return null
  const propsObj = asObject(layout.props)
  if (!propsObj) return null
  return Array.isArray(propsObj.children) ? (propsObj.children as BlockNode[]) : null
}

function blockContainsId(root: BlockNode, id: string): boolean {
  if (root.id === id) return true
  if (root.type !== 'layout') return false
  const children = getLayoutChildrenReadonly(root)
  if (!children) return false
  return children.some(it => blockContainsId(it, id))
}

interface BlockLocation {
  list: BlockNode[]
  index: number
  parentLayout: BlockNode | null
}

function findBlockLocationInList(list: BlockNode[], id: string, parentLayout: BlockNode | null): BlockLocation | null {
  for (let i = 0; i < list.length; i++) {
    const b = list[i]
    if (b.id === id) return { list, index: i, parentLayout }
    if (b.type !== 'layout') continue
    const children = getLayoutChildrenReadonly(b)
    if (!children) continue
    const found = findBlockLocationInList(children, id, b)
    if (found) return found
  }
  return null
}

function findBlockLocation(project: BlockPageProject, id: string): BlockLocation | null {
  return findBlockLocationInList(project.blocks, id, null)
}

function findBlockById(project: BlockPageProject, id: string): BlockNode | null {
  const loc = findBlockLocation(project, id)
  if (!loc) return null
  return loc.list[loc.index] ?? null
}

function flattenBlocks(list: BlockNode[], out: BlockNode[] = []): BlockNode[] {
  for (const b of list) {
    out.push(b)
    if (b.type !== 'layout') continue
    const children = getLayoutChildrenReadonly(b)
    if (!children) continue
    flattenBlocks(children, out)
  }
  return out
}

export function useUserPageBlocks(opts: UseUserPageBlocksOptions) {
  const clipboardBlocks = useStorage<BlockNode[]>(
    USER_PAGE_BLOCK_CLIPBOARD_KEY,
    [],
    typeof window === 'undefined' ? undefined : window.localStorage,
    { writeDefaults: false },
  )

  const selectedBlocks = computed<BlockNode[]>(() => {
    const p = opts.currentProject.value
    if (!p) return []
    if (!opts.selectedBlockIds.value.length) return []
    const set = new Set(opts.selectedBlockIds.value)
    return flattenBlocks(p.blocks).filter(b => set.has(b.id))
  })

  const selectedBlock = computed<BlockNode | null>(() => {
    const p = opts.currentProject.value
    if (!p) return null
    if (opts.selectedBlockIds.value.length !== 1) return null
    return findBlockById(p, opts.selectedBlockIds.value[0]) ?? null
  })

  function clearSelection() {
    opts.selectedBlockIds.value = []
  }

  function ensurePropsObject(block: BlockNode) {
    const v = block.props
    if (!v || typeof v !== 'object' || Array.isArray(v)) {
      block.props = {}
    }
    return block.props as Record<string, any>
  }

  function ensureItems(block: BlockNode) {
    const propsObj = ensurePropsObject(block)
    if (!Array.isArray(propsObj.items)) propsObj.items = []
    return propsObj.items as Array<{ label: string, url: string }>
  }

  function ensureRichTextProps(block: BlockNode) {
    const propsObj = ensurePropsObject(block)
    if (typeof propsObj.html !== 'string') propsObj.html = ''
    if (!Array.isArray(propsObj.imagesFile)) propsObj.imagesFile = []
    return propsObj
  }

  function ensureImageGalleryProps(block: BlockNode) {
    const propsObj = ensurePropsObject(block)
    if (!['grid', 'masonry', 'carousel'].includes(String(propsObj.layout))) propsObj.layout = 'grid'
    if (!Number.isInteger(propsObj.columns) || propsObj.columns < 1 || propsObj.columns > 12) propsObj.columns = 3
    if (!Number.isFinite(propsObj.gap) || propsObj.gap < 0 || propsObj.gap > 80) propsObj.gap = 12
    if (typeof propsObj.maxWidth !== 'string') propsObj.maxWidth = ''
    if (typeof propsObj.maxHeight !== 'string') propsObj.maxHeight = ''
    if (!['cover', 'contain'].includes(String(propsObj.fit))) propsObj.fit = 'cover'
    if (propsObj.autoplay !== undefined && typeof propsObj.autoplay !== 'boolean') propsObj.autoplay = false
    if (!Number.isFinite(propsObj.interval) || propsObj.interval < 1000 || propsObj.interval > 20000) propsObj.interval = 5000
    if (propsObj.intervalMs !== undefined && propsObj.interval === 5000) {
      const v = Number(propsObj.intervalMs)
      if (Number.isFinite(v) && v >= 1000 && v <= 20000) propsObj.interval = v
      delete propsObj.intervalMs
    }
    if (!['slide', 'fade', 'card', 'custom'].includes(String(propsObj.effect))) propsObj.effect = 'slide'
    if (!['dot', 'line'].includes(String(propsObj.dotType))) propsObj.dotType = 'line'
    if (!['top', 'bottom', 'left', 'right'].includes(String(propsObj.dotPlacement))) propsObj.dotPlacement = 'bottom'
    if (propsObj.showArrow !== undefined && typeof propsObj.showArrow !== 'boolean') propsObj.showArrow = true
    if (propsObj.showDots !== undefined && typeof propsObj.showDots !== 'boolean') propsObj.showDots = true
    if (propsObj.loop !== undefined && typeof propsObj.loop !== 'boolean') propsObj.loop = true
    if (propsObj.draggable !== undefined && typeof propsObj.draggable !== 'boolean') propsObj.draggable = true
    if (propsObj.touchable !== undefined && typeof propsObj.touchable !== 'boolean') propsObj.touchable = true
    if (!['click', 'hover'].includes(String(propsObj.trigger))) propsObj.trigger = 'click'
    if (!Array.isArray(propsObj.items)) propsObj.items = []
    return propsObj
  }

  function ensureLayoutProps(block: BlockNode) {
    const propsObj = ensurePropsObject(block)
    if (propsObj.layout !== 'row' && propsObj.layout !== 'column' && propsObj.layout !== 'grid') propsObj.layout = 'row'
    if (typeof propsObj.wrap !== 'boolean') propsObj.wrap = true
    if (typeof propsObj.gap !== 'number' || !Number.isFinite(propsObj.gap) || propsObj.gap < 0) propsObj.gap = 12
    if (typeof propsObj.columns !== 'number' || !Number.isFinite(propsObj.columns) || !Number.isInteger(propsObj.columns) || propsObj.columns < 1) propsObj.columns = 2
    if (typeof propsObj.maxWidth !== 'string') propsObj.maxWidth = ''
    if (!['start', 'center', 'end', 'between', 'around', 'evenly'].includes(String(propsObj.justify))) propsObj.justify = 'start'
    if (!['start', 'center', 'end', 'stretch'].includes(String(propsObj.align))) propsObj.align = 'stretch'
    if (!Array.isArray(propsObj.children)) propsObj.children = []
    return propsObj as {
      layout: 'row' | 'column' | 'grid'
      wrap: boolean
      gap: number
      columns: number
      maxWidth: string
      justify: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'
      align: 'start' | 'center' | 'end' | 'stretch'
      children: BlockNode[]
    }
  }

  function pruneEmptyLayouts(project: BlockPageProject) {
    const prune = (list: BlockNode[]): BlockNode[] => {
      const out: BlockNode[] = []
      for (const b of list) {
        if (b.type === 'layout') {
          const propsObj = asObject(b.props)
          if (propsObj && Array.isArray(propsObj.children)) {
            propsObj.children = prune(propsObj.children as BlockNode[])
            if (propsObj.children.length === 0) continue
          }
        }
        out.push(b)
      }
      return out
    }
    project.blocks = prune(project.blocks)
  }

  function addBlock(type: BlockType) {
    const p = opts.currentProject.value
    if (!p) return
    opts.history.batch(() => {
      const block = createBlockNode(type, createId())
      p.blocks.push(block)
      opts.selectedBlockIds.value = [block.id]
    })
  }

  function moveBlock(blockId: string, dir: -1 | 1) {
    const p = opts.currentProject.value
    if (!p) return
    const loc = findBlockLocation(p, blockId)
    if (!loc) return
    const next = loc.index + dir
    if (next < 0 || next >= loc.list.length) return
    opts.history.batch(() => {
      ;[loc.list[loc.index], loc.list[next]] = [loc.list[next], loc.list[loc.index]]
    })
  }

  function duplicateBlockAt(blockId: string, dir: -1 | 1) {
    const p = opts.currentProject.value
    if (!p) return
    const loc = findBlockLocation(p, blockId)
    if (!loc) return
    opts.history.batch(() => {
      const copied = cloneBlockNode(loc.list[loc.index])
      const insertAt = dir === -1 ? loc.index : loc.index + 1
      loc.list.splice(insertAt, 0, copied)
      opts.selectedBlockIds.value = [copied.id]
    })
  }

  function removeBlock(blockId: string) {
    const p = opts.currentProject.value
    if (!p) return
    opts.history.batch(() => {
      const loc = findBlockLocation(p, blockId)
      if (loc) loc.list.splice(loc.index, 1)
      opts.selectedBlockIds.value = opts.selectedBlockIds.value.filter(id => id !== blockId)
    })
  }

  function setBlocksHidden(blockIds: string[], hidden: boolean) {
    const p = opts.currentProject.value
    if (!p) return
    if (!blockIds.length) return
    const set = new Set(blockIds)
    opts.history.batch(() => {
      const visit = (list: BlockNode[]) => {
        list.forEach((b) => {
          if (set.has(b.id)) b.hidden = hidden
          if (b.type === 'layout') {
            const children = getLayoutChildrenReadonly(b)
            if (children) visit(children)
          }
        })
      }
      visit(p.blocks)
    })
  }

  function removeBlocks(blockIds: string[]) {
    const p = opts.currentProject.value
    if (!p) return
    if (!blockIds.length) return
    const set = new Set(blockIds)
    opts.history.batch(() => {
      const prune = (list: BlockNode[]): BlockNode[] => {
        const out: BlockNode[] = []
        for (const b of list) {
          if (set.has(b.id)) continue
          if (b.type === 'layout') {
            const propsObj = asObject(b.props)
            if (propsObj && Array.isArray(propsObj.children)) {
              const children = prune(propsObj.children as BlockNode[])
              // 如果 layout 变空了，我们也可以选择移除它
              if (children.length === 0) continue
              propsObj.children = children
            }
          }
          out.push(b)
        }
        return out
      }
      p.blocks = prune(p.blocks)
      opts.selectedBlockIds.value = opts.selectedBlockIds.value.filter(id => !set.has(id))
    })
  }

  function getClipboardBlocksCount() {
    return clipboardBlocks.value.length
  }

  function copyBlocksToClipboard(blockIds: string[]) {
    const p = opts.currentProject.value
    if (!p) return
    if (!blockIds.length) return
    const set = new Set(blockIds)
    const blocks: BlockNode[] = []
    const visit = (list: BlockNode[], ancestorSelected: boolean) => {
      list.forEach((b) => {
        const isSelected = set.has(b.id)
        if (ancestorSelected) return
        if (isSelected) {
          blocks.push(deepCloneJson(b))
          return
        }
        if (b.type === 'layout') {
          const children = getLayoutChildrenReadonly(b)
          if (children) visit(children, false)
        }
      })
    }
    visit(p.blocks, false)
    clipboardBlocks.value = blocks
    opts.notify.success(`已复制 ${blocks.length} 个区块`)
  }

  function pasteBlocksAfter(afterBlockId: string | null) {
    const p = opts.currentProject.value
    if (!p) return
    const blocks = clipboardBlocks.value
    if (!blocks.length) {
      opts.notify.warning('剪贴板为空')
      return
    }

    opts.history.batch(() => {
      const copied = blocks.map(cloneBlockNode)
      const loc = afterBlockId ? findBlockLocation(p, afterBlockId) : null
      const list = loc ? loc.list : p.blocks
      const insertAt = loc ? loc.index + 1 : list.length
      list.splice(insertAt, 0, ...copied)
      opts.selectedBlockIds.value = copied.map(b => b.id)
    })
    opts.notify.success(`已粘贴 ${blocks.length} 个区块`)
  }

  function getBlockById(blockId: string): BlockNode | null {
    const p = opts.currentProject.value
    if (!p) return null
    return findBlockById(p, blockId)
  }

  function setBlockName(blockId: string, name: string | null) {
    const p = opts.currentProject.value
    if (!p) return
    const block = findBlockById(p, blockId)
    if (!block) return
    const next = name === null ? '' : name
    const trimmed = next.trim()
    if (trimmed.length > 50) {
      opts.notify.warning('区块名称不能超过 50 字符')
      return
    }
    opts.history.batch(() => {
      if (!trimmed.length) delete (block as any).name
      else block.name = trimmed
    })
  }

  function moveBlockIntoLayout(layoutId: string, blockId: string) {
    const p = opts.currentProject.value
    if (!p) return
    if (layoutId === blockId) return
    const layout = findBlockById(p, layoutId)
    if (!layout || layout.type !== 'layout') return

    // 检查是否有多个选中的区块要一起移入
    const selectedIds = opts.selectedBlockIds.value
    const idsToMove = selectedIds.includes(blockId) ? selectedIds : [blockId]

    // 检查嵌套深度限制
    const getDepth = (id: string): number => {
      const loc = findBlockLocation(p, id)
      if (!loc || !loc.parentLayout) return 0
      return 1 + getDepth(loc.parentLayout.id)
    }
    if (getDepth(layoutId) >= 16) {
      opts.notify.warning('达到最大嵌套深度')
      return
    }

    const layoutProps = ensureLayoutProps(layout)

    opts.history.batch(() => {
      const movedNodes: BlockNode[] = []
      for (const id of idsToMove) {
        if (id === layoutId) continue
        const dragged = findBlockById(p, id)
        if (!dragged || blockContainsId(dragged, layoutId)) continue

        const loc = findBlockLocation(p, id)
        if (!loc) continue
        if (loc.parentLayout?.id === layoutId) continue

        const [removed] = loc.list.splice(loc.index, 1)
        movedNodes.push(removed)
      }

      if (movedNodes.length > 0) {
        layoutProps.children.push(...movedNodes)
        opts.selectedBlockIds.value = movedNodes.map(n => n.id)
      }

      // 自动清理变空的父容器
      pruneEmptyLayouts(p)
    })
  }

  function groupBlocksIntoLayout(blockId: string, targetId: string) {
    const p = opts.currentProject.value
    if (!p) return
    if (blockId === targetId) return

    const target = findBlockById(p, targetId)
    if (!target) return

    // 如果目标已经是 layout，直接移入
    if (target.type === 'layout') {
      moveBlockIntoLayout(targetId, blockId)
      return
    }

    // 检查是否有多个选中的区块要一起成组
    const selectedIds = opts.selectedBlockIds.value
    const idsToGroup = selectedIds.includes(blockId) ? selectedIds : [blockId]

    // 过滤掉包含 targetId 的区块 (防止自包含)
    const validIdsToGroup = idsToGroup.filter((id) => {
      const b = findBlockById(p, id)
      return b && !blockContainsId(b, targetId)
    })

    if (validIdsToGroup.length === 0) return

    const locB = findBlockLocation(p, targetId)
    if (!locB) return

    opts.history.batch(() => {
      // 1. 创建新分组
      const group = createBlockNode('layout', createId())
      const groupProps = ensureLayoutProps(group)
      groupProps.layout = 'column'

      // 2. 用 group 替换 target（避免索引偏移问题）
      const targetBlock = locB.list[locB.index]
      locB.list[locB.index] = group
      groupProps.children.push(targetBlock)

      // 3. 移除其他区块并加入 group
      for (const id of validIdsToGroup) {
        if (id === targetId) continue
        const loc = findBlockLocation(p, id)
        if (!loc) continue
        const [node] = loc.list.splice(loc.index, 1)
        groupProps.children.push(node)
      }

      opts.selectedBlockIds.value = [group.id]

      // 自动清理变空的父容器
      pruneEmptyLayouts(p)
    })
  }

  function ungroupLayout(layoutId: string) {
    const p = opts.currentProject.value
    if (!p) return
    const loc = findBlockLocation(p, layoutId)
    if (!loc) return
    const layout = loc.list[loc.index]
    if (layout.type !== 'layout') return

    const children = getLayoutChildrenReadonly(layout) ?? []
    opts.history.batch(() => {
      // 移除 layout 本身，并在其位置插入所有子元素
      loc.list.splice(loc.index, 1, ...children)
      opts.selectedBlockIds.value = children.map(c => c.id)
    })
  }

  return {
    selectedBlocks,
    selectedBlock,
    clearSelection,

    ensurePropsObject,
    ensureItems,
    ensureRichTextProps,
    ensureImageGalleryProps,
    ensureLayoutProps,

    addBlock,
    moveBlock,
    duplicateBlockAt,
    removeBlock,
    setBlocksHidden,
    removeBlocks,

    getClipboardBlocksCount,
    copyBlocksToClipboard,
    pasteBlocksAfter,
    moveBlockIntoLayout,
    groupBlocksIntoLayout,
    ungroupLayout,

    getBlockById,
    setBlockName,
  }
}
