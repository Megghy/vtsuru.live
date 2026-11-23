<script setup lang="ts">
import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { TriggerType } from '@/apps/client/store/useAutoAction'
import { SettingRow } from '@/shared/ui/setting-row'

defineProps<{
  action: AutoActionItem
}>()
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
      hint="同一用户在本次会话中反复关注/取关仅触发一次感谢（按规则独立记录）"
      v-model="action.triggerConfig.preventRepeat"
    />
  </div>
</template>
