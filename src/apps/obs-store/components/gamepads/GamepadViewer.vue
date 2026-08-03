<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue'

import { controllerBodies, gamepadConfigs } from '@/apps/obs-store/data/gamepadConfigs'
import { usePersistedStorage } from '@/shared/storage/persist'
import { useGamepadStore } from '@/store/useGamepadStore'
import type { GamepadType } from '@/types/gamepad'

const GamepadDisplay = defineAsyncComponent(() => import('./GamepadDisplay.vue'))

// --- 基本设置 ---
const selectedType = usePersistedStorage<GamepadType>('Setting.Gamepad.SelectedType', 'xbox')
const gamepadTypeOptions = [
  { label: 'Xbox', value: 'xbox' as GamepadType },
  { label: 'PlayStation', value: 'ps' as GamepadType },
  { label: 'Nintendo', value: 'nintendo' as GamepadType },
]

const config = computed(() => gamepadConfigs[selectedType.value])
const bodies = computed(() => controllerBodies[selectedType.value] || [])
const bodyOptions = computed(() => bodies.value.map((b) => ({ label: b.name, value: b.name })))

// --- 持久化设置 ---
const bodyKey = computed(() => `gamepad-body-${selectedType.value}`)
const selectedBodyId = usePersistedStorage<string>(bodyKey, '')
const useOverlayButtons = usePersistedStorage<boolean>('Setting.Gamepad.UseOverlayButtons', true)

const viewBoxKey = computed(() => `gamepad-viewBox-${selectedType.value}`)
const customViewBox = usePersistedStorage<string>(viewBoxKey, '')

const sensitivityKey = computed(() => `gamepad-stick-sensitivity-${selectedType.value}`)
const stickSensitivity = usePersistedStorage<number>(sensitivityKey, 5)

const pressedColorKey = computed(() => `gamepad-pressed-color-${selectedType.value}`)
const customPressedColor = usePersistedStorage<string | null>(pressedColorKey, null)
const enableCustomColor = computed({
  get: () => customPressedColor.value != null && customPressedColor.value !== 'null',
  set: (v) => {
    customPressedColor.value = v ? '#FF0000FF' : null
  },
})

// --- 预览 ---
const showPreview = ref(false)

// --- 连接状态 ---
const gamepad = useGamepadStore()

// 确保 body 选择有效
const validBodyId = computed(() => {
  if (bodies.value.length === 0) return ''
  if (bodies.value.some((b) => b.name === selectedBodyId.value)) return selectedBodyId.value
  return bodies.value[0].name
})

// 默认 viewBox
const defaultViewBox = computed(() => {
  const body = bodies.value.find((b) => b.name === validBodyId.value)
  return body?.defaultViewBox || config.value?.defaultViewBox || '0 0 1000 1000'
})

// 独立显示窗口 URL
const displayUrl = computed(() => {
  const p = new URLSearchParams()
  p.set('type', selectedType.value)
  if (validBodyId.value) p.set('bodyId', validBodyId.value)
  p.set('overlay', String(useOverlayButtons.value))
  p.set('pressedColor', customPressedColor.value ?? 'null')
  if (customViewBox.value) p.set('viewBox', customViewBox.value)
  p.set('stickSensitivity', String(stickSensitivity.value))
  return `/obs-store/gamepad?${p.toString()}`
})
</script>

<template>
  <section
    v-if="config"
    class="gamepad-settings"
  >
    <div class="setting-row">
      <span>控制器类型</span>
      <USelect
        v-model="selectedType"
        :options="gamepadTypeOptions"
        class="setting-select"
      />
      <UButton
        as="a"
        :href="displayUrl"
        target="_blank"
        icon="i-lucide-external-link"
      >
        独立显示窗口
      </UButton>
    </div>

    <USeparator />

    <UAlert
      v-if="!gamepad.isGamepadConnected"
      color="warning"
      icon="i-lucide-gamepad-2"
      title="未检测到游戏手柄连接"
    />
    <UAlert
      v-else
      color="success"
      icon="i-lucide-circle-check"
      :title="`已连接: ${gamepad.connectedGamepadInfo?.id}`"
    />

    <div class="settings-stack">
      <div
        v-if="bodyOptions.length > 1"
        class="setting-row"
      >
        <span>手柄样式</span>
        <USelect
          v-model="selectedBodyId"
          :options="bodyOptions"
          class="body-select"
        />
      </div>

      <UCheckbox
        v-model="useOverlayButtons"
        label="叠加式按钮（更好的交互效果）"
      />

      <USeparator label="按键按下效果" />
      <div class="setting-row">
        <UCheckbox
          v-model="enableCustomColor"
          label="自定义按下颜色"
        />
        <UColorPicker
          v-if="enableCustomColor"
          v-model="customPressedColor"
        />
        <span
          v-else
          class="setting-hint"
        >
          默认反色
        </span>
      </div>

      <USeparator label="摇杆灵敏度" />
      <div class="sensitivity-row">
        <USlider
          v-model="stickSensitivity"
          :min="1"
          :max="20"
          :step="1"
          class="sensitivity-slider"
        />
        <UInputNumber
          v-model="stickSensitivity"
          :min="1"
          :max="40"
          class="sensitivity-input"
        />
        <UButton
          color="neutral"
          variant="soft"
          @click="stickSensitivity = 5"
        >
          重置
        </UButton>
      </div>
      <p class="setting-hint">数值越大移动幅度越大，默认 5</p>

      <USeparator />
      <UButton
        color="neutral"
        variant="soft"
        :icon="showPreview ? 'i-lucide-eye-off' : 'i-lucide-eye'"
        @click="showPreview = !showPreview"
      >
        {{ showPreview ? '隐藏预览' : '显示预览' }}
      </UButton>
      <div
        v-if="showPreview"
        class="preview-box"
      >
        <GamepadDisplay
          :key="selectedType"
          :type="selectedType"
          :body-id="validBodyId"
          :overlay="useOverlayButtons"
          :pressed-color="enableCustomColor ? customPressedColor : null"
          :view-box="customViewBox || undefined"
          :fullscreen-mode="false"
          :inline-mode="true"
          :stick-sensitivity="stickSensitivity"
        />
      </div>

      <UCollapsible class="advanced-settings">
        <UButton
          label="高级布局设置（独立显示窗口）"
          color="neutral"
          variant="ghost"
          trailing-icon="i-lucide-chevron-down"
          block
        />
        <template #content>
          <div class="setting-row advanced-content">
            <span>ViewBox</span>
            <UInput
              v-model="customViewBox"
              :placeholder="defaultViewBox"
              class="viewbox-input"
            />
            <UButton
              color="neutral"
              variant="soft"
              @click="customViewBox = ''"
            >
              重置
            </UButton>
          </div>
        </template>
      </UCollapsible>
    </div>
  </section>
  <UEmpty
    v-else
    icon="i-lucide-gamepad-2"
    title="无效的游戏手柄类型"
  />
</template>

<style scoped>
.gamepad-settings {
  display: grid;
  gap: 16px;
  max-width: 720px;
  margin: 20px auto;
  padding: 20px;
  background: var(--vtsuru-bg-elevated);
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
}

.settings-stack {
  display: grid;
  gap: 14px;
}

.setting-row,
.sensitivity-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.setting-select {
  min-width: 140px;
}

.body-select {
  min-width: 200px;
}

.sensitivity-slider {
  flex: 1;
  min-width: 180px;
  max-width: 280px;
}

.sensitivity-input {
  width: 84px;
}

.setting-hint {
  margin: 0;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}

.advanced-settings {
  border-top: 1px solid var(--vtsuru-border-muted);
}

.advanced-content {
  padding: 10px 0;
}

.viewbox-input {
  width: min(100%, 220px);
}

.preview-box {
  position: relative;
  width: 100%;
  height: 300px;
  background: var(--vtsuru-bg-inset);
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
  overflow: hidden;
}
</style>
