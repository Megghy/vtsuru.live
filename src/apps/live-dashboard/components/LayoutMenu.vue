<script setup lang="ts">
import { ReOrderDotsVertical16Regular } from '@vicons/fluent'
import { Button } from '@/shared/ui/button'
import { Switch } from '@/shared/ui/switch'
import { VueDraggable } from 'vue-draggable-plus'
import { computed } from 'vue'

import type { PanelId } from '../core/types'
import { PANEL_IDS, PANEL_TITLES } from '../core/types'
import { resetLayout } from '../store/settings'
import { useLiveDashboard } from '../store/useLiveDashboard'

const dashboard = useLiveDashboard()
const layout = computed(() => dashboard.settings.layout)

function toggle(id: PanelId, visible: boolean) {
  layout.value.hidden = visible ? layout.value.hidden.filter((h) => h !== id) : [...layout.value.hidden, id]
}
</script>

<template>
  <div class="layout-menu">
    <div class="layout-menu__label">
      面板（拖动调整顺序）
    </div>
    <VueDraggable
      v-model="layout.order"
      :animation="150"
      handle=".layout-menu__handle"
      class="layout-menu__list"
    >
      <div
        v-for="id in layout.order"
        :key="id"
        class="layout-menu__item"
      >
        <component
          :is="ReOrderDotsVertical16Regular"
          class="layout-menu__handle h-4 w-4"
        />
        <span>{{ PANEL_TITLES[id] }}</span>
        <span class="layout-menu__key">Alt+{{ PANEL_IDS.indexOf(id) + 1 }}</span>
        <Switch
          :model-value="!layout.hidden.includes(id)"
          @update:model-value="(v: boolean) => toggle(id, v)"
        />
      </div>
    </VueDraggable>
    <label class="layout-menu__row">
      竖屏布局（上下排列）
      <Switch
        v-model="layout.vertical"
      />
    </label>
    <label class="layout-menu__row">
      互动区在弹幕上方
      <Switch
        v-model="layout.interactionOnTop"
      />
    </label>
    <label class="layout-menu__row">
      专注模式（隐藏面板原地虚化）
      <Switch
        v-model="layout.focusMode"
      />
    </label>
    <Button
      variant="secondary"
      size="sm"
      class="w-full"
      @click="resetLayout(dashboard.settings)"
    >
      重置布局
    </Button>
  </div>
</template>

<style scoped>
.layout-menu {
  display: grid;
  gap: 8px;
  width: 240px;
  font-size: 13px;
}

.layout-menu__label {
  font-size: 12px;
  color: var(--muted-foreground);
}

.layout-menu__list {
  display: grid;
  gap: 4px;
}

.layout-menu__item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border: 1px solid var(--border);
  border-radius: 6px;
}

.layout-menu__handle {
  cursor: grab;
  color: var(--muted-foreground);
}

.layout-menu__key {
  margin-left: auto;
  font-size: 11px;
  color: var(--muted-foreground);
}

.layout-menu__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
</style>
