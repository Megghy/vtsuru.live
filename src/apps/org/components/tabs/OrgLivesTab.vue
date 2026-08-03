<script setup lang="ts">
import { computed, onMounted } from 'vue'

import { injectOrgLives } from '../../composables/useOrgLives'
import { injectOrgStreamers } from '../../composables/useOrgStreamers'
import { exportCsv, withImageSize } from '../../utils'

const { loading, view, streamerFilter, sortKey, search, load } = injectOrgLives()
const { options } = injectOrgStreamers()
const streamerOptions = computed(() => [{ label: '全部主播', value: 0 }, ...options.value])
const sortOptions = [
  { label: '按时间', value: 'startAt' },
  { label: '按营收', value: 'income' },
  { label: '按互动', value: 'interaction' },
  { label: '按弹幕', value: 'danmaku' },
]
const formatTime = (timestamp: number, options?: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(
    'zh-CN',
    options ?? { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' },
  ).format(timestamp)
function exportLives() {
  exportCsv(
    `直播记录_${Date.now()}.csv`,
    ['主播', '标题', '分区', '开始时间', '营收', '互动', '弹幕', '点赞'],
    view.value.map(({ streamer, live }) => [
      streamer.name,
      live.title,
      `${live.parentArea}/${live.area}`,
      formatTime(live.startAt),
      live.totalIncomeWithGuard.toFixed(2),
      live.interactionCount,
      live.danmakusCount,
      live.likeCount,
    ]),
  )
}
onMounted(() => load())
</script>

<template>
  <div class="lives-tab">
    <div class="toolbar">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="搜索标题/主播"
        class="toolbar__search"
      /><USelectMenu
        v-model="streamerFilter"
        :items="streamerOptions"
        value-key="value"
        class="toolbar__select"
      /><USelectMenu
        v-model="sortKey"
        :items="sortOptions"
        value-key="value"
        class="toolbar__select"
      /><UButton
        color="neutral"
        variant="soft"
        size="sm"
        icon="i-lucide-download"
        :disabled="!view.length"
        @click="exportLives"
        >导出 CSV</UButton
      ><span>共 {{ view.length }} 场</span>
    </div>
    <div
      v-if="loading"
      class="loading-state"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="size-5 animate-spin"
      />
    </div>
    <UEmpty
      v-else-if="!view.length"
      icon="i-lucide-radio-tower"
      description="暂无直播记录"
    />
    <div
      v-else
      class="live-grid"
    >
      <UCard
        v-for="item in view"
        :key="item.live.liveId"
        class="live-card"
        :ui="{ body: 'p-0 sm:p-0', footer: 'p-3' }"
      >
        <div class="live-cover">
          <img
            v-if="item.live.coverUrl"
            :src="withImageSize(item.live.coverUrl, '@140h')"
            :alt="item.live.title"
            referrerpolicy="no-referrer"
          /><UIcon
            v-else
            name="i-lucide-image-off"
            class="size-12"
          />
          <div class="live-badge">
            <UBadge
              :color="item.live.isFinish ? 'neutral' : 'success'"
              variant="solid"
              size="xs"
              >{{ item.live.isFinish ? '已结束' : 'LIVE' }}</UBadge
            >
          </div>
          <div class="live-streamer">
            <UAvatar
              v-if="item.streamer.faceUrl"
              :src="withImageSize(item.streamer.faceUrl, '@20w')"
              size="2xs"
            />{{ item.streamer.name }}
          </div>
        </div>
        <div class="live-body">
          <UTooltip :text="item.live.title"
            ><p class="live-title">{{ item.live.title }}</p></UTooltip
          >
          <div class="live-meta">
            <div>{{ item.live.parentArea }} / {{ item.live.area }}</div>
            <div>
              {{ formatTime(item.live.startAt) }} -
              {{ item.live.stopAt ? formatTime(item.live.stopAt, { hour: '2-digit', minute: '2-digit' }) : 'Now' }}
            </div>
          </div>
        </div>
        <template #footer
          ><div class="live-stats">
            <span title="营收"><UIcon name="i-lucide-wallet" /> {{ item.live.totalIncomeWithGuard.toFixed(0) }}</span
            ><span title="互动"><UIcon name="i-lucide-users" /> {{ item.live.interactionCount }}</span
            ><span title="弹幕"><UIcon name="i-lucide-message-circle" /> {{ item.live.danmakusCount }}</span>
          </div></template
        >
      </UCard>
    </div>
  </div>
</template>

<style scoped>
.lives-tab {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.toolbar__search {
  width: 200px;
}
.toolbar__select {
  width: 150px;
}
.toolbar > span {
  color: var(--vtsuru-fg-muted);
  font-size: 0.75rem;
}
.loading-state {
  display: flex;
  min-height: 180px;
  align-items: center;
  justify-content: center;
}
.live-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}
.live-card {
  overflow: hidden;
}
.live-cover {
  position: relative;
  display: grid;
  height: 140px;
  place-items: center;
  background: var(--vtsuru-bg-muted);
  color: var(--vtsuru-fg-muted);
}
.live-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.live-badge {
  position: absolute;
  top: 8px;
  right: 8px;
}
.live-streamer {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
  color: #fff;
  font-size: 0.75rem;
}
.live-body {
  padding: 12px;
}
.live-title {
  display: -webkit-box;
  min-height: 44px;
  margin: 0 0 6px;
  overflow: hidden;
  font-weight: 600;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.live-meta {
  color: var(--vtsuru-fg-muted);
  font-size: 0.75rem;
}
.live-stats {
  display: flex;
  justify-content: space-between;
  color: var(--vtsuru-fg-muted);
  font-size: 0.8125rem;
}
.live-stats span {
  display: flex;
  align-items: center;
  gap: 4px;
}
@media (max-width: 600px) {
  .toolbar__search,
  .toolbar__select {
    width: 100%;
  }
}
</style>
