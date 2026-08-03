<script setup lang="ts">
import { computed } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'

import type { BlockNode } from '@/apps/user-page/block/schema'
import type { UserFeatureKey } from '@/apps/user-page/featureNavigation'
import { USER_FEATURE_DEFINITION_MAP } from '@/apps/user-page/featureNavigation'

import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { ensureArrayProp } = useBlockPropsEditor(() => props.block)
const items = ensureArrayProp<{ key: UserFeatureKey; hidden?: boolean }>('items')
const itemsModel = computed({
  get: () => items,
  set: (value) => items.splice(0, items.length, ...value),
})

function setVisible(item: { hidden?: boolean }, visible: boolean) {
  if (visible) delete item.hidden
  else item.hidden = true
}
</script>

<template>
  <div class="builder-form">
    <UFormField label="功能顺序">
      <VueDraggable
        v-model="itemsModel"
        handle=".feature-drag-handle"
        :animation="160"
        class="feature-list"
      >
        <div
          v-for="item in itemsModel"
          :key="item.key"
          class="feature-item"
        >
          <UIcon
            class="feature-drag-handle"
            size="19"
            title="拖拽排序"
            name="i-lucide-grip-vertical"
          />
          <UIcon
            size="18"
            :name="USER_FEATURE_DEFINITION_MAP[item.key].icon"
          />
          <span class="builder-text feature-label">
            {{ USER_FEATURE_DEFINITION_MAP[item.key].label }}
          </span>
          <USwitch
            :model-value="item.hidden !== true"
            size="small"
            @update:model-value="(value) => setVisible(item, value)"
          />
        </div>
      </VueDraggable>
    </UFormField>
  </div>
</template>

<style scoped>
.feature-list {
  display: grid;
  gap: 6px;
  width: 100%;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 5px 8px;
  border: 1px solid var(--vtsuru-border);
  border-radius: 6px;
  background: var(--vtsuru-bg-elevated);
}

.feature-drag-handle {
  flex: none;
  color: var(--vtsuru-fg-muted);
  cursor: grab;
}

.feature-label {
  flex: 1;
  min-width: 0;
}
</style>
