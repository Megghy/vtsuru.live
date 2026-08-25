<script setup lang="ts">
import { CalendarLtr20Regular, Clock20Regular } from '@vicons/fluent'
import { NButton, NEmpty, NFlex, NIcon, NSwitch, NText } from 'naive-ui'
import { computed } from 'vue'

import type { BiliLiveReserveItem } from '@/api/api-models'
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
        <NIcon :component="CalendarLtr20Regular" />
        <div>
          <strong>B 站直播预约</strong>
          <p>{{ fetchedLabel }} · {{ formatBiliLiveReserveInterval(intervalMinutes) }}</p>
        </div>
      </div>
      <NFlex
        v-if="manage"
        align="center"
        :size="10"
        class="bili-reserve__actions"
      >
        <NFlex
          align="center"
          :size="6"
        >
          <NText
            depth="3"
            style="font-size: 12px"
          >
            写入日程表
          </NText>
          <NSwitch
            :value="autoSync"
            :loading="syncing"
            size="small"
            @update:value="emit('update:autoSync', $event)"
          >
            <template #checked> 开 </template>
            <template #unchecked> 关 </template>
          </NSwitch>
        </NFlex>
        <NButton
          size="small"
          :loading="refreshing"
          @click="emit('refresh')"
        >
          立即刷新
        </NButton>
      </NFlex>
    </header>

    <NText
      v-if="manage"
      depth="3"
      class="bili-reserve__hint"
    >
      开启后会把预约合并进周历展示和日历订阅，手填日程不会被覆盖。同步有延迟，可手动刷新。
    </NText>

    <NEmpty
      v-if="!upcoming.length"
      size="small"
      description="暂无即将开始的 B 站预约"
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
            <NIcon :component="Clock20Regular" />
            {{ formatBiliLiveReserveTime(item.planStart) }}
          </span>
          <strong>{{ item.title }}</strong>
          <em v-if="item.total > 0">{{ item.total }} 人预约</em>
        </a>
        <div v-else>
          <span class="bili-reserve__time">
            <NIcon :component="Clock20Regular" />
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
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius, 10px);
  background: var(--vtsuru-bg-elevated, var(--vtsuru-bg));
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
.bili-reserve__title :deep(.n-icon) {
  flex: none;
  margin-top: 2px;
  color: #fb7299;
}
.bili-reserve__title strong {
  display: block;
  font-size: 14px;
  font-weight: 650;
}
.bili-reserve__title p,
.bili-reserve__hint {
  margin: 2px 0 0;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
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
  border-radius: 8px;
  background: var(--vtsuru-bg-muted, color-mix(in srgb, var(--vtsuru-fg) 4%, transparent));
  color: inherit;
  text-decoration: none;
}
.bili-reserve__list strong {
  min-width: 0;
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bili-reserve__list em {
  flex: none;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
  font-style: normal;
}
.bili-reserve__time {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #fb7299;
  font-size: 12px;
  font-weight: 650;
  white-space: nowrap;
}

@media (max-width: 640px) {
  .bili-reserve__head,
  .bili-reserve__actions {
    flex-wrap: wrap;
  }
  .bili-reserve__list a,
  .bili-reserve__list div {
    grid-template-columns: minmax(0, 1fr);
    gap: 4px;
  }
}
</style>
