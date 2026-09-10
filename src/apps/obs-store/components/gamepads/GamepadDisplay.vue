<script setup lang="ts">
import { computed } from 'vue'

import { controllerBodies, gamepadConfigs } from '@/apps/obs-store/data/gamepadConfigs'
import { useRouteQueryParam } from '@/composables/useRouteQueryParam'
import type { GamepadConfig, GamepadType } from '@/types/gamepad'

import GamepadStage from './GamepadStage.vue'

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
const querySensitivity = useRouteQueryParam<number>('stickSensitivity', 12, {
  transform: (v) => {
    const n = Number(v)
    return Number.isNaN(n) || n <= 0 ? 12 : n
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
    const match = bodies.value.find((b) => b.id === effectiveBodyId.value || b.name === effectiveBodyId.value)
    if (match) return match
  }
  return bodies.value[0]
})

const bodySvgComponent = computed(() => selectedBody.value?.body || config.value?.bodySvg)
const viewBoxString = computed(() => effectiveViewBox.value || selectedBody.value?.defaultViewBox || config.value?.defaultViewBox)
</script>

<template>
  <div :class="inlineMode ? 'gp-container-inline' : 'gp-container-obs'">
    <GamepadStage
      v-if="config"
      :config="config"
      :body-svg="bodySvgComponent"
      :view-box="viewBoxString"
      :pressed-color="effectivePressedColor"
      :stick-sensitivity="effectiveSensitivity"
    />
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

.gp-error-tip {
  color: var(--vtsuru-fg-muted, #999);
  font-size: 14px;
}
</style>
