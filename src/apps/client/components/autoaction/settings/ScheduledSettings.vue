<script setup lang="ts">
import { computed } from 'vue'

import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { TriggerType } from '@/apps/client/store/useAutoAction'
import { SettingRow } from '@/shared/ui/setting-row'

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
  get: () => Boolean(props.action.triggerConfig.useGlobalTimer),
  set: (value: boolean) => {
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
    class="scheduled-trigger-settings space-y-3"
  >
    <SettingRow
      type="switch"
      title="使用全局设置"
      hint="开启后将遵循【自动化 -> 消息队列】中的全局定时设置"
      v-model="useGlobalTimer"
    />

    <div
      v-if="useGlobalTimer"
      class="text-xs text-muted-foreground p-2.5 rounded border border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400"
    >
      当前正在使用全局定时器。此操作将与其他全局任务共享发送频率和顺序。<br />
      修改全局间隔请前往：功能设置 -> 消息队列。
    </div>

    <div class="space-y-3 pt-1">
      <div class="border-b pb-1">
        <span class="font-semibold text-xs text-foreground block">独立定时设置</span>
      </div>

      <div
        class="space-y-2"
        :class="{ 'opacity-50 pointer-events-none': useGlobalTimer }"
      >
        <SettingRow
          type="number"
          title="发送间隔 (秒)"
          :min="10"
          :max="86400"
          :disabled="useGlobalTimer"
          placeholder="300"
          :model-value="action.triggerConfig.intervalSeconds"
          @change="(val) => (action.triggerConfig.intervalSeconds = Number(val) || 300)"
        />

        <SettingRow
          type="select"
          title="发送模式"
          :options="schedulingModeOptions"
          :disabled="useGlobalTimer"
          :model-value="action.triggerConfig.schedulingMode"
          @change="(val) => (action.triggerConfig.schedulingMode = val as any)"
        />
      </div>
    </div>
  </div>
</template>
