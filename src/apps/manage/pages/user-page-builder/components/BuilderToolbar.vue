<script setup lang="ts">
import type { DropdownOption } from 'naive-ui'
import { NButton, NDropdown, NFlex, NIcon, NText, NTooltip, useDialog } from 'naive-ui'
import { computed, h, inject } from 'vue'
import {
  ArrowRedoOutline,
  ArrowUndoOutline,
  ColorPaletteOutline,
  EllipsisHorizontalOutline,
  FolderOpenOutline,
  GridOutline,
  RefreshOutline,
  SaveOutline,
  SettingsOutline,
  TrashOutline,
} from '@vicons/ionicons5'
import { UserPageEditorKey } from '../context'

const emit = defineEmits<{
  (event: 'open-layout'): void
  (event: 'open-global-style'): void
}>()

const editor = inject(UserPageEditorKey)
if (!editor) throw new Error('UserPageEditor context is missing')

const dialog = useDialog()

const moreOptions = computed<DropdownOption[]>(() => [
  { label: '资源管理', key: 'resources', icon: () => h(NIcon, null, { default: () => h(FolderOpenOutline) }) },
  { label: '编辑器布局', key: 'layout', icon: () => h(NIcon, null, { default: () => h(GridOutline) }) },
  { label: '全局样式', key: 'global-style', icon: () => h(NIcon, null, { default: () => h(ColorPaletteOutline) }) },
  { type: 'divider', key: 'divider-1' },
  {
    label: editor.autoSaveEnabled.value ? '关闭自动保存' : '开启自动保存',
    key: 'auto-save',
    icon: () => h(NIcon, null, { default: () => h(SettingsOutline) }),
  },
  { type: 'divider', key: 'divider-2' },
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
])

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

function handleMoreAction(key: string) {
  if (key === 'resources') editor.resourcesModal.value = true
  else if (key === 'layout') emit('open-layout')
  else if (key === 'global-style') emit('open-global-style')
  else if (key === 'auto-save') editor.autoSaveEnabled.value = !editor.autoSaveEnabled.value
  else if (key === 'rollback') confirmRollback()
  else if (key === 'clear') confirmClearDraft()
}
</script>

<template>
  <NFlex class="builder-toolbar" justify="end" align="center" :wrap="false" size="small">
    <NTooltip>
      <template #trigger>
        <NButton quaternary circle size="small" :disabled="!editor.canUndo.value" aria-label="撤销" @click="editor.undo">
          <template #icon>
            <NIcon><ArrowUndoOutline /></NIcon>
          </template>
        </NButton>
      </template>
      撤销
    </NTooltip>
    <NTooltip>
      <template #trigger>
        <NButton quaternary circle size="small" :disabled="!editor.canRedo.value" aria-label="重做" @click="editor.redo">
          <template #icon>
            <NIcon><ArrowRedoOutline /></NIcon>
          </template>
        </NButton>
      </template>
      重做
    </NTooltip>
    <NButton size="small" :loading="editor.isSaving.value" @click="editor.saveDraft">
      <template #icon>
        <NIcon><SaveOutline /></NIcon>
      </template>
      保存
    </NButton>
    <NButton type="primary" size="small" :loading="editor.isSaving.value" @click="editor.openPublishModal">
      发布
    </NButton>
    <NDropdown :options="moreOptions" trigger="click" @select="(key) => handleMoreAction(String(key))">
      <NButton quaternary circle size="small" aria-label="更多操作">
        <template #icon>
          <NIcon><EllipsisHorizontalOutline /></NIcon>
        </template>
      </NButton>
    </NDropdown>
    <NText class="save-state" depth="3" :title="editor.autoSaveEnabled.value ? '自动保存已开启' : '自动保存已关闭'">
      {{ editor.saveStatusText.value }}
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
  .save-state {
    display: none;
  }
}
</style>
