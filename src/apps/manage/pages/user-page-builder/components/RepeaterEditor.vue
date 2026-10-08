<script setup lang="ts">
import {
  AddOutline,
  ChevronDownOutline,
  ContractOutline,
  CopyOutline,
  ExpandOutline,
  ReorderThreeOutline,
  TrashOutline,
} from '@vicons/ionicons5'
import { NButton, NFlex, NIcon, NPopconfirm, NText, NTooltip } from 'naive-ui'
import { computed, ref, watchEffect } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'

import { createId, deepCloneJson } from '../editorHelpers'

const props = defineProps<{
  items: Array<Record<string, any>>
  createItem: () => Record<string, any>
  addText?: string
}>()

const expandedIds = ref(new Set<string>())
const itemsModel = computed({
  get: () => props.items,
  set: (items) => props.items.splice(0, props.items.length, ...items),
})

watchEffect(() => {
  props.items.forEach((item) => {
    if (typeof item._id !== 'string' || !item._id) item._id = createId()
  })
})

function toggle(itemId: string) {
  const next = new Set(expandedIds.value)
  if (next.has(itemId)) next.delete(itemId)
  else next.add(itemId)
  expandedIds.value = next
}

function expandAll() {
  expandedIds.value = new Set(props.items.map((item) => item._id))
}

function collapseAll() {
  expandedIds.value = new Set()
}

function addItem() {
  const item = { ...props.createItem(), _id: createId() }
  props.items.push(item)
  expandedIds.value = new Set([...expandedIds.value, item._id])
}

function duplicateItem(index: number) {
  const copy = { ...deepCloneJson(props.items[index]), _id: createId() }
  props.items.splice(index + 1, 0, copy)
  expandedIds.value = new Set([...expandedIds.value, copy._id])
}
</script>

<template>
  <div class="repeater-editor">
    <div
      v-if="itemsModel.length >= 2"
      class="repeater-bulk-actions"
    >
      <NFlex
        justify="space-between"
        align="center"
        style="width: 100%"
      >
        <span style="font-size: 11px; color: var(--vtsuru-fg-muted)"> 共 {{ itemsModel.length }} 项 </span>
        <NFlex :size="4">
          <NButton
            size="tiny"
            quaternary
            @click="expandAll"
          >
            <template #icon>
              <NIcon><ExpandOutline /></NIcon>
            </template>
            全部展开
          </NButton>
          <NButton
            size="tiny"
            quaternary
            @click="collapseAll"
          >
            <template #icon>
              <NIcon><ContractOutline /></NIcon>
            </template>
            全部折叠
          </NButton>
        </NFlex>
      </NFlex>
    </div>

    <div
      v-if="itemsModel.length === 0"
      class="repeater-empty"
    >
      <span style="font-size: 12px; color: var(--vtsuru-fg-muted)"> 暂无列表项，点击下方按钮添加 </span>
    </div>

    <VueDraggable
      v-else
      v-model="itemsModel"
      handle=".repeater-drag-handle"
      :animation="160"
    >
      <section
        v-for="(item, index) in itemsModel"
        :key="item._id"
        class="repeater-item"
      >
        <header class="repeater-header">
          <NIcon
            class="repeater-drag-handle"
            size="18"
            title="拖拽排序"
          >
            <ReorderThreeOutline />
          </NIcon>
          <button
            class="repeater-toggle"
            type="button"
            @click="toggle(item._id)"
          >
            <NIcon :class="{ expanded: expandedIds.has(item._id) }">
              <ChevronDownOutline />
            </NIcon>
            <NText strong>
              <slot
                name="title"
                :item="item"
                :index="index"
              >
                项目 {{ index + 1 }}
              </slot>
            </NText>
          </button>
          <NTooltip>
            <template #trigger>
              <NButton
                quaternary
                circle
                size="tiny"
                aria-label="复制项目"
                @click="duplicateItem(index)"
              >
                <template #icon>
                  <NIcon><CopyOutline /></NIcon>
                </template>
              </NButton>
            </template>
            复制项目
          </NTooltip>
          <NPopconfirm
            positive-text="删除"
            negative-text="取消"
            @positive-click="itemsModel.splice(index, 1)"
          >
            <template #trigger>
              <NButton
                quaternary
                circle
                size="tiny"
                type="error"
                aria-label="删除项目"
              >
                <template #icon>
                  <NIcon><TrashOutline /></NIcon>
                </template>
              </NButton>
            </template>
            确定删除这个项目吗？
          </NPopconfirm>
        </header>
        <div
          v-show="expandedIds.has(item._id)"
          class="repeater-content"
        >
          <slot
            :item="item"
            :index="index"
          />
        </div>
      </section>
    </VueDraggable>
    <NButton
      block
      secondary
      type="primary"
      @click="addItem"
    >
      <template #icon>
        <NIcon><AddOutline /></NIcon>
      </template>
      {{ addText || '添加项目' }}
    </NButton>
  </div>
</template>

<style scoped>
.repeater-editor {
  display: grid;
  gap: 8px;
  width: 100%;
}
.repeater-bulk-actions {
  display: flex;
  align-items: center;
  margin-bottom: 2px;
}
.repeater-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px;
  border: 1px dashed var(--vtsuru-border);
  border-radius: 6px;
  background: var(--vtsuru-bg-muted);
}
.repeater-item {
  margin-bottom: 8px;
  overflow: hidden;
  border: 1px solid var(--vtsuru-border);
  border-radius: 6px;
  background: var(--vtsuru-bg-elevated);
}
.repeater-header {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 38px;
  padding: 4px 6px;
}
.repeater-drag-handle {
  flex: none;
  cursor: grab;
  color: var(--vtsuru-fg-muted);
}
.repeater-toggle {
  display: flex;
  flex: 1;
  gap: 6px;
  align-items: center;
  min-width: 0;
  padding: 4px;
  border: 0;
  color: inherit;
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.repeater-toggle .n-icon {
  flex: none;
  transform: rotate(-90deg);
  transition: transform 140ms ease;
}
.repeater-toggle .n-icon.expanded {
  transform: rotate(0);
}
.repeater-toggle .n-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.repeater-content {
  padding: 10px;
  border-top: 1px solid var(--vtsuru-border);
}

@media (max-width: 520px) {
  .repeater-content :deep(.props-grid) {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
