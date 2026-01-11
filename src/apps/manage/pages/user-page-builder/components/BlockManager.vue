<script setup lang="ts">
import { NButton, NDropdown, NFlex, NIcon, NSpace, NText } from 'naive-ui'
import { computed, h, inject, ref } from 'vue'
import Draggable from 'vuedraggable-es'
import {
  AddCircleOutline,
  ArrowDownOutline,
  ArrowUpOutline,
  CopyOutline,
  EllipsisHorizontalOutline,
  EyeOffOutline,
  EyeOutline,
  ReorderThreeOutline,
  TrashOutline,
} from '@vicons/ionicons5'
import { BLOCK_LIBRARY, getBlockLabel } from '@/features/user-page/block/registry'
import { UserPageEditorKey } from '../context'

const editor = inject(UserPageEditorKey)
if (!editor) throw new Error('UserPageEditor context is missing')

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

const selectionAnchorId = ref<string | null>(null)

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

function selectRange(toId: string) {
  const blocks = blocksModel.value
  const anchor = selectionAnchorId.value ?? editor.selectedBlockIds.value[0]
  if (!anchor) return selectOnly(toId)
  const a = blocks.findIndex(b => b.id === anchor)
  const b = blocks.findIndex(b => b.id === toId)
  if (a < 0 || b < 0) return selectOnly(toId)
  const [start, end] = a < b ? [a, b] : [b, a]
  editor.selectedBlockIds.value = blocks.slice(start, end + 1).map(it => it.id)
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

const addBlockOptions = computed(() => BLOCK_LIBRARY.map(it => ({
  label: it.label,
  key: it.type,
  icon: it.icon ? () => h(NIcon, null, { default: () => h(it.icon!) }) : undefined,
})))

const blockActionOptions = computed(() => [
  { label: '上移', key: 'move-up', icon: () => h(NIcon, null, { default: () => h(ArrowUpOutline) }) },
  { label: '下移', key: 'move-down', icon: () => h(NIcon, null, { default: () => h(ArrowDownOutline) }) },
  { type: 'divider' },
  { label: '复制', key: 'copy', icon: () => h(NIcon, null, { default: () => h(CopyOutline) }) },
  { label: '粘贴到下方', key: 'paste-after', disabled: !hasClipboard.value, icon: () => h(NIcon, null, { default: () => h(AddCircleOutline) }) },
  { type: 'divider' },
  { label: '在上方插入副本', key: 'dup-up', icon: () => h(NIcon, null, { default: () => h(AddCircleOutline) }) },
  { label: '在下方插入副本', key: 'dup-down', icon: () => h(NIcon, null, { default: () => h(AddCircleOutline) }) },
  { type: 'divider' },
  { label: '删除区块', key: 'delete', icon: () => h(NIcon, null, { default: () => h(TrashOutline) }), props: { style: 'color: #d03050' } },
])

function handleBlockAction(key: string, blockId: string) {
  if (key === 'move-up') editor.moveBlock(blockId, -1)
  else if (key === 'move-down') editor.moveBlock(blockId, 1)
  else if (key === 'dup-up') editor.duplicateBlockAt(blockId, -1)
  else if (key === 'dup-down') editor.duplicateBlockAt(blockId, 1)
  else if (key === 'copy') editor.copyBlocksToClipboard([blockId])
  else if (key === 'paste-after') editor.pasteBlocksAfter(blockId)
  else if (key === 'delete') {
    // eslint-disable-next-line no-alert
    if (window.confirm('确定要删除该区块吗？')) editor.removeBlock(blockId)
  }
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
  // eslint-disable-next-line no-alert
  if (!window.confirm(`确定要删除 ${selectionCount.value} 个区块吗？`)) return
  editor.removeBlocks(editor.selectedBlockIds.value)
}

function bulkPaste() {
  const tail = editor.selectedBlockIds.value[editor.selectedBlockIds.value.length - 1] ?? null
  editor.pasteBlocksAfter(tail)
}
</script>

<template>
  <div>
    <NFlex justify="space-between" align="center" style="margin-bottom: 8px">
      <NText strong>
        区块管理
      </NText>
      <NDropdown
        trigger="click"
        :options="addBlockOptions"
        @select="(key) => editor.addBlock(key as any)"
      >
        <NButton size="small" type="primary" secondary>
          <template #icon>
            <NIcon><AddCircleOutline /></NIcon>
          </template>
          添加区块
        </NButton>
      </NDropdown>
    </NFlex>

    <div v-if="selectionCount > 1" style="margin-bottom: 8px">
      <NSpace size="small" align="center">
        <NText depth="3">
          已选择 {{ selectionCount }} 个区块
        </NText>
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
      </NSpace>
    </div>

    <div style="padding-right: 4px">
      <Draggable
        v-model="blocksModel"
        item-key="id"
        handle=".drag-handle"
        :animation="160"
        ghost-class="drag-ghost"
      >
        <template #item="{ element: b }">
          <div
            class="block-item-row"
            :class="{ active: selectionSet.has(b.id), hidden: b.hidden, 'is-layout': b.type === 'layout' }"
            @click="onRowClick(b.id, $event)"
          >
            <NIcon class="drag-handle" size="18">
              <ReorderThreeOutline />
            </NIcon>

            <div class="block-label">
              <span class="truncate-text">
                {{ getBlockLabel(b.type) }}
              </span>
            </div>

            <NButton
              quaternary
              circle
              size="tiny"
              :type="b.hidden ? 'default' : 'primary'"
              :title="b.hidden ? '点击显示区块' : '点击隐藏区块'"
              @click.stop="b.hidden = !b.hidden"
            >
              <template #icon>
                <NIcon>
                  <EyeOutline v-if="!b.hidden" />
                  <EyeOffOutline v-else />
                </NIcon>
              </template>
            </NButton>

            <NDropdown
              trigger="click"
              :options="blockActionOptions"
              @select="(key) => handleBlockAction(String(key), b.id)"
            >
              <NButton quaternary circle size="tiny" @click.stop>
                <template #icon>
                  <NIcon><EllipsisHorizontalOutline /></NIcon>
                </template>
              </NButton>
            </NDropdown>
          </div>
        </template>
      </Draggable>
    </div>
  </div>
</template>

<style scoped>
.truncate-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.block-item-row {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 6px 8px;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
  user-select: none;
}

.block-item-row.is-layout {
  box-shadow: inset 3px 0 0 var(--n-primary-color);
}

.block-item-row.is-layout .block-label {
  font-weight: 650;
}

.block-item-row:hover {
  background: var(--n-color-embedded);
}

.block-item-row.active {
  border-color: var(--n-color-target);
  background: var(--n-color-embedded);
}

.block-item-row.hidden .block-label {
  opacity: 0.6;
  text-decoration: line-through;
}

.drag-handle {
  cursor: grab;
  opacity: 0.8;
}

.drag-handle:active {
  cursor: grabbing;
}

.block-label {
  flex: 1;
  min-width: 0;
}

.drag-ghost {
  opacity: 0.45;
}
</style>
