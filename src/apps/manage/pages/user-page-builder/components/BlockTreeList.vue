<script setup lang="ts">
import {
  AlertCircleOutline,
  ChevronForwardOutline,
  EllipsisHorizontalOutline,
  EyeOffOutline,
  EyeOutline,
  LocateOutline,
  ReorderThreeOutline,
} from '@vicons/ionicons5'
import { computed, inject } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'

import { BLOCK_LIBRARY, getBlockLabel } from '@/apps/user-page/block/registry'
import type { BlockNode } from '@/apps/user-page/block/schema'
import { Button } from '@/shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

import { UserPageEditorKey } from '../context'

defineOptions({ name: 'BlockTreeList' })

const props = defineProps<{
  blocks: BlockNode[]
  depth: number
  groupName: string
  selectionSet: Set<string>
  invalidSet: Set<string>
  expandedLayoutIdSet: Set<string>
  dragGroupTargetId?: string | null
  dragGroupTargetMode?: 'into-layout' | 'wrap' | null
  dragInsertTargetId?: string | null
  dragInsertPosition?: 'before' | 'after' | null
  onRowClick: (id: string, ev: MouseEvent) => void
  onBlockAction: (key: string, blockId: string) => void
  onToggleExpanded: (layoutId: string) => void
  onDragStart: (evt: any) => void
  onDragEnd: (evt: any) => void
  onMove: (evt: any, originalEvent: any) => boolean
  blockActionOptions: any[]
}>()

const editor = inject(UserPageEditorKey)
if (!editor) throw new Error('UserPageEditor context is missing')

const indentWidth = computed(() => `${props.depth * 14}px`)
const blocksModel = computed({
  get() {
    return props.blocks
  },
  set(next: BlockNode[]) {
    props.blocks.splice(0, props.blocks.length, ...next)
  },
})

const iconMap = new Map(BLOCK_LIBRARY.map((it) => [it.type, it.icon]))
function getIcon(type: BlockNode['type']) {
  return iconMap.get(type)
}

function getLayoutChildrenModel(layout: BlockNode): BlockNode[] {
  if (layout.type !== 'layout') return []
  return editor.ensureLayoutProps(layout).children
}

function getDisplayTitle(b: BlockNode) {
  const name = typeof b.name === 'string' ? b.name.trim() : ''
  return name.length ? name : getBlockLabel(b.type)
}

function onExpandBeforeEnter(el: Element) {
  const e = el as HTMLElement
  e.style.height = '0px'
  e.style.opacity = '0'
  e.style.overflow = 'hidden'
}

function onExpandEnter(el: Element, done: () => void) {
  const e = el as HTMLElement
  e.style.overflow = 'hidden'
  e.style.transition = 'height 180ms ease, opacity 180ms ease'
  requestAnimationFrame(() => {
    e.style.height = `${e.scrollHeight}px`
    e.style.opacity = '1'
  })

  const timeout = window.setTimeout(() => {
    e.removeEventListener('transitionend', onEnd)
    done()
  }, 240)

  const onEnd = (ev: TransitionEvent) => {
    if (ev.target !== e) return
    if (ev.propertyName !== 'height') return
    window.clearTimeout(timeout)
    e.removeEventListener('transitionend', onEnd)
    done()
  }
  e.addEventListener('transitionend', onEnd)
}

function onExpandAfterEnter(el: Element) {
  const e = el as HTMLElement
  e.style.height = ''
  e.style.opacity = ''
  e.style.overflow = ''
  e.style.transition = ''
}

function onExpandBeforeLeave(el: Element) {
  const e = el as HTMLElement
  e.style.height = `${e.scrollHeight}px`
  e.style.opacity = '1'
  e.style.overflow = 'hidden'
}

function onExpandLeave(el: Element, done: () => void) {
  const e = el as HTMLElement
  e.style.overflow = 'hidden'
  e.style.transition = 'height 160ms ease, opacity 160ms ease'
  requestAnimationFrame(() => {
    e.style.height = '0px'
    e.style.opacity = '0'
  })

  const timeout = window.setTimeout(() => {
    e.removeEventListener('transitionend', onEnd)
    done()
  }, 220)

  const onEnd = (ev: TransitionEvent) => {
    if (ev.target !== e) return
    if (ev.propertyName !== 'height') return
    window.clearTimeout(timeout)
    e.removeEventListener('transitionend', onEnd)
    done()
  }
  e.addEventListener('transitionend', onEnd)
}

function onExpandAfterLeave(el: Element) {
  const e = el as HTMLElement
  e.style.height = ''
  e.style.opacity = ''
  e.style.overflow = ''
  e.style.transition = ''
}

function scrollToPreviewBlock(blockId: string) {
  const previewRoot = document.querySelector('.user-page-builder .preview-content') as HTMLElement | null
  if (!previewRoot) {
    editor.message.warning('预览未就绪，当前页可能不是区块模式')
    return
  }

  const el = previewRoot.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement | null
  if (!el) {
    editor.message.warning('预览中未找到对应区块，可能未渲染或已被隐藏')
    return
  }

  el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
}

function focusTreeItem(row: HTMLElement | undefined) {
  if (!row) return
  const tree = row.closest<HTMLElement>('[role="tree"]')
  tree?.querySelectorAll<HTMLElement>('[role="treeitem"]').forEach((item) => {
    item.tabIndex = -1
  })
  row.tabIndex = 0
  row.focus()
}

function handleTreeKeydown(event: KeyboardEvent, block: BlockNode) {
  const row = event.currentTarget as HTMLElement
  const tree = row.closest<HTMLElement>('[role="tree"]')
  const items = Array.from(tree?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? []).filter(
    (item) => item.getClientRects().length > 0,
  )
  const index = items.indexOf(row)
  if (event.key === 'ArrowDown') focusTreeItem(items[index + 1])
  else if (event.key === 'ArrowUp') focusTreeItem(items[index - 1])
  else if (event.key === 'Home') focusTreeItem(items[0])
  else if (event.key === 'End') focusTreeItem(items.at(-1))
  else if (event.key === 'ArrowRight' && block.type === 'layout' && !props.expandedLayoutIdSet.has(block.id))
    props.onToggleExpanded(block.id)
  else if (event.key === 'ArrowLeft' && block.type === 'layout' && props.expandedLayoutIdSet.has(block.id))
    props.onToggleExpanded(block.id)
  else if (event.key === 'ArrowLeft') {
    const parent = row.closest('.children')?.parentElement?.querySelector<HTMLElement>(':scope > [role="treeitem"]')
    focusTreeItem(parent)
  } else if (event.key === 'Enter' || event.key === ' ') {
    props.onRowClick(block.id, event as unknown as MouseEvent)
  } else return
  event.preventDefault()
  event.stopPropagation()
}
</script>

<template>
  <VueDraggable
    v-model="blocksModel"
    handle=".drag-handle"
    :group="{ name: props.groupName, pull: true, put: true }"
    :animation="160"
    :invert-swap="true"
    :inverted-swap-threshold="0.35"
    ghost-class="drag-ghost"
    :on-move="props.onMove"
    :role="props.depth === 0 ? 'tree' : 'group'"
    :aria-label="props.depth === 0 ? '页面区块' : undefined"
    @start="props.onDragStart"
    @end="props.onDragEnd"
  >
    <div
      v-for="b in blocksModel"
      :key="b.id"
      :data-block-id="b.id"
    >
      <div
        class="block-item-row"
        :class="{
          active: props.selectionSet.has(b.id),
          invalid: props.invalidSet.has(b.id),
          hidden: b.hidden,
          'is-layout': b.type === 'layout',
          'drag-group-target': props.dragGroupTargetId === b.id,
          'drag-group-target-wrap': props.dragGroupTargetId === b.id && props.dragGroupTargetMode === 'wrap',
          'drag-insert-before': props.dragInsertTargetId === b.id && props.dragInsertPosition === 'before',
          'drag-insert-after': props.dragInsertTargetId === b.id && props.dragInsertPosition === 'after',
        }"
        role="treeitem"
        :aria-level="props.depth + 1"
        :aria-selected="props.selectionSet.has(b.id)"
        :aria-expanded="b.type === 'layout' ? props.expandedLayoutIdSet.has(b.id) : undefined"
        :tabindex="
          editor.selectedBlockIds.value[0] === b.id ||
          (!editor.selectedBlockIds.value.length && props.depth === 0 && blocksModel[0]?.id === b.id)
            ? 0
            : -1
        "
        @click="props.onRowClick(b.id, $event)"
        @keydown="handleTreeKeydown($event, b)"
        @mouseenter="editor.hoveredBlockId.value = b.id"
        @mouseleave="editor.hoveredBlockId.value === b.id && (editor.hoveredBlockId.value = null)"
      >
        <div
          class="indent"
          :style="{ width: indentWidth }"
        />

        <component
          :is="ChevronForwardOutline"
          v-if="b.type === 'layout'"
          class="expand-toggle size-4 cursor-pointer text-muted-foreground transition-transform"
          :class="{ 'rotate-90': props.expandedLayoutIdSet.has(b.id) }"
          title="折叠/展开"
          @click.stop="props.onToggleExpanded(b.id)"
        />
        <div
          v-else
          class="expand-placeholder w-4 h-4 shrink-0"
        />

        <component
          :is="ReorderThreeOutline"
          class="drag-handle size-4.5 cursor-grab text-muted-foreground shrink-0"
          title="拖拽排序"
        />

        <component
          :is="getIcon(b.type)!"
          v-if="getIcon(b.type)"
          class="type-icon size-4 shrink-0 text-muted-foreground"
        />
        <div
          v-else
          class="type-icon-placeholder w-4 h-4 shrink-0"
        />

        <div class="block-label flex-1 min-w-0 flex items-center">
          <span class="truncate-text text-xs">
            {{ getDisplayTitle(b) }}
          </span>
          <span
            v-if="b.name && b.name.trim().length"
            class="type-hint text-[11px] text-muted-foreground ml-2 truncate"
          >
            {{ getBlockLabel(b.type) }}
          </span>
          <span
            v-if="b.type === 'layout'"
            class="text-[11px] text-muted-foreground ml-1.5"
          >
            ({{ getLayoutChildrenModel(b).length }})
          </span>
        </div>

        <Transition name="fade-scale">
          <span
            v-if="props.dragGroupTargetId === b.id"
            class="drag-group-hint text-xs text-primary border border-primary px-1.5 rounded-full"
          >
            {{ props.dragGroupTargetMode === 'into-layout' ? '松开加入组' : '松开成组' }}
          </span>
        </Transition>

        <component
          :is="AlertCircleOutline"
          v-if="props.invalidSet.has(b.id)"
          class="size-4 text-destructive shrink-0"
          title="该区块配置有误"
        />

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="sm"
                class="size-6 p-0"
                :aria-label="b.hidden ? '显示区块' : '隐藏区块'"
                @click.stop="b.hidden = !b.hidden"
              >
                <component :is="b.hidden ? EyeOffOutline : EyeOutline" class="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ b.hidden ? '显示区块' : '隐藏区块' }}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="sm"
                class="size-6 p-0"
                aria-label="在预览中定位"
                @click.stop="scrollToPreviewBlock(b.id)"
              >
                <component :is="LocateOutline" class="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>在预览中定位</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button
              variant="ghost"
              size="sm"
              class="size-6 p-0"
              aria-label="更多区块操作"
              @click.stop
            >
              <component :is="EllipsisHorizontalOutline" class="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-44 text-xs">
            <template v-for="item in props.blockActionOptions" :key="item.key">
              <DropdownMenuSeparator v-if="item.type === 'divider'" />
              <DropdownMenuItem
                v-else
                :disabled="item.disabled"
                :class="item.key === 'delete' ? 'text-destructive focus:text-destructive' : ''"
                @click="props.onBlockAction(String(item.key), b.id)"
              >
                <component :is="item.icon" v-if="item.icon" class="mr-2" />
                {{ item.label }}
              </DropdownMenuItem>
            </template>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Transition
        @before-enter="onExpandBeforeEnter"
        @enter="onExpandEnter"
        @after-enter="onExpandAfterEnter"
        @before-leave="onExpandBeforeLeave"
        @leave="onExpandLeave"
        @after-leave="onExpandAfterLeave"
      >
        <div
          v-if="b.type === 'layout' && props.expandedLayoutIdSet.has(b.id)"
          class="children"
        >
          <BlockTreeList
            :blocks="getLayoutChildrenModel(b)"
            :depth="props.depth + 1"
            :group-name="props.groupName"
            :selection-set="props.selectionSet"
            :invalid-set="props.invalidSet"
            :expanded-layout-id-set="props.expandedLayoutIdSet"
            :drag-group-target-id="props.dragGroupTargetId"
            :drag-group-target-mode="props.dragGroupTargetMode"
            :drag-insert-target-id="props.dragInsertTargetId"
            :drag-insert-position="props.dragInsertPosition"
            :on-row-click="props.onRowClick"
            :on-block-action="props.onBlockAction"
            :on-toggle-expanded="props.onToggleExpanded"
            :on-drag-start="props.onDragStart"
            :on-drag-end="props.onDragEnd"
            :on-move="props.onMove"
            :block-action-options="props.blockActionOptions"
          />
        </div>
      </Transition>
    </div>
  </VueDraggable>
</template>

<style scoped src="./ui-transitions.css"></style>

<style scoped>
.truncate-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.block-item-row {
  position: relative;
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 6px 8px;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
  user-select: none;
  transition:
    background-color 140ms ease,
    border-color 140ms ease,
    box-shadow 140ms ease,
    transform 140ms ease;
}

.block-item-row.is-layout {
  box-shadow: inset 3px 0 0 var(--primary);
}

.block-item-row:hover {
  background: var(--muted);
}

.block-item-row.active {
  border-color: var(--border);
  background: var(--muted);
}

.block-item-row.drag-group-target {
  border-color: var(--primary);
  background: var(--muted);
  box-shadow: 0 0 0 1px var(--primary);
}

.block-item-row.drag-group-target-wrap {
  border-style: dashed;
}

.block-item-row.drag-insert-before::before,
.block-item-row.drag-insert-after::after {
  content: '';
  position: absolute;
  right: 6px;
  left: 6px;
  z-index: 3;
  height: 2px;
  border-radius: 2px;
  background: var(--primary);
}

.block-item-row.drag-insert-before::before {
  top: -2px;
}

.block-item-row.drag-insert-after::after {
  bottom: -2px;
}

.drag-group-hint {
  margin-right: 6px;
  flex: 0 0 auto;
}

.block-item-row.invalid,
.block-item-row.active.invalid {
  border-color: var(--destructive);
}

.block-item-row.hidden .block-label {
  opacity: 0.6;
  text-decoration: line-through;
}

.indent {
  flex: 0 0 auto;
}

.expand-placeholder {
  flex: 0 0 auto;
}

.type-icon,
.type-icon-placeholder {
  flex: 0 0 auto;
}

.drag-handle {
  cursor: grab;
}

.drag-handle:active {
  cursor: grabbing;
}

.children {
  margin-left: 0;
}

.drag-ghost {
  opacity: 0.45;
}

.sortable-chosen {
  opacity: 0.9;
  background: var(--muted);
}

.sortable-drag {
  opacity: 0;
}
</style>
