<script setup lang="ts">
import { NAlert, NButton, NColorPicker, NDivider, NFlex, NForm, NFormItem, NIcon, NModal, NPopconfirm, NScrollbar, NSplit, NSpin, NSelect, NSwitch, NText } from 'naive-ui';
import { computed, onBeforeUnmount, onMounted, provide, ref, watchEffect } from 'vue'
import type { CSSProperties } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { ArrowRedoOutline, ArrowUndoOutline, ReorderThreeOutline } from '@vicons/ionicons5'
import { useEventListener } from '@vueuse/core'
import Draggable from 'vuedraggable-es'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import { persistedGetItemRaw, usePersistedStorage } from '@/shared/storage/persist'
import { UserPageEditorKey } from './user-page-builder/context'
import {
  USER_PAGE_BUILDER_COLUMNS_ORDER_KEY,
  USER_PAGE_BUILDER_COLUMNS_WIDTHS_KEY,
  USER_PAGE_BUILDER_MERGE_PROPS_IN_BLOCKS_KEY,
  USER_PAGE_BUILDER_SPLIT_BLOCKS_SIZE_KEY,
  USER_PAGE_BUILDER_SPLIT_CENTER_SIZE_KEY,
  USER_PAGE_BUILDER_SPLIT_LEFT_SIZE_KEY,
} from './user-page-builder/storageKeys'
import { useUserPageEditor } from './user-page-builder/useUserPageEditor'
import BackgroundSettingsEditor from './user-page-builder/components/BackgroundSettingsEditor.vue'
import type {BackgroundSettingsTarget} from './user-page-builder/components/BackgroundSettingsEditor.vue';
import BuilderPagesPane from './user-page-builder/components/BuilderPagesPane.vue'
import BuilderBlocksPane from './user-page-builder/components/BuilderBlocksPane.vue'
import BuilderPreviewPane from './user-page-builder/components/BuilderPreviewPane.vue'
import BuilderPropsPane from './user-page-builder/components/BuilderPropsPane.vue'

const editor = useUserPageEditor()
provide(UserPageEditorKey, editor)
let stopBeforeUnload: (() => void) | null = null
let stopResize: (() => void) | null = null
let stopSplitDragEmergency: (() => void) | null = null
let stopSplitDragInterceptor: (() => void) | null = null
const route = useRoute()
const router = useRouter()
const builderBodyEl = ref<HTMLElement | null>(null)
const builderBodyWidthPx = ref(0)

function releaseStuckSplitDrag() {
  if (typeof window === 'undefined') return
  try {
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }))
  } finally {
    // naive-ui NSplit 会在 mouseup 时清理，但在极端情况下可能错过 mouseup
    document.body.style.cursor = ''
  }
}

function shouldForceReleaseSplitDrag(ev: Event) {
  const cursor = document.body.style.cursor
  if (!(cursor === 'col-resize' || cursor === 'row-resize')) return false
  const target = (ev.target as HTMLElement | null) ?? null
  if (target?.closest?.('.n-split__resize-trigger-wrapper')) return false
  return true
}

type BuilderColumnId = 'pages' | 'blocks' | 'preview' | 'props'

const DEFAULT_COLUMNS_ORDER: BuilderColumnId[] = ['pages', 'blocks', 'preview', 'props']
const COLUMN_META: Record<BuilderColumnId, { label: string; minPx: number; maxPx?: number }> = {
  pages: { label: '页面', minPx: 52, maxPx: 360 },
  blocks: { label: '区块', minPx: 240, maxPx: 520 },
  preview: { label: '预览', minPx: 420, maxPx: 1200 },
  props: { label: '属性', minPx: 320, maxPx: 720 },
}

function normalizeColumnsOrder(value: unknown): BuilderColumnId[] {
  const list = Array.isArray(value) ? value : []
  const seen = new Set<BuilderColumnId>()
  const result: BuilderColumnId[] = []
  for (const it of list) {
    if (typeof it !== 'string') continue
    const id = it as BuilderColumnId
    if (!(id in COLUMN_META)) continue
    if (seen.has(id)) continue
    seen.add(id)
    result.push(id)
  }
  for (const id of DEFAULT_COLUMNS_ORDER) if (!seen.has(id)) result.push(id)
  return result
}

const columnsOrder = usePersistedStorage<BuilderColumnId[]>(USER_PAGE_BUILDER_COLUMNS_ORDER_KEY, [...DEFAULT_COLUMNS_ORDER])
watchEffect(() => {
  const next = normalizeColumnsOrder(columnsOrder.value)
  if (next.join('|') !== columnsOrder.value.join('|')) columnsOrder.value = next
})

const isPropsMergedInBlocks = usePersistedStorage<boolean>(USER_PAGE_BUILDER_MERGE_PROPS_IN_BLOCKS_KEY, false)
const activeColumnsOrder = computed<BuilderColumnId[]>(() => (isPropsMergedInBlocks.value ? columnsOrder.value.filter(id => id !== 'props') : columnsOrder.value))

async function readLegacySplitSize(key: string, fallback: string | number): Promise<string | number> {
  const raw = await persistedGetItemRaw(key)
  if (raw == null) return fallback
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'string' || typeof parsed === 'number') return parsed
  } catch {
    // ignore
  }
  return raw
}

const columnWidths = usePersistedStorage<Record<BuilderColumnId, string | number>>(USER_PAGE_BUILDER_COLUMNS_WIDTHS_KEY, {
  pages: '220px',
  blocks: '320px',
  preview: '640px',
  props: '360px',
}, {
  writeDefaults: false,
  onReady: () => {
    void (async () => {
      const hadWidthsKey = await persistedGetItemRaw(USER_PAGE_BUILDER_COLUMNS_WIDTHS_KEY) != null
      if (hadWidthsKey) return

      const next: Record<BuilderColumnId, string | number> = { ...columnWidths.value }
      next.pages = await readLegacySplitSize(USER_PAGE_BUILDER_SPLIT_LEFT_SIZE_KEY, next.pages)
      next.blocks = await readLegacySplitSize(USER_PAGE_BUILDER_SPLIT_BLOCKS_SIZE_KEY, next.blocks)
      next.preview = await readLegacySplitSize(USER_PAGE_BUILDER_SPLIT_CENTER_SIZE_KEY, next.preview)
      columnWidths.value = next
    })()
  },
})

function px(n: number) {
  return `${n}px`
}

function minWidthSum(ids: BuilderColumnId[]) {
  return ids.reduce((acc, id) => acc + COLUMN_META[id].minPx, 0)
}

function readPxNumber(v: string | number) {
  if (typeof v === 'number') return v
  if (typeof v !== 'string') return Number.NaN
  const s = v.trim().toLowerCase()
  if (!s.endsWith('px')) return Number.NaN
  const n = Number.parseFloat(s.slice(0, -2))
  return Number.isFinite(n) ? n : Number.NaN
}

function updateBuilderBodyWidth() {
  builderBodyWidthPx.value = Math.max(0, Math.floor(builderBodyEl.value?.getBoundingClientRect().width ?? 0))
}

function getAvailableWidthPxForSplitLevel(level: 0 | 1 | 2) {
  const body = builderBodyWidthPx.value
  if (!body) return 0
  const used0 = Math.max(0, readPxNumber(columnWidths.value[col0.value]) || 0)
  if (level === 0) return Math.max(0, body)
  const used1 = Math.max(0, readPxNumber(columnWidths.value[col1.value]) || 0)
  if (level === 1) return Math.max(0, body - used0)
  return Math.max(0, body - used0 - used1)
}

function getEffectiveMaxPx(colId: BuilderColumnId, remaining: BuilderColumnId[], availableWidthPx: number) {
  const metaMax = COLUMN_META[colId].maxPx
  if (!availableWidthPx) return metaMax
  const limit = availableWidthPx - minWidthSum(remaining)
  if (!Number.isFinite(limit)) return metaMax
  const maxByLayout = Math.max(COLUMN_META[colId].minPx, Math.floor(limit))
  if (typeof metaMax === 'number') return Math.max(COLUMN_META[colId].minPx, Math.min(metaMax, maxByLayout))
  return maxByLayout
}

function clampSplitSize(value: string | number, colId: BuilderColumnId, remaining: BuilderColumnId[], availableWidthPx: number) {
  const minPx = COLUMN_META[colId].minPx
  const maxPx = getEffectiveMaxPx(colId, remaining, availableWidthPx)
  const n = readPxNumber(value)
  if (!Number.isFinite(n)) return value
  const clamped = typeof maxPx === 'number' ? Math.max(minPx, Math.min(n, maxPx)) : Math.max(minPx, n)
  return px(clamped)
}

const col0 = computed(() => activeColumnsOrder.value[0] ?? 'pages')
const col1 = computed(() => activeColumnsOrder.value[1] ?? 'blocks')
const col2 = computed(() => activeColumnsOrder.value[2] ?? 'preview')
const col3 = computed(() => activeColumnsOrder.value[3] ?? 'props')
const isFourCols = computed(() => activeColumnsOrder.value.length >= 4)

const size0 = computed<string | number>({
  get: () => columnWidths.value[col0.value],
  set: v => { columnWidths.value[col0.value] = clampSplitSize(v, col0.value, activeColumnsOrder.value.slice(1) as BuilderColumnId[], getAvailableWidthPxForSplitLevel(0)) },
})
const size1 = computed<string | number>({
  get: () => columnWidths.value[col1.value],
  set: v => { columnWidths.value[col1.value] = clampSplitSize(v, col1.value, activeColumnsOrder.value.slice(2) as BuilderColumnId[], getAvailableWidthPxForSplitLevel(1)) },
})
const size2 = computed<string | number>({
  get: () => columnWidths.value[col2.value],
  set: v => { columnWidths.value[col2.value] = clampSplitSize(v, col2.value, activeColumnsOrder.value.slice(3) as BuilderColumnId[], getAvailableWidthPxForSplitLevel(2)) },
})

const split0Min = computed(() => px(COLUMN_META[col0.value].minPx))
const split0Max = computed(() => {
  const m = getEffectiveMaxPx(col0.value, activeColumnsOrder.value.slice(1) as BuilderColumnId[], getAvailableWidthPxForSplitLevel(0))
  return typeof m === 'number' ? px(m) : undefined
})
const split0Pane1Style = computed<CSSProperties>(() => ({ minWidth: split0Min.value, display: 'flex', flexDirection: 'column', minHeight: '0', overflow: 'hidden' }))
const split0Pane2Style = computed<CSSProperties>(() => ({ minWidth: px(minWidthSum(activeColumnsOrder.value.slice(1) as BuilderColumnId[])), display: 'flex', flexDirection: 'column', minHeight: '0', overflow: 'hidden' }))

const split1Min = computed(() => px(COLUMN_META[col1.value].minPx))
const split1Max = computed(() => {
  const m = getEffectiveMaxPx(col1.value, activeColumnsOrder.value.slice(2) as BuilderColumnId[], getAvailableWidthPxForSplitLevel(1))
  return typeof m === 'number' ? px(m) : undefined
})
const split1Pane1Style = computed<CSSProperties>(() => ({ minWidth: split1Min.value, display: 'flex', flexDirection: 'column', minHeight: '0', overflow: 'hidden' }))
const split1Pane2Style = computed<CSSProperties>(() => ({ minWidth: px(minWidthSum(activeColumnsOrder.value.slice(2) as BuilderColumnId[])), display: 'flex', flexDirection: 'column', minHeight: '0', overflow: 'hidden' }))

const split2Min = computed(() => px(COLUMN_META[col2.value].minPx))
const split2Max = computed(() => {
  const m = getEffectiveMaxPx(col2.value, activeColumnsOrder.value.slice(3) as BuilderColumnId[], getAvailableWidthPxForSplitLevel(2))
  return typeof m === 'number' ? px(m) : undefined
})
const split2Pane1Style = computed<CSSProperties>(() => ({ minWidth: split2Min.value, display: 'flex', flexDirection: 'column', minHeight: '0', overflow: 'hidden' }))
const split2Pane2Style = computed<CSSProperties>(() => ({ minWidth: px(COLUMN_META[col3.value].minPx), display: 'flex', flexDirection: 'column', minHeight: '0', overflow: 'hidden' }))

const layoutModal = ref(false)
const layoutColumnsModel = computed<BuilderColumnId[]>({
  get() {
    return isPropsMergedInBlocks.value ? columnsOrder.value.filter(id => id !== 'props') : columnsOrder.value
  },
  set(next) {
    releaseStuckSplitDrag()
    if (!isPropsMergedInBlocks.value) {
      columnsOrder.value = normalizeColumnsOrder(next)
      return
    }

    const prevPropsIndex = columnsOrder.value.indexOf('props')
    const merged = [...next]
    const insertAt = prevPropsIndex >= 0 ? Math.min(prevPropsIndex, merged.length) : merged.length
    merged.splice(insertAt, 0, 'props')
    columnsOrder.value = normalizeColumnsOrder(merged)
  },
})
const globalBgModal = ref(false)

const pagesColIndex = computed(() => activeColumnsOrder.value.indexOf('pages'))
const isPagesResizable = computed(() => pagesColIndex.value >= 0 && pagesColIndex.value < activeColumnsOrder.value.length - 1)
const isPagesCollapsed = computed(() => isPagesResizable.value && columnWidths.value.pages === '52px')
let lastExpandedSidebarSize = '220px'
watchEffect(() => {
  if (!isPagesCollapsed.value && typeof columnWidths.value.pages === 'string' && columnWidths.value.pages !== '52px') lastExpandedSidebarSize = columnWidths.value.pages
})

function togglePagesCollapse() {
  if (!isPagesResizable.value) return
  releaseStuckSplitDrag()
  columnWidths.value.pages = isPagesCollapsed.value ? lastExpandedSidebarSize : '52px'
}

function toggleMergePropsInBlocks() {
  releaseStuckSplitDrag()
  isPropsMergedInBlocks.value = !isPropsMergedInBlocks.value
}

const globalBgTarget: BackgroundSettingsTarget = {
  get: () => (editor.settings.value as any).background,
  ensure: () => ((editor.settings.value as any).background ??= {}),
  uploadImage: editor.triggerUploadGlobalBackground,
  clearImage: editor.clearGlobalBackgroundImageFile,
}

function ensureGlobalTheme() {
  return ((editor.settings.value as any).theme ??= {})
}

function clearGlobalTheme() {
  delete (editor.settings.value as any).theme
}

function cleanupGlobalThemeIfEmpty() {
  const t: any = (editor.settings.value as any).theme
  if (!t || typeof t !== 'object') return
  const keys = Object.keys(t)
  if (keys.length === 0) delete (editor.settings.value as any).theme
}

const globalThemePrimaryColor = computed({
  get() {
    const v = (editor.settings.value as any).theme?.primaryColor
    return typeof v === 'string' ? v : undefined
  },
  set(v: string | null) {
    const next = typeof v === 'string' ? v : ''
    if (!next.trim().length) {
      const t: any = (editor.settings.value as any).theme
      if (t) delete t.primaryColor
      cleanupGlobalThemeIfEmpty()
      return
    }
    const t: any = ensureGlobalTheme()
    t.primaryColor = next
  },
})

const globalThemeTextColor = computed({
  get() {
    const v = (editor.settings.value as any).theme?.textColor
    return typeof v === 'string' ? v : undefined
  },
  set(v: string | null) {
    const next = typeof v === 'string' ? v : ''
    if (!next.trim().length) {
      const t: any = (editor.settings.value as any).theme
      if (t) delete t.textColor
      cleanupGlobalThemeIfEmpty()
      return
    }
    const t: any = ensureGlobalTheme()
    t.textColor = next
  },
})

const globalThemeBackgroundColor = computed({
  get() {
    const v = (editor.settings.value as any).theme?.backgroundColor
    return typeof v === 'string' ? v : undefined
  },
  set(v: string | null) {
    const next = typeof v === 'string' ? v : ''
    if (!next.trim().length) {
      const t: any = (editor.settings.value as any).theme
      if (t) delete t.backgroundColor
      cleanupGlobalThemeIfEmpty()
      return
    }
    const t: any = ensureGlobalTheme()
    t.backgroundColor = next
  },
})

const globalThemeMode = computed({
  get() {
    const v = (editor.settings.value as any).theme?.pageThemeMode
    return (v === 'light' || v === 'dark') ? v : 'auto'
  },
  set(v: 'auto' | 'light' | 'dark') {
    const t: any = (editor.settings.value as any).theme
    if (v === 'auto') {
      if (t) delete t.pageThemeMode
      cleanupGlobalThemeIfEmpty()
      return
    }
    const ensured: any = ensureGlobalTheme()
    ensured.pageThemeMode = v
  },
})

function isImagePath(path?: string) {
  if (!path) return false
  const p = path.toLowerCase().split('?')[0]?.split('#')[0] ?? ''
  return /\.(?:png|jpe?g|gif|webp|svg)$/.test(p)
}

function beforeUnloadHandler(e: BeforeUnloadEvent) {
  if (!editor.isDirty.value) return
  e.preventDefault()
  e.returnValue = ''
}

onMounted(async () => {
  updateBuilderBodyWidth()
  await editor.init()
  requestAnimationFrame(() => updateBuilderBodyWidth())

  const mode = route.query.mode
  if (mode === 'legacy' || mode === 'block' || mode === 'contrib') {
    editor.currentKey.value = 'home'
    editor.currentPage.value.mode = mode
    await router.replace({ name: 'manage-userPageBuilder' })
  }

  stopBeforeUnload = useEventListener(window, 'beforeunload', beforeUnloadHandler)
  stopResize = useEventListener(window, 'resize', updateBuilderBodyWidth)
  stopSplitDragEmergency = useEventListener(window, 'blur', releaseStuckSplitDrag)
  stopSplitDragInterceptor = useEventListener(
    document,
    'mousedown',
    (ev) => {
      if (shouldForceReleaseSplitDrag(ev)) releaseStuckSplitDrag()
    },
    { capture: true },
  )
})

onBeforeUnmount(() => {
  releaseStuckSplitDrag()
  stopBeforeUnload?.()
  stopResize?.()
  stopSplitDragEmergency?.()
  stopSplitDragInterceptor?.()
  editor.destroy()
})

onBeforeRouteLeave(() => {
  releaseStuckSplitDrag()
  if (!editor.isDirty.value) return true
  // eslint-disable-next-line no-alert
  return window.confirm('当前有未保存的更改，确定离开吗？')
})
</script>

<template>
  <div class="user-page-builder">
    <ManagePageHeader title="自定义页面" subtitle="配置个人主页与子页面">
      <template #action>
        <NFlex justify="end" align="center" :wrap="false">
          <NButton
            quaternary
            circle
            size="small"
            :disabled="!editor.canUndo.value"
            @click="editor.undo"
          >
            <template #icon>
              <NIcon><ArrowUndoOutline /></NIcon>
            </template>
          </NButton>
          <NButton
            quaternary
            circle
            size="small"
            :disabled="!editor.canRedo.value"
            @click="editor.redo"
          >
            <template #icon>
              <NIcon><ArrowRedoOutline /></NIcon>
            </template>
          </NButton>

          <NButton size="small" :loading="editor.isSaving.value" @click="editor.saveDraft">
            保存草稿
          </NButton>
          <NButton type="primary" size="small" :loading="editor.isSaving.value" @click="editor.openPublishModal">
            发布
          </NButton>
          <NPopconfirm :disabled="!editor.rollbackAvailable.value" @positive-click="editor.rollback">
            <template #trigger>
              <NButton size="small" :disabled="!editor.rollbackAvailable.value" :loading="editor.isSaving.value">
                回滚
              </NButton>
            </template>
            确定要回滚到上一个已发布版本吗？
          </NPopconfirm>
          <NButton size="small" secondary @click="editor.resourcesModal.value = true">
            资源
          </NButton>
          <NButton size="small" secondary @click="layoutModal = true">
            布局
          </NButton>
          <NButton size="small" secondary @click="globalBgModal = true">
            全局样式
          </NButton>
          <NPopconfirm :disabled="editor.isSaving.value" @positive-click="editor.clearDraft">
            <template #trigger>
              <NButton size="small" secondary :disabled="editor.isSaving.value" :loading="editor.isSaving.value">
                清空草稿
              </NButton>
            </template>
            确定要清空草稿吗？此操作会丢弃当前未保存更改，并切换为已发布版本（如存在）。
          </NPopconfirm>
          <NText depth="3">
            {{ editor.saveStatusText.value }}
          </NText>
          <NFlex align="center" size="small">
            <NText depth="3">
              自动保存
            </NText>
            <NSwitch v-model:value="editor.autoSaveEnabled.value" size="small" />
          </NFlex>
        </NFlex>
      </template>
    </ManagePageHeader>

    <NSpin class="builder-spin" :show="editor.isLoading.value">
      <NAlert
        v-if="editor.error.value"
        type="error"
        :show-icon="true"
        style="margin-bottom: 12px"
      >
        {{ editor.error.value }}
      </NAlert>

      <div ref="builderBodyEl" class="builder-body">
        <NSplit
          v-model:size="size0"
          direction="horizontal"
          :min="split0Min"
          :max="split0Max"
          class="builder-split"
          :pane1-style="split0Pane1Style"
          :pane2-style="split0Pane2Style"
        >
          <template #1>
            <BuilderPagesPane
              v-if="col0 === 'pages'"
              :collapsed="isPagesCollapsed"
              :resizable="isPagesResizable"
              @toggle-collapse="togglePagesCollapse"
            />
            <BuilderBlocksPane
              v-else-if="col0 === 'blocks'"
              :merged-props="isPropsMergedInBlocks"
              @toggle-merged-props="toggleMergePropsInBlocks"
            />
            <BuilderPreviewPane v-else-if="col0 === 'preview'" />
            <BuilderPropsPane v-else />
          </template>

          <template #2>
            <NSplit
              v-model:size="size1"
              direction="horizontal"
              :min="split1Min"
              :max="split1Max"
              class="builder-split"
              :pane1-style="split1Pane1Style"
              :pane2-style="split1Pane2Style"
            >
              <template #1>
                <BuilderPagesPane
                  v-if="col1 === 'pages'"
                  :collapsed="isPagesCollapsed"
                  :resizable="isPagesResizable"
                  @toggle-collapse="togglePagesCollapse"
                />
                <BuilderBlocksPane
                  v-else-if="col1 === 'blocks'"
                  :merged-props="isPropsMergedInBlocks"
                  @toggle-merged-props="toggleMergePropsInBlocks"
                />
                <BuilderPreviewPane v-else-if="col1 === 'preview'" />
                <BuilderPropsPane v-else />
              </template>

              <template #2>
                <template v-if="!isFourCols">
                  <BuilderPagesPane
                    v-if="col2 === 'pages'"
                    :collapsed="isPagesCollapsed"
                    :resizable="isPagesResizable"
                    @toggle-collapse="togglePagesCollapse"
                  />
                  <BuilderBlocksPane
                    v-else-if="col2 === 'blocks'"
                    :merged-props="isPropsMergedInBlocks"
                    @toggle-merged-props="toggleMergePropsInBlocks"
                  />
                  <BuilderPreviewPane v-else-if="col2 === 'preview'" />
                  <BuilderPropsPane v-else />
                </template>
                <NSplit
                  v-else
                  v-model:size="size2"
                  direction="horizontal"
                  :min="split2Min"
                  :max="split2Max"
                  class="builder-split"
                  :pane1-style="split2Pane1Style"
                  :pane2-style="split2Pane2Style"
                >
                  <template #1>
                    <BuilderPagesPane
                      v-if="col2 === 'pages'"
                      :collapsed="isPagesCollapsed"
                      :resizable="isPagesResizable"
                      @toggle-collapse="togglePagesCollapse"
                    />
                    <BuilderBlocksPane
                      v-else-if="col2 === 'blocks'"
                      :merged-props="isPropsMergedInBlocks"
                      @toggle-merged-props="toggleMergePropsInBlocks"
                    />
                    <BuilderPreviewPane v-else-if="col2 === 'preview'" />
                    <BuilderPropsPane v-else />
                  </template>

                  <template #2>
                    <BuilderPagesPane
                      v-if="col3 === 'pages'"
                      :collapsed="isPagesCollapsed"
                      :resizable="isPagesResizable"
                      @toggle-collapse="togglePagesCollapse"
                    />
                    <BuilderBlocksPane
                      v-else-if="col3 === 'blocks'"
                      :merged-props="isPropsMergedInBlocks"
                      @toggle-merged-props="toggleMergePropsInBlocks"
                    />
                    <BuilderPreviewPane v-else-if="col3 === 'preview'" />
                    <BuilderPropsPane v-else />
                  </template>
                </NSplit>
              </template>
            </NSplit>
          </template>
        </NSplit>
      </div>

      <NModal
        v-model:show="layoutModal"
        preset="card"
        title="编辑器布局"
        style="width: 520px; max-width: 95vw"
        :auto-focus="false"
      >
        <NAlert type="info" :show-icon="true" style="margin-bottom: 12px">
          拖拽调整列从左到右顺序。最后一列会自动填充剩余宽度（想让某列更宽/更窄，可以把它放到最后）。
        </NAlert>
        <Draggable
          :list="layoutColumnsModel"
          :item-key="(id: any) => id"
          handle=".drag-handle"
          :animation="160"
        >
          <template #item="{ element: id }">
            <div
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
            </div>
          </template>
        </Draggable>
        <template #footer>
          <NFlex justify="space-between">
            <NButton
              size="small"
              secondary
              @click="columnsOrder = [...DEFAULT_COLUMNS_ORDER]"
            >
              重置默认
            </NButton>
            <NButton size="small" type="primary" @click="layoutModal = false">
              完成
            </NButton>
          </NFlex>
        </template>
      </NModal>

      <NModal
        v-model:show="editor.resourcesModal.value"
        preset="card"
        title="已引用资源（从 *File 字段提取）"
        style="width: 900px; max-width: 95vw"
        :auto-focus="false"
      >
        <NFlex vertical>
          <NFlex justify="space-between" align="center">
            <NText depth="3">
              共 {{ editor.fileRefs.value.length }} 个文件引用
            </NText>
            <NButton size="small" secondary @click="editor.normalizeRichTextImagesFile">
              整理 richText 引用
            </NButton>
          </NFlex>
          <NScrollbar style="max-height: 70vh">
            <div
              v-for="f in editor.fileRefs.value"
              :key="f.id"
              style="padding: 8px 0; border-bottom: 1px solid var(--n-divider-color)"
            >
              <NFlex align="center" :wrap="false" style="gap: 10px">
                <img
                  v-if="isImagePath(f.path)"
                  :src="f.path"
                  alt=""
                  referrerpolicy="no-referrer"
                  loading="lazy"
                  decoding="async"
                  style="width: 40px; height: 40px; object-fit: cover; border-radius: 8px; border: 1px solid var(--n-border-color); flex: 0 0 auto"
                >
                <div style="min-width: 0">
                  <NText strong>
                    #{{ f.id }}
                  </NText>
                  <NText depth="3" style="margin-left: 8px">
                    {{ f.path || '' }}
                  </NText>
                  <NText v-if="f.name" depth="3" style="margin-left: 8px">
                    ({{ f.name }})
                  </NText>
                </div>
              </NFlex>
              <div style="margin-top: 6px">
                <NText depth="3">
                  {{ f.locations.join('；') }}
                </NText>
              </div>
            </div>
          </NScrollbar>
        </NFlex>
      </NModal>

      <NModal
        v-model:show="globalBgModal"
        preset="card"
        title="全局样式（所有页面）"
        style="width: 720px; max-width: 95vw"
        :auto-focus="false"
      >
        <NScrollbar style="max-height: min(78vh, 720px)">
          <div style="padding-right: 16px; padding-bottom: 16px">
            <NAlert type="info" :show-icon="true" style="margin-bottom: 12px">
              这里设置的背景/主题会对所有页面生效（包括歌单/日程/提问箱等内置页面）。子页面可单独设置覆盖此设置（例如做“二级页面”隐藏跳转）。
            </NAlert>
            <NDivider style="margin: 10px 0">
              全局主题
            </NDivider>
            <NForm label-placement="top" size="small">
              <NFlex :wrap="true" style="gap: 12px">
                <NFormItem label="主题色（primary）" style="flex: 1; min-width: 220px">
                  <NColorPicker v-model:value="globalThemePrimaryColor" />
                </NFormItem>
                <NFormItem label="字体颜色（text）" style="flex: 1; min-width: 220px">
                  <NColorPicker v-model:value="globalThemeTextColor" />
                </NFormItem>
                <NFormItem label="内容区域底色（可选）" style="flex: 1; min-width: 220px">
                  <NColorPicker v-model:value="globalThemeBackgroundColor" />
                </NFormItem>
                <NFormItem label="页面主题模式（可选）" style="flex: 1; min-width: 220px">
                  <NSelect
                    v-model:value="globalThemeMode"
                    :options="[
                      { label: '跟随站点（Auto）', value: 'auto' },
                      { label: '强制亮色（Light）', value: 'light' },
                      { label: '强制暗色（Dark）', value: 'dark' },
                    ]"
                  />
                </NFormItem>
              </NFlex>
              <NFlex justify="end">
                <NButton size="small" secondary :disabled="!(editor.settings.value as any).theme" @click="clearGlobalTheme">
                  清除全局主题
                </NButton>
              </NFlex>
            </NForm>

            <NDivider style="margin: 12px 0">
              全局背景
            </NDivider>
            <BackgroundSettingsEditor
              :target="globalBgTarget"
              none-hint="未设置全局背景时，页面会使用默认背景（或由站点主题决定）。"
            />
          </div>
        </NScrollbar>
      </NModal>

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

          <NAlert v-if="editor.publishCheckErrors.value.length" type="error" :show-icon="true">
            <div v-for="(it, idx) in editor.publishCheckErrors.value" :key="idx">
              {{ it }}
            </div>
          </NAlert>
          <NAlert v-else type="success" :show-icon="true">
            校验通过，可以发布
          </NAlert>

          <NAlert v-if="editor.publishCheckWarnings.value.length" type="warning" :show-icon="true">
            <div v-for="(it, idx) in editor.publishCheckWarnings.value" :key="idx">
              {{ it }}
            </div>
          </NAlert>
        </NFlex>
        <template #footer>
          <NFlex justify="end">
            <NButton @click="editor.publishModal.value = false">
              取消
            </NButton>
            <NButton
              type="primary"
              :disabled="editor.publishCheckErrors.value.length > 0"
              :loading="editor.isSaving.value"
              @click="editor.publishModal.value = false; editor.confirmPublish()"
            >
              确认发布
            </NButton>
          </NFlex>
        </template>
      </NModal>
    </NSpin>
  </div>
</template>

<style src="./user-page-builder/components/ui-transitions.css"></style>

<style scoped>
.user-page-builder :deep(.n-button .n-button__content) {
  gap: 6px;
}

.user-page-builder {
  height: calc(100vh - var(--vtsuru-header-height));
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

.builder-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.builder-split {
  flex: 1;
  min-height: 0;
}

.user-page-builder :deep(.pane-card) {
  height: 100%;
  min-height: 0;
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
</style>
