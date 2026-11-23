<script setup lang="ts">
import { ArrowDownWideNarrow, CheckCheck, Clock, Eye, EyeOff, Filter } from 'lucide-vue-next'
import { computed } from 'vue'

import { Button } from '@/shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { FormField } from '@/shared/ui/form-field'
import { NumberField } from '@/shared/ui/number-field'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'

import type { PaidReadFilter } from '../store/settings'
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
const readFilter = computed({
  get: () => dashboard.settings.paidReadFilter[props.panel],
  set: (value: PaidReadFilter) => (dashboard.settings.paidReadFilter[props.panel] = value),
})
const readFilterLabel = computed(() =>
  readFilter.value === 'unread' ? '未读' : readFilter.value === 'read' ? '已读' : '',
)

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
        :icon="sort === 'price' ? ArrowDownWideNarrow : Clock"
        :tip="sort === 'price' ? '当前按金额排序，点击改为按时间' : '当前按时间排序，点击改为按金额'"
        :active="sort === 'price'"
        @click="sort = sort === 'price' ? 'time' : 'price'"
      />
      <Popover v-if="panel === 'gift'">
        <PopoverTrigger as-child>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="礼物过滤"
            :class="
              dashboard.settings.giftMinPrice > 0 || dashboard.settings.showFreeGift
                ? 'text-primary'
                : 'text-muted-foreground'
            "
          >
            <Filter class="size-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          class="w-[220px]"
          align="end"
        >
          <div class="grid gap-2.5 w-[200px] text-xs">
            <FormField label="最低金额（元），大航海不受影响">
              <NumberField
                v-model="dashboard.settings.giftMinPrice"
                :min="0"
                :step="1"
              />
            </FormField>
            <SettingRow
              variant="none"
              title="显示免费礼物"
            >
              <Switch v-model="dashboard.settings.showFreeGift" />
            </SettingRow>
          </div>
        </PopoverContent>
      </Popover>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            :size="readFilterLabel ? 'xs' : 'icon-xs'"
            :class="[readFilter !== 'all' ? 'text-primary gap-1 px-1.5' : 'text-muted-foreground']"
            aria-label="筛选已读状态"
            :title="
              readFilter === 'unread'
                ? '仅显示未读'
                : readFilter === 'read'
                  ? '仅显示已读'
                  : '已读筛选（当前显示全部，受全局隐藏已读影响）'
            "
          >
            <component
              :is="readFilter === 'unread' ? EyeOff : Eye"
              class="size-3.5 shrink-0"
            />
            <span
              v-if="readFilterLabel"
              class="leading-none"
              >{{ readFilterLabel }}</span
            >
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup v-model="readFilter">
            <DropdownMenuRadioItem value="all"> 全部 </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="unread"> 仅未读 </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="read"> 仅已读 </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <IconAction
        :icon="CheckCheck"
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
