<script setup lang="ts">
import {
  Box,
  Camera,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Film,
  Folder,
  FolderOpen,
  FolderOutput,
  GalleryHorizontalEnd,
  Gamepad2,
  Globe,
  GripVertical,
  Image as ImageIcon,
  Images,
  Layers,
  Lock,
  MessageSquareText,
  MoveHorizontal,
  Puzzle,
  Sparkles,
  Trash2,
  Type,
  Ungroup,
  Unlock,
  UserRound,
} from 'lucide-vue-next'
import { computed } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'

import { Button } from '@/shared/ui/button'

import { useObsSceneEditorStore } from '../store/useObsSceneEditorStore'
import type { ObsSceneLayer } from '../types'
import { getObsModuleById } from '../types'
import { isLayerEffectivelyLocked } from '../utils/groupTree'

defineOptions({ name: 'SceneLayerTreeList' })

const props = withDefaults(
  defineProps<{
    /** bottom -> top 顺序的图层 ID 列表 */
    layerIds: string[]
    parentGroupId?: string | null
    depth?: number
  }>(),
  {
    parentGroupId: null,
    depth: 0,
  },
)

const store = useObsSceneEditorStore()

// 图层面板自顶向下显示（索引越靠前 zIndex 越高）
const displayList = computed<ObsSceneLayer[]>({
  get() {
    const list: ObsSceneLayer[] = []
    for (let i = props.layerIds.length - 1; i >= 0; i--) {
      const layer = store.doc.layers[props.layerIds[i]]
      if (layer) list.push(layer)
    }
    return list
  },
  set(nextTopToBottom) {
    // 跨分组拖入/拖出交由 @add 原子处理（需坐标换算）；此处仅提交同级重排
    if (nextTopToBottom.length !== props.layerIds.length) return
    const currentSet = new Set(props.layerIds)
    if (!nextTopToBottom.every((l) => currentSet.has(l.id))) return
    const bottomToTop = nextTopToBottom.toReversed().map((l) => l.id)
    if (props.parentGroupId) {
      store.reorderGroupChildren(props.parentGroupId, bottomToTop)
    } else {
      store.reorderLayers(bottomToTop, store.editingScope)
    }
  },
})

function onDraggableAdd(evt: { item?: HTMLElement; newIndex?: number }) {
  const movedId = evt.item?.dataset?.treeLayerId
  if (!movedId) return
  const dropTopIndex = evt.newIndex ?? 0
  const insertBottomIndex = Math.max(0, props.layerIds.length - dropTopIndex)
  store.moveLayerToContainer(movedId, props.parentGroupId, insertBottomIndex)
}

function getLayerTypeIcon(layer: ObsSceneLayer) {
  switch (layer.type) {
    case 'group':
      return layer.group.collapsed ? Folder : FolderOpen
    case 'vtsuru-widget':
      return Puzzle
    case 'obs-module':
      return MessageSquareText
    case 'obs-source':
      if (layer.obsSource.role === 'vts') return Sparkles
      if (layer.obsSource.role === 'avatar') return UserRound
      if (layer.obsSource.role === 'game') return Gamepad2
      if (layer.obsSource.role === 'camera') return Camera
      return Layers
    case 'marquee':
      return layer.marquee.mode === 'image' ? GalleryHorizontalEnd : MoveHorizontal
    case 'slideshow':
      return Images
    case 'image':
      return ImageIcon
    case 'video':
      return Film
    case 'text':
      return Type
    case 'shape':
      return Box
    case 'iframe':
      return Globe
  }
}

function getLayerSubtitle(layer: ObsSceneLayer): string {
  if (layer.type === 'group') {
    const count = layer.group.childIds.length
    return layer.group.clipContent ? `${count} 项 · 裁切超出` : `${count} 项`
  }
  if (layer.type === 'vtsuru-widget') {
    return layer.widget.configMode === 'isolated' ? '独立配置' : `复用: ${layer.widget.channelId}`
  }
  if (layer.type === 'obs-module') {
    return getObsModuleById(layer.module.moduleId)?.name ?? layer.module.moduleId
  }
  if (layer.type === 'obs-source') {
    const tag = layer.obsSource.controller.type === 'vts' ? 'VTS' : 'OBS'
    return layer.obsSource.sourceName ? `${tag} · ${layer.obsSource.sourceName}` : `${tag} · 未绑定本地源`
  }
  if (layer.type === 'marquee') {
    return layer.marquee.mode === 'image' ? '图片走马灯' : '文字走马灯'
  }
  if (layer.type === 'slideshow') {
    return `轮播 (${layer.slideshow.images.length} 图)`
  }
  return ''
}

function handleSelectLayer(layer: ObsSceneLayer, e: MouseEvent) {
  if (e.shiftKey || e.ctrlKey || e.metaKey) {
    if (store.selectedLayerIds.includes(layer.id)) {
      store.selectedLayerIds = store.selectedLayerIds.filter((id) => id !== layer.id)
    } else {
      store.selectedLayerIds = [...store.selectedLayerIds, layer.id]
    }
  } else {
    store.selectedLayerIds = [layer.id]
  }
  store.editingGroupId = props.parentGroupId
}

function handleDblClickLayer(layer: ObsSceneLayer) {
  if (layer.type === 'group') {
    store.enterGroupEdit(layer.id)
  }
}

function toggleGroupCollapsed(layer: ObsSceneLayer) {
  if (layer.type !== 'group') return
  layer.group.collapsed = !layer.group.collapsed
}

function toggleLayerVisible(layer: ObsSceneLayer) {
  store.updateLayer(layer.id, { visible: !layer.visible })
}

function toggleLayerLock(layer: ObsSceneLayer) {
  store.updateLayer(layer.id, { locked: !layer.locked })
}
</script>

<template>
  <div class="relative">
    <div
      v-if="depth > 0 && displayList.length === 0"
      class="pointer-events-none absolute inset-0 ml-5 my-0.5 rounded border border-dashed border-border/80 flex-center text-[10px] text-muted-foreground/75"
    >
      拖动图层到此处放入分组
    </div>
    <VueDraggable
      v-model="displayList"
      :animation="150"
      :group="{ name: 'obs-scene-layers', pull: true, put: true }"
      handle=".layer-drag-handle"
      :class="
        depth === 0
          ? 'p-2 space-y-1 min-h-[24px]'
          : 'space-y-0.5 mt-0.5 pl-3 ml-2 border-l border-border/70 min-h-[30px]'
      "
      @add="onDraggableAdd"
    >
      <div
        v-for="layer in displayList"
        :key="layer.id"
        :data-tree-layer-id="layer.id"
      >
      <div
        class="group relative flex items-center gap-1 rounded-md px-1.5 py-1.5 cursor-pointer transition-colors"
        :class="[
          store.selectedLayerIds.includes(layer.id)
            ? 'bg-primary/12 text-foreground ring-1 ring-primary/30'
            : store.editingGroupId === layer.id
              ? 'bg-primary/6 text-foreground ring-1 ring-dashed ring-primary/35'
              : 'hover:bg-accent/60 text-muted-foreground hover:text-foreground',
        ]"
        @click="handleSelectLayer(layer, $event)"
        @dblclick.stop="handleDblClickLayer(layer)"
      >
        <GripVertical class="layer-drag-handle w-3.5 h-3.5 shrink-0 text-muted-foreground/50 cursor-grab" />

        <!-- 组展开/折叠按钮 -->
        <button
          v-if="layer.type === 'group'"
          type="button"
          class="w-3.5 h-3.5 shrink-0 flex-center rounded hover:bg-accent text-muted-foreground"
          :title="layer.group.collapsed ? '展开分组' : '折叠分组'"
          @click.stop="toggleGroupCollapsed(layer)"
        >
          <ChevronRight v-if="layer.group.collapsed" class="w-3 h-3" />
          <ChevronDown v-else class="w-3 h-3" />
        </button>

        <component
          :is="getLayerTypeIcon(layer)"
          class="w-3.5 h-3.5 shrink-0"
          :class="
            layer.type === 'group'
              ? 'text-amber-500'
              : layer.type === 'obs-source'
                ? 'text-violet-500'
                : 'text-primary/80'
          "
        />

        <div class="flex-1 min-w-0">
          <div class="truncate text-xs font-medium" :class="{ 'line-through opacity-50': !layer.visible }">
            {{ layer.name }}
          </div>
          <div
            v-if="getLayerSubtitle(layer)"
            class="text-[10px] text-muted-foreground truncate"
          >
            {{ getLayerSubtitle(layer) }}
          </div>
        </div>

        <!-- 非悬停状态：仅在隐藏/锁定时展示极小状态指示 -->
        <div
          v-if="!layer.visible || isLayerEffectivelyLocked(store.doc, layer.id)"
          class="flex items-center gap-1 shrink-0 group-hover:opacity-0 transition-opacity"
        >
          <EyeOff v-if="!layer.visible" class="w-3 h-3 text-muted-foreground/60" />
          <Lock v-if="isLayerEffectivelyLocked(store.doc, layer.id)" class="w-3 h-3 text-amber-500" />
        </div>

        <!-- 悬停紧凑浮层操作条 -->
        <div
          class="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 rounded bg-card/95 border border-border/70 px-0.5 py-0.5 shadow-xs opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-150"
        >
          <Button
            v-if="layer.type === 'group'"
            variant="ghost"
            size="none"
            class="w-5 h-5 rounded flex-center [&_svg]:size-3"
            title="解散分组"
            @click.stop="store.ungroupLayer(layer.id)"
          >
            <Ungroup />
          </Button>
          <Button
            v-else-if="parentGroupId"
            variant="ghost"
            size="none"
            class="w-5 h-5 rounded flex-center [&_svg]:size-3"
            title="移出分组"
            @click.stop="store.moveLayerOutOfGroup(layer.id)"
          >
            <FolderOutput />
          </Button>
          <Button
            variant="ghost"
            size="none"
            class="w-5 h-5 rounded flex-center [&_svg]:size-3"
            :title="layer.visible ? '隐藏' : '显示'"
            @click.stop="toggleLayerVisible(layer)"
          >
            <Eye v-if="layer.visible" />
            <EyeOff v-else class="opacity-50" />
          </Button>
          <Button
            variant="ghost"
            size="none"
            class="w-5 h-5 rounded flex-center [&_svg]:size-3"
            :title="layer.locked ? '解锁' : '锁定（点击穿透）'"
            @click.stop="toggleLayerLock(layer)"
          >
            <Lock v-if="layer.locked" class="text-amber-500" />
            <Unlock v-else class="opacity-75" />
          </Button>
          <Button
            variant="ghost"
            size="none"
            class="w-5 h-5 rounded flex-center [&_svg]:size-3"
            title="删除"
            @click.stop="store.deleteLayers([layer.id])"
          >
            <Trash2 class="text-destructive" />
          </Button>
        </div>
      </div>

      <!-- 递归渲染子图层（空分组展开后也提供拖入区域） -->
      <SceneLayerTreeList
        v-if="layer.type === 'group' && !layer.group.collapsed"
        :layer-ids="layer.group.childIds"
        :parent-group-id="layer.id"
        :depth="depth + 1"
      />
      </div>
    </VueDraggable>
  </div>
</template>
