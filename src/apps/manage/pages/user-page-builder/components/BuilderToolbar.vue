<script setup lang="ts">
import {
  AlertCircle,
  Download,
  Eye,
  FolderOpen,
  LayoutGrid,
  MoreHorizontal,
  Palette,
  Redo2,
  RotateCcw,
  Save,
  Settings2,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-vue-next'
import { computed, inject, ref } from 'vue'

import { Button } from '@/shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { useDialog } from '@/shared/utils'

import { UserPageEditorKey } from '../context'

const emit = defineEmits<{
  (event: 'open-layout'): void
  (event: 'open-global-style'): void
}>()

const editor = inject(UserPageEditorKey)
if (!editor) throw new Error('UserPageEditor context is missing')

const dialog = useDialog()
const importInputRef = ref<HTMLInputElement | null>(null)

const statusText = computed(() =>
  editor.hasUnpublishedChanges.value && !editor.isDirty.value
    ? `${editor.saveStatusText.value} · 未发布`
    : editor.saveStatusText.value,
)
const problemCount = computed(() => editor.liveValidationIssues.value.length)
const isBlockMode = computed(() => editor.currentPage.value.mode === 'block')

function confirmRollback() {
  dialog.warning({
    title: '回滚已发布版本',
    content: '确定回滚到上一个已发布版本吗？当前草稿会被替换。',
    positiveText: '回滚',
    negativeText: '取消',
    onPositiveClick: editor.rollback,
  })
}

function confirmClearDraft() {
  dialog.error({
    title: '清空草稿',
    content: '将丢弃当前未保存更改，并切换为已发布版本。',
    positiveText: '清空',
    negativeText: '取消',
    onPositiveClick: editor.clearDraft,
  })
}

function confirmDiscardLocalChanges() {
  dialog.warning({
    title: '放弃本地修改',
    content: '将恢复最近一次保存的服务端草稿，已发布版本和服务端草稿不会被删除。',
    positiveText: '放弃修改',
    negativeText: '取消',
    onPositiveClick: () => editor.discardLocalChanges(editor.lastSavedSnapshot.value),
  })
}

function handleExportJson() {
  try {
    const raw = editor.exportCurrentBlockPageJson()
    const blob = new Blob([raw], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `vtsuru-page-${editor.currentKey.value}-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    editor.message.success('已导出当前区块页 JSON')
  } catch (err: any) {
    editor.message.error(err?.message || '导出失败')
  }
}

function triggerImportJson() {
  importInputRef.value?.click()
}

async function handleImportFileChange(event: Event) {
  const input = event.target as HTMLInputElement | null
  const file = input?.files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    editor.importCurrentBlockPageJson(text)
  } catch (err: any) {
    editor.message.error(err?.message || '导入失败，请确认文件格式有效')
  } finally {
    if (input) input.value = ''
  }
}

function handleMoreAction(key: string) {
  if (key === 'resources') editor.resourcesModal.value = true
  else if (key === 'layout') emit('open-layout')
  else if (key === 'export-json') handleExportJson()
  else if (key === 'import-json') triggerImportJson()
  else if (key === 'auto-save') editor.autoSaveEnabled.value = !editor.autoSaveEnabled.value
  else if (key === 'discard-local') confirmDiscardLocalChanges()
  else if (key === 'preview-rollback') editor.openRollbackPreview()
  else if (key === 'rollback') confirmRollback()
  else if (key === 'clear') confirmClearDraft()
}
</script>

<template>
  <div class="min-w-0 flex items-center justify-end gap-1.5 flex-nowrap">
    <input
      ref="importInputRef"
      type="file"
      accept=".json,application/json"
      class="hidden"
      @change="handleImportFileChange"
    />

    <span
      class="inline-block min-w-0 max-w-[136px] overflow-hidden text-right text-ellipsis whitespace-nowrap text-[11px] text-muted-foreground mr-1 max-[920px]:hidden"
      :class="{ 'text-destructive': editor.hasSyncError.value }"
      role="status"
      aria-live="polite"
      :title="statusText"
    >
      {{ statusText }}
    </span>

    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon-sm"
            :disabled="!editor.canUndo.value"
            aria-label="撤销"
            @click="editor.undo"
          >
            <Undo2 class="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>撤销 (Ctrl+Z)</TooltipContent>
      </Tooltip>
    </TooltipProvider>

    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon-sm"
            :disabled="!editor.canRedo.value"
            aria-label="重做"
            @click="editor.redo"
          >
            <Redo2 class="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>重做 (Ctrl+Y)</TooltipContent>
      </Tooltip>
    </TooltipProvider>

    <Button
      variant="outline"
      class="gap-1.5"
      @click="emit('open-global-style')"
    >
      <Palette class="size-3.5 text-primary" />
      <span class="max-[640px]:hidden">外观与主题</span>
    </Button>

    <Button
      variant="outline"
      class="gap-1.5"
      :disabled="editor.isSaving.value"
      @click="editor.saveDraft"
    >
      <Save class="size-3.5" />
      <span>保存</span>
    </Button>

    <Button
      v-if="problemCount"
      variant="destructive"
      class="gap-1.5"
      @click="editor.openPublishModal"
    >
      <AlertCircle class="size-3.5" />
      <span>{{ problemCount }} 个问题</span>
    </Button>

    <Button
      :disabled="editor.isSaving.value"
      @click="editor.openPublishModal"
    >
      发布
    </Button>

    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="更多操作"
        >
          <MoreHorizontal class="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        class="w-52"
      >
        <div class="px-2 py-1.5 text-[11px] text-muted-foreground select-none">
          编辑来源：{{ editor.loadedFromLabel.value }}
        </div>
        <DropdownMenuItem @click="handleMoreAction('resources')">
          <FolderOpen class="size-3.5 mr-2" />
          资源管理
        </DropdownMenuItem>
        <DropdownMenuItem @click="handleMoreAction('layout')">
          <LayoutGrid class="size-3.5 mr-2" />
          编辑器布局
        </DropdownMenuItem>
        <template v-if="isBlockMode">
          <DropdownMenuSeparator />
          <DropdownMenuItem @click="handleMoreAction('export-json')">
            <Download class="size-3.5 mr-2" />
            导出当前页 JSON
          </DropdownMenuItem>
          <DropdownMenuItem @click="handleMoreAction('import-json')">
            <Upload class="size-3.5 mr-2" />
            导入区块页 JSON
          </DropdownMenuItem>
        </template>
        <DropdownMenuSeparator />
        <DropdownMenuItem @click="handleMoreAction('auto-save')">
          <Settings2 class="size-3.5 mr-2" />
          {{ editor.autoSaveEnabled.value ? '关闭自动保存' : '开启自动保存' }}
        </DropdownMenuItem>
        <DropdownMenuItem
          :disabled="!editor.isDirty.value || editor.isSaving.value"
          @click="handleMoreAction('discard-local')"
        >
          <RotateCcw class="size-3.5 mr-2" />
          放弃本地修改
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          :disabled="!editor.rollbackAvailable.value"
          @click="handleMoreAction('preview-rollback')"
        >
          <Eye class="size-3.5 mr-2" />
          预览可回滚版本
        </DropdownMenuItem>
        <DropdownMenuItem
          :disabled="!editor.rollbackAvailable.value || editor.isSaving.value"
          @click="handleMoreAction('rollback')"
        >
          <RotateCcw class="size-3.5 mr-2" />
          回滚已发布版本
        </DropdownMenuItem>
        <DropdownMenuItem
          :disabled="editor.isSaving.value"
          class="text-destructive focus:text-destructive"
          @click="handleMoreAction('clear')"
        >
          <Trash2 class="size-3.5 mr-2" />
          清空草稿
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>
