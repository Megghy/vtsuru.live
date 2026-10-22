<script setup lang="ts">
import { Live24Filled, Person48Filled } from '@vicons/fluent'

import { useManageWorkspace } from '@/apps/manage/composables/useManageWorkspace'

defineProps<{ collapsed?: boolean; block?: boolean }>()

const { workspace, switchWorkspace } = useManageWorkspace()
</script>

<template>
  <div
    class="grid grid-cols-2 gap-0.5 w-[148px] p-0.5 border border-border rounded-[9px] bg-muted box-border"
    :class="{ 'w-full': block, 'w-auto grid-cols-1 p-0.5': collapsed }"
  >
    <button
      type="button"
      class="min-w-0 h-7 px-2 border-0 rounded-md bg-transparent text-muted-foreground inline-flex-center gap-1.5 font-inherit text-xs font-semibold cursor-pointer transition-colors"
      :class="{
        'bg-popover text-foreground shadow-sm': workspace === 'streamer',
        'size-7 p-0': collapsed,
      }"
      :title="collapsed ? '主播后台' : undefined"
      @click="switchWorkspace('streamer')"
    >
      <component
        :is="Live24Filled"
        class="h-3.5 w-3.5"
      />
      <span v-if="!collapsed">主播</span>
    </button>
    <button
      type="button"
      class="min-w-0 h-7 px-2 border-0 rounded-md bg-transparent text-muted-foreground inline-flex-center gap-1.5 font-inherit text-xs font-semibold cursor-pointer transition-colors"
      :class="{
        'bg-popover text-foreground shadow-sm': workspace === 'user',
        'size-7 p-0': collapsed,
      }"
      :title="collapsed ? '观众' : undefined"
      @click="switchWorkspace('user')"
    >
      <component
        :is="Person48Filled"
        class="h-3.5 w-3.5"
      />
      <span v-if="!collapsed">观众</span>
    </button>
  </div>
</template>
