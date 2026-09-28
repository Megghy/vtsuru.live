<script setup lang="ts">
import { Grid16Regular, TextBulletListLtr16Regular } from '@vicons/fluent'
import { Pane, Splitpanes } from 'splitpanes'
import { computed } from 'vue'

import { useLiveDashboard } from '../store/useLiveDashboard'
import CardModeGrid from './CardModeGrid.vue'
import DanmakuRow from './DanmakuRow.vue'
import EventList from './EventList.vue'
import IconAction from './IconAction.vue'
import PanelShell from './PanelShell.vue'

defineProps<{ blurred?: boolean }>()
const dashboard = useLiveDashboard()
const layout = computed(() => dashboard.settings.layout)
const parts = computed<('main' | 'interaction')[]>(() => (layout.value.interactionOnTop ? ['interaction', 'main'] : ['main', 'interaction']))

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
        :icon="dashboard.settings.cardMode ? TextBulletListLtr16Regular : Grid16Regular"
        :tip="dashboard.settings.cardMode ? '切换到列表 (Alt+C)' : '卡片模式：合并重复弹幕 (Alt+C)'"
        :active="dashboard.settings.cardMode"
        @click="dashboard.settings.cardMode = !dashboard.settings.cardMode"
      />
    </template>
    <Splitpanes
      horizontal
      class="dash-split"
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
  </PanelShell>
</template>
