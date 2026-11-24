<script setup lang="ts">
import { computed } from 'vue'

import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { ActionType } from '@/apps/client/store/useAutoAction'

import type { Placeholder } from '../placeholders'
import TemplateEditor from '../TemplateEditor.vue'

const props = defineProps<{
  action: AutoActionItem
  customTestContext?: Record<string, any>
  extraPlaceholders?: Placeholder[]
}>()

const templateTitle = computed(() => {
  switch (props.action.actionType) {
    case ActionType.SEND_DANMAKU:
      return '弹幕模板'
    case ActionType.SEND_PRIVATE_MSG:
      return '私信模板'
    case ActionType.SEND_NOTIFICATION:
      return '通知正文模板'
    case ActionType.OBS_NOTIFY:
      return 'OBS 浮窗消息模板'
    case ActionType.SPEAK_TTS:
      return 'TTS 语音播报模板'
    case ActionType.SEND_WEBHOOK:
      return '附带消息模板（用于默认 JSON 的 message 字段）'
    default:
      return '消息模板'
  }
})

const templateDescription = computed(() => {
  switch (props.action.actionType) {
    case ActionType.SEND_DANMAKU:
      return '发送到直播间的弹幕内容（每行一条候选文案，支持变量与 JS 表达式）'
    case ActionType.SEND_PRIVATE_MSG:
      return '发送给用户的私信内容（支持变量与 JS 表达式）'
    case ActionType.SEND_NOTIFICATION:
      return '桌面与应用内通知的正文内容（多行时随机/顺序抽取一行，支持变量插值）'
    case ActionType.OBS_NOTIFY:
      return '推送到 OBS 悬浮通知组件显示的消息文本（支持变量插值）'
    case ActionType.SPEAK_TTS:
      return '通过客户端语音引擎直接朗读的文本内容（支持变量插值）'
    case ActionType.SEND_WEBHOOK:
      return '未自定义请求体模板时，将作为默认 JSON 请求载荷中的 message 字段发送'
    default:
      return '消息内容模板'
  }
})

function handleTemplateUpdate(payload: { index: number; value: string }) {
  if (payload.index === 0) {
    props.action.template = payload.value
  }
}
</script>

<template>
  <div class="relative">
    <TemplateEditor
      :template="props.action"
      :template-index="0"
      :title="templateTitle"
      :description="templateDescription"
      :check-length="action.actionType === ActionType.SEND_DANMAKU"
      :custom-test-context="customTestContext"
      :extra-placeholders="extraPlaceholders"
      class="template-editor"
      @update:template="handleTemplateUpdate"
    />
  </div>
</template>
