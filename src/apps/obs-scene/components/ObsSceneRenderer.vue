<script setup lang="ts">
import { computed } from 'vue'

import type { RpcObsSceneItemRef } from '@/shared/rpc/contract'

import type { ObsSceneDocument, ObsSceneLayer } from '../types'
import SceneLayerNode from './SceneLayerNode.vue'

const props = withDefaults(
  defineProps<{
    doc: ObsSceneDocument
    ownerUserId?: number
    authToken?: string
    mode?: 'edit' | 'preview' | 'live'
    activeSceneOverride?: string
    layerVisibilityOverride?: Record<string, boolean>
    selectedLayerIds?: string[]
    editingGroupId?: string | null
    interactionMode?: 'select' | 'interact'
    showGrid?: boolean
    referenceItems?: RpcObsSceneItemRef[]
    referenceCanvasSize?: { width: number; height: number }
    showReferenceOverlay?: boolean
  }>(),
  {
    mode: 'live',
    interactionMode: 'select',
    showGrid: false,
    showReferenceOverlay: false,
    editingGroupId: null,
  },
)

const currentSceneId = computed(() => {
  if (props.activeSceneOverride && props.doc.scenes[props.activeSceneOverride]) {
    return props.activeSceneOverride
  }
  return props.doc.activeSceneId
})

const activeScene = computed(() => props.doc.scenes[currentSceneId.value] ?? null)

const sceneLayers = computed<ObsSceneLayer[]>(() => {
  if (!activeScene.value) return []
  return activeScene.value.layerIds
    .map((id) => props.doc.layers[id])
    .filter((l): l is ObsSceneLayer => Boolean(l))
})

const globalLayers = computed<ObsSceneLayer[]>(() => {
  return props.doc.globalLayerIds
    .map((id) => props.doc.layers[id])
    .filter((l): l is ObsSceneLayer => Boolean(l))
})

const transitionName = computed(() => {
  if (props.mode === 'edit') return 'obs-scene-none'
  const t = activeScene.value?.transition ?? 'fade'
  return `obs-scene-${t}`
})

function getReferenceStyle(item: RpcObsSceneItemRef) {
  const refW = props.referenceCanvasSize?.width || props.doc.canvas.width
  const refH = props.referenceCanvasSize?.height || props.doc.canvas.height
  const sx = props.doc.canvas.width / Math.max(1, refW)
  const sy = props.doc.canvas.height / Math.max(1, refH)
  return {
    left: '0px',
    top: '0px',
    width: `${Math.max(12, item.width * sx)}px`,
    height: `${Math.max(12, item.height * sy)}px`,
    transform: `translate3d(${item.x * sx}px, ${item.y * sy}px, 0) rotate(${item.rotation}deg)`,
    transformOrigin: 'center center',
  }
}
</script>

<template>
  <div
    class="obs-scene-stage relative select-none overflow-hidden"
    :class="{ 'obs-scene-grid': mode === 'edit' && showGrid }"
    :style="{
      width: `${doc.canvas.width}px`,
      height: `${doc.canvas.height}px`,
      backgroundColor: mode === 'live' ? 'transparent' : doc.canvas.background || 'transparent',
    }"
  >
    <!-- 编辑态底层：本地 OBS 源占位参考框 -->
    <template v-if="mode === 'edit' && showReferenceOverlay && referenceItems?.length">
      <div
        v-for="item in referenceItems"
        :key="`obs-ref-${item.sceneItemId}`"
        class="pointer-events-none absolute border-2 border-dashed border-sky-400/70 bg-sky-500/10"
        :class="{ 'opacity-35': !item.enabled }"
        :style="getReferenceStyle(item)"
      >
        <div
          class="inline-flex items-center gap-1 px-2 py-0.5 text-sm font-medium bg-sky-500/85 text-white rounded-br"
        >
          <span>OBS: {{ item.sourceName }}</span>
          <span v-if="!item.enabled" class="opacity-80">(已隐藏)</span>
        </div>
      </div>
    </template>

    <!-- 当前子场景图层（支持切场过渡与递归分组） -->
    <Transition :name="transitionName" mode="out-in">
      <div :key="currentSceneId" class="absolute inset-0">
        <SceneLayerNode
          v-for="(layer, idx) in sceneLayers"
          :key="layer.id"
          :doc="doc"
          :layer="layer"
          :z-index="idx + 1"
          :owner-user-id="ownerUserId"
          :auth-token="authToken"
          :mode="mode"
          :layer-visibility-override="layerVisibilityOverride"
          :selected-layer-ids="selectedLayerIds"
          :editing-group-id="editingGroupId"
          :interaction-mode="interactionMode"
        />
      </div>
    </Transition>

    <!-- 全局常驻图层（切场不重载，始终置顶） -->
    <SceneLayerNode
      v-for="(layer, idx) in globalLayers"
      :key="`global-${layer.id}`"
      :doc="doc"
      :layer="layer"
      :z-index="1000 + idx"
      :owner-user-id="ownerUserId"
      :auth-token="authToken"
      :mode="mode"
      :layer-visibility-override="layerVisibilityOverride"
      :selected-layer-ids="selectedLayerIds"
      :editing-group-id="editingGroupId"
      :interaction-mode="interactionMode"
    />
  </div>
</template>

<style scoped>
.obs-scene-grid {
  background-image:
    linear-gradient(to right, rgba(148, 163, 184, 0.14) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(148, 163, 184, 0.14) 1px, transparent 1px);
  background-size: 40px 40px;
}

/* 切场纯 GPU 过渡 */
.obs-scene-fade-enter-active,
.obs-scene-fade-leave-active {
  transition: opacity 200ms ease;
}
.obs-scene-fade-enter-from,
.obs-scene-fade-leave-to {
  opacity: 0;
}

.obs-scene-slide-up-enter-active,
.obs-scene-slide-up-leave-active {
  transition: opacity 200ms ease, transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
}
.obs-scene-slide-up-enter-from {
  opacity: 0;
  transform: translate3d(0, 28px, 0);
}
.obs-scene-slide-up-leave-to {
  opacity: 0;
  transform: translate3d(0, -18px, 0);
}

.obs-scene-scale-enter-active,
.obs-scene-scale-leave-active {
  transition: opacity 180ms ease, transform 200ms ease;
}
.obs-scene-scale-enter-from {
  opacity: 0;
  transform: scale(0.96);
}
.obs-scene-scale-leave-to {
  opacity: 0;
  transform: scale(1.03);
}
</style>
