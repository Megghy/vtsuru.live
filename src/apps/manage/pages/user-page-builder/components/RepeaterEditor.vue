<script setup lang="ts">
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

function removeItem(index: number) {
  if (window.confirm('确定删除这个项目吗？')) itemsModel.value.splice(index, 1)
}

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
    <VueDraggable
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
          <UIcon
            class="repeater-drag-handle"
            size="18"
            title="拖拽排序"
            name="i-lucide-grip-vertical"
          />
          <button
            class="repeater-toggle"
            type="button"
            @click="toggle(item._id)"
          >
            <UIcon
              :class="{ expanded: expandedIds.has(item._id) }"
              name="i-lucide-chevron-down"
            />
            <span class="builder-text">
              <slot
                name="title"
                :item="item"
                :index="index"
              >
                项目 {{ index + 1 }}
              </slot>
            </span>
          </button>
          <UTooltip>
            <UButton
              variant="ghost"
              square
              size="xs"
              aria-label="复制项目"
              @click="duplicateItem(index)"
            >
              <template #icon>
                <UIcon name="i-lucide-copy" />
              </template>
            </UButton>
            <template #content> 复制项目 </template></UTooltip
          >
          <UButton
            icon="i-lucide-trash-2"
            variant="ghost"
            square
            size="xs"
            color="error"
            aria-label="删除项目"
            @click="removeItem(index)"
          />
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
    <UButton
      block
      variant="soft"
      color="primary"
      @click="addItem"
    >
      <template #icon>
        <UIcon name="i-lucide-plus" />
      </template>
      {{ addText || '添加项目' }}
    </UButton>
  </div>
</template>

<style scoped>
.repeater-editor {
  display: grid;
  gap: 8px;
  width: 100%;
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
.repeater-toggle :deep(svg) {
  flex: none;
  transform: rotate(-90deg);
  transition: transform 140ms ease;
}
.repeater-toggle.expanded :deep(svg) {
  transform: rotate(0);
}
.repeater-toggle .builder-text {
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
