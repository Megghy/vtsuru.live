<script setup lang="ts">
import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import {
  NCollapseItem,
  NDivider,
  NInputNumber,
  NRadio,
  NRadioGroup,
  NSpace,
  NSwitch,
  NText,
} from 'naive-ui'
import { ref, watch } from 'vue'
import { TriggerType } from '@/apps/client/store/useAutoAction'

const props = defineProps({
  action: {
    type: Object as () => AutoActionItem,
    required: true,
  },
})

// 初始化配置项
if (props.action.triggerConfig.useGlobalTimer === undefined) {
  props.action.triggerConfig.useGlobalTimer = false // 默认不使用全局定时器
}
if (props.action.triggerConfig.schedulingMode === undefined) {
  props.action.triggerConfig.schedulingMode = 'random' // 默认随机模式
}
if (props.action.triggerConfig.intervalSeconds === undefined) {
  props.action.triggerConfig.intervalSeconds = 300 // 默认5分钟
}

const useGlobalTimer = ref(props.action.triggerConfig.useGlobalTimer)

// 同步到 action
watch(useGlobalTimer, (value) => {
  props.action.triggerConfig.useGlobalTimer = value
})

// 定时模式选项
const schedulingModeOptions = [
  { label: '随机模式', value: 'random' },
  { label: '顺序模式', value: 'sequential' },
]
</script>

<template>
  <NCollapseItem
    v-if="action.triggerType === TriggerType.SCHEDULED"
    title="定时触发设置"
  >
    <NSpace
      vertical
      :size="16"
    >
      <NSpace
        align="center"
        justify="space-between"
        style="width: 100%"
      >
        <NText>使用全局定时器设置:</NText>
        <NSwitch v-model:value="useGlobalTimer">
          <template #checked>
            是
          </template>
          <template #unchecked>
            否
          </template>
        </NSwitch>
      </NSpace>

      <NText
        type="info"
        :depth="3"
        style="font-size: 12px; margin-top: -8px;"
      >
        启用后，此操作将遵循全局定时设置（间隔、模式），忽略下方独立设置。
        全局设置需在【自动化 -> 全局配置】中修改。
      </NText>

      <NDivider
        title-placement="left"
        style="margin-top: 8px; margin-bottom: 8px;"
      >
        独立设置 (仅在不使用全局定时器时生效)
      </NDivider>

      <NSpace
        align="center"
        justify="space-between"
        style="width: 100%"
        :class="{ 'disabled-setting': useGlobalTimer }"
      >
        <span>发送间隔 (秒):</span>
        <NInputNumber
          v-model:value="action.triggerConfig.intervalSeconds"
          :min="60"
          :max="3600"
          style="width: 120px"
          :disabled="useGlobalTimer"
        />
      </NSpace>

      <NSpace
        align="center"
        justify="space-between"
        style="width: 100%"
        :class="{ 'disabled-setting': useGlobalTimer }"
      >
        <span>发送模式:</span>
        <NRadioGroup
          v-model:value="action.triggerConfig.schedulingMode"
          :disabled="useGlobalTimer"
        >
          <NSpace>
            <NRadio
              v-for="option in schedulingModeOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </NRadio>
          </NSpace>
        </NRadioGroup>
      </NSpace>
    </NSpace>
  </NCollapseItem>
</template>

<style scoped>
.disabled-setting {
  opacity: 0.5;
  pointer-events: none;
}
</style>
