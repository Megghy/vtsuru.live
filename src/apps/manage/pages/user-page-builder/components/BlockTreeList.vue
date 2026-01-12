<script setup lang="ts">
import type { BlockNode } from '@/apps/user-page/block/schema'
import { BLOCK_LIBRARY, getBlockLabel } from '@/apps/user-page/block/registry'
import { NButton, NDropdown, NIcon, NText } from 'naive-ui'
import { computed, inject } from 'vue'
import Draggable from 'vuedraggable-es'
import {
  AlertCircleOutline,
  ChevronDownOutline,
  ChevronForwardOutline,
  EllipsisHorizontalOutline,
  EyeOffOutline,
  EyeOutline,
  ReorderThreeOutline,
} from '@vicons/ionicons5'
import { UserPageEditorKey } from '../context'

defineOptions({ name: 'BlockTreeList' })

const props = defineProps<{
  blocks: BlockNode[]
  depth: number
  groupName: string
  selectionSet: Set<string>
  invalidSet: Set<string>
  expandedLayoutIdSet: Set<string>
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

const iconMap = new Map(BLOCK_LIBRARY.map(it => [it.type, it.icon]))
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
</script>

<template>
  <Draggable
    :list="props.blocks"
    item-key="id"
    handle=".drag-handle"
    :group="{ name: props.groupName, pull: true, put: true }"
    :animation="160"
    ghost-class="drag-ghost"
    :move="props.onMove"
    @start="props.onDragStart"
    @end="props.onDragEnd"
  >
    <template #item="{ element: b }">
      <div :data-block-id="b.id">
        <div
          class="block-item-row"
          :class="{
            active: props.selectionSet.has(b.id),
            invalid: props.invalidSet.has(b.id),
            hidden: b.hidden,
            'is-layout': b.type === 'layout',
          }"
          @click="props.onRowClick(b.id, $event)"
        >
          <div class="indent" :style="{ width: indentWidth }" />

          <NIcon
            v-if="b.type === 'layout'"
            class="expand-toggle"
            size="16"
            title="折叠/展开"
            @click.stop="props.onToggleExpanded(b.id)"
          >
            <ChevronDownOutline v-if="props.expandedLayoutIdSet.has(b.id)" />
            <ChevronForwardOutline v-else />
          </NIcon>
          <div v-else class="expand-placeholder" />

          <NIcon class="drag-handle" size="18" title="拖拽排序 / 拖入分组">
            <ReorderThreeOutline />
          </NIcon>

          <NIcon v-if="getIcon(b.type)" class="type-icon" size="16">
            <component :is="getIcon(b.type)!" />
          </NIcon>
          <div v-else class="type-icon-placeholder" />

          <div class="block-label">
            <span class="truncate-text">
              {{ getDisplayTitle(b) }}
            </span>
            <NText v-if="b.name && b.name.trim().length" depth="3" class="type-hint">
              {{ getBlockLabel(b.type) }}
            </NText>
            <NText v-if="b.type === 'layout'" depth="3" style="margin-left: 6px; font-size: 12px">
              ({{ getLayoutChildrenModel(b).length }})
            </NText>
          </div>

          <NIcon
            v-if="props.invalidSet.has(b.id)"
            size="18"
            title="该区块配置有误"
            style="color: var(--n-error-color, #d03050)"
          >
            <AlertCircleOutline />
          </NIcon>

          <NButton
            quaternary
            circle
            size="tiny"
            :type="b.hidden ? 'default' : 'primary'"
            :title="b.hidden ? '点击显示区块' : '点击隐藏区块'"
            @click.stop="b.hidden = !b.hidden"
          >
            <template #icon>
              <NIcon>
                <EyeOutline v-if="!b.hidden" />
                <EyeOffOutline v-else />
              </NIcon>
            </template>
          </NButton>

          <NDropdown
            trigger="click"
            :options="props.blockActionOptions"
            @select="(key) => props.onBlockAction(String(key), b.id)"
          >
            <NButton quaternary circle size="tiny" @click.stop>
              <template #icon>
                <NIcon><EllipsisHorizontalOutline /></NIcon>
              </template>
            </NButton>
          </NDropdown>
        </div>

        <div v-if="b.type === 'layout' && props.expandedLayoutIdSet.has(b.id)" class="children">
          <BlockTreeList
            :blocks="getLayoutChildrenModel(b)"
            :depth="props.depth + 1"
            :group-name="props.groupName"
            :selection-set="props.selectionSet"
            :invalid-set="props.invalidSet"
            :expanded-layout-id-set="props.expandedLayoutIdSet"
            :on-row-click="props.onRowClick"
            :on-block-action="props.onBlockAction"
            :on-toggle-expanded="props.onToggleExpanded"
            :on-drag-start="props.onDragStart"
            :on-drag-end="props.onDragEnd"
            :on-move="props.onMove"
            :block-action-options="props.blockActionOptions"
          />
        </div>
      </div>
    </template>
  </Draggable>
</template>

<style scoped>
.truncate-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.block-item-row {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 6px 8px;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
  user-select: none;
}

.block-item-row.is-layout {
  box-shadow: inset 3px 0 0 var(--n-primary-color);
}

.block-item-row.is-layout .block-label {
  font-weight: 650;
}

.block-item-row:hover {
  background: var(--n-color-embedded);
}

.block-item-row.active {
  border-color: var(--n-color-target);
  background: var(--n-color-embedded);
}

.block-item-row.invalid,
.block-item-row.active.invalid {
  border-color: var(--n-error-color-pressed, var(--n-error-color, #d03050));
}

.block-item-row.hidden .block-label {
  opacity: 0.6;
  text-decoration: line-through;
}

.indent {
  flex: 0 0 auto;
}

.expand-toggle {
  cursor: pointer;
  opacity: 0.85;
}

.expand-placeholder {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
}

.type-icon,
.type-icon-placeholder {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  opacity: 0.92;
}

.type-hint {
  margin-left: 8px;
  font-size: 12px;
}

.drag-handle {
  cursor: grab;
  opacity: 0.8;
}

.drag-handle:active {
  cursor: grabbing;
}

.block-label {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
}

.children {
  margin-left: 0;
}

.drag-ghost {
  opacity: 0.45;
}

/* 拖放时的插入线指示 */
.sortable-chosen {
  opacity: 0.9;
  background: var(--n-color-embedded);
}

.sortable-drag {
  opacity: 0;
}
</style>
