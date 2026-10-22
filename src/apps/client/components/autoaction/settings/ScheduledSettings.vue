<script setup lang="ts">
import { Info16Regular } from '@vicons/fluent'
import { computed } from 'vue'

import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { TriggerType } from '@/apps/client/store/useAutoAction'
import { NumberField } from '@/shared/ui/number-field'
import { Switch } from '@/shared/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

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
] as const
</script>

<template>
  <div
    v-if="action.triggerType === TriggerType.SCHEDULED"
    class="scheduled-trigger-settings space-y-3"
  >
    <div class="flex items-center justify-between p-2.5 rounded border bg-muted/20">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger as-child>
            <div class="flex items-center gap-1 cursor-help">
              <span class="text-xs font-medium text-foreground">使用全局设置</span>
              <Info16Regular class="size-3.5 text-muted-foreground" />
            </div>
          </TooltipTrigger>
          <TooltipContent class="text-xs"> 开启后将遵循【自动化 -> 消息队列】中的全局定时设置 </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <Switch v-model:checked="useGlobalTimer" />
    </div>

    <div
      v-if="useGlobalTimer"
      class="info-box text-xs text-muted-foreground p-2.5 rounded border border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400"
    >
      当前正在使用全局定时器。此操作将与其他全局任务共享发送频率和顺序。<br />
      修改全局间隔请前往：功能设置 -> 消息队列。
    </div>

    <div class="space-y-3 pt-1">
      <div class="border-b pb-1">
        <span class="font-semibold text-xs text-foreground block">独立定时设置</span>
      </div>

      <div
        class="space-y-3"
        :class="{ 'opacity-50 pointer-events-none': useGlobalTimer }"
      >
        <div class="flex items-center justify-between p-2.5 rounded border bg-muted/20">
          <span class="text-xs font-medium text-foreground">发送间隔 (秒)</span>
          <NumberField
            :model-value="action.triggerConfig.intervalSeconds"
            :min="10"
            :max="86400"
            :disabled="useGlobalTimer"
            placeholder="300"
            class="w-32"
            @update:model-value="action.triggerConfig.intervalSeconds = $event || 300"
          />
        </div>

        <div class="space-y-1.5 p-2.5 rounded border bg-muted/20">
          <span class="text-xs font-medium text-foreground block">发送模式</span>
          <div class="flex flex-col gap-2">
            <label
              v-for="opt in schedulingModeOptions"
              :key="opt.value"
              class="flex items-center gap-2 cursor-pointer text-xs"
              :class="useGlobalTimer ? 'cursor-not-allowed' : ''"
            >
              <input
                type="radio"
                name="schedulingMode"
                :value="opt.value"
                :checked="action.triggerConfig.schedulingMode === opt.value"
                :disabled="useGlobalTimer"
                class="accent-primary"
                @change="action.triggerConfig.schedulingMode = opt.value"
              />
              <span>{{ opt.label }}</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
