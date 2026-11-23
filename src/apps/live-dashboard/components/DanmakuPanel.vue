<script setup lang="ts">
import { HelpCircle, Layers, LayoutGrid, List } from 'lucide-vue-next'
import { Pane, Splitpanes } from 'splitpanes'
import { computed, defineAsyncComponent } from 'vue'

import { isTauri } from '@/shared/config'

import { useLiveDashboard } from '../store/useLiveDashboard'
import CardModeGrid from './CardModeGrid.vue'
import DanmakuRow from './DanmakuRow.vue'
import EventList from './EventList.vue'
import IconAction from './IconAction.vue'
import PanelShell from './PanelShell.vue'

const DanmakuComposer = defineAsyncComponent(() => import('./DanmakuComposer.vue'))

defineProps<{ blurred?: boolean }>()
const dashboard = useLiveDashboard()
const inTauri = isTauri()
const layout = computed(() => dashboard.settings.layout)
const parts = computed<('main' | 'interaction')[]>(() =>
  layout.value.interactionOnTop ? ['interaction', 'main'] : ['main', 'interaction'],
)

function onResized({ panes }: { panes: { size: number }[] }) {
  const index = parts.value.indexOf('interaction')
  if (panes[index]) layout.value.interactionSize = Math.round(panes[index].size)
}
</script>

<template>
  <PanelShell
    title="弹幕"
    :count="dashboard.danmakuList.length"
    :blurred="blurred"
  >
    <template #actions>
      <IconAction
        :icon="HelpCircle"
        :tip="dashboard.questionOnly ? '当前仅看提问/提及，点击恢复全部' : '仅看提问 / @提及弹幕'"
        :active="dashboard.questionOnly"
        @click="dashboard.questionOnly = !dashboard.questionOnly"
      />
      <IconAction
        v-if="!dashboard.settings.cardMode"
        :icon="Layers"
        :tip="dashboard.settings.collapseRepeated ? '已开启连续刷屏折叠' : '合并连续重复刷屏弹幕'"
        :active="dashboard.settings.collapseRepeated"
        @click="dashboard.settings.collapseRepeated = !dashboard.settings.collapseRepeated"
      />
      <IconAction
        :icon="dashboard.settings.cardMode ? List : LayoutGrid"
        :tip="dashboard.settings.cardMode ? '切换到列表 (Alt+C)' : '卡片模式：合并重复弹幕 (Alt+C)'"
        :active="dashboard.settings.cardMode"
        @click="dashboard.settings.cardMode = !dashboard.settings.cardMode"
      />
    </template>
    <div class="flex flex-col h-full min-h-0">
      <Splitpanes
        horizontal
        class="dash-split flex-1 min-h-0"
        @resized="onResized"
      >
        <Pane
          v-for="part in parts"
          :key="part"
          :size="part === 'main' ? 100 - layout.interactionSize : layout.interactionSize"
          :min-size="part === 'main' ? 20 : 8"
        >
          <CardModeGrid v-if="part === 'main' && dashboard.settings.cardMode" />
          <EventList
            v-else
            :items="part === 'main' ? dashboard.danmakuList : dashboard.interactionList"
            :item-size="part === 'main' ? 64 : 28"
            anchor="bottom"
          >
            <template #default="{ item }">
              <DanmakuRow
                :event="item"
                :compact="part === 'interaction'"
              />
            </template>
          </EventList>
        </Pane>
      </Splitpanes>
      <DanmakuComposer v-if="inTauri" />
    </div>
  </PanelShell>
</template>
