<script setup lang="ts">
import type { BlockNode } from '@/apps/user-page/block/schema'
import type { UserFeatureKey } from '@/apps/user-page/featureNavigation'
import { USER_FEATURE_DEFINITION_MAP } from '@/apps/user-page/featureNavigation'
import { ReorderThreeOutline } from '@vicons/ionicons5'
import { NForm, NFormItem, NIcon, NSwitch, NText } from 'naive-ui'
import { computed } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { ensureArrayProp } = useBlockPropsEditor(() => props.block)
const items = ensureArrayProp<{ key: UserFeatureKey, hidden?: boolean }>('items')
const itemsModel = computed({
  get: () => items,
  set: value => items.splice(0, items.length, ...value),
})

function setVisible(item: { hidden?: boolean }, visible: boolean) {
  if (visible) delete item.hidden
  else item.hidden = true
}
</script>

<template>
  <NForm label-placement="top" size="small">
    <NFormItem label="功能顺序">
      <VueDraggable v-model="itemsModel" handle=".feature-drag-handle" :animation="160" class="feature-list">
        <div v-for="item in itemsModel" :key="item.key" class="feature-item">
          <NIcon class="feature-drag-handle" size="19" title="拖拽排序">
            <ReorderThreeOutline />
          </NIcon>
          <NIcon size="18">
            <component :is="USER_FEATURE_DEFINITION_MAP[item.key].icon" />
          </NIcon>
          <NText class="feature-label">
            {{ USER_FEATURE_DEFINITION_MAP[item.key].label }}
          </NText>
          <NSwitch :value="item.hidden !== true" size="small" @update:value="value => setVisible(item, value)" />
        </div>
      </VueDraggable>
    </NFormItem>
  </NForm>
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
