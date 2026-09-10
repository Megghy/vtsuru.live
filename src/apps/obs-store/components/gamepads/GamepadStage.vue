<script setup lang="ts">
import type { Component } from 'vue'
import { computed } from 'vue'

import { useGamepadStore } from '@/store/useGamepadStore'
import type { GamepadConfig } from '@/types/gamepad'

import GamepadButton from './GamepadButton.vue'
import GamepadStick from './GamepadStick.vue'

interface Props {
  config: GamepadConfig
  bodySvg?: Component
  viewBox?: string
  pressedColor?: string | null
  stickSensitivity?: number
}

const props = withDefaults(defineProps<Props>(), {
  bodySvg: undefined,
  viewBox: undefined,
  pressedColor: null,
  stickSensitivity: 12,
})

const gamepad = useGamepadStore()

const activeBodySvg = computed(() => props.bodySvg || props.config.bodySvg)
const effectiveViewBox = computed(() => props.viewBox || props.config.defaultViewBox)
</script>

<template>
  <div
    class="gamepad-stage"
    :style="{ aspectRatio: config.aspectRatio }"
  >
    <!-- 底壳图层 -->
    <component
      :is="activeBodySvg"
      v-if="activeBodySvg"
      class="gamepad-body-layer"
      :viewBox="effectiveViewBox"
      preserveAspectRatio="xMidYMid meet"
    />

    <!-- 按键与摇杆图层 -->
    <div class="gamepad-buttons-layer">
      <template
        v-for="(comp, i) in config.components"
        :key="`${comp.type}-${comp.logicalButton}-${i}`"
      >
        <GamepadButton
          v-if="comp.type === 'button'"
          :name="comp.name"
          :svg="comp.svg"
          :position="comp.position"
          :is-pressed="gamepad.normalizedGamepadState.buttons[comp.logicalButton]?.pressed ?? false"
          :value="gamepad.normalizedGamepadState.buttons[comp.logicalButton]?.value ?? 0"
          :is-trigger="comp.isTrigger"
          :custom-color="pressedColor"
        />
        <GamepadStick
          v-else-if="comp.type === 'stick'"
          :svg="comp.svg"
          :press-svg="comp.pressSvg"
          :position="comp.position"
          :axes="gamepad.normalizedGamepadState.sticks[comp.logicalButton] || { x: 0, y: 0 }"
          :is-pressed="
            comp.pressLogicalButton
              ? (gamepad.normalizedGamepadState.buttons[comp.pressLogicalButton]?.pressed ?? false)
              : false
          "
          :sensitivity="stickSensitivity"
          :custom-color="pressedColor"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
.gamepad-stage {
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

.gamepad-body-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}

.gamepad-buttons-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
</style>
