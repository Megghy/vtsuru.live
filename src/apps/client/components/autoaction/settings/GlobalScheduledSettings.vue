<script setup lang="ts">
import { useAutoAction } from '@/apps/client/store/useAutoAction'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { SettingRow } from '@/shared/ui/setting-row'

const autoActionStore = useAutoAction()

const schedulingModeOptions = [
  { label: '随机模式（每次随机选择一条符合条件的规则）', value: 'random' },
  { label: '顺序模式（按规则列表顺序依次循环执行）', value: 'sequential' },
]
</script>

<template>
  <Card>
    <CardHeader class="p-3 border-b">
      <CardTitle class="text-xs font-semibold">全局定时器配置</CardTitle>
    </CardHeader>

    <CardContent class="p-3 space-y-3">
      <Alert
        size="sm"
        variant="info"
      >
        <AlertDescription class="m-0">
          应用于所有开启“使用全局定时器”的定时规则，共享同一计时周期。修改间隔后会自动重置计时器。
        </AlertDescription>
      </Alert>

      <div class="space-y-2">
        <SettingRow
          type="number"
          variant="compact"
          title="全局发送间隔 (秒)"
          hint="每隔多少秒触发一次全局定时任务"
          :min="10"
          :max="7200"
          :model-value="autoActionStore.globalIntervalSeconds"
          @update:model-value="autoActionStore.globalIntervalSeconds = Number($event) || 300"
        />

        <SettingRow
          type="select"
          variant="compact"
          title="全局轮询模式"
          :options="schedulingModeOptions"
          :model-value="autoActionStore.globalSchedulingMode"
          @update:model-value="autoActionStore.globalSchedulingMode = ($event as 'random' | 'sequential') || 'random'"
        />
      </div>
    </CardContent>
  </Card>
</template>
