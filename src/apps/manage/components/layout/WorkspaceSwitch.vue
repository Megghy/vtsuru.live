<script setup lang="ts">
import { Live24Filled, Person48Filled } from '@vicons/fluent'

import { useManageWorkspace } from '@/apps/manage/composables/useManageWorkspace'

defineProps<{ collapsed?: boolean; block?: boolean }>()

const { workspace, switchWorkspace } = useManageWorkspace()
</script>

<template>
  <div
    class="workspace-switch"
    :class="{ 'workspace-switch--collapsed': collapsed, 'workspace-switch--block': block }"
  >
    <button
      type="button"
      :class="{ active: workspace === 'streamer' }"
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
      :class="{ active: workspace === 'user' }"
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

<style scoped>
.workspace-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3px;
  width: 148px;
  padding: 3px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--muted);
  box-sizing: border-box;
}

.workspace-switch button {
  min-width: 0;
  height: 28px;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--muted-foreground);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.workspace-switch button.active {
  background: var(--popover);
  color: var(--foreground);
  box-shadow: 0 1px 3px color-mix(in srgb, var(--foreground) 12%, transparent);
}

.workspace-switch--block {
  width: 100%;
}

.workspace-switch--collapsed {
  width: auto;
  grid-template-columns: 1fr;
  padding: 2px;
}

.workspace-switch--collapsed button {
  width: 28px;
  padding: 0;
}
</style>
