<script setup lang="ts">
import { Camera, Gamepad2, Layers, Sparkles, UserRound } from 'lucide-vue-next'
import { computed } from 'vue'

import type { ObsSourceLayer } from '../types'
import { getObsSourceRolePreset } from '../types'
import { buildObsNativeFilterPreviewCss } from '../vfx/presets'
import { hasActiveObsNativeFilters } from '../vfx/types'

const props = defineProps<{
  layer: ObsSourceLayer
  mode: 'edit' | 'preview' | 'live'
  sourcePreviews?: Record<string, string>
}>()

const preset = computed(() => getObsSourceRolePreset(props.layer.obsSource.role))

const previewSrc = computed(() => {
  const name = props.layer.obsSource.sourceName.trim()
  if (name && props.sourcePreviews?.[name]) {
    return props.sourcePreviews[name]
  }
  return props.layer.obsSource.referenceImageUrl?.trim() || ''
})

const isLiveSnapshot = computed(() => {
  const name = props.layer.obsSource.sourceName.trim()
  return Boolean(name && props.sourcePreviews?.[name])
})

const isVtsPresetMode = computed(() => {
  const ctrl = props.layer.obsSource.controller
  return ctrl.type === 'vts' && ctrl.positionMode === 'vts-preset'
})

const sourceFilterPreviewCss = computed(() => buildObsNativeFilterPreviewCss(props.layer.obsSource.filters))
const hasNativeFilters = computed(() => hasActiveObsNativeFilters(props.layer.obsSource.filters))

const roleIcon = computed(() => {
  switch (props.layer.obsSource.role) {
    case 'vts':
      return Sparkles
    case 'avatar':
      return UserRound
    case 'game':
      return Gamepad2
    case 'camera':
      return Camera
    default:
      return Layers
  }
})
</script>

<template>
  <!-- 直播播出态完全透明空占位：真实画面由夹在浏览器源之间的本地 OBS 原生源零拷贝渲染 -->
  <div v-if="mode === 'live'" class="w-full h-full pointer-events-none" />

  <!-- 编辑/预览态：优先展示 OBS 透明快照或离线参考图，其次显示高辨识度虚线占位框 -->
  <div
    v-else
    class="relative w-full h-full overflow-hidden border-2 border-dashed border-violet-400/75 bg-violet-500/8"
  >
    <img
      v-if="previewSrc"
      :src="previewSrc"
      :alt="layer.name"
      draggable="false"
      class="w-full h-full object-contain select-none"
      :style="{ filter: sourceFilterPreviewCss }"
    />

    <div
      v-else
      class="w-full h-full flex-col-center gap-2 px-6 text-center text-violet-200/90"
    >
      <div class="w-12 h-12 rounded-full bg-violet-500/20 border border-violet-400/40 flex-center">
        <component :is="roleIcon" class="w-6 h-6 text-violet-300" />
      </div>
      <div class="text-base font-semibold tracking-tight">
        {{ layer.obsSource.sourceName || preset.label }}
      </div>
      <div class="text-xs text-violet-200/70 max-w-[320px] leading-relaxed">
        {{
          layer.obsSource.sourceName
            ? '直播时由本地 OBS 源渲染此位置，可在右侧抓取透明预览图'
            : '请在右侧绑定本地 OBS 源（如 Spout2 / 游戏捕获）'
        }}
      </div>
    </div>

    <!-- 顶部角标：标明 OBS 原生源身份、绑定名与预览来源 -->
    <div class="pointer-events-none absolute top-2 left-2 flex items-center gap-1.5 flex-wrap max-w-[calc(100%-16px)]">
      <div class="inline-flex items-center gap-1 rounded bg-violet-600/90 px-2 py-0.5 text-xs font-medium text-white shadow-sm">
        <component :is="roleIcon" class="w-3.5 h-3.5 shrink-0" />
        <span class="truncate max-w-[220px]">
          OBS: {{ layer.obsSource.sourceName || '未绑定源' }}
        </span>
      </div>
      <span
        v-if="isVtsPresetMode"
        class="inline-flex items-center rounded bg-sky-600/90 px-1.5 py-0.5 text-[11px] font-medium text-white shadow-sm"
      >
        VTS 机位模式
      </span>
      <span
        v-else-if="isLiveSnapshot"
        class="inline-flex items-center rounded bg-emerald-600/85 px-1.5 py-0.5 text-[11px] font-medium text-white shadow-sm"
      >
        OBS 快照
      </span>
      <span
        v-if="hasNativeFilters"
        class="inline-flex items-center rounded bg-amber-600/90 px-1.5 py-0.5 text-[11px] font-medium text-white shadow-sm"
      >
        原生滤镜
      </span>
    </div>
  </div>
</template>
