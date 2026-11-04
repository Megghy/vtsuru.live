<script setup lang="ts">
import { Info16Regular } from '@vicons/fluent'
import { watch } from 'vue'

import { useAutoAction } from '@/apps/client/store/useAutoAction'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { NumberField } from '@/shared/ui/number-field'
import { RadioGroup, RadioGroupItem } from '@/shared/ui/radio-group'
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
  <Card>
    <CardHeader class="p-3 border-b">
      <CardTitle>全局定时器配置</CardTitle>
    </CardHeader>

    <CardContent class="p-3 space-y-3">
      <Alert size="sm" variant="info">
        <AlertDescription class="m-0">
          这里的设置将应用于所有启用了“使用全局设置”的定时触发操作。这些操作将共享同一个计时周期。
        </AlertDescription>
      </Alert>

      <div class="flex-between p-2.5 rounded border bg-muted/20">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <div class="flex items-center gap-1 cursor-help">
                <span class="text-xs font-medium text-foreground">全局发送间隔</span>
                <Info16Regular class="size-3.5 text-muted-foreground" />
              </div>
            </TooltipTrigger>
            <TooltipContent> 每隔多少秒触发一次全局定时任务 </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <NumberField
          :model-value="autoActionStore.globalIntervalSeconds"
          :min="10"
          :max="7200"
          class="w-32"
          @update:model-value="autoActionStore.globalIntervalSeconds = $event || 300"
        />
      </div>

      <div class="space-y-1.5 p-2.5 rounded border bg-muted/20">
        <span class="text-xs font-medium text-foreground block">全局发送模式</span>
        <RadioGroup
          :model-value="autoActionStore.globalSchedulingMode"
          class="flex flex-col gap-2"
          @update:model-value="(val) => (autoActionStore.globalSchedulingMode = val as any)"
        >
          <label
            v-for="option in schedulingModeOptions"
            :key="option.value"
            class="flex items-center gap-2 cursor-pointer text-xs"
          >
            <RadioGroupItem :value="option.value" />
            <span>{{ option.label }}</span>
          </label>
        </RadioGroup>
      </div>
    </CardContent>
  </Card>
</template>
