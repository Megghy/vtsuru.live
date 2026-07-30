<script setup lang="ts">
import {
  ArrowRedoOutline,
  ArrowUndoOutline,
  AlertCircleOutline,
  ColorPaletteOutline,
  EllipsisHorizontalOutline,
  FolderOpenOutline,
  GridOutline,
  EyeOutline,
  RefreshOutline,
  SaveOutline,
  SettingsOutline,
  TrashOutline,
} from '@vicons/ionicons5'
import type { DropdownOption } from 'naive-ui'
import { NButton, NDropdown, NFlex, NIcon, NText, NTooltip, useDialog } from 'naive-ui'
import { computed, h, inject } from 'vue'

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

const moreOptions = computed<DropdownOption[]>(() => {
  const options: DropdownOption[] = [
    {
      label: `编辑来源：${editor.loadedFromLabel.value}`,
      key: 'version-state',
      disabled: true,
    },
  ]
  if (editor.currentPage.value.mode === 'block') {
    options.push(
      { label: '资源管理', key: 'resources', icon: () => h(NIcon, null, { default: () => h(FolderOpenOutline) }) },
      { label: '编辑器布局', key: 'layout', icon: () => h(NIcon, null, { default: () => h(GridOutline) }) },
      { type: 'divider', key: 'divider-block' },
    )
  }
  options.push(
    {
      label: editor.autoSaveEnabled.value ? '关闭自动保存' : '开启自动保存',
      key: 'auto-save',
      icon: () => h(NIcon, null, { default: () => h(SettingsOutline) }),
    },
    {
      type: 'divider',
      key: 'divider-history',
    },
    {
      label: '预览可回滚版本',
      key: 'preview-rollback',
      disabled: !editor.rollbackAvailable.value,
      icon: () => h(NIcon, null, { default: () => h(EyeOutline) }),
    },
    {
      label: '回滚已发布版本',
      key: 'rollback',
      disabled: !editor.rollbackAvailable.value || editor.isSaving.value,
      icon: () => h(NIcon, null, { default: () => h(RefreshOutline) }),
    },
    {
      label: '清空草稿',
      key: 'clear',
      disabled: editor.isSaving.value,
      props: { style: 'color: #d03050' },
      icon: () => h(NIcon, null, { default: () => h(TrashOutline) }),
    },
  )
  return options
})

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
  <NFlex
    class="builder-toolbar"
    justify="end"
    align="center"
    :wrap="false"
    size="small"
  >
    <NTooltip>
      <template #trigger>
        <NButton
          quaternary
          circle
          size="small"
          :disabled="!editor.canUndo.value"
          aria-label="撤销"
          @click="editor.undo"
        >
          <template #icon>
            <NIcon><ArrowUndoOutline /></NIcon>
          </template>
        </NButton>
      </template>
      撤销
    </NTooltip>
    <NTooltip>
      <template #trigger>
        <NButton
          quaternary
          circle
          size="small"
          :disabled="!editor.canRedo.value"
          aria-label="重做"
          @click="editor.redo"
        >
          <template #icon>
            <NIcon><ArrowRedoOutline /></NIcon>
          </template>
        </NButton>
      </template>
      重做
    </NTooltip>
    <NButton
      size="small"
      secondary
      @click="emit('open-global-style')"
    >
      <template #icon>
        <NIcon><ColorPaletteOutline /></NIcon>
      </template>
      全局主题
    </NButton>
    <NTooltip>
      <template #trigger>
        <NButton
          class="discard-button"
          size="small"
          secondary
          :disabled="!editor.isDirty.value || editor.isSaving.value"
          aria-label="放弃本地修改"
          @click="confirmDiscardLocalChanges"
        >
          <template #icon>
            <NIcon><RefreshOutline /></NIcon>
          </template>
          <span class="discard-label">放弃本地修改</span>
        </NButton>
      </template>
      放弃本地修改
    </NTooltip>
    <NButton
      size="small"
      :loading="editor.isSaving.value"
      @click="editor.saveDraft"
    >
      <template #icon>
        <NIcon><SaveOutline /></NIcon>
      </template>
      保存
    </NButton>
    <NButton
      v-if="problemCount"
      size="small"
      type="error"
      secondary
      @click="editor.openPublishModal"
    >
      <template #icon>
        <NIcon><AlertCircleOutline /></NIcon>
      </template>
      {{ problemCount }} 个问题
    </NButton>
    <NButton
      type="primary"
      size="small"
      :loading="editor.isSaving.value"
      @click="editor.openPublishModal"
    >
      发布
    </NButton>
    <NTooltip>
      <template #trigger>
        <NDropdown
          :options="moreOptions"
          trigger="click"
          @select="(key) => handleMoreAction(String(key))"
        >
          <NButton
            quaternary
            circle
            size="small"
            aria-label="更多操作"
          >
            <template #icon>
              <NIcon><EllipsisHorizontalOutline /></NIcon>
            </template>
          </NButton>
        </NDropdown>
      </template>
      更多操作
    </NTooltip>
    <NText
      class="save-state"
      :type="editor.hasSyncError.value ? 'error' : undefined"
      depth="3"
      role="status"
      aria-live="polite"
      :title="statusText"
    >
      {{ statusText }}
    </NText>
  </NFlex>
</template>

<style scoped>
.builder-toolbar {
  min-width: 0;
}

.save-state {
  display: inline-block;
  width: 108px;
  overflow: hidden;
  font-size: 12px;
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
