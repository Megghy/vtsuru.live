<script setup lang="ts">
import { Info16Regular } from '@vicons/fluent'
import { watch } from 'vue'

import { useAutoAction } from '@/apps/client/store/useAutoAction'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import NInputNumber from '@/shared/ui/NInputNumber.vue'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

const autoActionStore = useAutoAction()

// 定时模式选项
const schedulingModeOptions = [
  { label: '随机模式 (随机选择符合条件的操作)', value: 'random' },
  { label: '顺序模式 (按列表顺序循环执行操作)', value: 'sequential' },
]

// 监听变化，触发定时器重启（如果间隔改变）
watch(
  () => autoActionStore.globalIntervalSeconds,
  () => {
    autoActionStore.restartGlobalTimer() // 确保间隔改变时定时器更新
  },
)
</script>

<template>
  <Card class="border bg-card">
    <CardHeader class="p-3 pb-2 border-b">
      <CardTitle class="text-sm font-semibold">全局定时器配置</CardTitle>
    </CardHeader>

    <CardContent class="p-3 space-y-3">
      <Alert class="py-2 px-2.5 border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400">
        <AlertDescription class="text-xs m-0">
          这里的设置将应用于所有启用了“使用全局设置”的定时触发操作。这些操作将共享同一个计时周期。
        </AlertDescription>
      </Alert>

      <div class="flex items-center justify-between p-2.5 rounded border bg-muted/20">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <div class="flex items-center gap-1 cursor-help">
                <span class="text-xs font-medium text-foreground">全局发送间隔</span>
                <Info16Regular class="size-3.5 text-muted-foreground" />
              </div>
            </TooltipTrigger>
            <TooltipContent class="text-xs">
              每隔多少秒触发一次全局定时任务
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <NInputNumber
          :value="autoActionStore.globalIntervalSeconds"
          :min="10"
          :max="7200"
          size="small"
          class="w-32"
          @update:value="autoActionStore.globalIntervalSeconds = $event || 300"
        />
      </div>

      <div class="space-y-1.5 p-2.5 rounded border bg-muted/20">
        <span class="text-xs font-medium text-foreground block">全局发送模式</span>
        <div class="flex flex-col gap-2">
          <label
            v-for="option in schedulingModeOptions"
            :key="option.value"
            class="flex items-center gap-2 cursor-pointer text-xs"
          >
            <input
              type="radio"
              name="globalSchedulingMode"
              :value="option.value"
              :checked="autoActionStore.globalSchedulingMode === option.value"
              class="accent-primary"
              @change="autoActionStore.globalSchedulingMode = option.value as any"
            />
            <span>{{ option.label }}</span>
          </label>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
