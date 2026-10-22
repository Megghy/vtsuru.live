<script setup lang="ts">
import { ArrowSort16Regular, CheckmarkCircle16Regular, Clock16Regular, Filter16Regular } from '@vicons/fluent'
import { computed } from 'vue'

import { Button } from '@/shared/ui/button'
import { NumberField } from '@/shared/ui/number-field'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { Switch } from '@/shared/ui/switch'

import { useLiveDashboard } from '../store/useLiveDashboard'
import EventList from './EventList.vue'
import IconAction from './IconAction.vue'
import PaidCard from './PaidCard.vue'
import PanelShell from './PanelShell.vue'

const props = defineProps<{ panel: 'sc' | 'gift'; blurred?: boolean }>()
const dashboard = useLiveDashboard()

const items = computed(() => (props.panel === 'sc' ? dashboard.scList : dashboard.giftList))
const sort = computed({
  get: () => dashboard.settings.sort[props.panel],
  set: (value) => (dashboard.settings.sort[props.panel] = value),
})

function markAllRead() {
  dashboard.setRead(
    items.value.filter((e) => !dashboard.isRead(e)),
    true,
  )
}
</script>

<template>
  <PanelShell
    :title="panel === 'sc' ? '醒目留言' : '礼物'"
    :count="items.length"
    :unread="dashboard.unreadCounts[panel]"
    :blurred="blurred"
  >
    <template #actions>
      <IconAction
        :icon="sort === 'price' ? ArrowSort16Regular : Clock16Regular"
        :tip="sort === 'price' ? '当前按金额排序，点击改为按时间' : '当前按时间排序，点击改为按金额'"
        :active="sort === 'price'"
        @click="sort = sort === 'price' ? 'time' : 'price'"
      />
      <Popover v-if="panel === 'gift'">
        <PopoverTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="h-6 w-6"
            aria-label="礼物过滤"
            :class="
              dashboard.settings.giftMinPrice > 0 || dashboard.settings.showFreeGift
                ? 'text-primary'
                : 'text-muted-foreground'
            "
          >
            <component
              :is="Filter16Regular"
              class="h-4 w-4"
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          class="w-[220px] p-3 text-xs"
          align="end"
        >
          <div class="grid gap-2 w-[200px] text-xs">
            <label class="text-muted-foreground">最低金额（元），大航海不受影响</label>
            <NumberField
              v-model="dashboard.settings.giftMinPrice"
              :min="0"
              :step="1"
            />
            <label class="flex-between items-center">
              显示免费礼物
              <Switch v-model="dashboard.settings.showFreeGift" />
            </label>
          </div>
        </PopoverContent>
      </Popover>
      <IconAction
        :icon="CheckmarkCircle16Regular"
        tip="全部标为已读"
        @click="markAllRead"
      />
    </template>
    <EventList
      :items="items"
      :item-size="panel === 'sc' ? 96 : 56"
      anchor="top"
    >
      <template #default="{ item }">
        <PaidCard :event="item" />
      </template>
    </EventList>
  </PanelShell>
</template>
