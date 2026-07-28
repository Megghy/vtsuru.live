<script setup lang="ts">
import { NAlert, NButton, NButtonGroup, NFlex, NIcon, NInputNumber, NModal, NResult, NSpin, NText, useDialog, useMessage } from 'naive-ui'
import { computed, onBeforeUnmount, onMounted, provide, ref } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { ReorderThreeOutline } from '@vicons/ionicons5'
import { useEventListener } from '@vueuse/core'
import { VueDraggable } from 'vue-draggable-plus'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import { UserPageEditorKey } from './user-page-builder/context'
import { useUserPageEditor } from './user-page-builder/useUserPageEditor'
import { COLUMN_META, DEFAULT_COLUMNS_ORDER, useBuilderLayout } from './user-page-builder/useBuilderLayout'
import type { BuilderColumnId } from './user-page-builder/useBuilderLayout'
import BuilderPaneHost from './user-page-builder/components/BuilderPaneHost.vue'
import BuilderToolbar from './user-page-builder/components/BuilderToolbar.vue'
import BuilderResourcesModal from './user-page-builder/components/BuilderResourcesModal.vue'
import GlobalPageStyleModal from './user-page-builder/components/GlobalPageStyleModal.vue'
import BlockPageThemeModal from './user-page-builder/components/BlockPageThemeModal.vue'
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
const dialog = useDialog()
const message = useMessage()
const keyboardStatus = ref('')

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
type ColumnResizeTarget = { id: BuilderColumnId, direction: 1 | -1 }
type ColumnResizeState = ColumnResizeTarget & { startX: number, startWidth: number }

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
    const target = index < previewIndex
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
  requestAnimationFrame(() => { keyboardStatus.value = text })
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
  } else if (editor.currentPage.value.mode === 'block' && command && key === 'c' && !window.getSelection()?.toString()) {
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
  } else if (editor.currentPage.value.mode === 'block' && event.key === 'Delete' && editor.selectedBlockIds.value.length) {
    event.preventDefault()
    editor.removeBlocks(editor.selectedBlockIds.value)
    announceKeyboardAction('已删除所选区块，可使用撤销恢复')
  }
}

function focusPublishValidationIssue(issue: UserPageValidationIssue) {
  if (!editor.focusValidationIssue(issue)) {
    message.warning('该问题无法自动定位，请根据提示检查当前配置')
    return
  }
  editor.publishModal.value = false
  const request = editor.validationFocusRequest.value
  if (request?.scope === 'settings') globalBgModal.value = true
  else if (
    request?.scope === 'page'
    && editor.currentPage.value.mode === 'block'
    && (request.fieldPath?.startsWith('theme') || request.fieldPath?.startsWith('background'))
  ) editor.pageThemeModal.value = true
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
    dialog.warning({
      title: '离开编辑器',
      content: '修改已保存在本机，但尚未同步到服务器。离开后仍可在当前浏览器恢复。',
      positiveText: '离开',
      negativeText: '继续编辑',
      onPositiveClick: () => resolve(true),
      onNegativeClick: () => resolve(false),
      onClose: () => resolve(false),
    })
  })
})
</script>

<template>
  <div class="user-page-builder">
    <ManagePageHeader title="自定义页面" subtitle="配置个人主页与子页面">
      <template #action>
        <BuilderToolbar
          v-if="editor.loadStatus.value === 'ready'"
          @open-layout="layoutModal = true"
          @open-global-style="globalBgModal = true"
        />
      </template>
    </ManagePageHeader>

    <NSpin class="builder-spin" :show="editor.isLoading.value">
      <NResult
        v-if="editor.loadStatus.value === 'error'"
        status="error"
        title="页面配置加载失败"
        :description="editor.error.value || '请检查网络连接后重试'"
        class="load-error"
      >
        <template #footer>
          <NButton type="primary" :loading="editor.isLoading.value" @click="editor.init">
            重试
          </NButton>
        </template>
      </NResult>

      <template v-else-if="editor.loadStatus.value === 'ready'">
        <NAlert
          v-if="editor.error.value"
          type="error"
          :show-icon="true"
          style="margin-bottom: 12px"
        >
          {{ editor.error.value }}
        </NAlert>

        <div ref="builderBodyEl" class="builder-body" :data-workspace-mode="workspaceMode">
          <span class="sr-only" role="status" aria-live="polite">{{ keyboardStatus }}</span>
          <NButtonGroup v-if="workspaceMode !== 'wide' && responsivePaneIds.length > 1" class="workspace-tabs" size="small">
            <NButton
              v-for="id in responsivePaneIds"
              :key="id"
              :type="selectedResponsivePane === id ? 'primary' : 'default'"
              :secondary="selectedResponsivePane === id"
              @click="selectResponsivePane(id)"
            >
              {{ COLUMN_META[id].label }}
            </NButton>
          </NButtonGroup>

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

        <NModal
          v-model:show="layoutModal"
          preset="card"
          title="编辑器布局"
          style="width: 520px; max-width: 95vw"
          :auto-focus="false"
        >
          <NFlex size="small" style="margin-bottom: 12px">
            <NButton size="small" secondary @click="applyPreset('content')">
              内容优先
            </NButton>
            <NButton size="small" secondary @click="applyPreset('preview')">
              预览优先
            </NButton>
            <NButton size="small" secondary @click="applyPreset('compact')">
              紧凑编辑
            </NButton>
          </NFlex>
          <VueDraggable
            v-model="layoutColumnsModel"
            handle=".drag-handle"
            :animation="160"
          >
            <div
              v-for="id in layoutColumnsModel"
              :key="id"
              style="display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; border: 1px solid var(--n-border-color); border-radius: 10px; margin: 8px 0"
            >
              <div style="min-width: 0; display: flex; align-items: center; gap: 10px">
                <NIcon class="drag-handle" size="18" style="cursor: grab">
                  <ReorderThreeOutline />
                </NIcon>
                <NText strong>
                  {{ COLUMN_META[id as any]?.label ?? id }}
                </NText>
              </div>
              <NText depth="3" style="font-size: 12px; white-space: nowrap">
                {{ id }}
              </NText>
              <NText v-if="id === 'preview'" depth="3" style="width: 112px; text-align: center; font-size: 12px">
                自动填充
              </NText>
              <NInputNumber
                v-else
                :value="columnWidths[id]"
                :min="COLUMN_META[id].minPx"
                :max="COLUMN_META[id].maxPx"
                :step="20"
                size="small"
                style="width: 112px"
                @update:value="value => setColumnWidth(id, value)"
              >
                <template #suffix>
                  px
                </template>
              </NInputNumber>
            </div>
          </VueDraggable>
          <template #footer>
            <NFlex justify="space-between">
              <NButton
                size="small"
                secondary
                @click="resetLayout"
              >
                重置顺序和列宽
              </NButton>
              <NButton size="small" type="primary" @click="layoutModal = false">
                完成
              </NButton>
            </NFlex>
          </template>
        </NModal>

        <BuilderResourcesModal v-model:show="editor.resourcesModal.value" />

        <GlobalPageStyleModal v-model:show="globalBgModal" />

        <BlockPageThemeModal v-model:show="editor.pageThemeModal.value" />

        <NModal
          v-model:show="editor.publishModal.value"
          preset="card"
          title="发布前检查"
          style="width: 720px; max-width: 95vw"
          :auto-focus="false"
        >
          <NFlex vertical>
            <NText depth="3">
              配置大小：{{ editor.publishCheckBytes.value }} bytes（后端上限 131072 bytes / 128KB）
            </NText>

            <NAlert v-if="editor.publishCheckIssues.value.length" type="error" :show-icon="true">
              <NButton
                v-for="(issue, idx) in editor.publishCheckIssues.value"
                :key="`${issue.pageKey}:${issue.blockId}:${issue.fieldPath}:${idx}`"
                text
                type="error"
                class="validation-error-link"
                @click="focusPublishValidationIssue(issue)"
              >
                {{ issue.message }}
              </NButton>
            </NAlert>
            <NAlert v-else type="success" :show-icon="true">
              校验通过，可以发布
            </NAlert>

            <NAlert v-if="editor.publishCheckWarnings.value.length" type="warning" :show-icon="true">
              <div v-for="(it, idx) in editor.publishCheckWarnings.value" :key="idx">
                {{ it }}
              </div>
            </NAlert>
            <NAlert v-if="editor.publishError.value" type="error" :show-icon="true">
              {{ editor.publishError.value }}
            </NAlert>
          </NFlex>
          <template #footer>
            <NFlex justify="end">
              <NButton @click="editor.publishModal.value = false">
                取消
              </NButton>
              <NButton
                type="primary"
                :disabled="editor.publishCheckIssues.value.length > 0"
                :loading="editor.isSaving.value"
                @click="editor.confirmPublish"
              >
                确认发布
              </NButton>
            </NFlex>
          </template>
        </NModal>
      </template>
    </NSpin>
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

.user-page-builder :deep(.n-button .n-button__content) {
  gap: 6px;
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

.builder-spin :deep(.n-spin-content) {
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

.workspace-tabs :deep(.n-button) {
  min-width: 72px;
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

.builder-body[data-workspace-mode="wide"] .builder-pane-slot.is-wide-active {
  display: flex;
}

.builder-body[data-workspace-mode="wide"] .builder-pane-grid.is-legacy {
  grid-template-columns: var(--builder-legacy-columns);
}

.builder-body[data-workspace-mode="wide"] .builder-pane-grid.is-legacy [data-pane-id="preview"] {
  order: 0 !important;
}

.builder-body[data-workspace-mode="wide"] .builder-pane-grid.is-legacy [data-pane-id="props"] {
  order: 1 !important;
}

.builder-body[data-workspace-mode="medium"] .builder-pane-grid {
  grid-template-columns: var(--builder-medium-columns);
}

.builder-body[data-workspace-mode="medium"] .builder-pane-slot.is-medium-active {
  display: flex;
  order: 0 !important;
}

.builder-body[data-workspace-mode="medium"] [data-pane-id="preview"] {
  grid-column: 2;
  order: 1 !important;
}

.builder-body[data-workspace-mode="medium"] [data-pane-id="pages"],
.builder-body[data-workspace-mode="medium"] [data-pane-id="blocks"] {
  grid-column: 1;
}

.builder-body[data-workspace-mode="medium"] [data-pane-id="props"] {
  grid-column: 3;
  order: 2 !important;
}

.builder-body[data-workspace-mode="compact"] .builder-pane-grid {
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: minmax(160px, 1fr) minmax(180px, 1fr);
}

.builder-body[data-workspace-mode="compact"] .builder-pane-slot.is-compact-active {
  display: flex;
  order: 0 !important;
}

.builder-body[data-workspace-mode="compact"] [data-pane-id="pages"],
.builder-body[data-workspace-mode="compact"] [data-pane-id="blocks"],
.builder-body[data-workspace-mode="compact"] [data-pane-id="preview"] {
  grid-row: 1;
}

.builder-body[data-workspace-mode="compact"] [data-pane-id="props"] {
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
  content: "";
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
  content: "";
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
  transition: background-color 180ms ease, filter 180ms ease;
}
.user-page-builder :deep(.preview-bg-host.enabled)::after {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--user-page-bg-scrim, transparent);
  pointer-events: none;
  z-index: 0;
  transition: background-color 180ms ease, opacity 180ms ease;
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
  transition: background-color 180ms ease, backdrop-filter 180ms ease;
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
