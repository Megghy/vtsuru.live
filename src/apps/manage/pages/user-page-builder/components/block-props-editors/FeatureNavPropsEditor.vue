<script setup lang="ts">
import { ReorderThreeOutline } from '@vicons/ionicons5'
import { computed } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'

import type { BlockNode } from '@/apps/user-page/block/schema'
import type { UserFeatureKey } from '@/apps/user-page/featureNavigation'
import { USER_FEATURE_DEFINITION_MAP } from '@/apps/user-page/featureNavigation'
import { Switch } from '@/shared/ui/switch'

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
  <div class="space-y-1.5">
    <label class="text-xs font-medium text-foreground">功能顺序</label>
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
        <span
          class="feature-drag-handle cursor-grab text-muted-foreground hover:text-foreground"
          title="拖拽排序"
        >
          <ReorderThreeOutline class="size-5" />
        </span>
        <component :is="USER_FEATURE_DEFINITION_MAP[item.key].icon" class="size-4 shrink-0 text-foreground" />
        <span class="feature-label text-xs text-foreground truncate flex-1">
          {{ USER_FEATURE_DEFINITION_MAP[item.key].label }}
        </span>
        <Switch :checked="item.hidden !== true" @update:checked="(value) => setVisible(item, value)"
        />
      </div>
    </VueDraggable>
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
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--popover);
}

.feature-drag-handle {
  flex: none;
}
</style>
