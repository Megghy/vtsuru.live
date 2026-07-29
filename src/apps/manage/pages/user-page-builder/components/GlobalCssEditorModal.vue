<script setup lang="ts">
import { CUSTOM_CSS_MAX_BYTES, utf8ByteLength } from '@/apps/user-page/block/customHtmlContract'
import { inspectCustomCss } from '@/apps/user-page/block/customHtmlRuntime'
import CustomHtmlCodeEditor from './CustomHtmlCodeEditor.vue'
import { NAlert, NButton, NFlex, NModal, NTag, NText, useDialog } from 'naive-ui'
import { computed, inject, ref, watch } from 'vue'
import { UserPageEditorKey } from '../context'

const show = defineModel<boolean>('show', { required: true })
const editor = inject(UserPageEditorKey)
if (!editor) throw new Error('UserPageEditor context is missing')

const dialog = useDialog()
const draft = ref('')
const initialSnapshot = ref('')
const codeEditor = ref<InstanceType<typeof CustomHtmlCodeEditor> | null>(null)
const cssBytes = computed(() => utf8ByteLength(draft.value))
const issues = computed(() => {
  const result = inspectCustomCss(draft.value)
  const next = [...result.issues]
  if (cssBytes.value > CUSTOM_CSS_MAX_BYTES) next.push({ field: 'css', message: `CSS 不能超过 ${CUSTOM_CSS_MAX_BYTES / 1024} KiB`, line: 1, column: 1 })
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
  dialog.warning({
    title: '放弃未应用修改',
    content: '全局 CSS 中的修改尚未应用到公开页。',
    positiveText: '放弃修改',
    negativeText: '继续编辑',
    onPositiveClick: () => { show.value = false },
  })
}

watch(show, (visible) => {
  if (visible) resetDraft()
}, { immediate: true })
</script>

<template>
  <NModal
    v-model:show="show"
    preset="card"
    title="全局 CSS"
    style="width: min(1100px, 94vw); height: min(720px, 88dvh)"
    content-style="padding: 0; min-height: 0; overflow: hidden"
    :auto-focus="false"
    :mask-closable="false"
  >
    <template #header-extra>
      <NFlex align="center" :wrap="false" size="small">
        <NTag v-if="issues.length" type="error" size="small">
          {{ issues.length }} 个问题
        </NTag>
        <NButton size="small" secondary @click="closeEditor">
          取消
        </NButton>
        <NButton size="small" type="primary" :disabled="!!issues.length" @click="applyChanges">
          应用
        </NButton>
      </NFlex>
    </template>

    <div class="editor-shell">
      <NAlert type="info" :show-icon="true" class="editor-hint">
        CSS 作用于公开用户页，可使用 --vtsuru-* 主题变量；不允许外部 URL、@import 和脚本相关属性。
      </NAlert>
      <NFlex justify="space-between" align="center" class="editor-meta">
        <NText depth="3">
          公开页全局样式
        </NText>
        <NText depth="3">
          {{ cssBytes }}/{{ CUSTOM_CSS_MAX_BYTES }} bytes
        </NText>
      </NFlex>
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
      />
    </div>
  </NModal>
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
