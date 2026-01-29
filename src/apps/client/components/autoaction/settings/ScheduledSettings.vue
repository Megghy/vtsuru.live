<script setup lang="ts">
import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { NDivider, NInputNumber, NRadio, NRadioGroup, NFlex, NSwitch, NText, NForm, NFormItem, NTooltip, NIcon } from 'naive-ui';
import { ref, watch } from 'vue'
import { TriggerType } from '@/apps/client/store/useAutoAction'
import { Info16Regular } from '@vicons/fluent'

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
  { label: '随机模式 (每次随机选一个模板)', value: 'random' },
  { label: '顺序模式 (按列表顺序循环)', value: 'sequential' },
]
</script>

<template>
  <div v-if="action.triggerType === TriggerType.SCHEDULED" class="scheduled-trigger-settings">
    <NForm label-placement="left" :label-width="140" size="small" :show-feedback="false">
      <NFlex vertical :size="16">
        <NFormItem label="使用全局设置">
          <template #label>
            <NTooltip trigger="hover">
              <template #trigger>
                <span>使用全局设置 <NIcon :component="Info16Regular" style="vertical-align: -2px" /></span>
              </template>
              开启后将遵循【自动化 -> 消息队列】中的全局定时设置
            </NTooltip>
          </template>
          <NSwitch v-model:value="useGlobalTimer">
            <template #checked>
              是
            </template>
            <template #unchecked>
              否
            </template>
          </NSwitch>
        </NFormItem>

        <transition name="fade">
          <div v-if="useGlobalTimer" class="info-box">
            <NText depth="3" style="font-size: 12px;">
              当前正在使用全局定时器。此操作将与其他全局任务共享发送频率和顺序。
              <br>修改全局间隔请前往：功能设置 -> 消息队列。
            </NText>
          </div>
        </transition>

        <NDivider title-placement="left" style="margin: 8px 0;">
          <NText strong depth="2">
            独立定时设置
          </NText>
        </NDivider>

        <div :class="{ 'disabled-overlay': useGlobalTimer }">
          <NFlex vertical :size="12">
            <NFormItem label="发送间隔 (秒)">
              <NInputNumber
                v-model:value="action.triggerConfig.intervalSeconds"
                :min="10"
                :max="86400"
                style="width: 140px"
                :disabled="useGlobalTimer"
                placeholder="300"
              >
                <template #suffix>
                  秒
                </template>
              </NInputNumber>
            </NFormItem>

            <NFormItem label="发送模式">
              <NRadioGroup
                v-model:value="action.triggerConfig.schedulingMode"
                :disabled="useGlobalTimer"
              >
                <NFlex vertical :size="8">
                  <NRadio
                    v-for="option in schedulingModeOptions"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </NRadio>
                </NFlex>
              </NRadioGroup>
            </NFormItem>
          </NFlex>
        </div>
      </NFlex>
    </NForm>
  </div>
</template>

<style scoped>
.scheduled-trigger-settings {
  width: 100%;
}

.info-box {
  padding: 8px 12px;
  background-color: var(--n-action-color);
  border-radius: var(--n-border-radius);
  border-left: 4px solid var(--n-info-color);
}

.disabled-overlay {
  opacity: 0.5;
  pointer-events: none;
  filter: grayscale(0.5);
  transition: all 0.3s ease;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
