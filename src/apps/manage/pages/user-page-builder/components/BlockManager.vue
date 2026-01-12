<script setup lang="ts">
import type { MenuOption } from 'naive-ui'
import { NButton, NFlex, NIcon, NMenu, NPopover, NScrollbar, NSpace, NText } from 'naive-ui'
import { computed, h, inject, ref, toRaw } from 'vue'
import {
  AddCircleOutline,
  ArrowDownOutline,
  ArrowUpOutline,
  CopyOutline,
  CreateOutline,
  LayersOutline,
  TrashOutline,
} from '@vicons/ionicons5'
import { BLOCK_LIBRARY } from '@/apps/user-page/block/registry'
import { validateBlockPageProject } from '@/apps/user-page/block/schema'
import { UserPageEditorKey } from '../context'
import BlockTreeList from './BlockTreeList.vue'

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

const invalidBlockIdSet = computed(() => {
  // Only recompute when we intentionally run validation (or page switches).
  // This avoids validating on every small reactive change while editing.
  void editor.validationTick.value

  const p = project.value ? toRaw(project.value) : null
  if (!p) return new Set<string>()
  const v = validateBlockPageProject(p)
  if (v.ok) return new Set<string>()

  const ids = new Set<string>()
  const resolveIdByIndexPath = (path: number[]) => {
    if (!path.length) return null
    let node: any = null
    let list: any[] = p.blocks
    for (let i = 0; i < path.length; i++) {
      const idx = path[i]
      if (!Array.isArray(list) || idx < 0 || idx >= list.length) return null
      node = list[idx]
      if (!node || typeof node !== 'object') return null
      if (i === path.length - 1) return typeof node.id === 'string' ? node.id : null
      if (node.type !== 'layout') return null
      const propsObj = node.props
      if (!propsObj || typeof propsObj !== 'object' || Array.isArray(propsObj)) return null
      list = Array.isArray((propsObj as any).children) ? (propsObj as any).children : []
    }
    return null
  }
  for (const err of v.errors) {
    const rootMatch = err.match(/blocks\[(\d+)\]/)
    if (!rootMatch) continue
    const path: number[] = []
    const rootIdx = Number(rootMatch[1])
    if (!Number.isInteger(rootIdx) || rootIdx < 0) continue
    path.push(rootIdx)
    for (const m of err.matchAll(/\.children\[(\d+)\]/g)) {
      const idx = Number(m[1])
      if (!Number.isInteger(idx) || idx < 0) break
      path.push(idx)
    }
    const id = resolveIdByIndexPath(path)
    if (id) ids.add(id)
  }
  return ids
})

const selectionAnchorId = ref<string | null>(null)

const expandedLayoutIds = ref<string[]>([])
const expandedLayoutIdSet = computed(() => new Set(expandedLayoutIds.value))

const draggingBlockId = ref<string | null>(null)
const expandTargetBlockId = ref<string | null>(null)
const expandTargetTimer = ref<any>(null)
const DRAG_EXPAND_DELAY_MS = 650

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

const showAddMenu = ref(false)
const blockTypeSet = new Set(BLOCK_LIBRARY.map(it => it.type as unknown as string))

function makeBlockOption(type: string, libMap: Map<string, (typeof BLOCK_LIBRARY)[number]>): MenuOption {
  const it = libMap.get(type)
  if (!it) throw new Error(`未知区块类型：${type}`)
  return {
    label: it.label,
    key: it.type,
    icon: it.icon ? () => h(NIcon, null, { default: () => h(it.icon!) }) : undefined,
  }
}

function makeMenuDividerLabel(label: string, key: string): MenuOption {
  return {
    key: `divider:${key}`,
    label: () => h(
      'div',
      { style: 'display:flex; align-items:center; gap: 10px; width: 100%;' },
      [
        h('span', { style: 'font-size: 12px; font-weight: 700; color: var(--n-text-color-3);' }, label),
        h('div', { style: 'height: 1px; flex: 1; background: var(--n-divider-color, var(--n-border-color)); opacity: 0.9;' }),
      ],
    ),
    disabled: true,
  }
}

const addBlockOptions = computed(() => {
  const libMap = new Map<string, (typeof BLOCK_LIBRARY)[number]>()
  BLOCK_LIBRARY.forEach((it) => libMap.set(it.type as unknown as string, it))

  const out: MenuOption[] = []
  const used = new Set<string>()

  const groups: Array<{ key: string, label: string, types: readonly string[] }> = [
    { key: 'live', label: '直播与日程', types: ['liveStatus', 'streamSchedule'] },
    { key: 'profile', label: '资料与品牌', types: ['profile', 'biliInfo', 'tags', 'milestone', 'faq', 'quote'] },
    { key: 'content', label: '内容与媒体', types: ['videoList', 'embed', 'image', 'imageGallery', 'musicPlayer'] },
    { key: 'social', label: '社交与运营', types: ['socialLinks', 'links', 'buttons', 'supporter', 'feedback'] },
    { key: 'base', label: '布局与基础', types: ['layout', 'heading', 'text', 'richText', 'alert', 'marquee', 'countdown', 'divider', 'spacer', 'footer'] },
  ]

  groups.forEach((g) => {
    const groupOptions: MenuOption[] = []
    g.types.forEach((type) => {
      if (!libMap.has(type)) return
      groupOptions.push(makeBlockOption(type, libMap))
      used.add(type)
    })
    if (!groupOptions.length) return
    out.push(makeMenuDividerLabel(g.label, g.key))
    out.push(...groupOptions)
  })

  // 新增类型但未加入排序列表时，按 label 追加到末尾
  const rest = BLOCK_LIBRARY
    .map(it => it.type as unknown as string)
    .filter(type => !used.has(type))
    .sort((a, b) => (libMap.get(a)?.label ?? a).localeCompare(libMap.get(b)?.label ?? b))
  if (rest.length) {
    if (out.length) out.push(makeMenuDividerLabel('其他', 'rest'))
    rest.forEach((type) => out.push(makeBlockOption(type, libMap)))
  }

  return out
})

function handleAddBlockMenuSelect(key: string) {
  if (!blockTypeSet.has(key)) return
  editor.addBlock(key as any)
  showAddMenu.value = false
}

const blockActionOptions = computed(() => {
  const options: any[] = [
    { label: '上移', key: 'move-up', icon: () => h(NIcon, null, { default: () => h(ArrowUpOutline) }) },
    { label: '下移', key: 'move-down', icon: () => h(NIcon, null, { default: () => h(ArrowDownOutline) }) },
    { type: 'divider' },
    { label: '重命名', key: 'rename', icon: () => h(NIcon, null, { default: () => h(CreateOutline) }) },
    { label: '复制', key: 'copy', icon: () => h(NIcon, null, { default: () => h(CopyOutline) }) },
    { label: '粘贴到下方', key: 'paste-after', disabled: !hasClipboard.value, icon: () => h(NIcon, null, { default: () => h(AddCircleOutline) }) },
    { type: 'divider' },
    { label: '在上方插入副本', key: 'dup-up', icon: () => h(NIcon, null, { default: () => h(AddCircleOutline) }) },
    { label: '在下方插入副本', key: 'dup-down', icon: () => h(NIcon, null, { default: () => h(AddCircleOutline) }) },
    { type: 'divider' },
    { label: '解散分组（仅布局）', key: 'ungroup', icon: () => h(NIcon, null, { default: () => h(LayersOutline) }) },
    { type: 'divider' },
  ]

  options.push({ label: '删除区块', key: 'delete', icon: () => h(NIcon, null, { default: () => h(TrashOutline) }), props: { style: 'color: #d03050' } })
  return options
})

function handleBlockAction(key: string, blockId: string) {
  if (key === 'move-up') editor.moveBlock(blockId, -1)
  else if (key === 'move-down') editor.moveBlock(blockId, 1)
  else if (key === 'rename') {
    const current = editor.getBlockById(blockId)?.name ?? ''
    // eslint-disable-next-line no-alert
    const next = window.prompt('区块名称（仅编辑用，不会对外展示）', current)
    if (next === null) return
    editor.setBlockName(blockId, next)
  }
  else if (key === 'dup-up') editor.duplicateBlockAt(blockId, -1)
  else if (key === 'dup-down') editor.duplicateBlockAt(blockId, 1)
  else if (key === 'copy') editor.copyBlocksToClipboard([blockId])
  else if (key === 'paste-after') editor.pasteBlocksAfter(blockId)
  else if (key === 'ungroup') editor.ungroupLayout(blockId)
  else if (key === 'delete') {
    // eslint-disable-next-line no-alert
    if (window.confirm('确定要删除该区块吗？')) editor.removeBlock(blockId)
  }
}

function toggleExpanded(layoutId: string) {
  const set = new Set(expandedLayoutIds.value)
  if (set.has(layoutId)) set.delete(layoutId)
  else set.add(layoutId)
  expandedLayoutIds.value = Array.from(set)
}

function onDragStart(evt: any) {
  const id = String(evt?.item?.dataset?.blockId || '')
  draggingBlockId.value = id || null
  expandTargetBlockId.value = null
  if (expandTargetTimer.value) {
    clearTimeout(expandTargetTimer.value)
    expandTargetTimer.value = null
  }
}

function onDragEnd(_evt: any) {
  draggingBlockId.value = null
  expandTargetBlockId.value = null
  if (expandTargetTimer.value) {
    clearTimeout(expandTargetTimer.value)
    expandTargetTimer.value = null
  }
}

function onMove(evt: any, _originalEvent: any) {
  if (!draggingBlockId.value) return true

  const related = (evt?.related as HTMLElement | null) ?? null
  const relatedWrapper = related?.closest?.('[data-block-id]') as HTMLElement | null
  const relatedId = String(relatedWrapper?.dataset?.blockId || '')
  const relatedBlock = evt?.relatedContext?.element as any

  // 自动展开逻辑（用于将区块拖入折叠的组）
  if (relatedId && relatedBlock?.type === 'layout' && !expandedLayoutIdSet.value.has(relatedId)) {
    if (expandTargetBlockId.value !== relatedId) {
      expandTargetBlockId.value = relatedId
      if (expandTargetTimer.value) clearTimeout(expandTargetTimer.value)
      expandTargetTimer.value = setTimeout(() => {
        if (expandTargetBlockId.value === relatedId) toggleExpanded(relatedId)
      }, DRAG_EXPAND_DELAY_MS)
    }
  } else if (expandTargetBlockId.value) {
    expandTargetBlockId.value = null
    if (expandTargetTimer.value) {
      clearTimeout(expandTargetTimer.value)
      expandTargetTimer.value = null
    }
  }

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
  // eslint-disable-next-line no-alert
  if (!window.confirm(`确定要删除 ${selectionCount.value} 个区块吗？`)) return
  editor.removeBlocks(editor.selectedBlockIds.value)
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
</script>

<template>
  <div>
    <NFlex justify="space-between" align="center" style="margin-bottom: 8px">
      <NText strong>
        区块管理
      </NText>
      <NPopover v-model:show="showAddMenu" trigger="click" placement="bottom-end">
        <template #trigger>
          <NButton size="small" type="primary" secondary>
            <template #icon>
              <NIcon><AddCircleOutline /></NIcon>
            </template>
            添加区块
          </NButton>
        </template>
        <NScrollbar style="max-height: 360px; width: 290px">
          <NMenu
            :options="addBlockOptions"
            :indent="18"
            :root-indent="18"
            :node-props="(opt: any) => String(opt?.key || '').startsWith('divider:') ? { style: 'margin-top: 8px; padding: 8px 12px 4px; cursor: default;' } : {}"
            @update:value="(key) => handleAddBlockMenuSelect(String(key))"
          />
        </NScrollbar>
      </NPopover>
    </NFlex>

    <div v-if="selectionCount > 1" style="margin-bottom: 8px">
      <NSpace size="small" align="center">
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
      </NSpace>
    </div>

    <div style="padding-right: 4px">
      <BlockTreeList
        :blocks="blocksModel"
        :depth="0"
        group-name="user-page-blocks"
        :selection-set="selectionSet"
        :invalid-set="invalidBlockIdSet"
        :expanded-layout-id-set="expandedLayoutIdSet"
        :on-row-click="onRowClick"
        :on-block-action="handleBlockAction"
        :on-toggle-expanded="toggleExpanded"
        :on-drag-start="onDragStart"
        :on-drag-end="onDragEnd"
        :on-move="onMove"
        :block-action-options="blockActionOptions as any"
      />
    </div>
  </div>
</template>
