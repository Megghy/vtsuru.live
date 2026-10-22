<script setup lang="ts">
import { CalendarLtr20Regular, Clock20Regular } from '@vicons/fluent'
import { computed } from 'vue'

import type { BiliLiveReserveItem } from '@/api/api-models'
import { Button } from '@/shared/ui/button'
import { Empty } from '@/shared/ui/empty'
import { Switch } from '@/shared/ui/switch'
import { formatBiliLiveReserveInterval, formatBiliLiveReserveTime } from '@/shared/utils/formatBiliLiveReserve'

const props = defineProps<{
  items: BiliLiveReserveItem[]
  fetchedAt: number
  intervalMinutes: number
  liveRoomUrl?: string
  manage?: boolean
  autoSync?: boolean
  refreshing?: boolean
  syncing?: boolean
}>()

const emit = defineEmits<{
  refresh: []
  'update:autoSync': [value: boolean]
}>()

const upcoming = computed(() => {
  const now = Date.now() / 1000
  return props.items.filter((item) => item.planStart >= now - 2 * 3600)
})

const fetchedLabel = computed(() => {
  if (!props.fetchedAt) return '尚未同步'
  return `上次同步 ${formatBiliLiveReserveTime(props.fetchedAt)}`
})
</script>

<template>
  <section class="grid gap-2.5 min-w-0 py-3.5 px-4 border border-border rounded-[var(--radius,10px)] bg-popover">
    <header class="flex items-start justify-between gap-3">
      <div class="flex min-w-0 gap-2.5">
        <component
          :is="CalendarLtr20Regular"
          class="size-5 shrink-0 text-[#fb7299] mt-0.5"
        />
        <div>
          <strong class="block text-sm font-semibold text-foreground">B 站直播预约</strong>
          <p class="text-xs text-muted-foreground mt-0.5 leading-[1.45]">
            {{ fetchedLabel }} · {{ formatBiliLiveReserveInterval(intervalMinutes) }}
          </p>
        </div>
      </div>

      <div
        v-if="manage"
        class="bili-reserve__actions flex items-center gap-2.5"
      >
        <div class="flex items-center gap-1.5">
          <span class="text-xs text-muted-foreground">写入日程表</span>
          <Switch
            :checked="autoSync"
            :disabled="syncing"
            @update:checked="emit('update:autoSync', $event)"
          />
        </div>
        <Button
          variant="outline"
          :disabled="refreshing"
          @click="emit('refresh')"
        >
          立即刷新
        </Button>
      </div>
    </header>

    <p
      v-if="manage"
      class="text-xs text-muted-foreground m-0 leading-[1.45]"
    >
      开启后会把预约合并进周历展示和日历订阅，手填日程不会被覆盖。同步有延迟，可手动刷新。
    </p>

    <Empty
      v-if="!upcoming.length"
      description="暂无即将开始的 B 站预约"
      class="py-4"
    />
    <ul
      v-else
      class="grid gap-2 m-0 p-0 list-none"
    >
      <li
        v-for="item in upcoming"
        :key="item.sid"
      >
        <a
          v-if="liveRoomUrl"
          :href="liveRoomUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 py-2 px-2.5 rounded-md bg-muted no-underline text-inherit hover:bg-muted/80"
        >
          <span class="flex items-center text-xs text-muted-foreground">
            <component
              :is="Clock20Regular"
              class="size-3.5 inline mr-1"
            />
            {{ formatBiliLiveReserveTime(item.planStart) }}
          </span>
          <strong class="text-[13px] truncate">{{ item.title }}</strong>
          <em v-if="item.total > 0" class="text-[11px] not-italic text-[#fb7299]">{{ item.total }} 人预约</em>
        </a>
        <div
          v-else
          class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 py-2 px-2.5 rounded-md bg-muted text-inherit"
        >
          <span class="flex items-center text-xs text-muted-foreground">
            <component
              :is="Clock20Regular"
              class="size-3.5 inline mr-1"
            />
            {{ formatBiliLiveReserveTime(item.planStart) }}
          </span>
          <strong class="text-[13px] truncate">{{ item.title }}</strong>
          <em v-if="item.total > 0" class="text-[11px] not-italic text-[#fb7299]">{{ item.total }} 人预约</em>
        </div>
      </li>
    </ul>
  </section>
</template>
