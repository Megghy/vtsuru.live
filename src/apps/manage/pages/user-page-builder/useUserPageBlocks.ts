import type { BlockNode, BlockPageProject, BlockType } from '@/features/user-page/block/schema'
import { createBlockNode } from '@/features/user-page/block/registry'
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
    return p.blocks.filter(b => set.has(b.id))
  })

  const selectedBlock = computed<BlockNode | null>(() => {
    const blocks = selectedBlocks.value
    return blocks.length === 1 ? blocks[0] : null
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
    const idx = p.blocks.findIndex(b => b.id === blockId)
    if (idx < 0) return
    const next = idx + dir
    if (next < 0 || next >= p.blocks.length) return
    opts.history.batch(() => {
      ;[p.blocks[idx], p.blocks[next]] = [p.blocks[next], p.blocks[idx]]
    })
  }

  function duplicateBlockAt(blockId: string, dir: -1 | 1) {
    const p = opts.currentProject.value
    if (!p) return
    const idx = p.blocks.findIndex(b => b.id === blockId)
    if (idx < 0) return
    opts.history.batch(() => {
      const copied = cloneBlockNode(p.blocks[idx])
      const insertAt = dir === -1 ? idx : idx + 1
      p.blocks.splice(insertAt, 0, copied)
      opts.selectedBlockIds.value = [copied.id]
    })
  }

  function removeBlock(blockId: string) {
    const p = opts.currentProject.value
    if (!p) return
    opts.history.batch(() => {
      p.blocks = p.blocks.filter(b => b.id !== blockId)
      opts.selectedBlockIds.value = opts.selectedBlockIds.value.filter(id => id !== blockId)
    })
  }

  function setBlocksHidden(blockIds: string[], hidden: boolean) {
    const p = opts.currentProject.value
    if (!p) return
    if (!blockIds.length) return
    const set = new Set(blockIds)
    opts.history.batch(() => {
      p.blocks.forEach((b) => {
        if (set.has(b.id)) b.hidden = hidden
      })
    })
  }

  function removeBlocks(blockIds: string[]) {
    const p = opts.currentProject.value
    if (!p) return
    if (!blockIds.length) return
    const set = new Set(blockIds)
    opts.history.batch(() => {
      p.blocks = p.blocks.filter(b => !set.has(b.id))
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
    const blocks = p.blocks.filter(b => set.has(b.id)).map(b => deepCloneJson(b))
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
      const idx = afterBlockId ? p.blocks.findIndex(b => b.id === afterBlockId) : -1
      const insertAt = idx >= 0 ? idx + 1 : p.blocks.length
      p.blocks.splice(insertAt, 0, ...copied)
      opts.selectedBlockIds.value = copied.map(b => b.id)
    })
    opts.notify.success(`已粘贴 ${blocks.length} 个区块`)
  }

  return {
    selectedBlocks,
    selectedBlock,
    clearSelection,

    ensurePropsObject,
    ensureItems,
    ensureRichTextProps,
    ensureImageGalleryProps,

    addBlock,
    moveBlock,
    duplicateBlockAt,
    removeBlock,
    setBlocksHidden,
    removeBlocks,

    getClipboardBlocksCount,
    copyBlocksToClipboard,
    pasteBlocksAfter,
  }
}
