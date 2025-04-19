<script setup lang="ts">
import { NSpace, NSwitch, NInputNumber, NSelect, NCollapseItem } from 'naive-ui';
import { AutoActionItem, TriggerType } from '@/client/store/useAutoAction';

const props = defineProps({
  action: {
    type: Object as () => AutoActionItem,
    required: true
  }
});

// SC过滤模式选项
const scFilterModeOptions = [
  { label: '不过滤', value: 'none' },
  { label: '最低价格', value: 'price' }
];
</script>

<template>
  <NCollapseItem
    v-if="action.triggerType === TriggerType.SUPER_CHAT"
    title="SC触发设置"
  >
    <NSpace vertical>
      <NSpace
        align="center"
        justify="space-between"
        style="width: 100%"
      >
        <span>SC过滤模式:</span>
        <NSelect
          v-model:value="action.triggerConfig.scFilterMode"
          style="width: 200px"
          :options="scFilterModeOptions"
        />
      </NSpace>

      <template v-if="action.triggerConfig.scFilterMode === 'price'">
        <NSpace
          align="center"
          justify="space-between"
          style="width: 100%"
        >
          <span>最低价格 (元):</span>
          <NInputNumber
            v-model:value="action.triggerConfig.minPrice"
            :min="0"
            style="width: 120px"
          />
        </NSpace>
      </template>

      <NSpace
        align="center"
        justify="space-between"
        style="width: 100%"
      >
        <span>防止重复发送:</span>
        <NSwitch v-model:value="action.triggerConfig.preventRepeat" />
      </NSpace>

      <NSpace
        align="center"
        justify="space-between"
        style="width: 100%"
      >
        <span>每次处理的最大用户数:</span>
        <NInputNumber
          v-model:value="action.actionConfig.maxUsersPerMsg"
          :min="1"
          :max="20"
          style="width: 120px"
        />
      </NSpace>
    </NSpace>
  </NCollapseItem>
</template>