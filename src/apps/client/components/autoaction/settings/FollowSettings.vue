<script setup lang="ts">
import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { TriggerType } from '@/apps/client/store/useAutoAction'
import { SettingRow } from '@/shared/ui/setting-row'

defineProps({
  action: {
    type: Object as () => AutoActionItem,
    required: true,
  },
})
</script>

<template>
  <div
    v-if="action.triggerType === TriggerType.FOLLOW"
    class="follow-trigger-settings space-y-3"
  >
    <SettingRow
      type="switch"
      variant="compact"
      title="防止重复发送"
      hint="同一用户在单次直播中多次关注仅触发一次感谢"
      v-model="action.triggerConfig.preventRepeat"
    />

    <SettingRow
      type="number"
      variant="compact"
      title="单次合并上限"
      hint="单条感谢弹幕中最多合并展示的用户数量"
      :min="1"
      :max="50"
      v-model="action.actionConfig.maxUsersPerMsg"
    />
  </div>
</template>
