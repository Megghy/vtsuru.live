<script setup lang="ts">
import { computed } from 'vue'

import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { TriggerType } from '@/apps/client/store/useAutoAction'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { SettingRow } from '@/shared/ui/setting-row'

const props = defineProps<{
  action: AutoActionItem
}>()

if (props.action.triggerConfig.useGlobalTimer === undefined) {
  props.action.triggerConfig.useGlobalTimer = false
}
if (props.action.triggerConfig.schedulingMode === undefined) {
  props.action.triggerConfig.schedulingMode = 'random'
}
if (props.action.triggerConfig.intervalSeconds === undefined) {
  props.action.triggerConfig.intervalSeconds = 300
}

const useGlobalTimer = computed({
  get: () => Boolean(props.action.triggerConfig.useGlobalTimer),
  set: (value: boolean) => {
    props.action.triggerConfig.useGlobalTimer = value
  },
})

const schedulingModeOptions = [
  { label: '随机模式（多行模板每次随机选一行）', value: 'random' },
  { label: '顺序模式（多行模板按行顺序循环）', value: 'sequential' },
]
</script>

<template>
  <div
    v-if="action.triggerType === TriggerType.SCHEDULED"
    class="scheduled-trigger-settings space-y-3"
  >
    <SettingRow
      type="switch"
      variant="compact"
      title="使用全局定时器"
      hint="开启后将与同分类下其他全局定时规则共用一个发送周期"
      v-model="useGlobalTimer"
    />

    <Alert
      v-if="useGlobalTimer"
      size="sm"
      variant="info"
    >
      <AlertDescription class="m-0">
        当前规则已纳入全局定时器，修改全局发送间隔与轮询顺序请返回【定时发送】列表顶部的「全局定时器配置」卡片。
      </AlertDescription>
    </Alert>

    <div
      v-else
      class="space-y-2.5 p-3 rounded-md border bg-muted/20"
    >
      <span class="font-semibold text-xs text-foreground block">独立定时器参数</span>

      <SettingRow
        type="number"
        variant="compact"
        title="发送间隔 (秒)"
        hint="修改后将自动重启该规则的独立计时器"
        :min="10"
        :max="86400"
        placeholder="300"
        :model-value="action.triggerConfig.intervalSeconds"
        @update:model-value="action.triggerConfig.intervalSeconds = Number($event) || 300"
      />

      <SettingRow
        type="select"
        variant="compact"
        title="多行模板轮播模式"
        :options="schedulingModeOptions"
        :model-value="action.triggerConfig.schedulingMode"
        @update:model-value="action.triggerConfig.schedulingMode = ($event as 'random' | 'sequential') || 'random'"
      />
    </div>
  </div>
</template>
