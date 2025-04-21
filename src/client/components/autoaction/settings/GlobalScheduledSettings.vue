<script setup lang="ts">
import {
  NCard,
  NSpace,
  NInputNumber,
  NRadioGroup,
  NRadio,
  NText,
  NDivider
} from 'naive-ui';
import { useAutoAction } from '@/client/store/useAutoAction';
import { watch } from 'vue';

const autoActionStore = useAutoAction();

// 定时模式选项
const schedulingModeOptions = [
  { label: '随机模式', value: 'random' },
  { label: '顺序模式', value: 'sequential' }
];

// 监听变化，触发定时器重启（如果间隔改变）
watch(() => autoActionStore.globalIntervalSeconds, () => {
  autoActionStore.restartGlobalTimer(); // 确保间隔改变时定时器更新
});

</script>

<template>
  <NCard
    title="全局定时设置"
    size="small"
    style="margin-bottom: 16px;"
  >
    <NSpace
      vertical
      :size="16"
    >
      <NText
        type="info"
        :depth="3"
        style="font-size: 12px;"
      >
        这里的设置将应用于所有启用了 "使用全局定时器" 选项的定时触发操作。
      </NText>
      <NDivider style="margin: 4px 0;" />
      <NSpace
        align="center"
        justify="space-between"
        style="width: 100%"
      >
        <NText>全局发送间隔 (秒):</NText>
        <NInputNumber
          v-model:value="autoActionStore.globalIntervalSeconds"
          :min="10"
          :max="7200"
          style="width: 120px"
        />
      </NSpace>

      <NSpace
        align="center"
        justify="space-between"
        style="width: 100%"
      >
        <NText>全局发送模式:</NText>
        <NRadioGroup v-model:value="autoActionStore.globalSchedulingMode">
          <NSpace>
            <NRadio
              v-for="option in schedulingModeOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </NRadio>
          </NSpace>
        </NRadioGroup>
      </NSpace>
    </NSpace>
  </NCard>
</template>

<style scoped>
/* 可以添加一些特定样式 */
</style>