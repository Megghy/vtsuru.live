<script setup lang="ts">
import type { AutoActionItem } from '@/client/store/useAutoAction'
import { NCollapseItem, NInputNumber, NSpace, NSwitch } from 'naive-ui'
import { TriggerType } from '@/client/store/useAutoAction'

const props = defineProps({
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
    <NSpace vertical>
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
