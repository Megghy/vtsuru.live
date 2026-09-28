<script setup lang="ts">
import { ReOrderDotsVertical16Regular } from '@vicons/fluent'
import { NButton, NIcon, NSwitch } from 'naive-ui'
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
        <NIcon
          class="layout-menu__handle"
          :component="ReOrderDotsVertical16Regular"
        />
        <span>{{ PANEL_TITLES[id] }}</span>
        <span class="layout-menu__key">Alt+{{ PANEL_IDS.indexOf(id) + 1 }}</span>
        <NSwitch
          size="small"
          :value="!layout.hidden.includes(id)"
          @update:value="(v: boolean) => toggle(id, v)"
        />
      </div>
    </VueDraggable>
    <label class="layout-menu__row">
      竖屏布局（上下排列）
      <NSwitch
        v-model:value="layout.vertical"
        size="small"
      />
    </label>
    <label class="layout-menu__row">
      互动区在弹幕上方
      <NSwitch
        v-model:value="layout.interactionOnTop"
        size="small"
      />
    </label>
    <label class="layout-menu__row">
      专注模式（隐藏面板原地虚化）
      <NSwitch
        v-model:value="layout.focusMode"
        size="small"
      />
    </label>
    <NButton
      size="small"
      block
      secondary
      @click="resetLayout(dashboard.settings)"
    >
      重置布局
    </NButton>
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
  color: var(--vtsuru-fg-muted);
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
  border: 1px solid var(--vtsuru-border);
  border-radius: 6px;
}

.layout-menu__handle {
  cursor: grab;
  color: var(--vtsuru-fg-muted);
}

.layout-menu__key {
  margin-left: auto;
  font-size: 11px;
  color: var(--vtsuru-fg-muted);
}

.layout-menu__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
</style>
