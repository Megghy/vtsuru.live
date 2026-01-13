<script setup lang="ts">
import {
  NCard,
  NInputNumber,
  NRadio,
  NRadioGroup,
  NText,
  NDivider,
  NFlex,
} from 'naive-ui'
import { watch } from 'vue'
import { useAutoAction } from '@/apps/client/store/useAutoAction'

const autoActionStore = useAutoAction()

// 定时模式选项
const schedulingModeOptions = [
  { label: '随机模式', value: 'random' },
  { label: '顺序模式', value: 'sequential' },
]

// 监听变化，触发定时器重启（如果间隔改变）
watch(() => autoActionStore.globalIntervalSeconds, () => {
  autoActionStore.restartGlobalTimer() // 确保间隔改变时定时器更新
})
</script>

<template>
  <NCard
    title="全局定时设置"
    size="small"
    bordered
    :segmented="{ content: true }"
  >
    <NFlex vertical :size="12">
      <NText
        type="info"
        :depth="3"
      >
        这里的设置将应用于所有启用了 "使用全局定时器" 选项的定时触发操作。
      </NText>
      <NDivider style="margin: 0;" />
      <NFlex align="center" justify="space-between" :wrap="true" :size="12">
        <NText depth="2">
          全局发送间隔 (秒)
        </NText>
        <NInputNumber
          v-model:value="autoActionStore.globalIntervalSeconds"
          :min="10"
          :max="7200"
          size="small"
          style="width: 140px"
        />
      </NFlex>

      <NFlex align="center" justify="space-between" :wrap="true" :size="12">
        <NText depth="2">
          全局发送模式
        </NText>
        <NRadioGroup v-model:value="autoActionStore.globalSchedulingMode" size="small">
          <NFlex :size="12">
            <NRadio
              v-for="option in schedulingModeOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </NRadio>
          </NFlex>
        </NRadioGroup>
      </NFlex>
    </NFlex>
  </NCard>
</template>

<style scoped>
/* 可以添加一些特定样式 */
</style>
