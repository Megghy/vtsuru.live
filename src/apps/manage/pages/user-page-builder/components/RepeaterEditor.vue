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
import { computed, ref, watchEffect } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'

import { Button } from '@/shared/ui/button'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

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
      class="repeater-bulk-actions flex justify-between items-center w-full mb-1"
    >
      <span class="text-[11px] text-muted-foreground">共 {{ itemsModel.length }} 项</span>
      <div class="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          class="h-6 px-2 text-xs"
          @click="expandAll"
        >
          <component :is="ExpandOutline" class="size-3.5 mr-1" />
          全部展开
        </Button>
        <Button
          size="sm"
          variant="ghost"
          class="h-6 px-2 text-xs"
          @click="collapseAll"
        >
          <component :is="ContractOutline" class="size-3.5 mr-1" />
          全部折叠
        </Button>
      </div>
    </div>

    <div
      v-if="itemsModel.length === 0"
      class="repeater-empty"
    >
      <span class="text-xs text-muted-foreground">暂无列表项，点击下方按钮添加</span>
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
          <component
            :is="ReorderThreeOutline"
            class="repeater-drag-handle size-4.5 cursor-grab text-muted-foreground"
            title="拖拽排序"
          />
          <button
            class="repeater-toggle"
            type="button"
            @click="toggle(item._id)"
          >
            <component
              :is="ChevronDownOutline"
              class="repeater-chevron size-3.5 transition-transform"
              :class="{ 'rotate-0': expandedIds.has(item._id), '-rotate-90': !expandedIds.has(item._id) }"
            />
            <span class="font-medium truncate text-xs">
              <slot
                name="title"
                :item="item"
                :index="index"
              >
                项目 {{ index + 1 }}
              </slot>
            </span>
          </button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="sm"
                  class="size-6 p-0"
                  aria-label="复制项目"
                  @click="duplicateItem(index)"
                >
                  <component :is="CopyOutline" class="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>复制项目</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Popconfirm
            title="确定删除这个项目吗？"
            ok-text="删除"
            cancel-text="取消"
            @confirm="itemsModel.splice(index, 1)"
          >
            <Button
              variant="ghost"
              size="sm"
              class="size-6 p-0 text-destructive hover:text-destructive"
              aria-label="删除项目"
            >
              <component :is="TrashOutline" class="size-3.5" />
            </Button>
          </Popconfirm>
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

    <Button
      variant="outline"
      class="w-full text-xs"
      @click="addItem"
    >
      <component :is="AddOutline" class="size-4 mr-1" />
      {{ addText || '添加项目' }}
    </Button>
  </div>
</template>

<style scoped>
.repeater-editor {
  display: grid;
  gap: 8px;
  width: 100%;
}
.repeater-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px;
  border: 1px dashed var(--border);
  border-radius: 6px;
  background: var(--muted);
}
.repeater-item {
  margin-bottom: 8px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--popover);
}
.repeater-header {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 38px;
  padding: 4px 6px;
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
.repeater-content {
  padding: 10px;
  border-top: 1px solid var(--border);
}

@media (max-width: 520px) {
  .repeater-content :deep(.props-grid) {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
