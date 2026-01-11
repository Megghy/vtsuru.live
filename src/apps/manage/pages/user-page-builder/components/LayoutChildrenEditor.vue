<script setup lang="ts">
import { NAlert, NBreadcrumb, NBreadcrumbItem, NButton, NDropdown, NFlex, NForm, NFormItem, NIcon, NInput, NInputNumber, NSelect, NScrollbar, NSpace, NSwitch, NText } from 'naive-ui'
import type { BlockNode, BlockType } from '@/features/user-page/block/schema'
import { BLOCK_LIBRARY, createBlockNode, getBlockLabel } from '@/features/user-page/block/registry'
import { computed, h, inject, ref, watch } from 'vue'
import Draggable from 'vuedraggable-es'
import { useStorage } from '@vueuse/core'
import {
  AddCircleOutline,
  ArrowBackOutline,
  EllipsisHorizontalOutline,
  EyeOffOutline,
  EyeOutline,
  ReorderThreeOutline,
} from '@vicons/ionicons5'
import { UserPageEditorKey } from '../context'
import { cloneBlockNode, createId, deepCloneJson } from '../editorHelpers'
import { USER_PAGE_BLOCK_CLIPBOARD_KEY } from '../storageKeys'
import BlockPropsForm from './BlockPropsForm.vue'
import PropsGrid from './PropsGrid.vue'

const props = defineProps<{
  block: BlockNode
}>()

const editor = inject(UserPageEditorKey)
if (!editor) throw new Error('UserPageEditor context is missing')
const clipboardBlocks = useStorage<BlockNode[]>(
  USER_PAGE_BLOCK_CLIPBOARD_KEY,
  [],
  typeof window === 'undefined' ? undefined : window.localStorage,
  { writeDefaults: false },
)

function asObject(v: unknown): Record<string, any> | null {
  if (!v || typeof v !== 'object') return null
  if (Array.isArray(v)) return null
  return v as any
}

function ensureLayoutProps(node: BlockNode) {
  const propsObj = editor.ensurePropsObject(node)
  if (propsObj.layout !== 'row' && propsObj.layout !== 'column' && propsObj.layout !== 'grid') propsObj.layout = 'row'
  if (typeof propsObj.wrap !== 'boolean') propsObj.wrap = true
  if (typeof propsObj.gap !== 'number' || !Number.isFinite(propsObj.gap) || propsObj.gap < 0) propsObj.gap = 12
  if (typeof propsObj.columns !== 'number' || !Number.isFinite(propsObj.columns) || !Number.isInteger(propsObj.columns) || propsObj.columns < 1) propsObj.columns = 2
  if (typeof propsObj.maxWidth !== 'string') propsObj.maxWidth = ''
  if (!['start', 'center', 'end', 'between', 'around', 'evenly'].includes(String(propsObj.justify))) propsObj.justify = 'start'
  if (!['start', 'center', 'end', 'stretch'].includes(String(propsObj.align))) propsObj.align = 'stretch'
  if (!Array.isArray(propsObj.children)) propsObj.children = []
  return propsObj as {
    layout: 'row' | 'column' | 'grid'
    wrap: boolean
    gap: number
    columns: number
    maxWidth: string
    justify: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'
    align: 'start' | 'center' | 'end' | 'stretch'
    children: BlockNode[]
  }
}

const containerPath = ref<string[]>([])
const selectedLeafId = ref<string | null>(null)

const root = computed(() => props.block)

watch(
  () => props.block.id,
  () => {
    containerPath.value = []
    selectedLeafId.value = null
  },
)

function findChildLayoutById(node: BlockNode, id: string): BlockNode | null {
  const propsObj = asObject(node.props)
  const children = Array.isArray(propsObj?.children) ? (propsObj!.children as any[]) : []
  const child = children.find(it => asObject(it)?.id === id)
  if (!child || typeof child !== 'object' || Array.isArray(child)) return null
  const childNode = child as BlockNode
  if (childNode.type !== 'layout') return null
  return childNode
}

const containerNode = computed(() => {
  let node: BlockNode = root.value
  for (const id of containerPath.value) {
    const next = findChildLayoutById(node, id)
    if (!next) break
    node = next
  }
  return node
})

const containerProps = computed(() => ensureLayoutProps(containerNode.value))

const justifyOptionsHorizontal = [
  { label: '靠左', value: 'start' },
  { label: '居中', value: 'center' },
  { label: '靠右', value: 'end' },
  { label: '两端对齐', value: 'between' },
  { label: '环绕分布', value: 'around' },
  { label: '均匀分布', value: 'evenly' },
]

const justifyOptionsVertical = [
  { label: '靠上', value: 'start' },
  { label: '居中', value: 'center' },
  { label: '靠下', value: 'end' },
  { label: '上下两端对齐', value: 'between' },
  { label: '上下环绕分布', value: 'around' },
  { label: '上下均匀分布', value: 'evenly' },
]

const alignOptionsHorizontal = [
  { label: '靠左', value: 'start' },
  { label: '居中', value: 'center' },
  { label: '靠右', value: 'end' },
  { label: '拉伸（铺满）', value: 'stretch' },
]

const alignOptionsVertical = [
  { label: '靠上', value: 'start' },
  { label: '居中', value: 'center' },
  { label: '靠下', value: 'end' },
  { label: '拉伸（铺满）', value: 'stretch' },
]

const horizontalAlignModel = computed({
  get() {
    const p = containerProps.value
    return p.layout === 'column' ? p.align : p.justify
  },
  set(v) {
    const p = containerProps.value
    if (p.layout === 'column') p.align = v as any
    else p.justify = v as any
  },
})

const verticalAlignModel = computed({
  get() {
    const p = containerProps.value
    return p.layout === 'column' ? p.justify : p.align
  },
  set(v) {
    const p = containerProps.value
    if (p.layout === 'column') p.justify = v as any
    else p.align = v as any
  },
})

const horizontalAlignOptions = computed(() => (containerProps.value.layout === 'column' ? alignOptionsHorizontal : justifyOptionsHorizontal))
const verticalAlignOptions = computed(() => (containerProps.value.layout === 'column' ? justifyOptionsVertical : alignOptionsVertical))

function getLayoutLabel(node: BlockNode, idxInParent: number | null) {
  const p = ensureLayoutProps(node)
  const mode = p.layout === 'grid'
    ? `Grid/${p.columns}列`
    : p.layout === 'column'
      ? 'Column'
      : `Row${p.wrap ? '/换行' : ''}`
  if (idxInParent === null) return `根布局 · ${mode}`
  return `子布局#${idxInParent + 1} · ${mode}`
}

const breadcrumb = computed(() => {
  const out: Array<{ label: string, depth: number }> = []
  let node: BlockNode = root.value
  out.push({ label: getLayoutLabel(node, null), depth: 0 })
  for (let i = 0; i < containerPath.value.length; i++) {
    const nextId = containerPath.value[i]
    const parentProps = ensureLayoutProps(node)
    const idxInParent = parentProps.children.findIndex(it => it.id === nextId)
    const next = findChildLayoutById(node, nextId)
    if (!next) break
    node = next
    out.push({ label: getLayoutLabel(node, idxInParent >= 0 ? idxInParent : 0), depth: i + 1 })
  }
  return out
})

const childrenModel = computed({
  get() {
    return containerProps.value.children
  },
  set(v: BlockNode[]) {
    containerProps.value.children = v
  },
})

const selectedLeaf = computed(() => {
  if (!selectedLeafId.value) return null
  return childrenModel.value.find(b => b.id === selectedLeafId.value) ?? null
})

const addChildOptions = computed(() => BLOCK_LIBRARY.map(it => ({
  label: it.label,
  key: it.type,
  icon: it.icon ? () => h(NIcon, null, { default: () => h(it.icon!) }) : undefined,
})))

function addChild(type: BlockType) {
  const node = createBlockNode(type, createId())
  childrenModel.value.push(node)
  if (node.type === 'layout') {
    enterLayout(node.id)
  } else {
    selectedLeafId.value = node.id
  }
}

function enterLayout(id: string) {
  containerPath.value = [...containerPath.value, id]
  selectedLeafId.value = null
}

function back() {
  if (containerPath.value.length === 0) return
  containerPath.value = containerPath.value.slice(0, -1)
  selectedLeafId.value = null
}

function jumpToBreadcrumb(index: number) {
  containerPath.value = containerPath.value.slice(0, Math.max(0, index))
  selectedLeafId.value = null
}

function onChildClick(child: BlockNode) {
  if (child.type === 'layout') enterLayout(child.id)
  else selectedLeafId.value = child.id
}

function copyBlockToClipboard(block: BlockNode) {
  clipboardBlocks.value = [deepCloneJson(block)]
  editor.message.success('已复制区块')
}

function pasteFromClipboard(afterId?: string) {
  const blocks = clipboardBlocks.value
  if (!blocks.length) {
    editor.message.warning('剪贴板为空')
    return
  }
  const copied = blocks.map(cloneBlockNode)
  if (afterId) {
    const idx = childrenModel.value.findIndex(b => b.id === afterId)
    const insertAt = idx >= 0 ? idx + 1 : childrenModel.value.length
    childrenModel.value.splice(insertAt, 0, ...copied)
  } else {
    childrenModel.value.push(...copied)
  }
  editor.message.success(`已粘贴 ${copied.length} 个区块`)
}
</script>

<template>
  <div>
    <NFlex justify="space-between" align="center" style="margin-bottom: 8px">
      <NSpace align="center" size="small">
        <NButton size="tiny" secondary :disabled="containerPath.length === 0" @click="back">
          <template #icon>
            <NIcon><ArrowBackOutline /></NIcon>
          </template>
          返回
        </NButton>
        <NBreadcrumb>
          <NBreadcrumbItem
            v-for="it in breadcrumb"
            :key="it.depth"
          >
            <NButton text size="small" @click="jumpToBreadcrumb(it.depth)">
              {{ it.label }}
            </NButton>
          </NBreadcrumbItem>
        </NBreadcrumb>
      </NSpace>

      <NDropdown
        trigger="click"
        :options="addChildOptions"
        @select="(key) => addChild(key as any)"
      >
        <NButton size="tiny" type="primary" secondary>
          <template #icon>
            <NIcon><AddCircleOutline /></NIcon>
          </template>
          添加子区块
        </NButton>
      </NDropdown>
    </NFlex>

    <NFlex :wrap="false" style="gap: 12px">
      <div style="flex: 1; min-width: 0">
        <NText strong style="display:block; margin-bottom: 8px">
          布局设置
        </NText>
        <NForm label-placement="top" size="small">
          <PropsGrid :min-item-width="200">
            <NFormItem label="类型">
              <NSelect
                v-model:value="containerProps.layout"
                size="small"
                style="width: 100%"
                :options="[
                  { label: '横向(Row)', value: 'row' },
                  { label: '竖向(Column)', value: 'column' },
                  { label: '网格(Grid)', value: 'grid' },
                ]"
              />
            </NFormItem>
            <NFormItem label="最大宽度">
              <NInput
                v-model:value="containerProps.maxWidth"
                size="small"
                style="width: 100%"
                placeholder="例如 100% / 480px"
              />
            </NFormItem>
            <NFormItem v-if="containerProps.layout === 'row'" label="自动换行">
              <NFlex justify="end">
                <NSwitch v-model:value="containerProps.wrap" size="small" />
              </NFlex>
            </NFormItem>
            <NFormItem v-else-if="containerProps.layout === 'grid'" label="列数（1~12）">
              <NInputNumber v-model:value="containerProps.columns" size="small" :min="1" :max="12" style="width: 100%" />
            </NFormItem>
            <NFormItem label="横向对齐">
              <NSelect
                v-model:value="horizontalAlignModel"
                size="small"
                style="width: 100%"
                :options="horizontalAlignOptions"
              />
            </NFormItem>
            <NFormItem label="纵向对齐">
              <NSelect
                v-model:value="verticalAlignModel"
                size="small"
                style="width: 100%"
                :options="verticalAlignOptions"
              />
            </NFormItem>
            <NFormItem label="间距 gap（px）">
              <NInputNumber v-model:value="containerProps.gap" size="small" :min="0" :max="80" style="width: 100%" />
            </NFormItem>
          </PropsGrid>
        </NForm>

        <NText strong style="display:block; margin: 12px 0 8px">
          子区块（{{ childrenModel.length }}）
        </NText>

        <NScrollbar style="max-height: 260px; padding-right: 4px">
          <Draggable
            v-model="childrenModel"
            item-key="id"
            handle=".drag-handle"
            :animation="160"
            ghost-class="drag-ghost"
          >
            <template #item="{ element: b }">
              <div
                class="row"
                :class="{ active: selectedLeafId === b.id, hidden: b.hidden }"
                @click="onChildClick(b)"
              >
                <NIcon class="drag-handle" size="18">
                  <ReorderThreeOutline />
                </NIcon>

                <div class="label">
                  <span class="truncate">
                    {{ getBlockLabel(b.type) }}
                    <span v-if="b.type === 'layout'" style="opacity:0.7">（进入）</span>
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
                  :options="[
                    { label: '复制', key: 'copy' },
                    { label: '粘贴到下方', key: 'paste' },
                    { type: 'divider' },
                    { label: '删除', key: 'delete', props: { style: 'color: #d03050' } },
                  ]"
                  @select="(key) => {
                    if (String(key) === 'copy') copyBlockToClipboard(b)
                    else if (String(key) === 'paste') pasteFromClipboard(b.id)
                    else if (String(key) === 'delete') {
                      const idx = childrenModel.findIndex(x => x.id === b.id)
                      if (idx >= 0) childrenModel.splice(idx, 1)
                    }
                  }"
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
        </NScrollbar>
      </div>

      <div style="width: 1px; background: var(--n-divider-color)" />

      <div style="flex: 1; min-width: 0">
        <NText strong style="display:block; margin-bottom: 8px">
          子区块属性
        </NText>
        <NAlert v-if="!selectedLeaf" type="info" :show-icon="true">
          选择一个非布局的子区块进行编辑；布局容器会直接进入下一层。
        </NAlert>
        <BlockPropsForm v-else :block="selectedLeaf" />
      </div>
    </NFlex>
  </div>
</template>

<style scoped>
.row {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 6px 8px;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
  user-select: none;
}
.row:hover {
  background: var(--n-color-embedded);
}
.row.active {
  border-color: var(--n-color-target);
  background: var(--n-color-embedded);
}
.row.hidden .label {
  opacity: 0.6;
  text-decoration: line-through;
}
.drag-handle {
  cursor: grab;
  opacity: 0.8;
}
.drag-ghost {
  opacity: 0.45;
}
.label {
  flex: 1;
  min-width: 0;
}
.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
