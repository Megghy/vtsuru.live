import type { CSSProperties } from 'vue'
import { computed, ref, watchEffect } from 'vue'
import { useEventListener } from '@vueuse/core'
import { persistedGetItemRaw, usePersistedStorage } from '@/shared/storage/persist'
import {
  USER_PAGE_BUILDER_COLUMNS_ORDER_KEY,
  USER_PAGE_BUILDER_COLUMNS_WIDTHS_KEY,
  USER_PAGE_BUILDER_MERGE_PROPS_IN_BLOCKS_KEY,
  USER_PAGE_BUILDER_SPLIT_BLOCKS_SIZE_KEY,
  USER_PAGE_BUILDER_SPLIT_CENTER_SIZE_KEY,
  USER_PAGE_BUILDER_SPLIT_LEFT_SIZE_KEY,
} from './storageKeys'

export type BuilderColumnId = 'pages' | 'blocks' | 'preview' | 'props'

export const DEFAULT_COLUMNS_ORDER: BuilderColumnId[] = ['pages', 'blocks', 'preview', 'props']
export const COLUMN_META: Record<BuilderColumnId, { label: string, minPx: number, maxPx?: number }> = {
  pages: { label: '页面', minPx: 52, maxPx: 360 },
  blocks: { label: '区块', minPx: 240, maxPx: 520 },
  preview: { label: '预览', minPx: 420, maxPx: 1200 },
  props: { label: '属性', minPx: 320, maxPx: 720 },
}

function normalizeColumnsOrder(value: unknown) {
  const requested = Array.isArray(value) ? value : []
  const result = requested.filter((id, index): id is BuilderColumnId => (
    typeof id === 'string'
    && id in COLUMN_META
    && requested.indexOf(id) === index
  ))
  DEFAULT_COLUMNS_ORDER.forEach((id) => {
    if (!result.includes(id)) result.push(id)
  })
  return result
}

async function readLegacySplitSize(key: string, fallback: string | number) {
  const raw = await persistedGetItemRaw(key)
  if (raw == null) return fallback
  try {
    const parsed = JSON.parse(raw)
    return typeof parsed === 'string' || typeof parsed === 'number' ? parsed : fallback
  } catch {
    return raw
  }
}

const px = (value: number) => `${value}px`
const minWidthSum = (ids: BuilderColumnId[]) => ids.reduce((sum, id) => sum + COLUMN_META[id].minPx, 0)

function readPxNumber(value: string | number) {
  if (typeof value === 'number') return value
  const normalized = value.trim().toLowerCase()
  if (!normalized.endsWith('px')) return Number.NaN
  return Number.parseFloat(normalized.slice(0, -2))
}

export function useBuilderLayout() {
  const bodyElement = ref<HTMLElement | null>(null)
  const bodyWidth = ref(0)
  const columnsOrder = usePersistedStorage<BuilderColumnId[]>(USER_PAGE_BUILDER_COLUMNS_ORDER_KEY, [...DEFAULT_COLUMNS_ORDER])
  const isPropsMergedInBlocks = usePersistedStorage(USER_PAGE_BUILDER_MERGE_PROPS_IN_BLOCKS_KEY, false)
  const activeColumnsOrder = computed(() => isPropsMergedInBlocks.value
    ? columnsOrder.value.filter(id => id !== 'props')
    : columnsOrder.value)

  watchEffect(() => {
    const normalized = normalizeColumnsOrder(columnsOrder.value)
    if (normalized.join('|') !== columnsOrder.value.join('|')) columnsOrder.value = normalized
  })

  const columnWidths = usePersistedStorage<Record<BuilderColumnId, string | number>>(USER_PAGE_BUILDER_COLUMNS_WIDTHS_KEY, {
    pages: '220px',
    blocks: '320px',
    preview: '640px',
    props: '360px',
  }, {
    writeDefaults: false,
    onReady: () => void restoreLegacyWidths(),
  })

  async function restoreLegacyWidths() {
    if (await persistedGetItemRaw(USER_PAGE_BUILDER_COLUMNS_WIDTHS_KEY) != null) return
    columnWidths.value = {
      ...columnWidths.value,
      pages: await readLegacySplitSize(USER_PAGE_BUILDER_SPLIT_LEFT_SIZE_KEY, columnWidths.value.pages),
      blocks: await readLegacySplitSize(USER_PAGE_BUILDER_SPLIT_BLOCKS_SIZE_KEY, columnWidths.value.blocks),
      preview: await readLegacySplitSize(USER_PAGE_BUILDER_SPLIT_CENTER_SIZE_KEY, columnWidths.value.preview),
    }
  }

  function updateBodyWidth() {
    bodyWidth.value = Math.max(0, Math.floor(bodyElement.value?.getBoundingClientRect().width ?? 0))
  }

  const columns = [0, 1, 2, 3].map(index => computed(() => activeColumnsOrder.value[index] ?? DEFAULT_COLUMNS_ORDER[index]))
  const [col0, col1, col2, col3] = columns

  function availableWidth(level: 0 | 1 | 2) {
    let width = bodyWidth.value
    for (let index = 0; index < level; index++) width -= Math.max(0, readPxNumber(columnWidths.value[columns[index].value]) || 0)
    return Math.max(0, width)
  }

  function maxWidth(column: BuilderColumnId, remaining: BuilderColumnId[], available: number) {
    const configured = COLUMN_META[column].maxPx
    if (!available) return configured
    const byLayout = Math.max(COLUMN_META[column].minPx, Math.floor(available - minWidthSum(remaining)))
    return configured ? Math.min(configured, byLayout) : byLayout
  }

  function clampWidth(value: string | number, column: BuilderColumnId, remaining: BuilderColumnId[], available: number) {
    const numeric = readPxNumber(value)
    if (!Number.isFinite(numeric)) return value
    return px(Math.max(COLUMN_META[column].minPx, Math.min(numeric, maxWidth(column, remaining, available) ?? numeric)))
  }

  function splitSize(level: 0 | 1 | 2) {
    return computed<string | number>({
      get: () => columnWidths.value[columns[level].value],
      set: value => {
        const column = columns[level].value
        columnWidths.value[column] = clampWidth(value, column, activeColumnsOrder.value.slice(level + 1), availableWidth(level))
      },
    })
  }

  function splitStyles(level: 0 | 1 | 2) {
    const column = columns[level]
    const remaining = computed(() => activeColumnsOrder.value.slice(level + 1))
    const min = computed(() => px(COLUMN_META[column.value].minPx))
    const max = computed(() => {
      const value = maxWidth(column.value, remaining.value, availableWidth(level))
      return value ? px(value) : undefined
    })
    const common: CSSProperties = { display: 'flex', flexDirection: 'column', minHeight: '0', overflow: 'hidden' }
    return {
      min,
      max,
      pane1: computed<CSSProperties>(() => ({ ...common, minWidth: min.value })),
      pane2: computed<CSSProperties>(() => ({ ...common, minWidth: px(minWidthSum(remaining.value)) })),
    }
  }

  const size0 = splitSize(0)
  const size1 = splitSize(1)
  const size2 = splitSize(2)
  const split0 = splitStyles(0)
  const split1 = splitStyles(1)
  const split2 = splitStyles(2)
  const split2Pane2Style = computed<CSSProperties>(() => ({
    display: 'flex', flexDirection: 'column', minHeight: '0', overflow: 'hidden', minWidth: px(COLUMN_META[col3.value].minPx),
  }))

  const layoutColumnsModel = computed<BuilderColumnId[]>({
    get: () => isPropsMergedInBlocks.value ? columnsOrder.value.filter(id => id !== 'props') : columnsOrder.value,
    set: (next) => {
      releaseStuckSplitDrag()
      if (!isPropsMergedInBlocks.value) {
        columnsOrder.value = normalizeColumnsOrder(next)
        return
      }
      const merged = [...next]
      merged.splice(Math.min(Math.max(columnsOrder.value.indexOf('props'), 0), merged.length), 0, 'props')
      columnsOrder.value = normalizeColumnsOrder(merged)
    },
  })

  const isFourCols = computed(() => activeColumnsOrder.value.length >= 4)
  const isPagesResizable = computed(() => {
    const index = activeColumnsOrder.value.indexOf('pages')
    return index >= 0 && index < activeColumnsOrder.value.length - 1
  })
  const isPagesCollapsed = computed(() => isPagesResizable.value && columnWidths.value.pages === '52px')
  let lastExpandedSidebarSize = '220px'
  watchEffect(() => {
    if (!isPagesCollapsed.value && typeof columnWidths.value.pages === 'string') lastExpandedSidebarSize = columnWidths.value.pages
  })

  function releaseStuckSplitDrag() {
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }))
    document.body.style.cursor = ''
  }

  function togglePagesCollapse() {
    if (!isPagesResizable.value) return
    releaseStuckSplitDrag()
    columnWidths.value.pages = isPagesCollapsed.value ? lastExpandedSidebarSize : '52px'
  }

  function toggleMergePropsInBlocks() {
    releaseStuckSplitDrag()
    isPropsMergedInBlocks.value = !isPropsMergedInBlocks.value
  }

  let cleanups: Array<() => void> = []
  function mount() {
    updateBodyWidth()
    cleanups = [
      useEventListener(window, 'resize', updateBodyWidth),
      useEventListener(window, 'blur', releaseStuckSplitDrag),
    ]
  }

  function destroy() {
    releaseStuckSplitDrag()
    cleanups.forEach(cleanup => cleanup())
    cleanups = []
  }

  return {
    bodyElement,
    columnsOrder,
    activeColumnsOrder,
    isPropsMergedInBlocks,
    layoutColumnsModel,
    col0,
    col1,
    col2,
    col3,
    isFourCols,
    size0,
    size1,
    size2,
    split0Min: split0.min,
    split0Max: split0.max,
    split0Pane1Style: split0.pane1,
    split0Pane2Style: split0.pane2,
    split1Min: split1.min,
    split1Max: split1.max,
    split1Pane1Style: split1.pane1,
    split1Pane2Style: split1.pane2,
    split2Min: split2.min,
    split2Max: split2.max,
    split2Pane1Style: split2.pane1,
    split2Pane2Style,
    isPagesResizable,
    isPagesCollapsed,
    togglePagesCollapse,
    toggleMergePropsInBlocks,
    releaseStuckSplitDrag,
    updateBodyWidth,
    mount,
    destroy,
  }
}
