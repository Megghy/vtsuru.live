<script setup lang="ts">
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  Check,
  Copy,
  EyeOff,
  FolderInput,
  FolderOpen,
  FolderOutput,
  FolderPlus,
  Group,
  Layers,
  Lock,
  Maximize2,
  Trash2,
  Ungroup,
  Unlock,
} from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import type { ObsSceneDocument, ObsSceneLayer } from '../types'
import {
  getAncestorGroupIds,
  getParentGroupId,
  isDescendantOf,
  isLayerEffectivelyLocked,
  isLayerInGlobalScope,
} from '../utils/groupTree'
import type { HitLayerEntry } from '../utils/hitTest'

const props = defineProps<{
  open: boolean
  x: number
  y: number
  doc: ObsSceneDocument
  hitEntries: HitLayerEntry[]
  selectedLayerIds: string[]
  editingGroupId: string | null
  canGroupSelected: boolean
}>()

const emit = defineEmits<{
  close: []
  selectLayer: [layerId: string]
  createEmptyGroup: []
  groupSelected: []
  ungroup: [groupId: string]
  enterGroup: [groupId: string]
  exitGroup: []
  fitGroupBounds: [groupId: string]
  moveOutOfGroup: [layerId: string]
  moveIntoGroup: [layerIds: string[], groupId: string]
  moveZOrder: [layerId: string, action: 'top' | 'up' | 'down' | 'bottom']
  toggleLock: [layerId: string]
  hideLayer: [layerId: string]
  duplicateLayer: [layerId: string]
  deleteSelected: []
}>()

const menuRef = ref<HTMLElement | null>(null)

// 视口边缘防裁切定位
const menuStyle = computed(() => {
  if (typeof window === 'undefined') {
    return { left: `${props.x}px`, top: `${props.y}px` }
  }
  const estW = 236
  const estH = 380
  const left = Math.max(8, Math.min(props.x, window.innerWidth - estW - 8))
  const top = Math.max(8, Math.min(props.y, window.innerHeight - estH - 8))
  return { left: `${left}px`, top: `${top}px` }
})

// 去重后的重叠图层列表（展示实际元素以及所属组，便于一步选中被遮挡或被锁定的图层）
const overlappingChoices = computed(() => {
  const seen = new Set<string>()
  const list: Array<{
    id: string
    name: string
    isGroup: boolean
    locked: boolean
    hollowInterior: boolean
    groupPath: string
    selected: boolean
  }> = []

  for (const entry of props.hitEntries) {
    if (seen.has(entry.layerId)) continue
    seen.add(entry.layerId)
    const ancestors = getAncestorGroupIds(props.doc, entry.layerId)
    const groupPath = ancestors
      .map((gid) => props.doc.layers[gid]?.name)
      .filter(Boolean)
      .join(' / ')
    list.push({
      id: entry.layerId,
      name: entry.layer.name,
      isGroup: entry.layer.type === 'group',
      locked: entry.effectivelyLocked,
      hollowInterior: entry.isHollowInterior && entry.layer.type === 'shape',
      groupPath,
      selected: props.selectedLayerIds.includes(entry.layerId),
    })
  }
  return list
})

const primaryLayer = computed<ObsSceneLayer | null>(() => {
  if (props.selectedLayerIds.length !== 1) return null
  return props.doc.layers[props.selectedLayerIds[0]] ?? null
})

const primaryIsLocked = computed(() => {
  if (!primaryLayer.value) return false
  return isLayerEffectivelyLocked(props.doc, primaryLayer.value.id)
})

const primaryParentGroupId = computed(() => {
  if (!primaryLayer.value) return null
  return getParentGroupId(props.doc, primaryLayer.value.id)
})

// 收集当前作用域内可供移入的目标分组列表
const availableTargetGroups = computed(() => {
  if (props.selectedLayerIds.length === 0) return []
  const firstId = props.selectedLayerIds[0]
  const inGlobal = isLayerInGlobalScope(props.doc, firstId)
  const rootIds = inGlobal
    ? props.doc.globalLayerIds
    : (props.doc.scenes[props.doc.activeSceneId]?.layerIds ?? [])

  const selectedSet = new Set(props.selectedLayerIds)
  const result: Array<{ id: string; name: string; depth: number }> = []

  function walk(ids: string[], depth: number) {
    for (let i = ids.length - 1; i >= 0; i--) {
      const id = ids[i]
      const layer = props.doc.layers[id]
      if (!layer || layer.type !== 'group') continue
      const blocked =
        selectedSet.has(id) ||
        props.selectedLayerIds.some((sid) => isDescendantOf(props.doc, sid, id)) ||
        props.selectedLayerIds.every((sid) => getParentGroupId(props.doc, sid) === id)
      if (!blocked) {
        result.push({ id, name: layer.name, depth })
      }
      if (layer.group.childIds.length > 0) {
        walk(layer.group.childIds, depth + 1)
      }
    }
  }

  walk(rootIds, 0)
  return result
})

function onGlobalPointerDown(e: PointerEvent) {
  if (!props.open) return
  if (menuRef.value && e.target instanceof Node && menuRef.value.contains(e.target)) return
  emit('close')
}

function onGlobalKeyDown(e: KeyboardEvent) {
  if (props.open && e.key === 'Escape') {
    e.stopPropagation()
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('pointerdown', onGlobalPointerDown, true)
  window.addEventListener('keydown', onGlobalKeyDown, true)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', onGlobalPointerDown, true)
  window.removeEventListener('keydown', onGlobalKeyDown, true)
})

function runAndClose(fn: () => void) {
  fn()
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      ref="menuRef"
      class="fixed z-[90] w-60 rounded-lg border border-border bg-popover p-1 text-xs text-popover-foreground shadow-lg select-none"
      :style="menuStyle"
      @contextmenu.prevent
    >
      <!-- 光标下方重叠图层选择区 -->
      <template v-if="overlappingChoices.length > 0">
        <div class="flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-muted-foreground">
          <Layers class="w-3 h-3" />
          <span>选择此处图层 ({{ overlappingChoices.length }})</span>
        </div>
        <div class="max-h-40 overflow-y-auto scrollbar-thin space-y-0.5">
          <button
            v-for="item in overlappingChoices"
            :key="item.id"
            type="button"
            class="w-full flex items-center gap-1.5 rounded-md px-2 py-1 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
            :class="item.selected ? 'bg-primary/12 text-foreground font-medium' : ''"
            @click="runAndClose(() => emit('selectLayer', item.id))"
          >
            <Check
              class="w-3 h-3 shrink-0"
              :class="item.selected ? 'text-primary opacity-100' : 'opacity-0'"
            />
            <FolderOpen v-if="item.isGroup" class="w-3 h-3 shrink-0 text-amber-500" />
            <div class="flex-1 min-w-0">
              <div class="truncate">{{ item.name }}</div>
              <div v-if="item.groupPath" class="truncate text-[10px] text-muted-foreground">
                {{ item.groupPath }}
              </div>
            </div>
            <Lock v-if="item.locked" class="w-3 h-3 shrink-0 text-amber-500" />
          </button>
        </div>
        <div class="my-1 h-px bg-border" />
      </template>

      <!-- 分组相关操作 -->
      <button
        v-if="canGroupSelected"
        type="button"
        class="ctx-item"
        @click="runAndClose(() => emit('groupSelected'))"
      >
        <Group class="w-3.5 h-3.5 text-primary" />
        <span class="flex-1">合并为组</span>
        <span class="text-[10px] text-muted-foreground">Ctrl+G</span>
      </button>

      <template v-if="primaryLayer?.type === 'group'">
        <button
          type="button"
          class="ctx-item"
          @click="runAndClose(() => emit('enterGroup', primaryLayer!.id))"
        >
          <FolderInput class="w-3.5 h-3.5 text-primary" />
          <span class="flex-1">进入组内编辑</span>
          <span class="text-[10px] text-muted-foreground">双击</span>
        </button>
        <button
          type="button"
          class="ctx-item"
          @click="runAndClose(() => emit('fitGroupBounds', primaryLayer!.id))"
        >
          <Maximize2 class="w-3.5 h-3.5" />
          <span class="flex-1">自适应组边界</span>
        </button>
        <button
          type="button"
          class="ctx-item"
          @click="runAndClose(() => emit('ungroup', primaryLayer!.id))"
        >
          <Ungroup class="w-3.5 h-3.5" />
          <span class="flex-1">解散分组</span>
          <span class="text-[10px] text-muted-foreground">Ctrl+Shift+G</span>
        </button>
      </template>

      <button
        v-if="primaryLayer && primaryParentGroupId"
        type="button"
        class="ctx-item"
        @click="runAndClose(() => emit('moveOutOfGroup', primaryLayer!.id))"
      >
        <FolderOutput class="w-3.5 h-3.5" />
        <span class="flex-1">移出所属分组</span>
      </button>

      <template v-if="availableTargetGroups.length > 0">
        <div class="px-2 pt-1 pb-0.5 text-[10px] font-medium text-muted-foreground">
          移入已有分组
        </div>
        <div class="max-h-28 overflow-y-auto scrollbar-thin space-y-0.5">
          <button
            v-for="grp in availableTargetGroups"
            :key="grp.id"
            type="button"
            class="ctx-item"
            :style="{ paddingLeft: `${8 + grp.depth * 10}px` }"
            @click="runAndClose(() => emit('moveIntoGroup', [...selectedLayerIds], grp.id))"
          >
            <FolderInput class="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span class="flex-1 truncate">{{ grp.name }}</span>
          </button>
        </div>
      </template>

      <button
        type="button"
        class="ctx-item"
        @click="runAndClose(() => emit('createEmptyGroup'))"
      >
        <FolderPlus class="w-3.5 h-3.5 text-amber-500" />
        <span class="flex-1">新建空分组</span>
      </button>

      <button
        v-if="editingGroupId"
        type="button"
        class="ctx-item"
        @click="runAndClose(() => emit('exitGroup'))"
      >
        <FolderOutput class="w-3.5 h-3.5 text-primary" />
        <span class="flex-1">退出组编辑</span>
        <span class="text-[10px] text-muted-foreground">Esc</span>
      </button>

      <!-- 单选图层层级与通用操作 -->
      <template v-if="primaryLayer">
        <div class="my-1 h-px bg-border" />
        <div class="grid grid-cols-4 gap-0.5 px-0.5 py-0.5">
          <button
            type="button"
            class="flex-center rounded p-1.5 hover:bg-accent"
            title="移至顶层"
            @click="runAndClose(() => emit('moveZOrder', primaryLayer!.id, 'top'))"
          >
            <ArrowUpToLine class="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            class="flex-center rounded p-1.5 hover:bg-accent"
            title="上移一层"
            @click="runAndClose(() => emit('moveZOrder', primaryLayer!.id, 'up'))"
          >
            <ArrowUp class="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            class="flex-center rounded p-1.5 hover:bg-accent"
            title="下移一层"
            @click="runAndClose(() => emit('moveZOrder', primaryLayer!.id, 'down'))"
          >
            <ArrowDown class="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            class="flex-center rounded p-1.5 hover:bg-accent"
            title="移至底层"
            @click="runAndClose(() => emit('moveZOrder', primaryLayer!.id, 'bottom'))"
          >
            <ArrowDownToLine class="w-3.5 h-3.5" />
          </button>
        </div>
        <div class="my-1 h-px bg-border" />
        <button
          type="button"
          class="ctx-item"
          @click="runAndClose(() => emit('toggleLock', primaryLayer!.id))"
        >
          <Unlock v-if="primaryLayer.locked" class="w-3.5 h-3.5 text-amber-500" />
          <Lock v-else class="w-3.5 h-3.5" />
          <span class="flex-1">{{ primaryLayer.locked ? '解锁图层' : '锁定图层（点击穿透）' }}</span>
        </button>
        <button
          type="button"
          class="ctx-item"
          @click="runAndClose(() => emit('hideLayer', primaryLayer!.id))"
        >
          <EyeOff class="w-3.5 h-3.5" />
          <span class="flex-1">隐藏图层</span>
        </button>
        <button
          type="button"
          class="ctx-item"
          @click="runAndClose(() => emit('duplicateLayer', primaryLayer!.id))"
        >
          <Copy class="w-3.5 h-3.5" />
          <span class="flex-1">复制</span>
          <span class="text-[10px] text-muted-foreground">Ctrl+D</span>
        </button>
      </template>

      <template v-if="selectedLayerIds.length > 0">
        <div class="my-1 h-px bg-border" />
        <button
          type="button"
          class="ctx-item text-destructive hover:text-destructive"
          :disabled="primaryIsLocked && selectedLayerIds.length === 1"
          @click="runAndClose(() => emit('deleteSelected'))"
        >
          <Trash2 class="w-3.5 h-3.5" />
          <span class="flex-1">删除{{ selectedLayerIds.length > 1 ? ` (${selectedLayerIds.length})` : '' }}</span>
          <span class="text-[10px] opacity-70">Del</span>
        </button>
      </template>

      <div
        v-if="overlappingChoices.length === 0 && selectedLayerIds.length === 0 && !editingGroupId"
        class="px-2 py-1.5 text-[11px] text-muted-foreground"
      >
        此处暂无图层
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.ctx-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-radius: 0.375rem;
  padding: 0.375rem 0.5rem;
  text-align: left;
  transition: background-color 150ms ease, color 150ms ease;
}

.ctx-item:hover:not(:disabled) {
  background-color: hsl(var(--accent));
  color: hsl(var(--accent-foreground));
}

.ctx-item:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
