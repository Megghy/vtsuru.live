<script setup lang="ts">
import { NCard, NInputNumber, NRadio, NRadioGroup, NFlex, NForm, NFormItem, NIcon, NTooltip, NAlert } from 'naive-ui';
import { watch } from 'vue'
import { useAutoAction } from '@/apps/client/store/useAutoAction'
import { Info16Regular } from '@vicons/fluent'

const autoActionStore = useAutoAction()

// 定时模式选项
const schedulingModeOptions = [
  { label: '随机模式 (随机选择符合条件的操作)', value: 'random' },
  { label: '顺序模式 (按列表顺序循环执行操作)', value: 'sequential' },
]

// 监听变化，触发定时器重启（如果间隔改变）
watch(() => autoActionStore.globalIntervalSeconds, () => {
  autoActionStore.restartGlobalTimer() // 确保间隔改变时定时器更新
})
</script>

<template>
  <NCard
    title="全局定时器配置"
    size="small"
    bordered
    embedded
    class="global-scheduled-card"
  >
    <NFlex vertical :size="16">
      <NAlert type="info" size="small" :show-icon="false" :bordered="false">
        这里的设置将应用于所有启用了“使用全局设置”的定时触发操作。这些操作将共享同一个计时周期。
      </NAlert>

      <NForm label-placement="left" :label-width="140" size="small" :show-feedback="false">
        <NFormItem label="全局发送间隔">
          <template #label>
            <NTooltip trigger="hover">
              <template #trigger>
                <span>发送间隔 <NIcon :component="Info16Regular" style="vertical-align: -2px" /></span>
              </template>
              每隔多少秒触发一次全局定时任务
            </NTooltip>
          </template>
          <NInputNumber
            v-model:value="autoActionStore.globalIntervalSeconds"
            :min="10"
            :max="7200"
            style="width: 140px"
          >
            <template #suffix>
              秒
            </template>
          </NInputNumber>
        </NFormItem>

        <NFormItem label="全局发送模式">
          <NRadioGroup v-model:value="autoActionStore.globalSchedulingMode">
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
      </NForm>
    </NFlex>
  </NCard>
</template>

<style scoped>
.global-scheduled-card {
  border-radius: var(--n-border-radius);
}
</style>
