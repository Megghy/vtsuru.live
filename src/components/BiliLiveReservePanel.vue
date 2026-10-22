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
  <section class="bili-reserve">
    <header class="bili-reserve__head">
      <div class="bili-reserve__title">
        <component :is="CalendarLtr20Regular" class="size-5 shrink-0 text-[#fb7299] mt-0.5" />
        <div>
          <strong class="text-sm font-semibold text-foreground">B 站直播预约</strong>
          <p class="text-xs text-muted-foreground">{{ fetchedLabel }} · {{ formatBiliLiveReserveInterval(intervalMinutes) }}</p>
        </div>
      </div>

      <div
        v-if="manage"
        class="bili-reserve__actions flex items-center gap-2.5"
      >
        <div class="flex items-center gap-1.5">
          <span class="text-xs text-muted-foreground">写入日程表</span>
          <Switch :checked="autoSync" :disabled="syncing" @update:checked="emit('update:autoSync', $event)" />
        </div>
        <Button variant="outline" :disabled="refreshing" @click="emit('refresh')">
          立即刷新
        </Button>
      </div>
    </header>

    <p
      v-if="manage"
      class="bili-reserve__hint text-xs text-muted-foreground m-0"
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
      class="bili-reserve__list"
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
        >
          <span class="bili-reserve__time">
            <component :is="Clock20Regular" class="size-3.5 inline mr-1" />
            {{ formatBiliLiveReserveTime(item.planStart) }}
          </span>
          <strong>{{ item.title }}</strong>
          <em v-if="item.total > 0">{{ item.total }} 人预约</em>
        </a>
        <div v-else>
          <span class="bili-reserve__time">
            <component :is="Clock20Regular" class="size-3.5 inline mr-1" />
            {{ formatBiliLiveReserveTime(item.planStart) }}
          </span>
          <strong>{{ item.title }}</strong>
          <em v-if="item.total > 0">{{ item.total }} 人预约</em>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.bili-reserve {
  display: grid;
  gap: 10px;
  min-width: 0;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius, 10px);
  background: var(--popover, var(--background));
}
.bili-reserve__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.bili-reserve__title {
  display: flex;
  min-width: 0;
  gap: 10px;
}
.bili-reserve__title strong {
  display: block;
}
.bili-reserve__title p,
.bili-reserve__hint {
  margin: 2px 0 0;
  line-height: 1.45;
}
.bili-reserve__list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.bili-reserve__list a,
.bili-reserve__list div {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--muted, rgba(128, 128, 128, 0.05));
  text-decoration: none;
  color: inherit;
}
.bili-reserve__list a:hover {
  background: var(--background-hover, rgba(128, 128, 128, 0.1));
}
.bili-reserve__time {
  display: flex;
  align-items: center;
  font-size: 12px;
  color: var(--muted-foreground);
}
.bili-reserve__list strong {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bili-reserve__list em {
  font-size: 11px;
  font-style: normal;
  color: #fb7299;
}
</style>
