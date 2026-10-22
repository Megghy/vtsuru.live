<script setup lang="ts">
import { Live24Filled, Person48Filled } from '@vicons/fluent'

import { useManageWorkspace } from '@/apps/manage/composables/useManageWorkspace'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { cn } from '@/shared/utils/cn'

const props = defineProps<{ collapsed?: boolean; block?: boolean }>()

const { workspace, switchWorkspace } = useManageWorkspace()

function onChange(value: string | string[] | undefined) {
  if (value === 'streamer' || value === 'user') void switchWorkspace(value)
}
</script>

<template>
  <ToggleGroup
    type="single"
    :model-value="workspace"
    :class="cn(collapsed ? '!h-auto w-full flex-col' : props.block ? 'w-full' : 'w-[148px]')"
    @update:model-value="onChange"
  >
    <ToggleGroupItem
      value="streamer"
      :title="collapsed ? '主播后台' : undefined"
      :class="collapsed ? 'w-full px-0' : 'flex-1'"
    >
      <component :is="Live24Filled" />
      <span v-if="!collapsed">主播</span>
    </ToggleGroupItem>
    <ToggleGroupItem
      value="user"
      :title="collapsed ? '观众' : undefined"
      :class="collapsed ? 'w-full px-0' : 'flex-1'"
    >
      <component :is="Person48Filled" />
      <span v-if="!collapsed">观众</span>
    </ToggleGroupItem>
  </ToggleGroup>
</template>
