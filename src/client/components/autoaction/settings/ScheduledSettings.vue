<script setup lang="ts">
import { NSpace, NInputNumber, NRadioGroup, NRadio, NCollapseItem } from 'naive-ui';
import { AutoActionItem, TriggerType } from '@/client/store/useAutoAction';
import { computed, ref } from 'vue';

const props = defineProps({
  action: {
    type: Object as () => AutoActionItem,
    required: true
  }
});

// 定时模式选项
const schedulingModeOptions = [
  { label: '随机模式', value: 'random' },
  { label: '顺序模式', value: 'sequential' }
];
</script>

<template>
  <NCollapseItem
    v-if="action.triggerType === TriggerType.SCHEDULED"
    title="定时触发设置"
  >
    <NSpace vertical>
      <NSpace
        align="center"
        justify="space-between"
        style="width: 100%"
      >
        <span>发送间隔 (秒):</span>
        <NInputNumber
          v-model:value="action.triggerConfig.intervalSeconds"
          :min="60"
          :max="3600"
          style="width: 120px"
        />
      </NSpace>

      <NSpace
        align="center"
        justify="space-between"
        style="width: 100%"
      >
        <span>发送模式:</span>
        <NRadioGroup v-model:value="action.triggerConfig.schedulingMode">
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
  </NCollapseItem>
</template>
