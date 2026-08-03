<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'

import { CUSTOM_CSS_MAX_BYTES, utf8ByteLength } from '@/apps/user-page/block/customHtmlContract'
import { inspectCustomCss } from '@/apps/user-page/block/customHtmlRuntime'

import { UserPageEditorKey } from '../context'
import CustomHtmlCodeEditor from './CustomHtmlCodeEditor.vue'

const show = defineModel<boolean>('show', { required: true })
const editor = inject(UserPageEditorKey)
if (!editor) throw new Error('UserPageEditor context is missing')

const draft = ref('')
const initialSnapshot = ref('')
const codeEditor = ref<InstanceType<typeof CustomHtmlCodeEditor> | null>(null)
const cssBytes = computed(() => utf8ByteLength(draft.value))
const issues = computed(() => {
  const result = inspectCustomCss(draft.value)
  const next = [...result.issues]
  if (cssBytes.value > CUSTOM_CSS_MAX_BYTES)
    next.push({ field: 'css', message: `CSS 不能超过 ${CUSTOM_CSS_MAX_BYTES / 1024} KiB`, line: 1, column: 1 })
  return next
})
const isDirty = computed(() => draft.value !== initialSnapshot.value)

function resetDraft() {
  draft.value = typeof editor.settings.value.customCss === 'string' ? editor.settings.value.customCss : ''
  initialSnapshot.value = draft.value
}

function applyChanges() {
  if (issues.value.length) return
  const next = draft.value.trim()
  editor.batchHistory(() => {
    if (next) editor.settings.value.customCss = next
    else delete editor.settings.value.customCss
  })
  initialSnapshot.value = draft.value
  show.value = false
  editor.message.success('全局 CSS 已应用')
}

function closeEditor() {
  if (!isDirty.value) {
    show.value = false
    return
  }
  if (window.confirm('全局 CSS 中的修改尚未应用到公开页。确定放弃修改吗？')) show.value = false
}

watch(
  show,
  (visible) => {
    if (visible) resetDraft()
  },
  { immediate: true },
)
</script>

<template>
  <UModal
    v-model:open="show"
    title="全局 CSS"
    style="width: min(1100px, 94vw); height: min(720px, 88dvh)"
    :dismissible="false"
  >
    <template #actions>
      <div class="builder-row">
        <UBadge
          v-if="issues.length"
          type="error"
          size="sm"
        >
          {{ issues.length }} 个问题
        </UBadge>
        <UButton
          size="sm"
          variant="soft"
          @click="closeEditor"
        >
          取消
        </UButton>
        <UButton
          size="sm"
          color="primary"
          :disabled="!!issues.length"
          @click="applyChanges"
        >
          应用
        </UButton>
      </div>
    </template>

    <template #body
      ><div class="editor-shell">
        <UAlert
          type="info"
          :show-icon="true"
          class="editor-hint"
        >
          CSS 作用于公开用户页，可使用 --vtsuru-* 主题变量；不允许外部 URL、@import 和脚本相关属性。
        </UAlert>
        <div class="builder-row editor-meta">
          <span class="builder-text"> 公开页全局样式 </span>
          <span class="builder-text"> {{ cssBytes }}/{{ CUSTOM_CSS_MAX_BYTES }} bytes </span>
        </div>
        <CustomHtmlCodeEditor
          ref="codeEditor"
          html=""
          :css="draft"
          active-language="css"
          theme="vs"
          :assets="[]"
          :resources="[]"
          :issues="issues"
          @update:css="draft = $event"
        /></div
    ></template>
  </UModal>
</template>

<style scoped>
.editor-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.editor-hint {
  flex: 0 0 auto;
  margin: 12px 14px 0;
}

.editor-meta {
  flex: 0 0 auto;
  padding: 10px 14px;
}

.editor-shell :deep(.code-editor) {
  flex: 1;
  min-height: 0;
}
</style>
