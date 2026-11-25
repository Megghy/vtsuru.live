<script setup lang="ts">
import { GripVertical, Plus, RotateCcw, X } from 'lucide-vue-next'
import { computed } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'

import { isTauri } from '@/shared/config'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Separator } from '@/shared/ui/separator'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'
import { SimpleTooltip } from '@/shared/ui/tooltip'

import type { PanelCategory, PanelId } from '../core/types'
import { PANEL_CATEGORY_LABELS, PANEL_IDS, PANEL_META, PANEL_TITLES } from '../core/types'
import { applyLayoutPreset, LAYOUT_PRESETS, resetLayout } from '../store/settings'
import { useLiveDashboard } from '../store/useLiveDashboard'

const dashboard = useLiveDashboard()
const inTauri = isTauri()
const layout = computed(() => dashboard.settings.layout)

const availablePanelIds = computed(() =>
  PANEL_IDS.filter((id) => inTauri || !PANEL_META[id].clientOnly),
)

const visiblePanels = computed<PanelId[]>({
  get() {
    return layout.value.order.filter(
      (id) => !layout.value.hidden.includes(id) && (inTauri || !PANEL_META[id].clientOnly),
    )
  },
  set(newVisibleOrder: PanelId[]) {
    const visibleSet = new Set(newVisibleOrder)
    const rest = layout.value.order.filter((id) => !visibleSet.has(id))
    layout.value.order = [...newVisibleOrder, ...rest]
  },
})

const activePresetId = computed(() => {
  const current = visiblePanels.value
  for (const preset of LAYOUT_PRESETS) {
    if (
      preset.panels.length === current.length &&
      preset.panels.every((id, idx) => current[idx] === id)
    ) {
      return preset.id
    }
  }
  return ''
})

const hiddenByCategory = computed(() => {
  const hiddenSet = new Set(layout.value.hidden)
  const categories: PanelCategory[] = ['core', 'interact', 'assist']
  return categories
    .map((category) => ({
      category,
      label: PANEL_CATEGORY_LABELS[category],
      items: availablePanelIds.value
        .filter((id) => PANEL_META[id].category === category && hiddenSet.has(id))
        .map((id) => PANEL_META[id]),
    }))
    .filter((group) => group.items.length > 0)
})

function showPanel(id: PanelId) {
  layout.value.hidden = layout.value.hidden.filter((h) => h !== id)
}

function hidePanel(id: PanelId) {
  if (visiblePanels.value.length <= 1) return
  if (!layout.value.hidden.includes(id)) {
    layout.value.hidden = [...layout.value.hidden, id]
  }
}

function shortcutLabel(id: PanelId) {
  const idx = PANEL_IDS.indexOf(id)
  return idx >= 0 && idx < 9 ? `Alt+${idx + 1}` : ''
}
</script>

<template>
  <div class="w-[336px] max-h-[75vh] overflow-y-auto scrollbar-thin p-1 space-y-3 text-xs">
    <!-- 场景预设 -->
    <div class="space-y-1.5">
      <div class="flex-between">
        <span class="font-semibold text-foreground">场景预设</span>
        <span class="text-[11px] text-muted-foreground">一键切换常用栏位组合</span>
      </div>
      <div class="grid grid-cols-3 gap-1.5">
        <SimpleTooltip
          v-for="preset in LAYOUT_PRESETS"
          :key="preset.id"
          :content="preset.description"
        >
          <Button
            size="xs"
            :variant="activePresetId === preset.id ? 'default' : 'outline'"
            class="justify-center px-2"
            @click="applyLayoutPreset(dashboard.settings, preset.id)"
          >
            {{ preset.label }}
          </Button>
        </SimpleTooltip>
      </div>
    </div>

    <Separator />

    <!-- 已开启栏位：支持拖拽排序与快捷移除 -->
    <div class="space-y-1.5">
      <div class="flex-between">
        <span class="font-semibold text-foreground">已开启栏位（{{ visiblePanels.length }}）</span>
        <span class="text-[11px] text-muted-foreground">拖拽调整左右顺序</span>
      </div>
      <VueDraggable
        v-model="visiblePanels"
        :animation="150"
        handle=".layout-menu-handle"
        class="space-y-1"
      >
        <div
          v-for="id in visiblePanels"
          :key="id"
          class="flex items-center gap-1.5 py-1 px-2 border border-border rounded-md bg-card"
        >
          <GripVertical class="layout-menu-handle size-3.5 cursor-grab text-muted-foreground shrink-0" />
          <span class="font-medium text-foreground truncate">{{ PANEL_TITLES[id] }}</span>
          <span
            v-if="shortcutLabel(id)"
            class="ml-auto text-[10px] text-muted-foreground tabular-nums shrink-0"
          >
            {{ shortcutLabel(id) }}
          </span>
          <SimpleTooltip
            content="隐藏此栏位"
            :disabled="visiblePanels.length <= 1"
          >
            <Button
              variant="ghost"
              size="none"
              class="size-5 text-muted-foreground hover:text-destructive shrink-0"
              :class="shortcutLabel(id) ? '' : 'ml-auto'"
              :disabled="visiblePanels.length <= 1"
              aria-label="隐藏此栏位"
              @click="hidePanel(id)"
            >
              <X class="size-3" />
            </Button>
          </SimpleTooltip>
        </div>
      </VueDraggable>
    </div>

    <!-- 未开启栏位：按分类点击即添加 -->
    <template v-if="hiddenByCategory.length > 0">
      <Separator />
      <div class="space-y-2">
        <div class="font-semibold text-foreground">添加更多栏位</div>
        <div
          v-for="group in hiddenByCategory"
          :key="group.category"
          class="space-y-1"
        >
          <div class="text-[11px] text-muted-foreground">{{ group.label }}</div>
          <div class="flex flex-wrap gap-1.5">
            <SimpleTooltip
              v-for="item in group.items"
              :key="item.id"
              :content="item.description"
            >
              <Button
                size="xs"
                variant="outline"
                class="gap-1 px-2 border-dashed"
                @click="showPanel(item.id)"
              >
                <Plus class="size-3 text-muted-foreground" />
                <span>{{ item.title }}</span>
                <Badge
                  v-if="item.clientOnly"
                  variant="secondary"
                  size="xs"
                  class="px-1 text-[10px]"
                >
                  客户端
                </Badge>
              </Button>
            </SimpleTooltip>
          </div>
        </div>
      </div>
    </template>

    <Separator />

    <!-- 布局行为选项 -->
    <div class="space-y-1.5">
      <SettingRow
        variant="none"
        title="竖屏布局（上下排列）"
      >
        <Switch v-model="layout.vertical" />
      </SettingRow>
      <SettingRow
        variant="none"
        title="互动区在弹幕上方"
      >
        <Switch v-model="layout.interactionOnTop" />
      </SettingRow>
      <SettingRow
        variant="none"
        title="专注模式（隐藏面板原地虚化）"
      >
        <Switch v-model="layout.focusMode" />
      </SettingRow>
      <SettingRow
        variant="none"
        title="弹幕顶部热度折线与热词条"
      >
        <Switch v-model="dashboard.settings.showDanmakuPulse" />
      </SettingRow>
    </div>

    <Button
      variant="secondary"
      size="xs"
      class="w-full gap-1.5"
      @click="resetLayout(dashboard.settings)"
    >
      <RotateCcw class="size-3.5" />
      恢复默认三栏布局
    </Button>
  </div>
</template>
