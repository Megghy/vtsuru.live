<script setup lang="ts">
import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { TriggerType } from '@/apps/client/store/useAutoAction'
import { FormField } from '@/shared/ui/form-field'
import { Separator } from '@/shared/ui/separator'
import { SettingRow } from '@/shared/ui/setting-row'

defineProps({
  action: {
    type: Object as () => AutoActionItem,
    required: true,
  },
})

// 入场过滤模式选项
const enterFilterModeOptions = [
  { label: '不过滤 (欢迎所有人)', value: 'none' },
  { label: '用户黑名单 (名单内不欢迎)', value: 'blacklist' },
  { label: '用户白名单 (只欢迎名单内)', value: 'whitelist' },
  { label: '仅欢迎舰长', value: 'guard' },
  { label: '仅欢迎佩戴勋章的用户', value: 'medal' },
]
</script>

<template>
  <div
    v-if="action.triggerType === TriggerType.ENTER"
    class="enter-trigger-settings space-y-3"
  >
    <FormField
      type="select"
      label="入场过滤模式"
      :options="enterFilterModeOptions"
      v-model="action.triggerConfig.filterMode"
    />

    <SettingRow
      v-if="action.triggerConfig.filterMode === 'medal'"
      type="number"
      variant="compact"
      title="最低牌子等级"
      hint="仅欢迎佩戴本房勋章且等级达到此值的用户，0 表示不限制等级"
      :min="0"
      :max="40"
      v-model="action.triggerConfig.enterMedalMinLevel"
    />

    <Separator class="my-1" />

    <SettingRow
      type="switch"
      variant="compact"
      title="防止重复发送"
      hint="同一用户在单次直播中多次进入仅触发一次欢迎"
      v-model="action.triggerConfig.preventRepeat"
    />

    <SettingRow
      type="number"
      variant="compact"
      title="单次合并上限"
      hint="单条欢迎弹幕中最多合并展示的用户数量"
      :min="1"
      :max="50"
      v-model="action.actionConfig.maxUsersPerMsg"
    />
  </div>
</template>
