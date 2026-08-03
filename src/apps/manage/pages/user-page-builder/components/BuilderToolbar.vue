<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { computed, inject } from 'vue'

import { UserPageEditorKey } from '../context'

const emit = defineEmits<{
  (event: 'open-layout'): void
  (event: 'open-global-style'): void
}>()

const editor = inject(UserPageEditorKey)
if (!editor) throw new Error('UserPageEditor context is missing')

const statusText = computed(() =>
  editor.hasUnpublishedChanges.value && !editor.isDirty.value
    ? `${editor.saveStatusText.value} · 未发布`
    : editor.saveStatusText.value,
)
const problemCount = computed(() => editor.liveValidationIssues.value.length)

const moreOptions = computed(() => {
  const options: DropdownMenuItem[] = [
    {
      label: `编辑来源：${editor.loadedFromLabel.value}`,
      key: 'version-state',
      disabled: true,
    },
  ]
  if (editor.currentPage.value.mode === 'block') {
    options.push(
      { label: '资源管理', key: 'resources', icon: 'i-lucide-folder-open' },
      { label: '编辑器布局', key: 'layout', icon: 'i-lucide-grid-3x3' },
      { type: 'separator' as const, key: 'divider-block' },
    )
  }
  options.push(
    {
      label: editor.autoSaveEnabled.value ? '关闭自动保存' : '开启自动保存',
      key: 'auto-save',
      icon: 'i-lucide-settings',
    },
    {
      type: 'separator' as const,
      key: 'divider-history',
    },
    {
      label: '预览可回滚版本',
      key: 'preview-rollback',
      disabled: !editor.rollbackAvailable.value,
      icon: 'i-lucide-eye',
    },
    {
      label: '回滚已发布版本',
      key: 'rollback',
      disabled: !editor.rollbackAvailable.value || editor.isSaving.value,
      icon: 'i-lucide-refresh-cw',
    },
    {
      label: '清空草稿',
      key: 'clear',
      disabled: editor.isSaving.value,
      class: 'text-red-500',
      icon: 'i-lucide-trash-2',
    },
  )
  return options.map((item) =>
    item.key && item.type !== 'separator' ? { ...item, onSelect: () => handleMoreAction(String(item.key)) } : item,
  )
})

function confirmRollback() {
  if (window.confirm('确定回滚到上一个已发布版本吗？当前草稿会被替换。')) void editor.rollback()
}

function confirmClearDraft() {
  if (window.confirm('将丢弃当前未保存更改，并切换为已发布版本。确定清空吗？')) void editor.clearDraft()
}

function confirmDiscardLocalChanges() {
  const savedSnapshot = editor.lastSavedSnapshot.value
  if (window.confirm('将恢复最近一次保存的服务端草稿，已发布版本和服务端草稿不会被删除。确定放弃修改吗？'))
    void editor.discardLocalChanges(savedSnapshot)
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
  <div class="builder-row builder-toolbar">
    <UTooltip>
      <UButton
        variant="ghost"
        square
        size="sm"
        :disabled="!editor.canUndo.value"
        aria-label="撤销"
        @click="editor.undo"
      >
        <template #icon>
          <UIcon name="i-lucide-undo-2" />
        </template>
      </UButton>
      <template #content> 撤销 </template></UTooltip
    >
    <UTooltip>
      <UButton
        variant="ghost"
        square
        size="sm"
        :disabled="!editor.canRedo.value"
        aria-label="重做"
        @click="editor.redo"
      >
        <template #icon>
          <UIcon name="i-lucide-redo-2" />
        </template>
      </UButton>
      <template #content> 重做 </template></UTooltip
    >
    <UButton
      size="sm"
      variant="soft"
      @click="emit('open-global-style')"
    >
      <template #icon>
        <UIcon name="i-lucide-palette" />
      </template>
      全局主题
    </UButton>
    <UTooltip>
      <UButton
        class="discard-button"
        size="sm"
        variant="soft"
        :disabled="!editor.isDirty.value || editor.isSaving.value"
        aria-label="放弃本地修改"
        @click="confirmDiscardLocalChanges"
      >
        <template #icon>
          <UIcon name="i-lucide-refresh-cw" />
        </template>
        <span class="discard-label">放弃本地修改</span>
      </UButton>
      <template #content> 放弃本地修改 </template></UTooltip
    >
    <UButton
      size="sm"
      :loading="editor.isSaving.value"
      @click="editor.saveDraft"
    >
      <template #icon>
        <UIcon name="i-lucide-save" />
      </template>
      保存
    </UButton>
    <UButton
      v-if="problemCount"
      size="sm"
      color="error"
      variant="soft"
      @click="editor.openPublishModal"
    >
      <template #icon>
        <UIcon name="i-lucide-circle-alert" />
      </template>
      {{ problemCount }} 个问题
    </UButton>
    <UButton
      color="primary"
      size="sm"
      :loading="editor.isSaving.value"
      @click="editor.openPublishModal"
    >
      发布
    </UButton>
    <UTooltip>
      <UDropdownMenu :items="moreOptions">
        <UButton
          variant="ghost"
          square
          size="sm"
          aria-label="更多操作"
        >
          <template #icon>
            <UIcon name="i-lucide-ellipsis" />
          </template>
        </UButton>
      </UDropdownMenu>
      <template #content> 更多操作 </template></UTooltip
    >
    <span
      class="builder-text save-state"
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
