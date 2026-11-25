<script setup lang="ts">
import { computed } from 'vue'

import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { FormField } from '@/shared/ui/form-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'

const props = defineProps<{
  action: AutoActionItem
}>()

const banHoursModel = computed({
  get: () => String(props.action.actionConfig.banHours ?? 1),
  set: (v: string) => {
    props.action.actionConfig.banHours = Number(v)
  },
})

const skipGuardModel = computed({
  get: () => props.action.actionConfig.banSkipGuard !== false,
  set: (v: boolean) => {
    props.action.actionConfig.banSkipGuard = v
  },
})
</script>

<template>
  <Card>
    <CardHeader class="p-3 border-b">
      <CardTitle class="text-xs font-semibold">直播间禁言设置</CardTitle>
    </CardHeader>
    <CardContent class="p-3 space-y-3">
      <FormField
        label="禁言时长"
        description="使用主播主账号 Cookie 对触发事件的用户执行 B 站直播间禁言"
      >
        <Select v-model="banHoursModel">
          <SelectTrigger class="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">本场直播</SelectItem>
            <SelectItem value="1">1 小时</SelectItem>
            <SelectItem value="24">24 小时</SelectItem>
            <SelectItem value="168">7 天</SelectItem>
            <SelectItem value="720">30 天</SelectItem>
            <SelectItem value="-1">永久禁言</SelectItem>
          </SelectContent>
        </Select>
      </FormField>

      <SettingRow
        type="switch"
        variant="compact"
        title="跳过大航海成员（舰长/提督/总督）"
        hint="开启后不会自动禁言在舰观众，避免误伤"
        v-model="skipGuardModel"
      />
    </CardContent>
  </Card>
</template>
