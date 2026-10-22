<script setup lang="ts">
import {
  AlertCircleOutline,
  ArrowRedoOutline,
  ArrowUndoOutline,
  ColorPaletteOutline,
  EllipsisHorizontalOutline,
  EyeOutline,
  FolderOpenOutline,
  GridOutline,
  RefreshOutline,
  SaveOutline,
  SettingsOutline,
  TrashOutline,
} from '@vicons/ionicons5'
import { computed, inject } from 'vue'

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
const statusText = computed(() =>
  editor.hasUnpublishedChanges.value && !editor.isDirty.value
    ? `${editor.saveStatusText.value} · 未发布`
    : editor.saveStatusText.value,
)
const problemCount = computed(() => editor.liveValidationIssues.value.length)

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
  const savedSnapshot = editor.lastSavedSnapshot.value
  dialog.warning({
    title: '放弃本地修改',
    content: '将恢复最近一次保存的服务端草稿，已发布版本和服务端草稿不会被删除。',
    positiveText: '放弃修改',
    negativeText: '取消',
    onPositiveClick: () => editor.discardLocalChanges(savedSnapshot),
  })
}

function handleMoreAction(key: string) {
  if (key === 'resources') editor.resourcesModal.value = true
  else if (key === 'layout') emit('open-layout')
  else if (key === 'auto-save') editor.autoSaveEnabled.value = !editor.autoSaveEnabled.value
  else if (key === 'preview-rollback') editor.openRollbackPreview()
  else if (key === 'rollback') confirmRollback()
  else if (key === 'clear') confirmClearDraft()
}
</script>

<template>
  <div class="builder-toolbar flex items-center justify-end gap-1.5 flex-nowrap">
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger as-child>
          <Button variant="ghost" class="size-8 p-0" :disabled="!editor.canUndo.value" aria-label="撤销" @click="editor.undo">
            <component :is="ArrowUndoOutline" class="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>撤销</TooltipContent>
      </Tooltip>
    </TooltipProvider>

    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger as-child>
          <Button variant="ghost" class="size-8 p-0" :disabled="!editor.canRedo.value" aria-label="重做" @click="editor.redo">
            <component :is="ArrowRedoOutline" class="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>重做</TooltipContent>
      </Tooltip>
    </TooltipProvider>

    <Button variant="outline" @click="emit('open-global-style')">
      <component :is="ColorPaletteOutline" class="size-4 mr-1 text-primary" />
      外观与主题
    </Button>

    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger as-child>
          <Button class="discard-button" variant="outline" :disabled="!editor.isDirty.value || editor.isSaving.value" aria-label="放弃本地修改" @click="confirmDiscardLocalChanges">
            <component :is="RefreshOutline" class="size-4 mr-1" />
            <span class="discard-label">放弃本地修改</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>放弃本地修改</TooltipContent>
      </Tooltip>
    </TooltipProvider>

    <Button variant="outline" :disabled="editor.isSaving.value" @click="editor.saveDraft">
      <component :is="SaveOutline" class="size-4 mr-1" />
      保存
    </Button>

    <Button v-if="problemCount" variant="destructive" @click="editor.openPublishModal">
      <component :is="AlertCircleOutline" class="size-4 mr-1" />
      {{ problemCount }} 个问题
    </Button>

    <Button :disabled="editor.isSaving.value" @click="editor.openPublishModal">
      发布
    </Button>

    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button variant="ghost" class="size-8 p-0" aria-label="更多操作">
          <component :is="EllipsisHorizontalOutline" class="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" class="w-48 text-xs">
        <div class="px-2 py-1.5 text-[11px] text-muted-foreground select-none">
          编辑来源：{{ editor.loadedFromLabel.value }}
        </div>
        <template v-if="editor.currentPage.value.mode === 'block'">
          <DropdownMenuItem @click="handleMoreAction('resources')">
            <component :is="FolderOpenOutline" class="size-3.5 mr-2" />
            资源管理
          </DropdownMenuItem>
          <DropdownMenuItem @click="handleMoreAction('layout')">
            <component :is="GridOutline" class="size-3.5 mr-2" />
            编辑器布局
          </DropdownMenuItem>
          <DropdownMenuSeparator />
        </template>
        <DropdownMenuItem @click="handleMoreAction('auto-save')">
          <component :is="SettingsOutline" class="size-3.5 mr-2" />
          {{ editor.autoSaveEnabled.value ? '关闭自动保存' : '开启自动保存' }}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          :disabled="!editor.rollbackAvailable.value"
          @click="handleMoreAction('preview-rollback')"
        >
          <component :is="EyeOutline" class="size-3.5 mr-2" />
          预览可回滚版本
        </DropdownMenuItem>
        <DropdownMenuItem
          :disabled="!editor.rollbackAvailable.value || editor.isSaving.value"
          @click="handleMoreAction('rollback')"
        >
          <component :is="RefreshOutline" class="size-3.5 mr-2" />
          回滚已发布版本
        </DropdownMenuItem>
        <DropdownMenuItem
          :disabled="editor.isSaving.value"
          class="text-destructive focus:text-destructive"
          @click="handleMoreAction('clear')"
        >
          <component :is="TrashOutline" class="size-3.5 mr-2" />
          清空草稿
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <span
      class="save-state text-xs text-muted-foreground"
      :class="{ 'text-destructive': editor.hasSyncError.value }"
      role="status"
      aria-live="polite"
      :title="statusText"
    >
      {{ statusText }}
    </span>
  </div>
</template>

<style scoped>
.builder-toolbar {
  min-width: 0;
}

.save-state {
  display: inline-block;
  width: 108px;
  overflow: hidden;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 760px) {
  .discard-label {
    display: none;
  }

  .discard-button {
    width: 28px;
    padding: 0;
  }

  .save-state {
    display: none;
  }
}
</style>
