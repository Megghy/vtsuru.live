<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import type { BodyOptionConfig } from '@/apps/obs-store/data/gamepadConfigs'
import type { GamepadConfig, GamepadType } from '@/types/gamepad'
import { useRouteQuery } from '@vueuse/router'
import { NCard, NText } from 'naive-ui'
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import { controllerBodies, controllerStructures, gamepadConfigs } from '@/apps/obs-store/data/gamepadConfigs'
import { useGamepadStore } from '@/store/useGamepadStore'
import { useSvgGamepadRenderer } from '@/composables/useSvgGamepadRenderer'
import GamepadButton from './GamepadButton.vue'
import GamepadStick from './GamepadStick.vue'

interface Props {
  fullscreenMode?: boolean
  type?: GamepadType
  bodyId?: string
  overlay?: boolean
  pressedColor?: string | null
  viewBox?: string
  inlineMode?: boolean
  stickSensitivity?: number
}

const props = withDefaults(defineProps<Props>(), {
  fullscreenMode: true,
  type: undefined,
  bodyId: undefined,
  overlay: undefined,
  pressedColor: undefined,
  viewBox: undefined,
  inlineMode: false,
  stickSensitivity: undefined,
})

// 路由查询参数（独立显示窗口使用）
const queryType = useRouteQuery<GamepadType>('type', 'xbox', { transform: String as (v: any) => GamepadType })
const queryBodyId = useRouteQuery<string>('bodyId', '')
const queryOverlay = useRouteQuery('overlay', 'true')
const queryPressedColor = useRouteQuery<string | null>('pressedColor', null, { transform: v => v === 'null' ? null : String(v) })
const queryViewBox = useRouteQuery<string>('viewBox', '')
const querySensitivity = useRouteQuery<number>('stickSensitivity', 5, { transform: v => {
  const n = Number(v); return Number.isNaN(n) ? 5 : n
} })

// props 优先，否则用 query
const selectedType = computed(() => props.type ?? queryType.value)
const selectedBodyId = computed(() => props.bodyId ?? queryBodyId.value)
const useOverlayButtons = computed(() => props.overlay ?? queryOverlay.value === 'true')
const customPressedColor = computed(() => props.pressedColor !== undefined ? props.pressedColor : queryPressedColor.value)
const customViewBox = computed(() => props.viewBox ?? queryViewBox.value)
const stickSensitivityVal = computed(() => props.stickSensitivity ?? querySensitivity.value)

// 配置
const config = computed<GamepadConfig | undefined>(() => gamepadConfigs[selectedType.value])
const bodies = computed<BodyOptionConfig[]>(() => controllerBodies[selectedType.value] || [])
const components = computed(() => controllerStructures[selectedType.value] || [])

// SVG 组件
const bodySvgRef = ref<ComponentPublicInstance | null>(null)
const bodySvgComponent = shallowRef<any>(null)

const defaultViewBox = computed(() => {
  const body = bodies.value.find(b => b.name === selectedBodyId.value)
  return body?.defaultViewBox || config.value?.defaultViewBox || '0 0 1000 1000'
})
const effectiveViewBox = computed(() => customViewBox.value || defaultViewBox.value)

// 加载 SVG body 组件
watch(() => [selectedBodyId.value, selectedType.value], () => {
  const body = bodies.value.find(b => b.name === selectedBodyId.value)
  bodySvgComponent.value = body?.body || config.value?.bodySvg || null
}, { immediate: true })

// SVG 渲染器
const { analyzeSvg } = useSvgGamepadRenderer({
  bodySvgRef,
  components,
  pressedColor: customPressedColor,
  stickSensitivity: stickSensitivityVal,
  useOverlay: useOverlayButtons,
})

watch(bodySvgComponent, () => nextTick(analyzeSvg), { immediate: true })

const gamepad = useGamepadStore()
</script>

<template>
  <div :class="inlineMode ? 'gp-display-inline' : 'gp-display-fullscreen'">
    <div v-if="config" class="gp-viewer">
      <div class="gp-svg-container">
        <component
          :is="bodySvgComponent"
          v-if="bodySvgComponent"
          ref="bodySvgRef"
          class="gp-body"
          :viewBox="effectiveViewBox"
          preserveAspectRatio="xMidYMid meet"
        />
        <NText v-else>无法加载手柄 SVG</NText>
      </div>
      <div v-if="useOverlayButtons" class="gp-overlay">
        <template v-for="(comp, i) in config.components" :key="`${selectedType}-${i}`">
          <GamepadButton
            v-if="comp.type === 'button'"
            :name="comp.name"
            :svg="comp.svg"
            :position="comp.position"
            :is-pressed="gamepad.normalizedGamepadState.buttons[comp.logicalButton]?.pressed ?? false"
          />
          <GamepadStick
            v-else-if="comp.type === 'stick'"
            :svg="comp.svg"
            :position="comp.position"
            :axes="gamepad.normalizedGamepadState.sticks[comp.logicalButton] || { x: 0, y: 0 }"
            :sensitivity="stickSensitivityVal"
          />
        </template>
      </div>
    </div>
    <NCard v-else class="gp-error">无效的游戏手柄类型: {{ selectedType }}</NCard>
  </div>
</template>

<style scoped>
.gp-display-fullscreen {
  position: fixed;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  box-sizing: border-box;
  overflow: hidden;
}
.gp-display-inline {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
}
.gp-viewer {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
}
.gp-svg-container {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
}
.gp-body {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.gp-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  display: flex;
  justify-content: center;
  align-items: center;
}
.gp-overlay > * { pointer-events: all; }
.gp-error { max-width: 400px; }
</style>

