<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { computed, onBeforeUnmount, onMounted, provide, ref } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'

import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import { showWarningToast } from '@/shared/services/toast'

import BlockPageThemeModal from './user-page-builder/components/BlockPageThemeModal.vue'
import BuilderPaneHost from './user-page-builder/components/BuilderPaneHost.vue'
import BuilderResourcesModal from './user-page-builder/components/BuilderResourcesModal.vue'
import BuilderToolbar from './user-page-builder/components/BuilderToolbar.vue'
import GlobalPageStyleModal from './user-page-builder/components/GlobalPageStyleModal.vue'
import { UserPageEditorKey } from './user-page-builder/context'
import { COLUMN_META, DEFAULT_COLUMNS_ORDER, useBuilderLayout } from './user-page-builder/useBuilderLayout'
import type { BuilderColumnId } from './user-page-builder/useBuilderLayout'
import { useUserPageEditor } from './user-page-builder/useUserPageEditor'
import type { UserPageValidationIssue } from './user-page-builder/validateUserPagesSettings'

const editor = useUserPageEditor()
provide(UserPageEditorKey, editor)
let stopBeforeUnload: (() => void) | null = null
let stopKeyboardShortcuts: (() => void) | null = null
let stopColumnResizeMove: (() => void) | null = null
let stopColumnResizeEnd: (() => void) | null = null
let stopColumnResizeCancel: (() => void) | null = null
const route = useRoute()
const router = useRouter()
const keyboardStatus = ref('')
const leaveModal = ref(false)
let resolveLeave: ((allowed: boolean) => void) | undefined

const layoutModal = ref(false)
const globalBgModal = ref(false)
const isLegacyMode = computed(() => editor.currentPage.value.mode === 'legacy')
const builderLayout = useBuilderLayout()
const {
  bodyElement: builderBodyEl,
  columnWidths,
  activeColumnsOrder,
  mode: workspaceMode,
  layoutColumnsModel,
  wideGridColumns,
  mediumGridColumns,
  legacyGridColumns,
  isPagesCollapsed,
  mediumPane,
  compactPane,
  paneStyle,
  setColumnWidth,
  togglePagesCollapse,
  applyPreset,
  resetLayout,
} = builderLayout
type ColumnResizeTarget = { id: BuilderColumnId; direction: 1 | -1 }
type ColumnResizeState = ColumnResizeTarget & { startX: number; startWidth: number }

const columnResizeState = ref<ColumnResizeState | null>(null)
const mediumPaneIds: BuilderColumnId[] = ['pages', 'blocks']
const compactPaneIds: BuilderColumnId[] = ['pages', 'blocks', 'preview']
const responsivePaneIds = computed<BuilderColumnId[]>(() => {
  if (isLegacyMode.value) return ['preview']
  return workspaceMode.value === 'medium' ? mediumPaneIds : compactPaneIds
})
const selectedResponsivePane = computed<BuilderColumnId>(() => {
  if (workspaceMode.value === 'compact') {
    return compactPaneIds.includes(compactPane.value) && !isLegacyMode.value ? compactPane.value : 'preview'
  }
  if (isLegacyMode.value) return 'preview'
  return mediumPane.value
})
const workspaceGridStyle = computed(() => ({
  '--builder-wide-columns': wideGridColumns.value,
  '--builder-medium-columns': mediumGridColumns.value,
  '--builder-legacy-columns': legacyGridColumns.value,
}))
const columnResizeTargets = computed<Partial<Record<BuilderColumnId, ColumnResizeTarget>>>(() => {
  if (workspaceMode.value === 'compact') return {}
  if (isLegacyMode.value) return { preview: { id: 'props', direction: -1 } }
  if (workspaceMode.value === 'medium') {
    const targets: Partial<Record<BuilderColumnId, ColumnResizeTarget>> = {
      preview: { id: 'props', direction: -1 },
    }
    if (!(mediumPane.value === 'pages' && isPagesCollapsed.value)) {
      targets[mediumPane.value] = { id: mediumPane.value, direction: 1 }
    }
    return targets
  }

  const targets: Partial<Record<BuilderColumnId, ColumnResizeTarget>> = {}
  const previewIndex = activeColumnsOrder.value.indexOf('preview')
  activeColumnsOrder.value.slice(0, -1).forEach((id, index) => {
    const target =
      index < previewIndex
        ? { id, direction: 1 as const }
        : { id: activeColumnsOrder.value[index + 1], direction: -1 as const }
    if (target.id !== 'pages' || !isPagesCollapsed.value) targets[id] = target
  })
  return targets
})

function selectResponsivePane(id: BuilderColumnId) {
  if (workspaceMode.value === 'medium' && (id === 'pages' || id === 'blocks')) mediumPane.value = id
  else compactPane.value = id
}

function startColumnResize(event: PointerEvent, target: ColumnResizeTarget) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  event.preventDefault()
  columnResizeState.value = {
    ...target,
    startX: event.clientX,
    startWidth: columnWidths.value[target.id],
  }
  document.documentElement.classList.add('builder-column-resizing')
}

function moveColumnResize(event: PointerEvent) {
  const state = columnResizeState.value
  if (!state) return
  setColumnWidth(state.id, state.startWidth + (event.clientX - state.startX) * state.direction)
}

function finishColumnResize() {
  columnResizeState.value = null
  document.documentElement.classList.remove('builder-column-resizing')
}

function resizeColumnByKeyboard(event: KeyboardEvent, target: ColumnResizeTarget) {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  event.preventDefault()
  const offset = event.key === 'ArrowRight' ? 20 : -20
  setColumnWidth(target.id, columnWidths.value[target.id] + offset * target.direction)
}

function beforeUnloadHandler(e: BeforeUnloadEvent) {
  if (!editor.isDirty.value) return
  e.preventDefault()
  e.returnValue = ''
}

function isEditableTarget(target: EventTarget | null) {
  const element = target instanceof HTMLElement ? target : null
  return Boolean(element?.closest('input, textarea, select, [contenteditable="true"], .w-e-text-container'))
}

function announceKeyboardAction(text: string) {
  keyboardStatus.value = ''
  requestAnimationFrame(() => {
    keyboardStatus.value = text
  })
}

function handleEditorShortcut(event: KeyboardEvent) {
  if (editor.loadStatus.value !== 'ready' || isEditableTarget(event.target)) return
  const command = event.ctrlKey || event.metaKey
  const key = event.key.toLowerCase()
  if (command && key === 'z') {
    event.preventDefault()
    if (event.shiftKey) editor.redo()
    else editor.undo()
    announceKeyboardAction(event.shiftKey ? '已重做' : '已撤销')
  } else if (command && key === 'y') {
    event.preventDefault()
    editor.redo()
    announceKeyboardAction('已重做')
  } else if (command && key === 's') {
    event.preventDefault()
    void editor.saveDraft()
    announceKeyboardAction('正在保存')
  } else if (
    editor.currentPage.value.mode === 'block' &&
    command &&
    key === 'c' &&
    !window.getSelection()?.toString()
  ) {
    event.preventDefault()
    editor.copyBlocksToClipboard(editor.selectedBlockIds.value)
    announceKeyboardAction('已复制所选区块')
  } else if (editor.currentPage.value.mode === 'block' && command && key === 'v') {
    event.preventDefault()
    editor.pasteBlocksAfter(editor.selectedBlockIds.value.at(-1) ?? null)
    announceKeyboardAction('已粘贴区块')
  } else if (editor.currentPage.value.mode === 'block' && command && key === 'd') {
    event.preventDefault()
    const ids = editor.selectedBlockIds.value
    if (ids.length === 1) editor.duplicateBlockAt(ids[0], 1)
    else if (ids.length > 1) {
      editor.copyBlocksToClipboard(ids)
      editor.pasteBlocksAfter(ids.at(-1) ?? null)
    }
    announceKeyboardAction('已创建区块副本')
  } else if (
    editor.currentPage.value.mode === 'block' &&
    event.key === 'Delete' &&
    editor.selectedBlockIds.value.length
  ) {
    event.preventDefault()
    editor.removeBlocks(editor.selectedBlockIds.value)
    announceKeyboardAction('已删除所选区块，可使用撤销恢复')
  }
}

function focusPublishValidationIssue(issue: UserPageValidationIssue) {
  if (!editor.focusValidationIssue(issue)) {
    showWarningToast('该问题无法自动定位，请根据提示检查当前配置')
    return
  }
  editor.publishModal.value = false
  const request = editor.validationFocusRequest.value
  if (request?.scope === 'settings') globalBgModal.value = true
  else if (
    request?.scope === 'page' &&
    editor.currentPage.value.mode === 'block' &&
    (request.fieldPath?.startsWith('theme') || request.fieldPath?.startsWith('background'))
  )
    editor.pageThemeModal.value = true
}

onMounted(async () => {
  builderLayout.mount()
  await editor.init()

  const mode = route.query.mode
  if (mode === 'legacy' || mode === 'block' || mode === 'contrib') {
    editor.currentKey.value = 'home'
    editor.currentPage.value.mode = mode
    await router.replace({ name: 'manage-userPageBuilder' })
  }

  stopBeforeUnload = useEventListener(window, 'beforeunload', beforeUnloadHandler)
  stopKeyboardShortcuts = useEventListener(document, 'keydown', handleEditorShortcut)
  stopColumnResizeMove = useEventListener(window, 'pointermove', moveColumnResize)
  stopColumnResizeEnd = useEventListener(window, 'pointerup', finishColumnResize)
  stopColumnResizeCancel = useEventListener(window, 'pointercancel', finishColumnResize)
})

onBeforeUnmount(() => {
  finishColumnResize()
  builderLayout.destroy()
  stopBeforeUnload?.()
  stopKeyboardShortcuts?.()
  stopColumnResizeMove?.()
  stopColumnResizeEnd?.()
  stopColumnResizeCancel?.()
  editor.destroy()
})

onBeforeRouteLeave(() => {
  if (!editor.isDirty.value) return true
  return new Promise<boolean>((resolve) => {
    resolveLeave?.(false)
    resolveLeave = resolve
    leaveModal.value = true
  })
})

function finishLeave(allowed: boolean) {
  leaveModal.value = false
  resolveLeave?.(allowed)
  resolveLeave = undefined
}
</script>

<template>
  <div class="user-page-builder">
    <ManagePageHeader
      title="自定义页面"
      subtitle="配置个人主页与子页面"
    >
      <template #action>
        <BuilderToolbar
          v-if="editor.loadStatus.value === 'ready'"
          @open-layout="layoutModal = true"
          @open-global-style="globalBgModal = true"
        />
      </template>
    </ManagePageHeader>

    <div
      class="builder-spin"
      :aria-busy="editor.isLoading.value"
    >
      <UEmpty
        v-if="editor.loadStatus.value === 'error'"
        icon="i-lucide-circle-x"
        title="页面配置加载失败"
        :description="editor.error.value || '请检查网络连接后重试'"
        class="load-error"
      >
        <template #footer>
          <UButton
            :loading="editor.isLoading.value"
            @click="editor.init"
          >
            重试
          </UButton>
        </template>
      </UEmpty>

      <template v-else-if="editor.loadStatus.value === 'ready'">
        <UAlert
          v-if="editor.error.value"
          color="error"
          icon="i-lucide-circle-x"
          :title="editor.error.value"
        />

        <UAlert
          v-if="editor.localDraftConflict.value"
          color="warning"
          icon="i-lucide-triangle-alert"
          title="检测到另一服务端版本上的本地修改"
          description="当前显示服务端内容。"
        >
          <div>检测到另一服务端版本上的本地修改，当前显示服务端内容。</div>
          <template #actions>
            <UButton
              size="sm"
              color="neutral"
              variant="soft"
              @click="editor.discardConflictingLocalDraft"
            >
              放弃本地修改
            </UButton>
            <UButton
              size="sm"
              color="warning"
              @click="editor.restoreConflictingLocalDraft"
            >
              恢复本地修改
            </UButton>
          </template>
        </UAlert>

        <div
          ref="builderBodyEl"
          class="builder-body"
          :data-workspace-mode="workspaceMode"
        >
          <span
            class="sr-only"
            role="status"
            aria-live="polite"
            >{{ keyboardStatus }}</span
          >
          <UFieldGroup
            v-if="workspaceMode !== 'wide' && responsivePaneIds.length > 1"
            class="workspace-tabs"
          >
            <UButton
              v-for="id in responsivePaneIds"
              :key="id"
              :color="selectedResponsivePane === id ? 'primary' : 'neutral'"
              :variant="selectedResponsivePane === id ? 'solid' : 'soft'"
              @click="selectResponsivePane(id)"
            >
              {{ COLUMN_META[id].label }}
            </UButton>
          </UFieldGroup>

          <div
            class="builder-pane-grid"
            :class="{ 'is-legacy': isLegacyMode }"
            :style="workspaceGridStyle"
          >
            <div
              v-for="id in DEFAULT_COLUMNS_ORDER"
              v-show="!isLegacyMode || id === 'preview' || id === 'props'"
              :key="id"
              class="builder-pane-slot"
              :class="{
                'is-medium-active': id === 'preview' || id === 'props' || id === mediumPane,
                'is-compact-active': id === 'props' || id === selectedResponsivePane,
                'is-wide-active': activeColumnsOrder.includes(id),
              }"
              :data-pane-id="id"
              :style="paneStyle(id)"
            >
              <BuilderPaneHost
                :pane-id="id"
                :pages-collapsed="isPagesCollapsed"
                :pages-collapsible="workspaceMode !== 'compact' && !isLegacyMode"
                @toggle-pages-collapse="togglePagesCollapse"
              />
              <div
                v-if="columnResizeTargets[id]"
                class="builder-column-resizer"
                role="separator"
                tabindex="0"
                aria-orientation="vertical"
                :aria-label="`调整${COLUMN_META[columnResizeTargets[id]!.id].label}栏宽度`"
                :aria-valuemin="COLUMN_META[columnResizeTargets[id]!.id].minPx"
                :aria-valuemax="COLUMN_META[columnResizeTargets[id]!.id].maxPx"
                :aria-valuenow="columnWidths[columnResizeTargets[id]!.id]"
                @pointerdown="startColumnResize($event, columnResizeTargets[id]!)"
                @keydown="resizeColumnByKeyboard($event, columnResizeTargets[id]!)"
              />
            </div>
          </div>
        </div>

        <UModal
          v-model:open="layoutModal"
          title="编辑器布局"
          :ui="{ content: 'sm:max-w-xl' }"
        >
          <template #body>
            <div class="layout-presets">
              <UButton
                color="neutral"
                variant="soft"
                @click="applyPreset('content')"
              >
                内容优先
              </UButton>
              <UButton
                color="neutral"
                variant="soft"
                @click="applyPreset('preview')"
              >
                预览优先
              </UButton>
              <UButton
                color="neutral"
                variant="soft"
                @click="applyPreset('compact')"
              >
                紧凑编辑
              </UButton>
            </div>
            <VueDraggable
              v-model="layoutColumnsModel"
              handle=".drag-handle"
              :animation="160"
            >
              <div
                v-for="id in layoutColumnsModel"
                :key="id"
                style="
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  gap: 10px;
                  padding: 10px 12px;
                  border: 1px solid var(--vtsuru-border);
                  border-radius: 10px;
                  margin: 8px 0;
                "
              >
                <div style="min-width: 0; display: flex; align-items: center; gap: 10px">
                  <UIcon
                    name="i-lucide-grip-vertical"
                    class="drag-handle"
                    style="cursor: grab"
                  />
                  <strong>
                    {{ COLUMN_META[id as any]?.label ?? id }}
                  </strong>
                </div>
                <small class="layout-id">
                  {{ id }}
                </small>
                <small
                  v-if="id === 'preview'"
                  class="layout-auto"
                >
                  自动填充
                </small>
                <UFieldGroup v-else>
                  <UInputNumber
                    :model-value="columnWidths[id]"
                    :min="COLUMN_META[id].minPx"
                    :max="COLUMN_META[id].maxPx"
                    :step="20"
                    class="layout-width-input"
                    @update:model-value="(value) => setColumnWidth(id, value)"
                  />
                  <span class="layout-unit">px</span>
                </UFieldGroup>
              </div>
            </VueDraggable>
          </template>
          <template #footer>
            <div class="layout-footer">
              <UButton
                color="neutral"
                variant="soft"
                @click="resetLayout"
              >
                重置顺序和列宽
              </UButton>
              <UButton @click="layoutModal = false"> 完成 </UButton>
            </div>
          </template>
        </UModal>

        <BuilderResourcesModal v-model:show="editor.resourcesModal.value" />

        <GlobalPageStyleModal v-model:show="globalBgModal" />

        <BlockPageThemeModal v-model:show="editor.pageThemeModal.value" />

        <UModal
          v-model:open="editor.publishModal.value"
          title="发布前检查"
          :ui="{ content: 'sm:max-w-3xl' }"
        >
          <template #body>
            <div class="publish-checks">
              <p class="publish-size">
                配置大小：{{ editor.publishCheckBytes.value }} bytes（后端上限 131072 bytes / 128KB）
              </p>

              <UAlert
                v-if="editor.publishCheckIssues.value.length"
                color="error"
                icon="i-lucide-circle-x"
                title="请先解决以下问题"
              >
                <template #description>
                  <UButton
                    v-for="(issue, idx) in editor.publishCheckIssues.value"
                    :key="`${issue.pageKey}:${issue.blockId}:${issue.fieldPath}:${idx}`"
                    color="error"
                    variant="link"
                    class="validation-error-link"
                    @click="focusPublishValidationIssue(issue)"
                  >
                    {{ issue.message }}
                  </UButton>
                </template>
              </UAlert>
              <UAlert
                v-else
                color="success"
                icon="i-lucide-circle-check"
                title="校验通过，可以发布"
              />

              <UAlert
                v-if="editor.publishCheckWarnings.value.length"
                color="warning"
                icon="i-lucide-triangle-alert"
                title="发布提醒"
              >
                <template #description>
                  <div
                    v-for="(it, idx) in editor.publishCheckWarnings.value"
                    :key="idx"
                  >
                    {{ it }}
                  </div>
                </template>
              </UAlert>
              <UAlert
                v-if="editor.publishError.value"
                color="error"
                icon="i-lucide-circle-x"
                :title="editor.publishError.value"
              />
            </div>
          </template>
          <template #footer>
            <div class="modal-actions">
              <UButton
                color="neutral"
                variant="ghost"
                @click="editor.publishModal.value = false"
              >
                取消
              </UButton>
              <UButton
                :disabled="editor.publishCheckIssues.value.length > 0"
                :loading="editor.isSaving.value"
                @click="editor.confirmPublish"
              >
                确认发布
              </UButton>
            </div>
          </template>
        </UModal>
      </template>
    </div>

    <UModal
      v-model:open="leaveModal"
      title="离开编辑器"
      description="修改已保存在本机，但尚未同步到服务器。离开后仍可在当前浏览器恢复。"
      @update:open="(open) => !open && finishLeave(false)"
    >
      <template #footer>
        <div class="modal-actions">
          <UButton
            color="neutral"
            variant="ghost"
            @click="finishLeave(false)"
          >
            继续编辑
          </UButton>
          <UButton
            color="error"
            @click="finishLeave(true)"
          >
            离开
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<style src="./user-page-builder/components/ui-transitions.css"></style>

<style scoped>
.validation-error-link {
  display: flex;
  width: 100%;
  height: auto;
  justify-content: flex-start;
  margin: 2px 0;
  text-align: left;
  white-space: normal;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.user-page-builder {
  height: calc(100dvh - var(--vtsuru-header-height));
  width: 100%;
  padding: var(--vtsuru-content-padding);
  box-sizing: border-box;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.builder-spin {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.load-error {
  margin: auto;
}

.builder-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.workspace-tabs {
  flex: none;
  max-width: 100%;
  overflow-x: auto;
}

.workspace-tabs :deep(button) {
  min-width: 72px;
}

.layout-presets,
.layout-footer,
.modal-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.layout-presets {
  margin-bottom: 12px;
}

.layout-footer {
  justify-content: space-between;
  width: 100%;
}

.modal-actions {
  justify-content: flex-end;
}

.layout-id,
.layout-auto,
.publish-size {
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}

.layout-id {
  white-space: nowrap;
}

.layout-auto {
  width: 112px;
  text-align: center;
}

.layout-width-input {
  width: 88px;
}

.layout-unit {
  display: grid;
  padding-inline: 10px;
  color: var(--vtsuru-fg-muted);
  background: var(--vtsuru-bg-muted);
  border: 1px solid var(--vtsuru-border);
  place-items: center;
}

.publish-checks {
  display: grid;
  gap: 12px;
}

.builder-pane-grid {
  display: grid;
  grid-template-columns: var(--builder-wide-columns);
  gap: 6px;
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.builder-pane-slot {
  position: relative;
  display: none;
  min-width: 0;
  min-height: 0;
  overflow: visible;
}

.builder-body[data-workspace-mode='wide'] .builder-pane-slot.is-wide-active {
  display: flex;
}

.builder-body[data-workspace-mode='wide'] .builder-pane-grid.is-legacy {
  grid-template-columns: var(--builder-legacy-columns);
}

.builder-body[data-workspace-mode='wide'] .builder-pane-grid.is-legacy [data-pane-id='preview'] {
  order: 0 !important;
}

.builder-body[data-workspace-mode='wide'] .builder-pane-grid.is-legacy [data-pane-id='props'] {
  order: 1 !important;
}

.builder-body[data-workspace-mode='medium'] .builder-pane-grid {
  grid-template-columns: var(--builder-medium-columns);
}

.builder-body[data-workspace-mode='medium'] .builder-pane-slot.is-medium-active {
  display: flex;
  order: 0 !important;
}

.builder-body[data-workspace-mode='medium'] [data-pane-id='preview'] {
  grid-column: 2;
  order: 1 !important;
}

.builder-body[data-workspace-mode='medium'] [data-pane-id='pages'],
.builder-body[data-workspace-mode='medium'] [data-pane-id='blocks'] {
  grid-column: 1;
}

.builder-body[data-workspace-mode='medium'] [data-pane-id='props'] {
  grid-column: 3;
  order: 2 !important;
}

.builder-body[data-workspace-mode='compact'] .builder-pane-grid {
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: minmax(160px, 1fr) minmax(180px, 1fr);
}

.builder-body[data-workspace-mode='compact'] .builder-pane-slot.is-compact-active {
  display: flex;
  order: 0 !important;
}

.builder-body[data-workspace-mode='compact'] [data-pane-id='pages'],
.builder-body[data-workspace-mode='compact'] [data-pane-id='blocks'],
.builder-body[data-workspace-mode='compact'] [data-pane-id='preview'] {
  grid-row: 1;
}

.builder-body[data-workspace-mode='compact'] [data-pane-id='props'] {
  grid-row: 2;
  order: 1 !important;
}

.user-page-builder :deep(.pane-card) {
  height: 100%;
  min-height: 0;
  overflow: hidden;
  animation: builder-pane-enter 220ms ease both;
}

.builder-column-resizer {
  position: absolute;
  z-index: 4;
  top: 0;
  right: -6px;
  bottom: 0;
  width: 12px;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  cursor: col-resize;
  touch-action: none;
}

.builder-column-resizer::after {
  position: absolute;
  top: 10px;
  bottom: 10px;
  left: 5px;
  width: 2px;
  border-radius: 1px;
  background: var(--vtsuru-border);
  content: '';
  transition: background-color 140ms ease;
}

.builder-column-resizer:hover::after,
.builder-column-resizer:focus-visible::after,
.builder-column-resizer:active::after {
  background: var(--vtsuru-brand-soft);
}

:global(html.builder-column-resizing),
:global(html.builder-column-resizing *) {
  cursor: col-resize !important;
  user-select: none !important;
}

.user-page-builder :deep(.pane-scroll) {
  flex: 1;
  min-height: 0;
  height: 100%;
}

.user-page-builder :deep(.preview-bg-host) {
  position: absolute;
  inset: 0;
}
.user-page-builder :deep(.preview-bg-host.enabled) {
  overflow: hidden;
}
.user-page-builder :deep(.preview-bg-host.enabled)::before {
  content: '';
  position: absolute;
  inset: calc(-24px - var(--user-page-bg-blur, 0px));
  background-color: var(--user-page-bg-color, transparent);
  background-image: var(--user-page-bg-image, none);
  background-repeat: no-repeat;
  background-size: var(--user-page-bg-size, cover);
  background-position: center;
  transform: none;
  pointer-events: none;
  z-index: 0;
  transition:
    background-color 180ms ease,
    filter 180ms ease;
}
.user-page-builder :deep(.preview-bg-host.enabled)::after {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--user-page-bg-scrim, transparent);
  pointer-events: none;
  z-index: 0;
  transition:
    background-color 180ms ease,
    opacity 180ms ease;
}
.user-page-builder :deep(.preview-bg-host.enabled.bg-blur)::before {
  filter: blur(var(--user-page-bg-blur, 0px));
}
.user-page-builder :deep(.preview-bg-host.enabled > *) {
  position: relative;
  z-index: 1;
}
.user-page-builder :deep(.preview-glass-surface) {
  min-height: 100%;
  padding: 12px 0;
  background: var(--glass-surface-bg, rgba(255, 255, 255, 0.55));
  backdrop-filter: blur(var(--user-page-bg-blur, 0px));
  -webkit-backdrop-filter: blur(var(--user-page-bg-blur, 0px));
  transition:
    background-color 180ms ease,
    backdrop-filter 180ms ease;
}

.user-page-builder :deep(.preview-content) {
  min-height: 100%;
}

@keyframes builder-pane-enter {
  from {
    opacity: 0;
    transform: translateY(5px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
