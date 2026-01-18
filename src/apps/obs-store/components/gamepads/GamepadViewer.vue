<script setup lang="ts">
import type {
  TreeOption,
} from 'naive-ui'
import type { BodyOptionConfig, ControllerComponentStructure } from '@/apps/obs-store/data/gamepadConfigs'
import type { GamepadConfig, GamepadType } from '@/types/gamepad'
import { useStorage } from '@vueuse/core'
import {
  NAlert, NButton, NCard, NCheckbox, NCollapse, NCollapseItem, NColorPicker, NDescriptions, NDescriptionsItem, NDivider, NGrid, NGridItem, NInput, NInputNumber, NScrollbar, NSelect, NSlider, NFlex, NTag, NText, NTree } from 'naive-ui';
import { computed, defineAsyncComponent, h, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { controllerBodies, controllerStructures, gamepadConfigs } from '@/apps/obs-store/data/gamepadConfigs'
import { useGamepadStore } from '@/store/useGamepadStore'

const props = withDefaults(defineProps<Props>(), {
  viewBox: '',
})

const GamepadDisplay = defineAsyncComponent(() => import('./GamepadDisplay.vue'))

interface Props {
  viewBox?: string
}
// 基本设置
const selectedType = useStorage<GamepadType>('Setting.Gamepad.SelectedType', 'xbox')
const currentGamepadType = computed(() => selectedType.value)
const gamepadTypeOptions = [
  { label: 'Xbox', value: 'xbox' as GamepadType },
  { label: 'PlayStation', value: 'ps' as GamepadType },
  { label: 'Nintendo', value: 'nintendo' as GamepadType },
]

// 调试树组件相关
const selectedComponentForDebug = ref<ControllerComponentStructure | null>(null)
const controllerComponents = computed(() => controllerStructures[selectedType.value] || [])

// 存储、配置与状态
const viewBoxStorageKey = computed(() => `gamepad-viewBox-${selectedType.value}`)
const customViewBoxInput = useStorage<string>(viewBoxStorageKey, props.viewBox || '')
const useOverlayButtons = useStorage<boolean>(`Setting.Gamepad.UseOverlayButtons`, true)
const showComponentTree = ref(false)

// 摇杆灵敏度设置
const stickSensitivityStorageKey = computed(() => `gamepad-stick-sensitivity-${selectedType.value}`)
const stickSensitivity = useStorage<number>(stickSensitivityStorageKey, 5)

// 按下颜色配置
const pressedColorStorageKey = computed(() => `gamepad-pressed-color-${selectedType.value}`)
const customPressedColor = useStorage<string | null>(pressedColorStorageKey, null)
const enableCustomPressedColor = computed({
  get: () => customPressedColor.value !== null && customPressedColor.value !== 'null',
  set: (val) => {
    if (!val) {
      customPressedColor.value = null
    } else if (customPressedColor.value === null || customPressedColor.value === 'null') {
      customPressedColor.value = '#FF0000FF'
    }
  },
})

// 游戏手柄状态与配置
const gamepad = useGamepadStore()
const currentConfig = computed<GamepadConfig | undefined>(() => gamepadConfigs[selectedType.value])

// 控制器主体选项
const availableBodies = computed<BodyOptionConfig[]>(() => controllerBodies[selectedType.value] || [])
const bodyOptions = computed(() => availableBodies.value.map(body => ({
  label: body.name,
  value: body.name,
})))

const bodyIdStorageKey = computed(() => `gamepad-body-${selectedType.value}`)
const selectedBodyId = useStorage<string>(bodyIdStorageKey, '')
// 是否显示实时预览（避免首次进入即加载大体积渲染资源）
const showPreview = ref(false)

// 当手柄类型变化时重置相关配置
watch(selectedType, () => {
  nextTick(() => {
    resetViewBox()
    selectedComponentForDebug.value = null
    if (availableBodies.value.length > 0 && !availableBodies.value.some(b => b.name === selectedBodyId.value)) {
      selectedBodyId.value = availableBodies.value[0].name
    } else if (availableBodies.value.length === 0) {
      selectedBodyId.value = ''
    }
  })
}, { immediate: true })

// 确保选择的手柄主体有效
watch(() => [availableBodies.value, selectedType.value], () => {
  if (availableBodies.value.length > 0) {
    const currentSelectionIsValid = availableBodies.value.some(b => b.name === selectedBodyId.value)
    if (!currentSelectionIsValid || !selectedBodyId.value) {
      selectedBodyId.value = availableBodies.value[0].name
    }
  } else {
    selectedBodyId.value = ''
  }
}, { immediate: true, deep: true })

// 从props更新viewBox
watch(() => props.viewBox, (newVal) => {
  if (newVal && newVal !== customViewBoxInput.value) {
    customViewBoxInput.value = newVal
  }
})

// 获取默认视图框
const defaultViewBoxForCurrentConfig = computed<string>(() => {
  const selectedBodyConfig = availableBodies.value.find(b => b.name === selectedBodyId.value)
  if (selectedBodyConfig?.defaultViewBox) {
    return selectedBodyConfig.defaultViewBox
  }
  return currentConfig.value?.defaultViewBox || '0 0 1000 1000'
})

// 实际应用的视图框
const effectiveViewBoxForDisplay = computed<string | undefined>(() => {
  if (selectedType.value === 'ps') return 'PlayStation SVGs typically manage their own size'
  return customViewBoxInput.value || defaultViewBoxForCurrentConfig.value
})

// 连接状态提示
const lastConnectedInfo = ref<string>('')
const lastDisconnectedInfo = ref<string>('')
const showConnectionMessage = ref(false)
let unsubscribeConnected: (() => void) | undefined
let unsubscribeDisconnected: (() => void) | undefined

// 组件挂载时初始化
onMounted(() => {
  // 注册手柄连接/断开事件监听器
  unsubscribeConnected = gamepad.onConnected((gamepadInfo, index) => {
    lastConnectedInfo.value = `${gamepadInfo.id} (索引: ${index})`
    lastDisconnectedInfo.value = ''
    showConnectionMessage.value = true
    setTimeout(() => showConnectionMessage.value = false, 3000)
  })
  unsubscribeDisconnected = gamepad.onDisconnected((gamepadInfo, index) => {
    lastDisconnectedInfo.value = `${gamepadInfo.id} (索引: ${index})`
    lastConnectedInfo.value = ''
    showConnectionMessage.value = true
    setTimeout(() => showConnectionMessage.value = false, 3000)
  })

  // 初始化视图框和主体选择
  if (!customViewBoxInput.value && props.viewBox) {
    customViewBoxInput.value = props.viewBox
  }
  if (availableBodies.value.length > 0 && !availableBodies.value.some(b => b.name === selectedBodyId.value)) {
    selectedBodyId.value = availableBodies.value[0].name
  } else if (availableBodies.value.length === 0 && selectedBodyId.value) {
    selectedBodyId.value = ''
  }
})

// 组件卸载时清理监听器
onUnmounted(() => {
  if (unsubscribeConnected) unsubscribeConnected()
  if (unsubscribeDisconnected) unsubscribeDisconnected()
})

// 重置视图框为默认值
function resetViewBox() {
  customViewBoxInput.value = defaultViewBoxForCurrentConfig.value
}

// 重置摇杆灵敏度为默认值
function resetStickSensitivity() {
  stickSensitivity.value = 5
}

// 调试树相关函数
function findComponentByPath(components: ControllerComponentStructure[], path: string): ControllerComponentStructure | null {
  if (!path) return null

  for (const component of components) {
    if (component.path === path) return component
    if (component.childComponents) {
      const found = findComponentByPath(component.childComponents, path)
      if (found) return found
    }
  }
  return null
}

// 将控制器组件格式化为树形数据
function formatComponentsForTree(components: ControllerComponentStructure[]): TreeOption[] {
  return components.map((component) => {
    const key = component.path || `name:${component.name}:${Math.random().toString(36).substr(2, 9)}`
    return {
      key,
      label: component.name,
      children: component.childComponents ? formatComponentsForTree(component.childComponents) : undefined,
      component,
    }
  })
}

// 自定义树节点渲染
function renderComponentLabel(info: { option: any }) {
  const { option } = info
  const component = option.component as ControllerComponentStructure
  let iconType: 'default' | 'success' | 'error' | 'warning' | 'primary' | 'info' = 'default'
  switch (component.type) {
    case 'button': iconType = 'info'; break
    case 'stick': iconType = 'success'; break
    case 'trigger': iconType = 'warning'; break
    case 'dpad': iconType = 'primary'; break
    default: iconType = 'default'; break
  }
  return h('div', { style: 'display: flex; align-items: center;' }, [
    h(NTag, { type: iconType, size: 'small', style: 'margin-right: 6px;' }, { default: () => component.type }),
    option.label,
  ])
}

// 处理组件选择事件
function handleComponentSelectedForDebug(keys: string[]) {
  if (keys.length === 0) {
    selectedComponentForDebug.value = null
    return
  }

  const key = keys[0]
  if (key.startsWith('name:')) {
    const namePart = key.split(':', 2)[1]
    for (const component of controllerComponents.value) {
      if (component.name === namePart) {
        selectedComponentForDebug.value = component
        return
      }
    }
    selectedComponentForDebug.value = null
  } else {
    selectedComponentForDebug.value = findComponentByPath(controllerComponents.value, key)
  }
}

// 生成独立显示窗口URL
const gamepadDisplayUrl = computed(() => {
  const params = new URLSearchParams()
  params.append('type', selectedType.value)
  if (selectedBodyId.value) {
    params.append('bodyId', selectedBodyId.value)
  }
  params.append('overlay', String(useOverlayButtons.value))
  if (customPressedColor.value && customPressedColor.value !== 'null') {
    params.append('pressedColor', customPressedColor.value)
  } else {
    params.append('pressedColor', 'null')
  }
  if (customViewBoxInput.value) {
    params.append('viewBox', customViewBoxInput.value)
  }
  // 添加摇杆灵敏度参数
  params.append('stickSensitivity', String(stickSensitivity.value))
  return `/obs-store/gamepad?${params.toString()}`
})
</script>

<template>
  <NCard
    v-if="currentConfig"
    size="small"
    class="gamepad-settings-container"
  >
    <NFlex
      align="center"
      size="small"
    >
      <NText>选择控制器类型:</NText>
      <NSelect
        v-model:value="selectedType"
        :options="gamepadTypeOptions"
        size="small"
        style="min-width: 150px"
      />
      <NButton
        size="small"
        type="primary"
        tag="a"
        :href="gamepadDisplayUrl"
        target="_blank"
      >
        打开独立显示窗口
      </NButton>
    </NFlex>

    <NDivider size="small" />

    <NText v-if="!gamepad.isGamepadConnected">
      未检测到游戏手柄连接
    </NText>
    <NText v-else-if="gamepad.connectedGamepadInfo">
      已连接: {{ gamepad.connectedGamepadInfo.id }} ({{ gamepad.connectedGamepadInfo.mapping }})
    </NText>

    <NAlert
      v-if="showConnectionMessage"
      type="info"
      closable
      style="margin-top: 10px;"
      @close="showConnectionMessage = false"
    >
      <template v-if="lastConnectedInfo">
        手柄已连接: {{ lastConnectedInfo }}
      </template>
      <template v-else-if="lastDisconnectedInfo">
        手柄已断开连接: {{ lastDisconnectedInfo }}
      </template>
    </NAlert>

    <NFlex
      vertical
      size="small"
    >
      <NFlex
        align="center"
        size="small"
      >
        <NCheckbox v-model:checked="useOverlayButtons">
          使用叠加式按钮 (更好的交互效果)
        </NCheckbox>
        <NButton
          size="small"
          @click="showComponentTree = !showComponentTree"
        >
          {{ showComponentTree ? '隐藏' : '显示' }}控制器结构 (调试)
        </NButton>
      </NFlex>

      <NFlex
        v-if="availableBodies.length > 1"
        align="center"
        size="small"
      >
        <NText>选择手柄主体样式:</NText>
        <NSelect
          v-model:value="selectedBodyId"
          :options="bodyOptions"
          size="small"
          style="min-width: 200px"
        />
      </NFlex>

      <NDivider title-placement="left">
        按键按下效果
      </NDivider>
      <NFlex align="center">
        <NCheckbox v-model:checked="enableCustomPressedColor">
          自定义按下颜色
        </NCheckbox>
        <NColorPicker
          v-if="enableCustomPressedColor"
          v-model:value="customPressedColor"
          :show-alpha="true"
          size="small"
        />
        <NText v-else>
          (默认使用反色效果)
        </NText>
      </NFlex>

      <NDivider title-placement="left">
        摇杆灵敏度
      </NDivider>
      <NFlex
        vertical
        size="small"
      >
        <NFlex align="center">
          <NText>移动幅度: {{ stickSensitivity }}</NText>
          <NSlider
            v-model:value="stickSensitivity"
            :min="1"
            :max="20"
            :step="1"
            style="min-width: 200px; max-width: 300px"
          />
          <NInputNumber
            v-model:value="stickSensitivity"
            :min="1"
            :max="40"
            size="small"
            style="width: 80px"
          />
          <NButton
            size="small"
            @click="resetStickSensitivity"
          >
            重置
          </NButton>
        </NFlex>
        <NText
          size="small"
          depth="3"
        >
          数值越大，摇杆移动幅度越大。默认值为5。
        </NText>
      </NFlex>

      <NCard
        title="手柄实时预览"
        size="small"
        style="margin-top: 10px;"
      >
        <NFlex align="center" size="small" style="margin-bottom: 6px;">
          <NButton size="small" type="info" @click="showPreview = !showPreview">
            {{ showPreview ? '隐藏预览' : '显示预览' }}
          </NButton>
        </NFlex>
        <div v-if="showPreview" style="position: relative; width: 100%; height: 300px; background-color: var(--n-color-embedded); border: 1px solid var(--n-border-color); border-radius: var(--n-border-radius); overflow: hidden;">
          <GamepadDisplay
            :key="selectedType"
            :type="selectedType"
            :body-id="selectedBodyId"
            :overlay="useOverlayButtons"
            :pressed-color="enableCustomPressedColor ? customPressedColor : null"
            :view-box="customViewBoxInput"
            :fullscreen-mode="false"
            :inline-mode="true"
            :stick-sensitivity="stickSensitivity"
          />
        </div>
      </NCard>

      <NGrid
        :cols="1"
      >
        <NGridItem v-if="showComponentTree">
          <NCard
            size="small"
            title="控制器结构 (数据视图)"
          >
            <NFlex vertical>
              <NScrollbar style="max-height: 300px;">
                <NTree
                  :data="formatComponentsForTree(controllerComponents)"
                  selectable
                  :render-label="renderComponentLabel"
                  @update:selected-keys="handleComponentSelectedForDebug"
                />
              </NScrollbar>
              <div
                v-if="selectedComponentForDebug"
                class="selected-component-info"
              >
                <NDivider title-placement="left">
                  选中组件信息 (调试)
                </NDivider>
                <NDescriptions
                  bordered
                  size="small"
                >
                  <NDescriptionsItem label="名称">
                    {{ selectedComponentForDebug.name }}
                  </NDescriptionsItem>
                  <NDescriptionsItem label="类型">
                    {{ selectedComponentForDebug.type }}
                  </NDescriptionsItem>
                  <NDescriptionsItem label="SVG路径">
                    {{ selectedComponentForDebug.path || '无' }}
                  </NDescriptionsItem>
                  <NDescriptionsItem label="逻辑按键">
                    {{ selectedComponentForDebug.logicalButton || 'N/A' }}
                  </NDescriptionsItem>
                </NDescriptions>
              </div>
            </NFlex>
          </NCard>
        </NGridItem>
      </NGrid>

      <NCollapse>
        <NCollapseItem title="高级布局设置 (用于独立显示窗口)">
          <NFlex vertical>
            <NFlex align="center">
              <NText>自定义ViewBox:</NText>
              <NInput
                v-model:value="customViewBoxInput"
                placeholder="例如: 0 0 1543 956"
                size="small"
                style="width: 200px"
              />
              <NButton
                size="small"
                @click="resetViewBox"
              >
                重置
              </NButton>
            </NFlex>
            <NText size="small">
              ViewBox格式: minX minY width height. 当前生效: {{ effectiveViewBoxForDisplay }}
            </NText>
          </NFlex>
        </NCollapseItem>
      </NCollapse>
    </NFlex>
  </NCard>
  <NCard v-else>
    无效的游戏手柄类型: {{ currentGamepadType }}
  </NCard>
</template>

<style scoped>
.gamepad-settings-container {
  max-width: 700px;
  margin: 20px auto;
}
.custom-scrollbar {
  max-height: 300px;
}
.selected-component-info {
  margin-top: 10px;
}
</style>
