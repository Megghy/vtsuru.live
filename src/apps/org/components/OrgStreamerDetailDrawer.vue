<script setup lang="ts">
import { watch } from 'vue'

import { useOrgContext } from '../composables/useOrgContext'
import type { useStreamerDetail } from '../composables/useOrgStreamers'
import { DEFAULT_COVER, formatDate, streamerStatusLabel, streamerStatusTagType } from '../utils'
import OrgUserAvatar from './OrgUserAvatar.vue'

const props = defineProps<{ detail: ReturnType<typeof useStreamerDetail> }>()
const emit = defineEmits<{ saved: [] }>()
const { isOrgAdmin } = useOrgContext()
const detail = props.detail
const statusOptions = [
  { label: 'Active', value: 1 },
  { label: 'Removed', value: 3 },
]
const formatTime = (
  timestamp: number,
  format: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' },
) => new Intl.DateTimeFormat('zh-CN', format).format(timestamp)

watch([() => detail.show.value, () => detail.selectedId.value], ([show, id]) => {
  if (show && id) detail.load(true)
})
</script>

<template>
  <USlideover
    v-model:open="detail.show.value"
    side="right"
    :ui="{ content: 'max-w-[92vw] sm:max-w-xl' }"
  >
    <template #header>
      <div class="drawer-header">
        <OrgUserAvatar
          :face-url="detail.detail.value?.streamer.faceUrl"
          :size="40"
        />
        <div class="min-w-0">
          <strong>{{
            detail.detail.value?.streamer.name ||
            (detail.selectedId.value ? `ID: ${detail.selectedId.value}` : '主播详情')
          }}</strong>
          <p>ID: {{ detail.detail.value?.streamer.id || detail.selectedId.value || '-' }}</p>
        </div>
        <UBadge
          v-if="detail.detail.value"
          :color="
            streamerStatusTagType(detail.detail.value.status) === 'default'
              ? 'neutral'
              : streamerStatusTagType(detail.detail.value.status)
          "
          variant="soft"
          class="ml-auto"
          >{{ streamerStatusLabel(detail.detail.value.status) }}</UBadge
        >
      </div>
    </template>
    <template #body>
      <div
        v-if="detail.loading.value"
        class="loading-state"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="size-5 animate-spin"
        />
      </div>
      <UEmpty
        v-else-if="!detail.detail.value"
        icon="i-lucide-user-round-x"
        description="暂无数据"
      />
      <div
        v-else
        class="drawer-body"
      >
        <div class="summary-grid">
          <UCard
            ><div class="summary-card">
              <span>总收入</span><strong>¥{{ detail.detail.value.summary.totalIncomeWithGuard.toFixed(2) }}</strong>
            </div></UCard
          >
          <UCard
            ><div class="summary-card">
              <span>直播时长</span><strong>{{ detail.detail.value.summary.totalLiveMinutes }}<small>min</small></strong>
            </div></UCard
          >
          <UCard
            ><div class="summary-card">
              <span>互动</span><strong>{{ detail.detail.value.summary.totalInteractionCount }}</strong>
            </div></UCard
          >
          <UCard
            ><div class="summary-card">
              <span>弹幕</span><strong>{{ detail.detail.value.summary.totalDanmakuCount }}</strong>
            </div></UCard
          >
        </div>

        <UCard
          ><template #header><h2>直播时间热力图</h2></template
          ><UEmpty
            v-if="!detail.detail.value.heatmap.length"
            icon="i-lucide-calendar-x"
            description="暂无时间数据"
          />
          <div
            v-else
            class="heatmap"
          >
            <div
              v-for="item in detail.detail.value.heatmap"
              :key="item.timestamp"
              :title="`${formatDate(item.timestamp)}：${item.value} min`"
              :style="{ opacity: Math.max(0.2, Math.min(1, item.value / 240)) }"
            >
              <time>{{ formatDate(item.timestamp).slice(5) }}</time
              ><strong>{{ item.value }}</strong>
            </div>
          </div></UCard
        >

        <UCard v-if="isOrgAdmin"
          ><template #header><h2>主播设置</h2></template>
          <div class="settings-form">
            <UFormField label="状态"
              ><USelectMenu
                v-model="detail.editStatus.value"
                :items="statusOptions"
                value-key="value" /></UFormField
            ><UFormField label="备注"
              ><UTextarea
                v-model="detail.editNote.value"
                :rows="3"
                placeholder="仅组织管理员可见" /></UFormField
            ><UButton
              :loading="detail.saving.value"
              @click="detail.save(() => emit('saved'))"
              >保存</UButton
            >
          </div></UCard
        >

        <UCard
          ><template #header><h2>直播记录</h2></template
          ><UEmpty
            v-if="!detail.lives.value.length"
            icon="i-lucide-radio-tower"
            description="暂无直播记录"
          />
          <div
            v-else
            class="live-list"
          >
            <article
              v-for="live in detail.lives.value"
              :key="live.liveId"
              class="live-item"
            >
              <img
                :src="live.coverUrl || DEFAULT_COVER"
                :alt="live.title"
                referrerpolicy="no-referrer"
              />
              <div class="min-w-0 flex-1">
                <strong>{{ live.title }}</strong>
                <p>
                  <UIcon name="i-lucide-clock-3" /> {{ formatTime(live.startAt)
                  }}<template v-if="live.stopAt">
                    - {{ formatTime(live.stopAt, { hour: '2-digit', minute: '2-digit' }) }}</template
                  >
                </p>
                <div class="live-stats">
                  <span><UIcon name="i-lucide-wallet" /> {{ live.totalIncomeWithGuard.toFixed(0) }}</span
                  ><span><UIcon name="i-lucide-users" /> {{ live.interactionCount }}</span
                  ><span><UIcon name="i-lucide-message-circle" /> {{ live.danmakusCount }}</span>
                </div>
              </div>
            </article>
          </div>
          <div
            v-if="detail.hasMore.value"
            class="mt-3 flex justify-center"
          >
            <UButton
              color="neutral"
              variant="soft"
              :loading="detail.loading.value"
              @click="detail.loadMore"
              >加载更多</UButton
            >
          </div></UCard
        >
      </div>
    </template>
  </USlideover>
</template>

<style scoped>
.drawer-header {
  display: flex;
  align-items: center;
  gap: 10px;
}
.drawer-header p {
  margin: 2px 0 0;
  color: var(--vtsuru-fg-muted);
  font-size: 0.75rem;
}
.drawer-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.loading-state {
  display: flex;
  min-height: 200px;
  align-items: center;
  justify-content: center;
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.summary-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.summary-card span,
.live-item p {
  color: var(--vtsuru-fg-muted);
  font-size: 0.75rem;
}
.summary-card strong {
  font-size: 1.25rem;
}
.summary-card small {
  margin-left: 4px;
  font-size: 0.75rem;
  font-weight: 400;
}
.drawer-body h2 {
  margin: 0;
  font-size: 1rem;
}
.heatmap {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
}
.heatmap div {
  display: flex;
  min-height: 42px;
  flex-direction: column;
  justify-content: center;
  padding: 4px;
  border-radius: 4px;
  background: var(--vtsuru-primary);
  color: #fff;
  text-align: center;
  font-size: 0.625rem;
}
.heatmap strong {
  font-size: 0.75rem;
}
.settings-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.live-list {
  display: flex;
  flex-direction: column;
}
.live-item {
  display: flex;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--vtsuru-border);
}
.live-item:last-child {
  border-bottom: 0;
}
.live-item img {
  width: 96px;
  height: 54px;
  flex: 0 0 auto;
  border-radius: var(--vtsuru-radius);
  object-fit: cover;
}
.live-item strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.live-item p {
  margin: 5px 0;
}
.live-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  color: var(--vtsuru-fg-muted);
  font-size: 0.75rem;
}
.live-stats span {
  display: flex;
  align-items: center;
  gap: 3px;
}
</style>
