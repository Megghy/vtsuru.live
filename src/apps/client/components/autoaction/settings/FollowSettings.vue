<script setup lang="ts">
import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { NCollapseItem, NInputNumber, NFlex, NSwitch } from 'naive-ui';
import { TriggerType } from '@/apps/client/store/useAutoAction'

defineProps({
  action: {
    type: Object as () => AutoActionItem,
    required: true,
  },
})
</script>

<template>
  <NCollapseItem
    v-if="action.triggerType === TriggerType.FOLLOW"
    title="关注触发设置"
  >
    <NFlex vertical>
      <NFlex
        align="center"
        justify="space-between"
        style="width: 100%"
      >
        <span>防止重复发送:</span>
        <NSwitch v-model:value="action.triggerConfig.preventRepeat" />
      </NFlex>

      <NFlex
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
      </NFlex>
    </NFlex>
  </NCollapseItem>
</template>
