<script setup lang="ts">
import { ReorderThreeOutline } from '@vicons/ionicons5'
import { useEventListener } from '@vueuse/core'
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'

import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { NumberField } from '@/shared/ui/number-field'
import { Spin } from '@/shared/ui/spin'
import { useDialog, useMessage } from '@/shared/utils'

import BuilderPaneHost from './user-page-builder/components/BuilderPaneHost.vue'
import BuilderResourcesModal from './user-page-builder/components/BuilderResourcesModal.vue'
import BuilderToolbar from './user-page-builder/components/BuilderToolbar.vue'
import ThemeStyleDrawer from './user-page-builder/components/ThemeStyleDrawer.vue'
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
const dialog = useDialog()
const message = useMessage()
const keyboardStatus = ref('')

const layoutModal = ref(false)
const themeDrawerVisible = ref(false)
const themeDrawerScope = ref<'global' | 'page'>('global')

function openThemeDrawer(scope: 'global' | 'page' = 'global') {
  themeDrawerScope.value = scope
  themeDrawerVisible.value = true
}

// 统一代理 editor.pageThemeModal，当属性栏触发「页面主题」时统一由外观抽屉承接
watch(editor.pageThemeModal, (val) => {
  if (val) {
    editor.pageThemeModal.value = false
    openThemeDrawer('page')
  }
})

function onThemeDrawerUpdate(show: boolean) {
  themeDrawerVisible.value = show
  if (!show && (route.query.action === 'theme' || route.query.action === 'background')) {
    const nextQuery = { ...route.query }
    delete nextQuery.action
    void router.replace({ name: 'manage-userPageBuilder', query: nextQuery })
  }
}

watch(
  () => [editor.loadStatus.value, route.query.action] as const,
  async ([status, action]) => {
    if (status === 'ready' && (action === 'theme' || action === 'background')) {
      await nextTick()
      openThemeDrawer('global')
    }
  },
  { immediate: true },
)
const isBlockMode = computed(() => editor.currentPage.value.mode === 'block')
const isLegacyMode = computed(() => editor.currentPage.value.mode === 'legacy')
const isContribMode = computed(() => editor.currentPage.value.mode === 'contrib')
const builderLayout = useBuilderLayout(isBlockMode)
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
  if (!isBlockMode.value) {
    return workspaceMode.value === 'medium' ? ['pages'] : ['pages', 'preview']
  }
  return workspaceMode.value === 'medium' ? mediumPaneIds : compactPaneIds
})
const selectedResponsivePane = computed<BuilderColumnId>(() => {
  if (!isBlockMode.value) {
    if (workspaceMode.value === 'compact') {
      return ['pages', 'preview'].includes(compactPane.value) ? compactPane.value : 'preview'
    }
    return 'pages'
  }
  if (workspaceMode.value === 'compact') {
    return compactPaneIds.includes(compactPane.value) ? compactPane.value : 'preview'
  }
  return mediumPane.value
})
const workspaceGridStyle = computed(() => ({
  '--builder-wide-columns': wideGridColumns.value,
  '--builder-medium-columns': mediumGridColumns.value,
  '--builder-legacy-columns': legacyGridColumns.value,
}))
const columnResizeTargets = computed<Partial<Record<BuilderColumnId, ColumnResizeTarget>>>(() => {
  if (workspaceMode.value === 'compact') return {}
  if (workspaceMode.value === 'medium') {
    const targets: Partial<Record<BuilderColumnId, ColumnResizeTarget>> = {
      preview: { id: 'props', direction: -1 },
    }
    const activeLeft = isBlockMode.value ? mediumPane.value : 'pages'
    if (!(activeLeft === 'pages' && isPagesCollapsed.value)) {
      targets[activeLeft] = { id: activeLeft, direction: 1 }
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
    message.warning('该问题无法自动定位，请根据提示检查当前配置')
    return
  }
  editor.publishModal.value = false
  const request = editor.validationFocusRequest.value
  if (request?.scope === 'settings') openThemeDrawer('global')
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
    dialog.warning({
      title: '离开编辑器',
      content: '修改已保存在本机，但尚未同步到服务器。离开后仍可在当前浏览器恢复。',
      positiveText: '离开',
      negativeText: '继续编辑',
      onPositiveClick: () => resolve(true),
      onNegativeClick: () => resolve(false),
    })
  })
})
</script>

<template>
  <div class="user-page-builder h-[calc(100dvh-var(--vtsuru-header-height))] w-full p-[var(--vtsuru-content-padding)] box-border overflow-hidden flex flex-col gap-3">
    <ManagePageHeader
      title="主页装修"
      subtitle="配置个人主页、视觉主题与展示块"
    >
      <template #action>
        <BuilderToolbar
          v-if="editor.loadStatus.value === 'ready'"
          @open-layout="layoutModal = true"
          @open-global-style="openThemeDrawer('global')"
        />
      </template>
    </ManagePageHeader>

    <Spin
      class="flex-1 min-h-0 overflow-hidden flex flex-col"
      :show="editor.isLoading.value"
    >
      <div
        v-if="editor.loadStatus.value === 'error'"
        class="m-auto flex flex-col items-center justify-center p-8 text-center"
      >
        <div class="mb-2 text-lg font-semibold text-destructive">页面配置加载失败</div>
        <p class="mb-4 text-sm text-muted-foreground">{{ editor.error.value || '请检查网络连接后重试' }}</p>
        <Button
          :loading="editor.isLoading.value"
          @click="editor.init"
        >
          重试
        </Button>
      </div>

      <template v-else-if="editor.loadStatus.value === 'ready'">
        <Alert
          v-if="editor.error.value"
          variant="destructive"
          class="mb-3"
        >
          <AlertCircle class="h-4 w-4" />
          <AlertDescription>{{ editor.error.value }}</AlertDescription>
        </Alert>

        <Alert
          v-if="editor.localDraftConflict.value"
          class="mb-3 border-amber-500/50 text-amber-600 dark:text-amber-400"
        >
          <AlertTriangle class="h-4 w-4" />
          <AlertTitle>版本冲突</AlertTitle>
          <AlertDescription>
            <div>检测到另一服务端版本上的本地修改，当前显示服务端内容。</div>
            <div class="mt-2 flex gap-2">
              <Button
                size="xs"
                variant="outline"
                class="px-2"
                @click="editor.discardConflictingLocalDraft"
              >
                放弃本地修改
              </Button>
              <Button
                size="xs"
                class="bg-amber-600 px-2 text-white hover:bg-amber-700"
                @click="editor.restoreConflictingLocalDraft"
              >
                恢复本地修改
              </Button>
            </div>
          </AlertDescription>
        </Alert>

        <div
          ref="builderBodyEl"
          class="builder-body flex-1 min-h-0 flex flex-col gap-2"
          :data-workspace-mode="workspaceMode"
        >
          <span
            class="sr-only"
            role="status"
            aria-live="polite"
            >{{ keyboardStatus }}</span
          >
          <div
            v-if="workspaceMode !== 'wide' && responsivePaneIds.length > 1"
            class="shrink-0 max-w-full overflow-x-auto inline-flex rounded-md border border-input p-0.5 bg-muted/40"
          >
            <Button
              size="xs"
              v-for="id in responsivePaneIds"
              :key="id"
              :variant="selectedResponsivePane === id ? 'secondary' : 'ghost'"
              class="px-3"
              @click="selectResponsivePane(id)"
            >
              {{ COLUMN_META[id].label }}
            </Button>
          </div>

          <div
            class="builder-pane-grid grid gap-1.5 flex-1 min-w-0 min-h-0"
            :class="{ 'is-legacy': isLegacyMode, 'is-non-block': !isBlockMode }"
            :style="workspaceGridStyle"
          >
            <div
              v-for="id in DEFAULT_COLUMNS_ORDER"
              v-show="activeColumnsOrder.includes(id)"
              :key="id"
              class="builder-pane-slot"
              :class="{
                'is-medium-active': id === 'preview' || id === 'props' || id === (isBlockMode ? mediumPane : 'pages'),
                'is-compact-active': id === 'props' || id === selectedResponsivePane,
                'is-wide-active': activeColumnsOrder.includes(id),
              }"
              :data-pane-id="id"
              :style="paneStyle(id)"
            >
              <BuilderPaneHost
                :pane-id="id"
                :pages-collapsed="isPagesCollapsed"
                :pages-collapsible="workspaceMode !== 'compact' && id === 'pages'"
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

        <Dialog v-model:open="layoutModal">
          <DialogContent class="max-w-[520px] p-6">
            <DialogHeader>
              <DialogTitle>编辑器布局</DialogTitle>
            </DialogHeader>
            <div class="flex gap-2 mb-3">
              <Button
                variant="outline"
                @click="applyPreset('content')"
              >
                内容优先
              </Button>
              <Button
                variant="outline"
                @click="applyPreset('preview')"
              >
                预览优先
              </Button>
              <Button
                variant="outline"
                @click="applyPreset('compact')"
              >
                紧凑编辑
              </Button>
            </div>
            <VueDraggable
              v-model="layoutColumnsModel"
              handle=".drag-handle"
              :animation="160"
            >
              <div
                v-for="id in layoutColumnsModel"
                :key="id"
                class="my-2 flex items-center justify-between gap-2.5 rounded-lg border border-border p-2.5"
              >
                <div class="flex min-w-0 items-center gap-2.5">
                  <ReorderThreeOutline class="drag-handle size-4 cursor-grab text-muted-foreground" />
                  <span class="text-sm font-semibold">
                    {{ COLUMN_META[id as any]?.label ?? id }}
                  </span>
                </div>
                <span class="whitespace-nowrap text-xs text-muted-foreground">
                  {{ id }}
                </span>
                <span
                  v-if="id === 'preview'"
                  class="w-28 text-center text-xs text-muted-foreground"
                >
                  自动填充
                </span>
                <NumberField
                  v-else
                  :model-value="columnWidths[id]"
                  :min="COLUMN_META[id].minPx"
                  :max="COLUMN_META[id].maxPx"
                  :step="20"
                  style="width: 112px"
                  @update:model-value="(value) => setColumnWidth(id, value)"
                />
              </div>
            </VueDraggable>
            <DialogFooter class="flex sm:justify-between justify-between items-center mt-4">
              <Button
                variant="outline"
                @click="resetLayout"
              >
                重置顺序和列宽
              </Button>
              <Button @click="layoutModal = false"> 完成 </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <BuilderResourcesModal v-model:show="editor.resourcesModal.value" />

        <ThemeStyleDrawer
          :show="themeDrawerVisible"
          :scope="themeDrawerScope"
          @update:show="onThemeDrawerUpdate"
        />

        <Dialog v-model:open="editor.publishModal.value">
          <DialogContent class="max-w-[720px] p-6">
            <DialogHeader>
              <DialogTitle>发布前检查</DialogTitle>
            </DialogHeader>
            <div class="flex flex-col gap-3">
              <span class="text-xs text-muted-foreground">
                配置大小：{{ editor.publishCheckBytes.value }} bytes（后端上限 131072 bytes / 128KB）
              </span>

              <Alert
                v-if="editor.publishCheckIssues.value.length"
                variant="destructive"
              >
                <AlertCircle class="h-4 w-4" />
                <AlertTitle>存在必须修复的问题</AlertTitle>
                <AlertDescription class="mt-2 flex flex-col gap-1">
                  <button
                    v-for="(issue, idx) in editor.publishCheckIssues.value"
                    :key="`${issue.pageKey}:${issue.blockId}:${issue.fieldPath}:${idx}`"
                    type="button"
                    class="flex w-full h-auto justify-start my-0.5 text-left whitespace-normal text-xs underline hover:opacity-80"
                    @click="focusPublishValidationIssue(issue)"
                  >
                    {{ issue.message }}
                  </button>
                </AlertDescription>
              </Alert>
              <Alert
                v-else
                class="border-green-500/50 text-green-600 dark:text-green-400"
              >
                <CheckCircle2 class="h-4 w-4" />
                <AlertDescription>校验通过，可以发布</AlertDescription>
              </Alert>

              <Alert
                v-if="editor.publishCheckWarnings.value.length"
                class="border-amber-500/50 text-amber-600 dark:text-amber-400"
              >
                <AlertTriangle class="h-4 w-4" />
                <AlertTitle>提示建议</AlertTitle>
                <AlertDescription class="mt-1 flex flex-col gap-0.5 text-xs">
                  <div
                    v-for="(it, idx) in editor.publishCheckWarnings.value"
                    :key="idx"
                  >
                    {{ it }}
                  </div>
                </AlertDescription>
              </Alert>
              <Alert
                v-if="editor.publishError.value"
                variant="destructive"
              >
                <AlertCircle class="h-4 w-4" />
                <AlertDescription>{{ editor.publishError.value }}</AlertDescription>
              </Alert>
            </div>
            <DialogFooter class="flex sm:justify-end justify-end gap-2 mt-4">
              <Button
                variant="outline"
                @click="editor.publishModal.value = false"
              >
                取消
              </Button>
              <Button
                :disabled="editor.publishCheckIssues.value.length > 0"
                :loading="editor.isSaving.value"
                @click="editor.confirmPublish"
              >
                确认发布
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </template>
    </Spin>
  </div>
</template>

<style src="./user-page-builder/components/ui-transitions.css"></style>

<style scoped>
.builder-pane-grid {
  grid-template-columns: var(--builder-wide-columns);
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
  width: 100%;
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
  background: var(--border);
  content: '';
  transition: background-color 140ms ease;
}

.builder-column-resizer:hover::after,
.builder-column-resizer:focus-visible::after,
.builder-column-resizer:active::after {
  background: var(--brand-soft);
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
