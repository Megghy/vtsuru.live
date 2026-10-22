<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'

import { CUSTOM_CSS_MAX_BYTES, utf8ByteLength } from '@/apps/user-page/block/customHtmlContract'
import { inspectCustomCss } from '@/apps/user-page/block/customHtmlRuntime'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Tag } from '@/shared/ui/tag'
import { useDialog } from '@/shared/utils'

import { UserPageEditorKey } from '../context'
import CustomHtmlCodeEditor from './CustomHtmlCodeEditor.vue'

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
  dialog.warning({
    title: '放弃未应用修改',
    content: '全局 CSS 中的修改尚未应用到公开页。',
    positiveText: '放弃修改',
    negativeText: '继续编辑',
    onPositiveClick: () => {
      show.value = false
    },
  })
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
  <Dialog :open="show" @update:open="(val) => { if (!val) closeEditor(); else show = true }">
    <DialogContent class="max-w-[min(1100px,94vw)] h-[min(720px,88dvh)] p-0 flex flex-col gap-0 overflow-hidden">
      <DialogHeader class="p-4 border-b flex flex-row items-center justify-between shrink-0">
        <DialogTitle class="text-base font-semibold"> 全局 CSS </DialogTitle>
        <div class="flex items-center gap-2 pr-6">
          <Tag v-if="issues.length" variant="destructive" class="text-xs">
            {{ issues.length }} 个问题
          </Tag>
          <Button variant="outline" @click="closeEditor"> 取消 </Button>
          <Button :disabled="!!issues.length" @click="applyChanges"> 应用 </Button>
        </div>
      </DialogHeader>

      <div class="editor-shell flex-1 min-h-0 flex flex-col">
        <div class="px-3.5 pt-3 shrink-0">
          <Alert class="text-xs py-2">
            <AlertDescription>
              CSS 作用于公开用户页，可使用 --vtsuru-* 主题变量；不允许外部 URL、@import 和脚本相关属性。
            </AlertDescription>
          </Alert>
        </div>
        <div class="flex justify-between items-center px-3.5 py-2 text-xs text-muted-foreground shrink-0">
          <span>公开页全局样式</span>
          <span>{{ cssBytes }}/{{ CUSTOM_CSS_MAX_BYTES }} bytes</span>
        </div>
        <div class="flex-1 min-h-0">
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
      </div>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.editor-shell :deep(.code-editor) {
  height: 100%;
  min-height: 0;
}
</style>
