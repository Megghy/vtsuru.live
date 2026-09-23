<script setup lang="ts">
import { Live24Filled, Person48Filled } from '@vicons/fluent'
import { NIcon } from 'naive-ui'

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
      <NIcon :component="Live24Filled" />
      <span v-if="!collapsed">主播</span>
    </button>
    <button
      type="button"
      :class="{ active: workspace === 'user' }"
      :title="collapsed ? '用户中心' : undefined"
      @click="switchWorkspace('user')"
    >
      <NIcon :component="Person48Filled" />
      <span v-if="!collapsed">用户</span>
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
  border: 1px solid var(--vtsuru-border);
  border-radius: 9px;
  background: var(--vtsuru-bg-muted);
}

.workspace-switch button {
  min-width: 0;
  height: 28px;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--vtsuru-fg-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.workspace-switch button.active {
  background: var(--vtsuru-bg-elevated);
  color: var(--vtsuru-fg);
  box-shadow: 0 1px 3px color-mix(in srgb, var(--vtsuru-fg) 12%, transparent);
}

.workspace-switch--block {
  width: 100%;
}

.workspace-switch--collapsed {
  width: auto;
  grid-template-columns: 1fr;
}
</style>
