<script setup lang="ts">
import { GripVertical } from 'lucide-vue-next'
import { computed, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'

import type { BlockNode } from '@/apps/user-page/block/schema'
import type { UserFeatureKey } from '@/apps/user-page/featureNavigation'
import { USER_FEATURE_DEFINITION_MAP, USER_FEATURE_KEYS } from '@/apps/user-page/featureNavigation'
import { FormField } from '@/shared/ui/form-field'
import { Switch } from '@/shared/ui/switch'

import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { arrayProp } = useBlockPropsEditor(() => props.block)
const items = arrayProp<{ key: UserFeatureKey; hidden?: boolean }>('items')

// 自动补全新增的功能键（如排队队列），兼容历史保存的 featureNav 配置
watch(
  items,
  (list) => {
    for (const key of USER_FEATURE_KEYS) {
      if (!list.some((it) => it.key === key)) {
        list.push({ key })
      }
    }
  },
  { immediate: true },
)

const itemsModel = computed({
  get: () => items.value,
  set: (value) => items.value.splice(0, items.value.length, ...value),
})

function setVisible(item: { hidden?: boolean }, visible: boolean) {
  if (visible) delete item.hidden
  else item.hidden = true
}
</script>

<template>
  <FormField label="功能顺序与显隐">
    <VueDraggable
      v-model="itemsModel"
      handle=".feature-drag-handle"
      :animation="160"
      class="grid gap-1.5 w-full"
    >
      <div
        v-for="item in itemsModel"
        :key="item.key"
        class="flex items-center gap-2 min-h-9 py-1 px-2 border border-border rounded-md bg-popover"
      >
        <span
          class="feature-drag-handle cursor-grab text-muted-foreground hover:text-foreground"
          title="拖拽排序"
        >
          <GripVertical class="size-3.5" />
        </span>
        <component
          :is="USER_FEATURE_DEFINITION_MAP[item.key].icon"
          class="size-3.5 shrink-0 text-foreground"
        />
        <span class="feature-label text-xs text-foreground truncate flex-1">
          {{ USER_FEATURE_DEFINITION_MAP[item.key].label }}
        </span>
        <Switch
          :checked="item.hidden !== true"
          @update:checked="(value) => setVisible(item, value)"
        />
      </div>
    </VueDraggable>
  </FormField>
</template>
