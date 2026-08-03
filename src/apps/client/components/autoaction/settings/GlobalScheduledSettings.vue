<script setup lang="ts">
import { watch } from 'vue'

import { useAutoAction } from '@/apps/client/store/useAutoAction'

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
  <UCard
    title="全局定时器配置"
    size="small"
    bordered
    embedded
    class="global-scheduled-card"
  >
    <div
      vertical
      :size="16"
    >
      <UAlert
        type="info"
        size="small"
        :show-icon="false"
        :bordered="false"
      >
        这里的设置将应用于所有启用了“使用全局设置”的定时触发操作。这些操作将共享同一个计时周期。
      </UAlert>

      <UForm
        label-placement="left"
        :label-width="140"
        size="small"
        :show-feedback="false"
      >
        <UFormField label="全局发送间隔">
          <template #label>
            <UTooltip>
              <span
                >发送间隔
                <UIcon
                  name="i-lucide-circle"
                  style="vertical-align: -2px"
              /></span>
              <template #content> 每隔多少秒触发一次全局定时任务 </template>
            </UTooltip>
          </template>
          <div class="flex items-center gap-2">
            <UInputNumber
              v-model="autoActionStore.globalIntervalSeconds"
              :min="10"
              :max="7200"
              style="width: 140px"
            />
            <span class="text-sm text-[var(--vtsuru-fg-muted)]">秒</span>
          </div>
        </UFormField>

        <UFormField label="全局发送模式">
          <URadioGroup
            v-model="autoActionStore.globalSchedulingMode"
            :items="schedulingModeOptions"
          />
        </UFormField>
      </UForm>
    </div>
  </UCard>
</template>

<style scoped>
.global-scheduled-card {
  border-radius: var(--vtsuru-radius);
}
</style>
