<template>
  <n-card
    v-if="currentConfig"
    size="small"
    class="gamepad-settings-container"
  >
    <n-space
      align="center"
      size="small"
    >
      <n-text>选择控制器类型:</n-text>
      <n-select
        v-model:value="selectedType"
        :options="gamepadTypeOptions"
        size="small"
        style="min-width: 150px"
      />
      <n-button
        size="small"
        type="primary"
        tag="a"
        :href="gamepadDisplayUrl"
        target="_blank"
      >
        打开独立显示窗口
      </n-button>
    </n-space>

    <n-divider size="small" />

    <n-text v-if="!gamepad.isGamepadConnected">
      未检测到游戏手柄连接
    </n-text>
    <n-text v-else-if="gamepad.connectedGamepadInfo">
      已连接: {{ gamepad.connectedGamepadInfo.id }} ({{ gamepad.connectedGamepadInfo.mapping }})
    </n-text>

    <n-alert
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
    </n-alert>

    <n-space
      vertical
      size="small"
    >
      <n-space
        align="center"
        size="small"
      >
        <n-checkbox v-model:checked="useOverlayButtons">
          使用叠加式按钮 (更好的交互效果)
        </n-checkbox>
        <n-button
          size="small"
          @click="showComponentTree = !showComponentTree"
        >
          {{ showComponentTree ? '隐藏' : '显示' }}控制器结构 (调试)
        </n-button>
      </n-space>

      <n-space
        v-if="availableBodies.length > 1"
        align="center"
        size="small"
      >
        <n-text>选择手柄主体样式:</n-text>
        <n-select
          v-model:value="selectedBodyId"
          :options="bodyOptions"
          size="small"
          style="min-width: 200px"
        />
      </n-space>

      <n-divider title-placement="left">
        按键按下效果
      </n-divider>
      <n-space align="center">
        <n-checkbox v-model:checked="enableCustomPressedColor">
          自定义按下颜色
        </n-checkbox>
        <n-color-picker
          v-if="enableCustomPressedColor"
          v-model:value="customPressedColor"
          :show-alpha="true"
          size="small"
        />
        <n-text v-else>
          (默认使用反色效果)
        </n-text>
      </n-space>

      <n-divider title-placement="left">
        摇杆灵敏度
      </n-divider>
      <n-space
        vertical
        size="small"
      >
        <n-space align="center">
          <n-text>移动幅度: {{ stickSensitivity }}</n-text>
          <n-slider
            v-model:value="stickSensitivity"
            :min="1"
            :max="20"
            :step="1"
            style="min-width: 200px; max-width: 300px"
          />
          <n-input-number
            v-model:value="stickSensitivity"
            :min="1"
            :max="40"
            size="small"
            style="width: 80px"
          />
          <n-button
            size="small"
            @click="resetStickSensitivity"
          >
            重置
          </n-button>
        </n-space>
        <n-text
          size="small"
          depth="3"
        >
          数值越大，摇杆移动幅度越大。默认值为5。
        </n-text>
      </n-space>

      <n-card
        title="手柄实时预览"
        size="small"
        style="margin-top: 10px;"
      >
        <div style="position: relative; width: 100%; height: 300px; background-color: #333; border-radius: 8px; overflow: hidden;">
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
      </n-card>

      <n-grid
        :cols="1"
      >
        <n-grid-item v-if="showComponentTree">
          <n-card
            size="small"
            title="控制器结构 (数据视图)"
          >
            <n-space vertical>
              <n-scrollbar style="max-height: 300px;">
                <n-tree
                  :data="formatComponentsForTree(controllerComponents)"
                  selectable
                  :render-label="renderComponentLabel"
                  @update:selected-keys="handleComponentSelectedForDebug"
                />
              </n-scrollbar>
              <div
                v-if="selectedComponentForDebug"
                class="selected-component-info"
              >
                <n-divider title-placement="left">
                  选中组件信息 (调试)
                </n-divider>
                <n-descriptions
                  bordered
                  size="small"
                >
                  <n-descriptions-item label="名称">
                    {{ selectedComponentForDebug.name }}
                  </n-descriptions-item>
                  <n-descriptions-item label="类型">
                    {{ selectedComponentForDebug.type }}
                  </n-descriptions-item>
                  <n-descriptions-item label="SVG路径">
                    {{ selectedComponentForDebug.path || '无' }}
                  </n-descriptions-item>
                  <n-descriptions-item label="逻辑按键">
                    {{ selectedComponentForDebug.logicalButton || 'N/A' }}
                  </n-descriptions-item>
                </n-descriptions>
              </div>
            </n-space>
          </n-card>
        </n-grid-item>
      </n-grid>

      <n-collapse>
        <n-collapse-item title="高级布局设置 (用于独立显示窗口)">
          <n-space vertical>
            <n-space align="center">
              <n-text>自定义ViewBox:</n-text>
              <n-input
                v-model:value="customViewBoxInput"
                placeholder="例如: 0 0 1543 956"
                size="small"
                style="width: 200px"
              />
              <n-button
                size="small"
                @click="resetViewBox"
              >
                重置
              </n-button>
            </n-space>
            <n-text size="small">
              ViewBox格式: minX minY width height. 当前生效: {{ effectiveViewBoxForDisplay }}
            </n-text>
          </n-space>
        </n-collapse-item>
      </n-collapse>
    </n-space>
  </n-card>
  <n-card v-else>
    无效的游戏手柄类型: {{ currentGamepadType }}
  </n-card>
</template>

<script setup lang="ts">
import { computed, watch, ref, onMounted, nextTick, h, onUnmounted } from 'vue';
import type { GamepadType, GamepadConfig } from '@/types/gamepad';
import GamepadDisplay from './GamepadDisplay.vue';
import { gamepadConfigs, controllerBodies, BodyOptionConfig, controllerStructures, ControllerComponentStructure } from '@/data/gamepadConfigs';
import { useGamepadStore } from '@/store/useGamepadStore';
import { useStorage } from '@vueuse/core';
import {
  NCard, NSpace, NButton, NCheckbox, NSelect, NText, NCollapse,
  NCollapseItem, NInput, NScrollbar, NDivider,
  NTag, NColorPicker, NGrid, NGridItem, NTree, NDescriptions,
  NDescriptionsItem, NAlert, NSlider, NInputNumber,
  TreeOption
} from 'naive-ui';

interface Props {
  viewBox?: string;
}
const props = withDefaults(defineProps<Props>(), {
  viewBox: '',
});

// 基本设置
const selectedType = useStorage<GamepadType>('Setting.Gamepad.SelectedType', 'xbox');
const currentGamepadType = computed(() => selectedType.value);
const gamepadTypeOptions = [
  { label: 'Xbox', value: 'xbox' as GamepadType },
  { label: 'PlayStation', value: 'ps' as GamepadType },
  { label: 'Nintendo', value: 'nintendo' as GamepadType }
];

// 调试树组件相关
const selectedComponentForDebug = ref<ControllerComponentStructure | null>(null);
const controllerComponents = computed(() => controllerStructures[selectedType.value] || []);

// 存储、配置与状态
const viewBoxStorageKey = computed(() => `gamepad-viewBox-${selectedType.value}`);
const customViewBoxInput = useStorage<string>(viewBoxStorageKey, props.viewBox || '');
const useOverlayButtons = useStorage<boolean>(`Setting.Gamepad.UseOverlayButtons`, true);
const showComponentTree = ref(false);

// 摇杆灵敏度设置
const stickSensitivityStorageKey = computed(() => `gamepad-stick-sensitivity-${selectedType.value}`);
const stickSensitivity = useStorage<number>(stickSensitivityStorageKey, 5);

// 按下颜色配置
const pressedColorStorageKey = computed(() => `gamepad-pressed-color-${selectedType.value}`);
const customPressedColor = useStorage<string | null>(pressedColorStorageKey, null);
const enableCustomPressedColor = computed({
  get: () => customPressedColor.value !== null && customPressedColor.value !== 'null',
  set: (val) => {
    if (!val) {
      customPressedColor.value = null;
    } else if (customPressedColor.value === null || customPressedColor.value === 'null') {
      customPressedColor.value = '#FF0000FF';
    }
  }
});

// 游戏手柄状态与配置
const gamepad = useGamepadStore();
const currentConfig = computed<GamepadConfig | undefined>(() => gamepadConfigs[selectedType.value]);

// 控制器主体选项
const availableBodies = computed<BodyOptionConfig[]>(() => controllerBodies[selectedType.value] || []);
const bodyOptions = computed(() => availableBodies.value.map(body => ({
  label: body.name,
  value: body.name
})));

const bodyIdStorageKey = computed(() => `gamepad-body-${selectedType.value}`);
const selectedBodyId = useStorage<string>(bodyIdStorageKey, '');

// 当手柄类型变化时重置相关配置
watch(selectedType, () => {
  nextTick(() => {
    resetViewBox();
    selectedComponentForDebug.value = null;
    if (availableBodies.value.length > 0 && !availableBodies.value.some(b => b.name === selectedBodyId.value)) {
      selectedBodyId.value = availableBodies.value[0].name;
    } else if (availableBodies.value.length === 0) {
      selectedBodyId.value = '';
    }
  });
}, { immediate: true });

// 确保选择的手柄主体有效
watch(() => [availableBodies.value, selectedType.value], () => {
  if (availableBodies.value.length > 0) {
    const currentSelectionIsValid = availableBodies.value.some(b => b.name === selectedBodyId.value);
    if (!currentSelectionIsValid || !selectedBodyId.value) {
      selectedBodyId.value = availableBodies.value[0].name;
    }
  } else {
    selectedBodyId.value = '';
  }
}, { immediate: true, deep: true });

// 从props更新viewBox
watch(() => props.viewBox, (newVal) => {
  if (newVal && newVal !== customViewBoxInput.value) {
    customViewBoxInput.value = newVal;
  }
});

// 获取默认视图框
const defaultViewBoxForCurrentConfig = computed<string>(() => {
  const selectedBodyConfig = availableBodies.value.find(b => b.name === selectedBodyId.value);
  if (selectedBodyConfig?.defaultViewBox) {
    return selectedBodyConfig.defaultViewBox;
  }
  return currentConfig.value?.defaultViewBox || '0 0 1000 1000';
});

// 实际应用的视图框
const effectiveViewBoxForDisplay = computed<string | undefined>(() => {
  if (selectedType.value === 'ps') return 'PlayStation SVGs typically manage their own size';
  return customViewBoxInput.value || defaultViewBoxForCurrentConfig.value;
});

// 连接状态提示
const lastConnectedInfo = ref<string>('');
const lastDisconnectedInfo = ref<string>('');
const showConnectionMessage = ref(false);
let unsubscribeConnected: (() => void) | undefined;
let unsubscribeDisconnected: (() => void) | undefined;

// 组件挂载时初始化
onMounted(() => {
  // 注册手柄连接/断开事件监听器
  unsubscribeConnected = gamepad.onConnected((gamepadInfo, index) => {
    lastConnectedInfo.value = `${gamepadInfo.id} (索引: ${index})`;
    lastDisconnectedInfo.value = '';
    showConnectionMessage.value = true;
    setTimeout(() => showConnectionMessage.value = false, 3000);
  });
  unsubscribeDisconnected = gamepad.onDisconnected((gamepadInfo, index) => {
    lastDisconnectedInfo.value = `${gamepadInfo.id} (索引: ${index})`;
    lastConnectedInfo.value = '';
    showConnectionMessage.value = true;
    setTimeout(() => showConnectionMessage.value = false, 3000);
  });

  // 初始化视图框和主体选择
  if (!customViewBoxInput.value && props.viewBox) {
    customViewBoxInput.value = props.viewBox;
  }
  if (availableBodies.value.length > 0 && !availableBodies.value.some(b => b.name === selectedBodyId.value)) {
    selectedBodyId.value = availableBodies.value[0].name;
  } else if (availableBodies.value.length === 0 && selectedBodyId.value) {
    selectedBodyId.value = '';
  }
});

// 组件卸载时清理监听器
onUnmounted(() => {
  if (unsubscribeConnected) unsubscribeConnected();
  if (unsubscribeDisconnected) unsubscribeDisconnected();
});

// 重置视图框为默认值
const resetViewBox = () => {
  customViewBoxInput.value = defaultViewBoxForCurrentConfig.value;
};

// 重置摇杆灵敏度为默认值
const resetStickSensitivity = () => {
  stickSensitivity.value = 5;
};

// 调试树相关函数
function findComponentByPath(components: ControllerComponentStructure[], path: string): ControllerComponentStructure | null {
  if (!path) return null;

  for (const component of components) {
    if (component.path === path) return component;
    if (component.childComponents) {
      const found = findComponentByPath(component.childComponents, path);
      if (found) return found;
    }
  }
  return null;
}

// 将控制器组件格式化为树形数据
function formatComponentsForTree(components: ControllerComponentStructure[]): TreeOption[] {
  return components.map(component => {
    const key = component.path || `name:${component.name}:${Math.random().toString(36).substr(2, 9)}`;
    return {
      key,
      label: component.name,
      children: component.childComponents ? formatComponentsForTree(component.childComponents) : undefined,
      component
    };
  });
}

// 自定义树节点渲染
function renderComponentLabel(info: { option: any }) {
  const { option } = info;
  const component = option.component as ControllerComponentStructure;
  let iconType: "default" | "success" | "error" | "warning" | "primary" | "info" = 'default';
  switch (component.type) {
    case 'button': iconType = 'info'; break;
    case 'stick': iconType = 'success'; break;
    case 'trigger': iconType = 'warning'; break;
    case 'dpad': iconType = 'primary'; break;
    default: iconType = 'default'; break;
  }
  return h('div', { style: 'display: flex; align-items: center;' }, [
    h(NTag, { type: iconType, size: 'small', style: 'margin-right: 6px;' }, { default: () => component.type }),
    option.label
  ]);
}

// 处理组件选择事件
function handleComponentSelectedForDebug(keys: string[]) {
  if (keys.length === 0) {
    selectedComponentForDebug.value = null;
    return;
  }

  const key = keys[0];
  if (key.startsWith('name:')) {
    const namePart = key.split(':', 2)[1];
    for (const component of controllerComponents.value) {
      if (component.name === namePart) {
        selectedComponentForDebug.value = component;
        return;
      }
    }
    selectedComponentForDebug.value = null;
  } else {
    selectedComponentForDebug.value = findComponentByPath(controllerComponents.value, key);
  }
}

// 生成独立显示窗口URL
const gamepadDisplayUrl = computed(() => {
  const params = new URLSearchParams();
  params.append('type', selectedType.value);
  if (selectedBodyId.value) {
    params.append('bodyId', selectedBodyId.value);
  }
  params.append('overlay', String(useOverlayButtons.value));
  if (customPressedColor.value && customPressedColor.value !== 'null') {
    params.append('pressedColor', customPressedColor.value);
  } else {
    params.append('pressedColor', 'null');
  }
  if (customViewBoxInput.value) {
    params.append('viewBox', customViewBoxInput.value);
  }
  // 添加摇杆灵敏度参数
  params.append('stickSensitivity', String(stickSensitivity.value));
  return `/obs-store/gamepad?${params.toString()}`;
});
</script>

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