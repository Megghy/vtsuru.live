<script setup lang="ts">
import type { AutoActionItem } from '@/client/store/useAutoAction'
import { computed } from 'vue'
import { ActionType } from '@/client/store/useAutoAction'
import TemplateEditor from '../TemplateEditor.vue'

const props = defineProps({
  action: {
    type: Object as () => AutoActionItem,
    required: true,
  },
  customTestContext: {
    type: Object,
    default: undefined,
  },
})

// 根据操作类型获取模板标题
const templateTitle = computed(() => {
  switch (props.action.actionType) {
    case ActionType.SEND_DANMAKU:
      return '弹幕模板'
    case ActionType.SEND_PRIVATE_MSG:
      return '私信模板'
    case ActionType.EXECUTE_COMMAND:
      return '命令模板'
    default:
      return '消息模板'
  }
})

// 根据操作类型获取模板描述
const templateDescription = computed(() => {
  switch (props.action.actionType) {
    case ActionType.SEND_DANMAKU:
      return '发送到直播间的弹幕内容'
    case ActionType.SEND_PRIVATE_MSG:
      return '发送给用户的私信内容'
    case ActionType.EXECUTE_COMMAND:
      return '执行的命令模板'
    default:
      return '消息内容模板'
  }
})

// Handle template updates from TemplateEditor
function handleTemplateUpdate(payload: { index: number, value: string }) {
  // Assuming index will always be 0 here as we only render one editor
  // And assuming action.templates is a string based on previous findings
  if (payload.index === 0) {
    props.action.template = payload.value
  }
}
</script>

<template>
  <div class="template-settings">
    <transition
      name="fade-scale"
      appear
    >
      <TemplateEditor
        :template="props.action"
        :template-index="0"
        :title="templateTitle"
        :description="templateDescription"
        :check-length="action.actionType === ActionType.SEND_DANMAKU"
        :custom-test-context="customTestContext"
        class="template-editor"
        @update:template="handleTemplateUpdate"
      />
    </transition>
  </div>
</template>

<style scoped>
.template-settings {
  position: relative;
}

.settings-divider {
  transition: all 0.3s ease;
}

.template-editor {
  transition: all 0.3s ease;
}

/* 淡入缩放效果 */
.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
