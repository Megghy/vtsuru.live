<script setup lang="ts">
import { computed } from 'vue'

import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { ActionType, Priority, TriggerType, useAutoAction } from '@/apps/client/store/useAutoAction'
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

const autoActionStore = useAutoAction()

const nameInvalid = computed(() => !props.action.name?.trim())

const enabledModel = computed({
  get: () => props.action.enabled,
  set: (val: boolean) => {
    const existsInStore = autoActionStore.autoActions.some((a) => a.id === props.action.id)
    if (existsInStore) {
      autoActionStore.toggleAutoAction(props.action.id, val)
    } else {
      props.action.enabled = val
    }
  },
})

const priorityModel = computed({
  get: () => String(Number(props.action.priority ?? Priority.NORMAL)),
  set: (val: string) => {
    props.action.priority = Number(val) as Priority
  },
})

const triggerTypeOptions = [
  { label: '弹幕触发', value: TriggerType.DANMAKU },
  { label: '礼物感谢', value: TriggerType.GIFT },
  { label: '上舰感谢', value: TriggerType.GUARD },
  { label: '关注感谢', value: TriggerType.FOLLOW },
  { label: '入场欢迎', value: TriggerType.ENTER },
  { label: '定时发送', value: TriggerType.SCHEDULED },
  { label: 'SC感谢', value: TriggerType.SUPER_CHAT },
  { label: '积分商品兑换', value: TriggerType.POINT_REDEEM },
  { label: '开播时触发', value: TriggerType.LIVE_START },
  { label: '下播时触发', value: TriggerType.LIVE_END },
  { label: '弹幕连接异常', value: TriggerType.DANMAKU_DISCONNECTED },
  { label: 'Cookie 失效', value: TriggerType.COOKIE_INVALID },
]

const actionTypeOptions = [
  { label: '发送弹幕', value: ActionType.SEND_DANMAKU },
  { label: '发送私信', value: ActionType.SEND_PRIVATE_MSG },
  { label: '发送客户端通知', value: ActionType.SEND_NOTIFICATION },
  { label: '发送 OBS 浮窗通知', value: ActionType.OBS_NOTIFY },
  { label: 'TTS 语音播报', value: ActionType.SPEAK_TTS },
  { label: '发送 Webhook 请求', value: ActionType.SEND_WEBHOOK },
  { label: '播放音效（无需 VTS）', value: ActionType.PLAY_AUDIO },
  { label: 'PNGtuber：切换表情', value: ActionType.PNGTUBER_EXPRESSION },
  { label: 'VTS：触发热键', value: ActionType.VTS_HOTKEY },
  { label: 'VTS：切换表情', value: ActionType.VTS_EXPRESSION },
  { label: 'VTS：机位预设', value: ActionType.VTS_PRESET },
  { label: 'VTS：掉落道具', value: ActionType.VTS_DROP_ITEM },
  { label: 'VTS：参数注入', value: ActionType.VTS_PARAM_ADD },
  { label: 'VTS：运行宏', value: ActionType.VTS_MACRO },
  { label: 'VTS：配饰显隐', value: ActionType.VTS_ACCESSORY },
  { label: 'VTS：模型染色', value: ActionType.VTS_COLOR_TINT },
  { label: 'VTS：后处理滤镜', value: ActionType.VTS_POST_PROCESSING },
  { label: 'OBS：切换本地场景', value: ActionType.OBS_SWITCH_SCENE },
  { label: 'VTsuru 场景：切换子场景', value: ActionType.OBS_SCENE_SWITCH },
  { label: 'OBS：控制源显隐', value: ActionType.OBS_SOURCE_VISIBLE },
  { label: 'OBS：控制滤镜开关', value: ActionType.OBS_FILTER_ENABLED },
  { label: 'OBS：保存高光回放', value: ActionType.OBS_SAVE_REPLAY },
]

const priorityOptions = [
  { label: '最高', value: String(Priority.HIGHEST) },
  { label: '高', value: String(Priority.HIGH) },
  { label: '普通', value: String(Priority.NORMAL) },
  { label: '低', value: String(Priority.LOW) },
  { label: '最低', value: String(Priority.LOWEST) },
]
</script>

<template>
  <Card>
    <CardHeader class="p-3 border-b">
      <CardTitle class="text-xs font-semibold">常规设置</CardTitle>
    </CardHeader>

    <CardContent class="p-3 space-y-3">
      <div
        v-if="!hideName"
        class="grid grid-cols-1 sm:grid-cols-2 gap-3"
      >
        <FormField
          type="text"
          label="规则名称"
          placeholder="例如：感谢礼物老板"
          :error="nameInvalid ? '规则名称不能为空' : undefined"
          v-model="action.name"
        />

        <FormField
          type="text"
          label="备注说明（可选）"
          placeholder="用于列表快速辨识规则用途"
          v-model="action.description"
        />
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-1">
        <SettingRow
          v-if="!hideEnabled"
          type="switch"
          variant="compact"
          title="启用此规则"
          v-model="enabledModel"
        />

        <SettingRow
          type="switch"
          variant="compact"
          title="仅开播时触发"
          hint="未开播时将跳过此规则"
          v-model="action.triggerConfig.onlyDuringLive"
        />

        <SettingRow
          type="switch"
          variant="compact"
          title="天选时刻暂停"
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
          description="同一事件命中多条规则时，优先级高的先执行"
          :options="priorityOptions"
          v-model="priorityModel"
        />
      </div>
    </CardContent>
  </Card>
</template>
