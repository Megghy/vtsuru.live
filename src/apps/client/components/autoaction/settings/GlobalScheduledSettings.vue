<script setup lang="ts">
import { watch } from 'vue'

import { useAutoAction } from '@/apps/client/store/useAutoAction'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { SettingRow } from '@/shared/ui/setting-row'

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

      <div class="space-y-2">
        <SettingRow
          type="number"
          title="全局发送间隔"
          hint="每隔多少秒触发一次全局定时任务"
          :min="10"
          :max="7200"
          :model-value="autoActionStore.globalIntervalSeconds"
          @change="(val) => (autoActionStore.globalIntervalSeconds = Number(val) || 300)"
        />

        <SettingRow
          type="select"
          title="全局发送模式"
          :options="schedulingModeOptions"
          :model-value="autoActionStore.globalSchedulingMode"
          @change="(val) => (autoActionStore.globalSchedulingMode = val as any)"
        />
      </div>
    </CardContent>
  </Card>
</template>
