<script setup lang="ts">
import type { MenuOption } from 'naive-ui'
import { NButton, NFlex, NInput, NModal, NScrollbar, NText } from 'naive-ui'
import { computed, inject, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { UserPageEditorKey } from '../context'
import BlockTreeList from './BlockTreeList.vue'

const props = defineProps<{
  blockActionOptions: MenuOption[]
}>()

const editor = inject(UserPageEditorKey)
if (!editor) throw new Error('UserPageEditor context is missing')
const managerRoot = ref<HTMLElement | null>(null)
const dragStatus = ref('')

const project = computed(() => editor.currentProject.value)
const blocksModel = computed({
  get() {
    return project.value?.blocks ?? []
  },
  set(v) {
    if (!project.value) return
    project.value.blocks = v
  },
})

const hasClipboard = computed(() => editor.getClipboardBlocksCount() > 0)
const selectionCount = computed(() => editor.selectedBlockIds.value.length)
const selectionSet = computed(() => new Set(editor.selectedBlockIds.value))

const invalidBlockIdSet = computed(() => {
  return new Set(editor.liveValidationIssues.value
    .filter(issue => issue.scope === 'block' && issue.pageKey === editor.currentKey.value && issue.blockId)
    .map(issue => issue.blockId as string))
})

const selectionAnchorId = ref<string | null>(null)

const expandedLayoutIds = ref<string[]>([])
const expandedLayoutIdSet = computed(() => new Set(expandedLayoutIds.value))

const draggingBlockId = ref<string | null>(null)
const expandTargetBlockId = ref<string | null>(null)
const expandTargetTimer = ref<any>(null)
const DRAG_EXPAND_DELAY_MS = 650
const INVERTED_SWAP_THRESHOLD = 0.35

type DragGroupMode = 'into-layout' | 'wrap'
type DragDropIntent =
  | { kind: 'group'; targetId: string; mode: DragGroupMode }
  | { kind: 'reorder'; targetId: string; position: 'before' | 'after' }
  | null

const dragDropIntent = ref<DragDropIntent>(null)
const dragGroupTargetId = computed(() => dragDropIntent.value?.kind === 'group' ? dragDropIntent.value.targetId : null)
const dragGroupTargetMode = computed(() => dragDropIntent.value?.kind === 'group' ? dragDropIntent.value.mode : null)
const dragInsertTargetId = computed(() => dragDropIntent.value?.kind === 'reorder' ? dragDropIntent.value.targetId : null)
const dragInsertPosition = computed(() => dragDropIntent.value?.kind === 'reorder' ? dragDropIntent.value.position : null)

function ensureExpanded(layoutId: string) {
  if (expandedLayoutIdSet.value.has(layoutId)) return
  expandedLayoutIds.value = Array.from(new Set([...expandedLayoutIds.value, layoutId]))
}

watch(() => editor.validationFocusRequest.value?.requestId, async () => {
  const request = editor.validationFocusRequest.value
  if (!request || request.scope !== 'block' || request.pageKey !== editor.currentKey.value) return
  request.ancestorLayoutIds.forEach(ensureExpanded)
  if (!request.blockId) return
  await scrollBlockIntoView(request.blockId)
})

async function scrollBlockIntoView(blockId: string) {
  await nextTick()
  const row = Array.from(managerRoot.value?.querySelectorAll<HTMLElement>('[data-block-id]') ?? [])
    .find(element => element.dataset.blockId === blockId)
  row?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

watch(() => editor.selectedBlockIds.value[0], (blockId) => {
  if (blockId) void scrollBlockIntoView(blockId)
})

function getPointerClientPoint(ev: any): { x: number; y: number } | null {
  if (!ev) return null
  const e = ev.originalEvent ?? ev
  if (typeof e.clientX === 'number' && typeof e.clientY === 'number') return { x: e.clientX, y: e.clientY }
  const t = e.touches?.[0] ?? e.changedTouches?.[0]
  if (t && typeof t.clientX === 'number' && typeof t.clientY === 'number') return { x: t.clientX, y: t.clientY }
  return null
}

function clearExpandTarget() {
  expandTargetBlockId.value = null
  if (expandTargetTimer.value) {
    clearTimeout(expandTargetTimer.value)
    expandTargetTimer.value = null
  }
}

function scheduleExpand(layoutId: string) {
  if (expandedLayoutIdSet.value.has(layoutId)) return
  if (expandTargetBlockId.value === layoutId) return

  expandTargetBlockId.value = layoutId
  if (expandTargetTimer.value) clearTimeout(expandTargetTimer.value)
  expandTargetTimer.value = setTimeout(() => {
    if (expandTargetBlockId.value === layoutId) toggleExpanded(layoutId)
  }, DRAG_EXPAND_DELAY_MS)
}

function updateDragIntentByPointerEvent(ev: any) {
  const draggingId = draggingBlockId.value
  if (!draggingId) return

  const point = getPointerClientPoint(ev)
  const target = (ev?.target as HTMLElement | null) ?? null
  const rowEl = (target?.closest?.('.block-item-row') as HTMLElement | null) ?? null
  const wrapper = (rowEl?.closest?.('[data-block-id]') as HTMLElement | null) ?? null
  const targetId = wrapper?.dataset?.blockId ?? null

  if (!point || !rowEl || !targetId || targetId === draggingId) {
    if (dragDropIntent.value) dragDropIntent.value = null
    clearExpandTarget()
    return
  }

  const rect = rowEl.getBoundingClientRect()
  const edge = rect.height * (INVERTED_SWAP_THRESHOLD / 2)
  const inCenter = point.y > rect.top + edge && point.y < rect.bottom - edge

  if (!inCenter) {
    dragDropIntent.value = {
      kind: 'reorder',
      targetId,
      position: point.y < rect.top + rect.height / 2 ? 'before' : 'after',
    }
    clearExpandTarget()
    return
  }

  const targetBlock = editor.getBlockById(targetId)
  if (!targetBlock) {
    if (dragDropIntent.value) dragDropIntent.value = null
    clearExpandTarget()
    return
  }

  const mode: DragGroupMode = targetBlock.type === 'layout' ? 'into-layout' : 'wrap'
  const prev = dragDropIntent.value
  if (!prev || prev.kind !== 'group' || prev.targetId !== targetId || prev.mode !== mode) {
    dragDropIntent.value = { kind: 'group', targetId, mode }
  }

  if (mode === 'into-layout') scheduleExpand(targetId)
  else clearExpandTarget()
}

let isDragPointerTracking = false
function startDragPointerTracking() {
  if (isDragPointerTracking) return
  isDragPointerTracking = true
  document.addEventListener('dragover', updateDragIntentByPointerEvent, true)
  document.addEventListener('pointermove', updateDragIntentByPointerEvent, true)
  document.addEventListener('mousemove', updateDragIntentByPointerEvent, true)
  document.addEventListener('touchmove', updateDragIntentByPointerEvent, true)
}

function stopDragPointerTracking() {
  if (!isDragPointerTracking) return
  isDragPointerTracking = false
  document.removeEventListener('dragover', updateDragIntentByPointerEvent, true)
  document.removeEventListener('pointermove', updateDragIntentByPointerEvent, true)
  document.removeEventListener('mousemove', updateDragIntentByPointerEvent, true)
  document.removeEventListener('touchmove', updateDragIntentByPointerEvent, true)
}

function selectOnly(id: string) {
  editor.selectedBlockIds.value = [id]
  selectionAnchorId.value = id
}

function toggleSelect(id: string) {
  const set = new Set(editor.selectedBlockIds.value)
  if (set.has(id)) set.delete(id)
  else set.add(id)
  editor.selectedBlockIds.value = Array.from(set)
  selectionAnchorId.value = id
}

function getLayoutChildrenReadonly(block: any): any[] {
  if (!block || typeof block !== 'object') return []
  if (block.type !== 'layout') return []
  const propsObj = block.props
  if (!propsObj || typeof propsObj !== 'object' || Array.isArray(propsObj)) return []
  return Array.isArray((propsObj as any).children) ? (propsObj as any).children : []
}

function flattenVisibleBlockIds(list: any[], out: string[]) {
  list.forEach((b) => {
    if (!b || typeof b !== 'object') return
    if (typeof b.id === 'string') out.push(b.id)
    if (b.type === 'layout' && typeof b.id === 'string' && expandedLayoutIdSet.value.has(b.id)) {
      flattenVisibleBlockIds(getLayoutChildrenReadonly(b), out)
    }
  })
}

const visibleBlockIds = computed(() => {
  const out: string[] = []
  flattenVisibleBlockIds(blocksModel.value as any[], out)
  return out
})

function selectRange(toId: string) {
  const anchor = selectionAnchorId.value ?? editor.selectedBlockIds.value[0]
  if (!anchor) return selectOnly(toId)
  const ids = visibleBlockIds.value
  const a = ids.findIndex(id => id === anchor)
  const b = ids.findIndex(id => id === toId)
  if (a < 0 || b < 0) return selectOnly(toId)
  const [start, end] = a < b ? [a, b] : [b, a]
  editor.selectedBlockIds.value = ids.slice(start, end + 1)
}

function onRowClick(id: string, ev: MouseEvent) {
  if (ev.shiftKey) {
    selectRange(id)
    return
  }
  if (ev.ctrlKey || ev.metaKey) {
    toggleSelect(id)
    return
  }
  selectOnly(id)
}

const renameBlockModal = ref(false)
const renameBlockId = ref<string | null>(null)
const renameBlockName = ref('')
const deleteBlockModal = ref(false)
const pendingDeleteIds = ref<string[]>([])

function openRenameBlock(blockId: string) {
  renameBlockId.value = blockId
  renameBlockName.value = editor.getBlockById(blockId)?.name ?? ''
  renameBlockModal.value = true
}

function confirmRenameBlock() {
  if (!renameBlockId.value) return
  editor.setBlockName(renameBlockId.value, renameBlockName.value)
  renameBlockModal.value = false
}

function openDeleteBlocks(ids: string[]) {
  pendingDeleteIds.value = [...ids]
  deleteBlockModal.value = true
}

function confirmDeleteBlocks() {
  editor.removeBlocks(pendingDeleteIds.value)
  deleteBlockModal.value = false
  pendingDeleteIds.value = []
}

function handleBlockAction(key: string, blockId: string) {
  if (key === 'move-up') editor.moveBlock(blockId, -1)
  else if (key === 'move-down') editor.moveBlock(blockId, 1)
  else if (key.startsWith('move-to:')) editor.moveBlockTo(blockId, key.slice(8))
  else if (key === 'rename') openRenameBlock(blockId)
  else if (key === 'dup-up') editor.duplicateBlockAt(blockId, -1)
  else if (key === 'dup-down') editor.duplicateBlockAt(blockId, 1)
  else if (key === 'copy') editor.copyBlocksToClipboard([blockId])
  else if (key === 'paste-after') editor.pasteBlocksAfter(blockId)
  else if (key === 'ungroup') editor.ungroupLayout(blockId)
  else if (key === 'delete') openDeleteBlocks([blockId])
}

function toggleExpanded(layoutId: string) {
  const set = new Set(expandedLayoutIds.value)
  if (set.has(layoutId)) set.delete(layoutId)
  else set.add(layoutId)
  expandedLayoutIds.value = Array.from(set)
}

function onDragStart(evt: any) {
  dragStatus.value = ''
  stopDragPointerTracking()
  const id = String(evt?.item?.dataset?.blockId || '')
  draggingBlockId.value = id || null
  dragDropIntent.value = null

  if (id && !selectionSet.value.has(id)) selectOnly(id)

  clearExpandTarget()
  startDragPointerTracking()
}

function onDragEnd(_evt: any) {
  stopDragPointerTracking()
  const dragId = draggingBlockId.value
  const intent = dragDropIntent.value

  draggingBlockId.value = null
  dragDropIntent.value = null
  clearExpandTarget()

  if (!dragId) return
  if (!intent || intent.kind !== 'group') {
    dragStatus.value = '区块位置已调整'
    return
  }

  const targetId = intent.targetId
  const mode = intent.mode

  // 让 Sortable/vuedraggable 先完成自身的收尾，再变更 block tree（避免相互打架）
  setTimeout(() => {
    editor.groupBlocksIntoLayout(dragId, targetId)
    dragStatus.value = mode === 'into-layout' ? '区块已移入布局' : '区块已成组'

    if (mode === 'into-layout') {
      ensureExpanded(targetId)
      return
    }

    const newGroupId = editor.selectedBlockIds.value[0] ?? null
    if (!newGroupId) return
    if (editor.getBlockById(newGroupId)?.type !== 'layout') return
    ensureExpanded(newGroupId)
  }, 0)
}

function onMove(_evt: any, _originalEvent: any) {
  if (dragDropIntent.value?.kind === 'group') return false
  return true
}

function bulkHide() {
  editor.setBlocksHidden(editor.selectedBlockIds.value, true)
}

function bulkShow() {
  editor.setBlocksHidden(editor.selectedBlockIds.value, false)
}

function bulkCopy() {
  editor.copyBlocksToClipboard(editor.selectedBlockIds.value)
}

function bulkDelete() {
  openDeleteBlocks(editor.selectedBlockIds.value)
}

function bulkPaste() {
  const tail = editor.selectedBlockIds.value[editor.selectedBlockIds.value.length - 1] ?? null
  editor.pasteBlocksAfter(tail)
}

function bulkGroup() {
  const ids = editor.selectedBlockIds.value
  if (ids.length < 2) return
  // 使用第一个选中的区块作为目标，其他区块加入成组
  editor.groupBlocksIntoLayout(ids[1], ids[0])
}

onBeforeUnmount(() => {
  stopDragPointerTracking()
  clearExpandTarget()
})
</script>

<template>
  <div ref="managerRoot" class="block-manager">
    <span class="sr-only" role="status" aria-live="polite">{{ dragStatus }}</span>
    <Transition name="fade-slide">
      <div v-if="selectionCount > 1" class="block-manager__selection-toolbar">
        <NFlex size="small" align="center">
          <NText depth="3">
            已选择 {{ selectionCount }} 个区块
          </NText>
          <NButton size="tiny" type="primary" secondary @click="bulkGroup">
            成组
          </NButton>
          <NButton size="tiny" secondary @click="bulkHide">
            批量隐藏
          </NButton>
          <NButton size="tiny" secondary @click="bulkShow">
            批量显示
          </NButton>
          <NButton size="tiny" secondary @click="bulkCopy">
            批量复制
          </NButton>
          <NButton size="tiny" secondary :disabled="!hasClipboard" @click="bulkPaste">
            粘贴
          </NButton>
          <NButton size="tiny" type="error" secondary @click="bulkDelete">
            批量删除
          </NButton>
        </NFlex>
      </div>
    </Transition>

    <NScrollbar class="block-manager__scroll">
      <div class="block-manager__tree">
        <BlockTreeList
          :blocks="blocksModel"
          :depth="0"
          group-name="user-page-blocks"
          :selection-set="selectionSet"
          :invalid-set="invalidBlockIdSet"
          :expanded-layout-id-set="expandedLayoutIdSet"
          :drag-group-target-id="dragGroupTargetId"
          :drag-group-target-mode="dragGroupTargetMode"
          :drag-insert-target-id="dragInsertTargetId"
          :drag-insert-position="dragInsertPosition"
          :on-row-click="onRowClick"
          :on-block-action="handleBlockAction"
          :on-toggle-expanded="toggleExpanded"
          :on-drag-start="onDragStart"
          :on-drag-end="onDragEnd"
          :on-move="onMove"
          :block-action-options="props.blockActionOptions as any"
        />
      </div>
    </NScrollbar>

    <NModal
      v-model:show="renameBlockModal"
      preset="card"
      title="重命名区块"
      style="width: 420px; max-width: 90vw"
      :auto-focus="false"
    >
      <NInput v-model:value="renameBlockName" maxlength="50" show-count placeholder="仅用于编辑器内识别" @keyup.enter="confirmRenameBlock" />
      <template #footer>
        <NFlex justify="end">
          <NButton @click="renameBlockModal = false">
            取消
          </NButton>
          <NButton type="primary" @click="confirmRenameBlock">
            保存
          </NButton>
        </NFlex>
      </template>
    </NModal>

    <NModal
      v-model:show="deleteBlockModal"
      preset="dialog"
      type="error"
      title="删除区块"
      :content="`将删除 ${pendingDeleteIds.length} 个区块，此操作可通过撤销恢复。`"
      positive-text="删除"
      negative-text="取消"
      @positive-click="confirmDeleteBlocks"
    />
  </div>
</template>

<style scoped src="./ui-transitions.css"></style>

<style scoped>
.block-manager {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.block-manager__selection-toolbar {
  flex: none;
  padding: 10px;
  border-bottom: 1px solid var(--vtsuru-border);
  padding-block: 8px;
  background: var(--vtsuru-bg-muted);
}

.block-manager__scroll {
  flex: 1;
  min-height: 0;
}

.block-manager__tree {
  padding: 10px 14px 10px 10px;
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
</style>
