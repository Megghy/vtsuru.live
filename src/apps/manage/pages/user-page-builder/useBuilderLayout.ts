import type { CSSProperties } from 'vue'
import { computed, ref, watch, watchEffect } from 'vue'
import { usePersistedStorage } from '@/shared/storage/persist'
import {
  USER_PAGE_BUILDER_COLUMNS_ORDER_KEY,
  USER_PAGE_BUILDER_COLUMNS_WIDTHS_KEY,
  USER_PAGE_BUILDER_PAGES_COLLAPSED_KEY,
} from './storageKeys'

export type BuilderColumnId = 'pages' | 'blocks' | 'preview' | 'props'
export type BuilderLayoutPreset = 'content' | 'preview' | 'compact'
export type BuilderWorkspaceMode = 'wide' | 'medium' | 'compact'

export const DEFAULT_COLUMNS_ORDER: BuilderColumnId[] = ['pages', 'blocks', 'preview', 'props']
export const COLUMN_META: Record<BuilderColumnId, { label: string, minPx: number, maxPx: number }> = {
  pages: { label: '页面', minPx: 150, maxPx: 360 },
  blocks: { label: '区块', minPx: 210, maxPx: 520 },
  preview: { label: '预览', minPx: 320, maxPx: 1200 },
  props: { label: '编辑', minPx: 280, maxPx: 720 },
}

const DEFAULT_WIDTHS: Record<BuilderColumnId, number> = {
  pages: 220,
  blocks: 320,
  preview: 640,
  props: 360,
}
const GRID_GAP_PX = 6
const PAGES_COLLAPSED_WIDTH_PX = 56

function normalizeColumnsOrder(value: unknown) {
  const requested = Array.isArray(value) ? value : []
  const result = requested.filter((id, index): id is BuilderColumnId => (
    typeof id === 'string' && id in COLUMN_META && requested.indexOf(id) === index
  ))
  DEFAULT_COLUMNS_ORDER.forEach((id) => {
    if (!result.includes(id)) result.push(id)
  })
  return result
}

function clampWidth(id: BuilderColumnId, value: unknown) {
  const width = Number(value)
  const meta = COLUMN_META[id]
  return Number.isFinite(width) ? Math.min(meta.maxPx, Math.max(meta.minPx, width)) : DEFAULT_WIDTHS[id]
}

export function useBuilderLayout() {
  const bodyElement = ref<HTMLElement | null>(null)
  const bodyWidth = ref(0)
  const columnsOrder = usePersistedStorage<BuilderColumnId[]>(USER_PAGE_BUILDER_COLUMNS_ORDER_KEY, [...DEFAULT_COLUMNS_ORDER])
  const columnWidths = usePersistedStorage<Record<BuilderColumnId, number>>(USER_PAGE_BUILDER_COLUMNS_WIDTHS_KEY, { ...DEFAULT_WIDTHS })
  const isPagesCollapsed = usePersistedStorage(USER_PAGE_BUILDER_PAGES_COLLAPSED_KEY, false)
  const mediumPane = ref<'pages' | 'blocks'>('blocks')
  const compactPane = ref<BuilderColumnId>('preview')

  watchEffect(() => {
    const normalized = normalizeColumnsOrder(columnsOrder.value)
    if (normalized.join('|') !== columnsOrder.value.join('|')) columnsOrder.value = normalized
    for (const id of DEFAULT_COLUMNS_ORDER) columnWidths.value[id] = clampWidth(id, columnWidths.value[id])
  })

  const mode = computed<BuilderWorkspaceMode>(() => {
    if (bodyWidth.value < 640) return 'compact'
    if (bodyWidth.value < 980) return 'medium'
    return 'wide'
  })
  const activeColumnsOrder = computed(() => columnsOrder.value)
  const layoutColumnsModel = computed<BuilderColumnId[]>({
    get: () => [...columnsOrder.value],
    set: value => { columnsOrder.value = normalizeColumnsOrder(value) },
  })
  const wideGridColumns = computed(() => {
    const ids = activeColumnsOrder.value
    const fixedTracks = ids.filter(id => id !== 'preview').map(id => ({
      id,
      min: id === 'pages' && isPagesCollapsed.value ? PAGES_COLLAPSED_WIDTH_PX : COLUMN_META[id].minPx,
      width: id === 'pages' && isPagesCollapsed.value ? PAGES_COLLAPSED_WIDTH_PX : columnWidths.value[id],
    }))
    const availableWidth = bodyWidth.value - COLUMN_META.preview.minPx - GRID_GAP_PX * (ids.length - 1)
    const desiredTotal = fixedTracks.reduce((sum, track) => sum + track.width, 0)
    const minTotal = fixedTracks.reduce((sum, track) => sum + track.min, 0)
    const overflow = Math.max(0, desiredTotal - availableWidth)
    const shrinkable = desiredTotal - minTotal
    const widths = Object.fromEntries(fixedTracks.map(track => [track.id, (
      overflow > 0 && shrinkable > 0
        ? Math.max(track.min, track.width - overflow * (track.width - track.min) / shrinkable)
        : track.width
    )])) as Partial<Record<BuilderColumnId, number>>

    return ids.map(id => id === 'preview' ? `minmax(${COLUMN_META.preview.minPx}px, 1fr)` : `${widths[id]}px`).join(' ')
  })
  const mediumGridColumns = computed(() => {
    const primaryId = mediumPane.value
    const primaryMin = primaryId === 'pages' && isPagesCollapsed.value ? PAGES_COLLAPSED_WIDTH_PX : COLUMN_META[primaryId].minPx
    const primaryWidth = primaryId === 'pages' && isPagesCollapsed.value ? PAGES_COLLAPSED_WIDTH_PX : columnWidths.value[primaryId]
    return `minmax(${primaryMin}px, ${primaryWidth}px) minmax(280px, 1fr) minmax(240px, ${columnWidths.value.props}px)`
  })
  const legacyGridColumns = computed(() => `minmax(320px, 1fr) minmax(280px, ${columnWidths.value.props}px)`)

  function paneStyle(id: BuilderColumnId): CSSProperties {
    return { order: activeColumnsOrder.value.indexOf(id) }
  }

  function setColumnWidth(id: BuilderColumnId, value: number | null) {
    columnWidths.value[id] = clampWidth(id, value)
  }

  function togglePagesCollapse() {
    isPagesCollapsed.value = !isPagesCollapsed.value
  }

  function applyPreset(preset: BuilderLayoutPreset) {
    if (preset === 'preview') {
      columnsOrder.value = ['pages', 'preview', 'blocks', 'props']
    } else if (preset === 'compact') {
      columnsOrder.value = [...DEFAULT_COLUMNS_ORDER]
      columnWidths.value = { pages: 160, blocks: 240, preview: 380, props: 300 }
    } else {
      columnsOrder.value = [...DEFAULT_COLUMNS_ORDER]
    }
  }

  function resetLayout() {
    columnsOrder.value = [...DEFAULT_COLUMNS_ORDER]
    columnWidths.value = { ...DEFAULT_WIDTHS }
    isPagesCollapsed.value = false
  }

  let observer: ResizeObserver | null = null
  let stopObservingBody: (() => void) | null = null
  function mount() {
    observer = new ResizeObserver(([entry]) => {
      bodyWidth.value = Math.floor(entry.contentRect.width)
    })
    stopObservingBody = watch(bodyElement, (element, previous) => {
      if (previous) observer?.unobserve(previous)
      if (element) observer?.observe(element)
    }, { immediate: true })
  }

  function destroy() {
    stopObservingBody?.()
    stopObservingBody = null
    observer?.disconnect()
    observer = null
  }

  return {
    bodyElement,
    bodyWidth,
    mode,
    columnsOrder,
    columnWidths,
    isPagesCollapsed,
    activeColumnsOrder,
    layoutColumnsModel,
    wideGridColumns,
    mediumGridColumns,
    legacyGridColumns,
    mediumPane,
    compactPane,
    paneStyle,
    setColumnWidth,
    togglePagesCollapse,
    applyPreset,
    resetLayout,
    mount,
    destroy,
  }
}
