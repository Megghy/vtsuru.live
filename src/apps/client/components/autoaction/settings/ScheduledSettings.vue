<script setup lang="ts">
import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
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

// 双向绑定到 action, 保证父组件修改也能同步到子组件
const useGlobalTimer = computed({
  get: () => props.action.triggerConfig.useGlobalTimer,
  set: (value) => {
    props.action.triggerConfig.useGlobalTimer = value
  },
})

// 定时模式选项
const schedulingModeOptions = [
  { label: '随机模式 (每次随机选一个模板)', value: 'random' },
  { label: '顺序模式 (按列表顺序循环)', value: 'sequential' },
]
</script>

<template>
  <div
    v-if="action.triggerType === TriggerType.SCHEDULED"
    class="scheduled-trigger-settings"
  >
    <UForm
      label-placement="left"
      :label-width="140"
      size="small"
      :show-feedback="false"
    >
      <div
        vertical
        :size="16"
      >
        <UFormField label="使用全局设置">
          <template #label>
            <UTooltip>
              <span
                >使用全局设置
                <UIcon
                  name="i-lucide-circle"
                  style="vertical-align: -2px"
              /></span>
              <template #content> 开启后将遵循【自动化 -> 消息队列】中的全局定时设置 </template>
            </UTooltip>
          </template>
          <USwitch v-model="useGlobalTimer">
            <template v-if="false"> 是 </template>
            <template v-if="false"> 否 </template>
          </USwitch>
        </UFormField>

        <transition name="fade">
          <div
            v-if="useGlobalTimer"
            class="info-box"
          >
            <span
              depth="3"
              style="font-size: 12px"
            >
              当前正在使用全局定时器。此操作将与其他全局任务共享发送频率和顺序。
              <br />修改全局间隔请前往：功能设置 -> 消息队列。
            </span>
          </div>
        </transition>

        <USeparator
          title-placement="left"
          style="margin: 8px 0"
        >
          <span
            strong
            depth="2"
          >
            独立定时设置
          </span>
        </USeparator>

        <div :class="{ 'disabled-overlay': useGlobalTimer }">
          <div
            vertical
            :size="12"
          >
            <UFormField label="发送间隔 (秒)">
              <div class="flex items-center gap-2">
                <UInputNumber
                  v-model="action.triggerConfig.intervalSeconds"
                  :min="10"
                  :max="86400"
                  style="width: 140px"
                  :disabled="useGlobalTimer"
                  placeholder="300"
                />
                <span class="text-sm text-[var(--vtsuru-fg-muted)]">秒</span>
              </div>
            </UFormField>

            <UFormField label="发送模式">
              <URadioGroup
                v-model="action.triggerConfig.schedulingMode"
                :disabled="useGlobalTimer"
                :items="schedulingModeOptions"
              />
            </UFormField>
          </div>
        </div>
      </div>
    </UForm>
  </div>
</template>

<style scoped>
.scheduled-trigger-settings {
  width: 100%;
}

.info-box {
  padding: 8px 12px;
  background-color: var(--vtsuru-bg-muted);
  border-radius: var(--vtsuru-radius);
  border-left: 4px solid var(--vtsuru-info);
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
