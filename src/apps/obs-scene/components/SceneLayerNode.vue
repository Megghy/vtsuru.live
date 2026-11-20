<script setup lang="ts">
import { computed } from 'vue'

import type { ObsSceneDocument, ObsSceneLayer } from '../types'
import { isLayerEffectivelyLocked } from '../utils/groupTree'
import { buildMaskClipPath } from '../utils/maskShapes'
import SceneLayerContent from './SceneLayerContent.vue'

defineOptions({ name: 'SceneLayerNode' })

const props = defineProps<{
  doc: ObsSceneDocument
  layer: ObsSceneLayer
  zIndex: number
  ownerUserId?: number
  authToken?: string
  mode: 'edit' | 'preview' | 'live'
  layerVisibilityOverride?: Record<string, boolean>
  selectedLayerIds?: string[]
  editingGroupId?: string | null
  interactionMode: 'select' | 'interact'
}>()

const isVisible = computed(() => {
  if (props.layerVisibilityOverride && props.layer.id in props.layerVisibilityOverride) {
    return props.layerVisibilityOverride[props.layer.id]
  }
  return props.layer.visible
})

const isEffectivelyLocked = computed(() => isLayerEffectivelyLocked(props.doc, props.layer.id))
const isSelected = computed(() => props.mode === 'edit' && Boolean(props.selectedLayerIds?.includes(props.layer.id)))
const isEditingGroup = computed(
  () => props.mode === 'edit' && props.layer.type === 'group' && props.editingGroupId === props.layer.id,
)

const childLayers = computed<ObsSceneLayer[]>(() => {
  if (props.layer.type !== 'group') return []
  return props.layer.group.childIds
    .map((cid) => props.doc.layers[cid])
    .filter((l): l is ObsSceneLayer => Boolean(l))
})

const containerStyle = computed(() => {
  const layer = props.layer
  const maskClipPath = buildMaskClipPath(layer.maskShape, layer.width, layer.height, layer.borderRadius ?? 0)
  const crop = layer.crop
  const cropClipPath =
    crop && (crop.top || crop.right || crop.bottom || crop.left)
      ? `inset(${crop.top}px ${crop.right}px ${crop.bottom}px ${crop.left}px)`
      : undefined

  const shouldClip =
    layer.type !== 'group' ||
    Boolean(layer.group.clipContent || maskClipPath || cropClipPath || (layer.borderRadius ?? 0) > 0)

  return {
    position: 'absolute' as const,
    left: '0px',
    top: '0px',
    width: `${layer.width}px`,
    height: `${layer.height}px`,
    transform: `translate3d(${layer.x}px, ${layer.y}px, 0) rotate(${layer.rotation}deg)`,
    transformOrigin: 'center center',
    opacity: layer.opacity,
    zIndex: props.zIndex,
    borderRadius: !maskClipPath && layer.borderRadius ? `${layer.borderRadius}px` : undefined,
    clipPath: maskClipPath ?? cropClipPath,
    overflow: shouldClip ? ('hidden' as const) : ('visible' as const),
  }
})

const shouldBlockInnerPointer = computed(() => {
  if (props.mode === 'edit' && props.interactionMode === 'select') return true
  if (props.mode === 'live' && props.layer.type === 'iframe' && !props.layer.iframe.interactable) return true
  return false
})

// 编辑态下锁定图层自动点击穿透，避免大背景图或装饰框遮挡下层选择
const shouldPassThroughPointer = computed(() => {
  return props.mode === 'edit' && props.interactionMode === 'select' && isEffectivelyLocked.value
})
</script>

<template>
  <div
    v-if="isVisible"
    :data-layer-id="layer.id"
    :data-layer-type="layer.type"
    class="obs-scene-layer"
    :class="{
      'is-selected': isSelected,
      'is-locked': mode === 'edit' && isEffectivelyLocked,
      'is-editing-group': isEditingGroup,
      'pointer-events-none': shouldPassThroughPointer,
      'cursor-move': mode === 'edit' && interactionMode === 'select' && !isEffectivelyLocked,
    }"
    :style="containerStyle"
  >
    <template v-if="layer.type === 'group'">
      <SceneLayerNode
        v-for="(child, idx) in childLayers"
        :key="child.id"
        :doc="doc"
        :layer="child"
        :z-index="idx + 1"
        :owner-user-id="ownerUserId"
        :auth-token="authToken"
        :mode="mode"
        :layer-visibility-override="layerVisibilityOverride"
        :selected-layer-ids="selectedLayerIds"
        :editing-group-id="editingGroupId"
        :interaction-mode="interactionMode"
      />
    </template>
    <div
      v-else
      class="w-full h-full"
      :class="{ 'pointer-events-none': shouldBlockInnerPointer }"
    >
      <SceneLayerContent
        :layer="layer"
        :owner-user-id="ownerUserId"
        :auth-token="authToken"
        :mode="mode"
      />
    </div>
  </div>
</template>

<style scoped>
.obs-scene-layer.is-selected {
  outline: 2px solid hsl(var(--primary));
  outline-offset: -1px;
}

.obs-scene-layer.is-locked.is-selected {
  outline: 2px dashed #f59e0b;
}

.obs-scene-layer.is-editing-group {
  outline: 1.5px dashed hsl(var(--primary) / 0.75);
  outline-offset: 2px;
}
</style>
