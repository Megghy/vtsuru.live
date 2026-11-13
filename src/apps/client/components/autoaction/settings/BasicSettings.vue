<script setup lang="ts">
import { computed } from 'vue'

import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { ActionType, Priority, TriggerType } from '@/apps/client/store/useAutoAction'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { FormField } from '@/shared/ui/form-field'
import { SettingRow } from '@/shared/ui/setting-row'

const props = defineProps({
  action: {
    type: Object as () => AutoActionItem,
    required: true,
  },
  hideName: {
    type: Boolean,
    default: false,
  },
  hideEnabled: {
    type: Boolean,
    default: false,
  },
})

// 需要模板内容的动作类型(发送弹幕/私信/执行命令)
const requiresTemplate = computed(() =>
  [ActionType.SEND_DANMAKU, ActionType.SEND_PRIVATE_MSG, ActionType.EXECUTE_COMMAND].includes(props.action.actionType),
)

const nameInvalid = computed(() => !props.action.name?.trim())
const templateInvalid = computed(
  () => requiresTemplate.value && (typeof props.action.template !== 'string' || !props.action.template.trim()),
)

// 触发类型选项
const triggerTypeOptions = [
  { label: '弹幕触发', value: TriggerType.DANMAKU },
  { label: '礼物感谢', value: TriggerType.GIFT },
  { label: '上舰感谢', value: TriggerType.GUARD },
  { label: '关注感谢', value: TriggerType.FOLLOW },
  { label: '入场欢迎', value: TriggerType.ENTER },
  { label: '定时发送', value: TriggerType.SCHEDULED },
  { label: 'SC感谢', value: TriggerType.SUPER_CHAT },
  { label: '积分商品兑换', value: TriggerType.POINT_REDEEM },
]

// 操作类型选项
const actionTypeOptions = [
  { label: '发送弹幕', value: ActionType.SEND_DANMAKU },
  { label: '发送私信', value: ActionType.SEND_PRIVATE_MSG },
  { label: '执行命令', value: ActionType.EXECUTE_COMMAND },
  { label: '播放音效（无需VTS）', value: ActionType.PLAY_AUDIO },
  { label: 'PNGtuber：切换表情', value: ActionType.PNGTUBER_EXPRESSION },
  { label: 'VTS：触发热键', value: ActionType.VTS_HOTKEY },
  { label: 'VTS：机位预设', value: ActionType.VTS_PRESET },
  { label: 'VTS：掉落道具', value: ActionType.VTS_DROP_ITEM },
  { label: 'VTS：参数注入', value: ActionType.VTS_PARAM_ADD },
  { label: 'VTS：运行宏', value: ActionType.VTS_MACRO },
  { label: 'VTS：配饰显隐', value: ActionType.VTS_ACCESSORY },
]

// 优先级选项
const priorityOptions = [
  { label: '最高', value: Priority.HIGHEST },
  { label: '高', value: Priority.HIGH },
  { label: '普通', value: Priority.NORMAL },
  { label: '低', value: Priority.LOW },
  { label: '最低', value: Priority.LOWEST },
]
</script>

<template>
  <Card>
    <CardHeader class="p-3 border-b">
      <CardTitle>常规设置</CardTitle>
    </CardHeader>

    <CardContent class="p-3 space-y-3">
      <FormField
        v-if="!hideName"
        type="text"
        label="操作名称"
        placeholder="例如：给礼物老板点赞"
        :error="nameInvalid ? '操作名称不能为空' : undefined"
        :description="templateInvalid ? '当前动作需要设置模板内容，否则不会生效' : undefined"
        v-model="action.name"
      />

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <SettingRow
          v-if="!hideEnabled"
          type="switch"
          variant="compact"
          title="是否启用"
          v-model="action.enabled"
        />

        <SettingRow
          type="switch"
          variant="compact"
          title="仅直播时"
          hint="关闭直播后将不会触发此操作"
          v-model="action.triggerConfig.onlyDuringLive"
        />

        <SettingRow
          type="switch"
          variant="compact"
          title="忽略天选"
          hint="开启天选时刻期间暂停触发（防止被风控）"
          v-model="action.triggerConfig.ignoreTianXuan"
        />

        <FormField
          type="select"
          label="触发类型"
          :options="triggerTypeOptions"
          disabled
          v-model="action.triggerType"
        />

        <FormField
          type="select"
          label="执行动作"
          :options="actionTypeOptions"
          v-model="action.actionType"
        />

        <FormField
          type="select"
          label="执行优先级"
          :options="priorityOptions"
          v-model="action.priority"
        />
      </div>
    </CardContent>
  </Card>
</template>
