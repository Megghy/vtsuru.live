<script setup lang="ts">
import { ReOrderDotsVertical16Regular } from '@vicons/fluent'
import { computed } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'

import { Button } from '@/shared/ui/button'
import { Switch } from '@/shared/ui/switch'

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
  <div class="grid gap-2 w-60 text-[13px]">
    <div class="text-xs text-muted-foreground">面板（拖动调整顺序）</div>
    <VueDraggable
      v-model="layout.order"
      :animation="150"
      handle=".layout-menu-handle"
      class="grid gap-1"
    >
      <div
        v-for="id in layout.order"
        :key="id"
        class="flex items-center gap-1.5 py-1 px-1.5 border border-border rounded-md"
      >
        <component
          :is="ReOrderDotsVertical16Regular"
          class="layout-menu-handle h-4 w-4 cursor-grab text-muted-foreground"
        />
        <span>{{ PANEL_TITLES[id] }}</span>
        <span class="ml-auto text-[11px] text-muted-foreground">Alt+{{ PANEL_IDS.indexOf(id) + 1 }}</span>
        <Switch
          :model-value="!layout.hidden.includes(id)"
          @update:model-value="(v: boolean) => toggle(id, v)"
        />
      </div>
    </VueDraggable>
    <label class="flex-between gap-2">
      竖屏布局（上下排列）
      <Switch v-model="layout.vertical" />
    </label>
    <label class="flex-between gap-2">
      互动区在弹幕上方
      <Switch v-model="layout.interactionOnTop" />
    </label>
    <label class="flex-between gap-2">
      专注模式（隐藏面板原地虚化）
      <Switch v-model="layout.focusMode" />
    </label>
    <Button
      variant="secondary"
      class="w-full"
      @click="resetLayout(dashboard.settings)"
    >
      重置布局
    </Button>
  </div>
</template>
