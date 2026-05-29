<script setup lang="ts">
import type { GamepadType } from '@/types/gamepad'
import { usePersistedStorage } from '@/shared/storage/persist'
import {
  NAlert, NButton, NCard, NCheckbox, NCollapse, NCollapseItem,
  NColorPicker, NDivider, NFlex, NInput, NInputNumber, NSelect,
  NSlider, NText,
} from 'naive-ui'
import { computed, defineAsyncComponent, ref } from 'vue'
import { controllerBodies, gamepadConfigs } from '@/apps/obs-store/data/gamepadConfigs'
import { useGamepadStore } from '@/store/useGamepadStore'

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
const bodyOptions = computed(() => bodies.value.map(b => ({ label: b.name, value: b.name })))

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
  set: (v) => { customPressedColor.value = v ? '#FF0000FF' : null },
})

// --- 预览 ---
const showPreview = ref(false)

// --- 连接状态 ---
const gamepad = useGamepadStore()

// 确保 body 选择有效
const validBodyId = computed(() => {
  if (bodies.value.length === 0) return ''
  if (bodies.value.some(b => b.name === selectedBodyId.value)) return selectedBodyId.value
  return bodies.value[0].name
})

// 默认 viewBox
const defaultViewBox = computed(() => {
  const body = bodies.value.find(b => b.name === validBodyId.value)
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
  <NCard v-if="config" size="small" style="max-width: 720px; margin: 20px auto;">
    <!-- 类型选择 + 独立窗口 -->
    <NFlex align="center" size="small" :wrap="true">
      <NText>控制器类型:</NText>
      <NSelect v-model:value="selectedType" :options="gamepadTypeOptions" size="small" style="min-width: 140px" />
      <NButton size="small" type="primary" tag="a" :href="displayUrl" target="_blank">
        独立显示窗口
      </NButton>
    </NFlex>

    <NDivider style="margin: 12px 0" />

    <!-- 连接状态 -->
    <NAlert v-if="!gamepad.isGamepadConnected" type="warning" :bordered="false" style="margin-bottom: 12px">
      未检测到游戏手柄连接
    </NAlert>
    <NAlert v-else type="success" :bordered="false" style="margin-bottom: 12px">
      已连接: {{ gamepad.connectedGamepadInfo?.id }}
    </NAlert>

    <!-- 设置区域 -->
    <NFlex vertical size="small">
      <!-- 主体样式 -->
      <NFlex v-if="bodyOptions.length > 1" align="center" size="small">
        <NText>手柄样式:</NText>
        <NSelect v-model:value="selectedBodyId" :options="bodyOptions" size="small" style="min-width: 200px" />
      </NFlex>

      <!-- 渲染模式 -->
      <NCheckbox v-model:checked="useOverlayButtons">
        叠加式按钮 (更好的交互效果)
      </NCheckbox>

      <!-- 按下颜色 -->
      <NDivider title-placement="left" style="margin: 8px 0">
        按键按下效果
      </NDivider>
      <NFlex align="center" size="small">
        <NCheckbox v-model:checked="enableCustomColor">
          自定义按下颜色
        </NCheckbox>
        <NColorPicker
          v-if="enableCustomColor"
          v-model:value="customPressedColor"
          :show-alpha="true"
          size="small"
          style="width: 120px"
        />
        <NText v-else depth="3">
          (默认反色)
        </NText>
      </NFlex>

      <!-- 摇杆灵敏度 -->
      <NDivider title-placement="left" style="margin: 8px 0">
        摇杆灵敏度
      </NDivider>
      <NFlex align="center" size="small" :wrap="true">
        <NSlider v-model:value="stickSensitivity" :min="1" :max="20" :step="1" style="min-width: 180px; max-width: 280px" />
        <NInputNumber v-model:value="stickSensitivity" :min="1" :max="40" size="small" style="width: 72px" />
        <NButton size="small" @click="stickSensitivity = 5">
          重置
        </NButton>
      </NFlex>
      <NText depth="3" style="font-size: 12px">
        数值越大移动幅度越大，默认 5
      </NText>

      <!-- 实时预览 -->
      <NDivider style="margin: 8px 0" />
      <NButton size="small" type="info" @click="showPreview = !showPreview">
        {{ showPreview ? '隐藏预览' : '显示预览' }}
      </NButton>
      <div v-if="showPreview" class="preview-box">
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

      <!-- 高级设置 -->
      <NCollapse>
        <NCollapseItem title="高级布局设置 (独立显示窗口)">
          <NFlex align="center" size="small">
            <NText>ViewBox:</NText>
            <NInput v-model:value="customViewBox" :placeholder="defaultViewBox" size="small" style="width: 180px" />
            <NButton size="small" @click="customViewBox = ''">
              重置
            </NButton>
          </NFlex>
        </NCollapseItem>
      </NCollapse>
    </NFlex>
  </NCard>
  <NCard v-else>
    无效的游戏手柄类型
  </NCard>
</template>

<style scoped>
.preview-box {
  position: relative;
  width: 100%;
  height: 300px;
  background: var(--n-color-embedded);
  border: 1px solid var(--n-border-color);
  border-radius: var(--n-border-radius);
  overflow: hidden;
}
</style>

