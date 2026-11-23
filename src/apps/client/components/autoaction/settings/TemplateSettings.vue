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
