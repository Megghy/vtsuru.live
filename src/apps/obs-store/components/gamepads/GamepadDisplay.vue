<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import { computed, ref } from 'vue'

import { controllerBodies, gamepadConfigs } from '@/apps/obs-store/data/gamepadConfigs'
import { useRouteQueryParam } from '@/composables/useRouteQueryParam'
import { useSvgGamepadRenderer } from '@/composables/useSvgGamepadRenderer'
import type { GamepadConfig, GamepadType } from '@/types/gamepad'

interface Props {
  type?: GamepadType
  bodyId?: string
  pressedColor?: string | null
  viewBox?: string
  inlineMode?: boolean
  stickSensitivity?: number
}

const props = withDefaults(defineProps<Props>(), {
  type: undefined,
  bodyId: undefined,
  pressedColor: undefined,
  viewBox: undefined,
  inlineMode: false,
  stickSensitivity: undefined,
})

// 路由查询参数（独立 OBS 浏览器源使用）
const queryType = useRouteQueryParam<GamepadType>('type', 'xbox', {
  transform: (v) => (v === 'ps' || v === 'nintendo' ? v : 'xbox'),
})
const queryBodyId = useRouteQueryParam<string>('bodyId', '')
const queryPressedColor = useRouteQueryParam<string | null>('pressedColor', null, {
  transform: (v) => (!v || v === 'null' ? null : String(v)),
})
const queryViewBox = useRouteQueryParam<string>('viewBox', '')
const querySensitivity = useRouteQueryParam<number>('stickSensitivity', 15, {
  transform: (v) => {
    const n = Number(v)
    return Number.isNaN(n) || n <= 0 ? 15 : n
  },
})

// props 优先，回退到路由 query
const effectiveType = computed<GamepadType>(() => props.type ?? queryType.value)
const effectiveBodyId = computed(() => props.bodyId ?? queryBodyId.value)
const effectivePressedColor = computed(() =>
  props.pressedColor !== undefined ? props.pressedColor : queryPressedColor.value,
)
const effectiveViewBox = computed(() => props.viewBox ?? queryViewBox.value)
const effectiveSensitivity = computed(() => props.stickSensitivity ?? querySensitivity.value)

// 对应配置与底壳
const config = computed<GamepadConfig | undefined>(() => gamepadConfigs[effectiveType.value])
const bodies = computed(() => controllerBodies[effectiveType.value] || [])

const selectedBody = computed(() => {
  if (effectiveBodyId.value) {
    const match = bodies.value.find(
      (b) => b.id === effectiveBodyId.value || b.name === effectiveBodyId.value,
    )
    if (match) return match
  }
  return bodies.value[0]
})

const bodySvgComponent = computed(() => selectedBody.value?.body || config.value?.bodySvg)
const viewBoxString = computed(
  () =>
    effectiveViewBox.value ||
    selectedBody.value?.defaultViewBox ||
    config.value?.defaultViewBox,
)
const activeAspectRatio = computed(
  () => selectedBody.value?.aspectRatio || config.value?.aspectRatio || '16 / 10',
)

// SVG 容器引用与直接 DOM 渲染驱动
const bodySvgRef = ref<ComponentPublicInstance | null>(null)

useSvgGamepadRenderer({
  svgContainerRef: bodySvgRef,
  gamepadType: effectiveType,
  pressedColor: effectivePressedColor,
  stickSensitivity: effectiveSensitivity,
})
</script>

<template>
  <div :class="inlineMode ? 'gp-container-inline' : 'gp-container-obs'">
    <div
      v-if="config"
      class="gp-stage-box"
      :style="{ aspectRatio: activeAspectRatio }"
    >
      <component
        :is="bodySvgComponent"
        v-if="bodySvgComponent"
        ref="bodySvgRef"
        class="gp-svg-body"
        :viewBox="viewBoxString"
        preserveAspectRatio="xMidYMid meet"
      />
    </div>
    <div
      v-else
      class="gp-error-tip"
    >
      未知手柄类型: {{ effectiveType }}
    </div>
  </div>
</template>

<style scoped>
.gp-container-obs {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 16px;
  box-sizing: border-box;
  overflow: hidden;
  background: transparent;
  display: flex;
  justify-content: center;
  align-items: center;
}

.gp-container-inline {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  box-sizing: border-box;
}

.gp-stage-box {
  position: relative;
  width: 100%;
  max-width: 100%;
  max-height: 100%;
  margin: auto;
  display: flex;
  justify-content: center;
  align-items: center;
  box-sizing: border-box;
}

.gp-svg-body {
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  pointer-events: none;
}

.gp-error-tip {
  color: var(--vtsuru-fg-muted, #999);
  font-size: 14px;
}
</style>
