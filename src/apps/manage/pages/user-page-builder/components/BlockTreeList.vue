<script setup lang="ts">
import {
  AlertCircle,
  ChevronRight,
  Crosshair,
  Eye,
  EyeOff,
  GripVertical,
  MoreHorizontal,
} from 'lucide-vue-next'
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

const indentWidth = computed(() => `${props.depth * 12}px`)
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
        class="group block-item-row relative flex gap-1 items-center py-1.5 px-1.5 rounded-md border border-transparent cursor-pointer select-none transition-colors duration-150 hover:bg-muted"
        :class="{
          'border-border bg-muted': props.selectionSet.has(b.id),
          'border-destructive': props.invalidSet.has(b.id),
          '[&_.block-label]:opacity-60 [&_.block-label]:line-through': b.hidden,
          'shadow-[inset_3px_0_0_var(--primary)]': b.type === 'layout',
          'border-primary bg-muted shadow-[0_0_0_1px_var(--primary)]': props.dragGroupTargetId === b.id,
          'border-dashed': props.dragGroupTargetId === b.id && props.dragGroupTargetMode === 'wrap',
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
          v-if="props.depth > 0"
          class="shrink-0"
          :style="{ width: indentWidth }"
        />

        <ChevronRight
          v-if="b.type === 'layout'"
          class="expand-toggle size-3.5 cursor-pointer text-muted-foreground transition-transform duration-150 shrink-0"
          :class="{ 'rotate-90': props.expandedLayoutIdSet.has(b.id) }"
          title="折叠/展开"
          @click.stop="props.onToggleExpanded(b.id)"
        />
        <GripVertical
          class="drag-handle size-3.5 cursor-grab active:cursor-grabbing text-muted-foreground/60 hover:text-foreground shrink-0"
          title="拖拽排序"
        />

        <component
          :is="getIcon(b.type)!"
          v-if="getIcon(b.type)"
          class="type-icon size-3.5 shrink-0 text-muted-foreground"
        />

        <div class="block-label flex-1 min-w-0 flex items-center gap-1">
          <span
            class="overflow-hidden text-ellipsis whitespace-nowrap text-xs font-medium"
            :title="getDisplayTitle(b)"
          >
            {{ getDisplayTitle(b) }}
          </span>
          <span
            v-if="b.type === 'layout'"
            class="text-[11px] text-muted-foreground tabular-nums shrink-0"
          >
            ({{ getLayoutChildrenModel(b).length }})
          </span>
          <span
            v-else-if="b.colSpan && b.colSpan > 1"
            class="text-[10px] text-muted-foreground bg-background/80 border border-border rounded px-1 tabular-nums shrink-0"
            :title="`占 ${b.colSpan} 列`"
          >
            {{ b.colSpan }}列
          </span>
        </div>

        <Transition name="fade-scale">
          <span
            v-if="props.dragGroupTargetId === b.id"
            class="drag-group-hint text-[11px] text-primary border border-primary px-1.5 rounded-full shrink-0"
          >
            {{ props.dragGroupTargetMode === 'into-layout' ? '松开加入组' : '松开成组' }}
          </span>
        </Transition>

        <AlertCircle
          v-if="props.invalidSet.has(b.id)"
          class="size-3.5 text-destructive shrink-0"
          title="该区块配置有误"
        />

        <!-- 隐藏态常驻小眼睛提醒；其余操作在 hover / 选中时显现，为区块标题留足空间 -->
        <div
          class="flex items-center gap-0.5 shrink-0 transition-opacity duration-150"
          :class="
            props.selectionSet.has(b.id)
              ? 'opacity-100'
              : b.hidden
                ? 'opacity-80 group-hover:opacity-100'
                : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
          "
        >
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  size="none"
                  variant="ghost"
                  class="size-5 rounded-sm"
                  :aria-label="b.hidden ? '显示区块' : '隐藏区块'"
                  @click.stop="b.hidden = !b.hidden"
                >
                  <component
                    :is="b.hidden ? EyeOff : Eye"
                    class="size-3"
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{{ b.hidden ? '显示区块' : '隐藏区块' }}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  size="none"
                  variant="ghost"
                  class="size-5 rounded-sm"
                  :class="b.hidden && !props.selectionSet.has(b.id) ? 'hidden group-hover:inline-flex' : ''"
                  aria-label="在预览中定位"
                  @click.stop="scrollToPreviewBlock(b.id)"
                >
                  <Crosshair class="size-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>在预览中定位</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button
                size="none"
                variant="ghost"
                class="size-5 rounded-sm"
                :class="b.hidden && !props.selectionSet.has(b.id) ? 'hidden group-hover:inline-flex' : ''"
                aria-label="更多区块操作"
                @click.stop
              >
                <MoreHorizontal class="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              class="w-44"
            >
              <template
                v-for="item in props.blockActionOptions"
                :key="item.key"
              >
                <DropdownMenuSeparator v-if="item.type === 'divider'" />
                <DropdownMenuItem
                  v-else
                  :disabled="item.disabled"
                  :class="item.key === 'delete' ? 'text-destructive focus:text-destructive' : ''"
                  @click="props.onBlockAction(String(item.key), b.id)"
                >
                  <component
                    :is="item.icon"
                    v-if="item.icon"
                    class="size-3.5 shrink-0"
                  />
                  {{ item.label }}
                </DropdownMenuItem>
              </template>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Transition name="fade">
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
