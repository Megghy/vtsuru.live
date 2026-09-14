<script setup lang="ts">
import {
  Chat24Regular,
  Clock24Regular,
  HandRight24Regular,
  Info24Filled,
  Money24Regular,
  Open24Regular,
  Video24Regular,
} from '@vicons/fluent'
import { NFlex, NIcon, NNumberAnimation, NPopover, NTag, NText, NTime, NTooltip } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import type { ResponseLiveInfoModel } from '@/api/api-models'

const props = defineProps<{
  live: ResponseLiveInfoModel
  showActions?: boolean
}>()

const router = useRouter()
const defaultDanmakusCount = ref(0)
const coverError = ref(false)

const guartPriceStartData = new Date(Date.UTC(2024, 2, 24, 10, 0, 0))

watch(
  () => props.live,
  (newValue) => {
    defaultDanmakusCount.value = newValue.danmakusCount
    coverError.value = false
  },
  { immediate: true },
)

const durationText = computed(() => {
  const start = Number(props.live.startAt) || 0
  if (!start) return '-'
  const end = props.live.isFinish ? Number(props.live.stopAt) || start : Date.now()
  const diffMinutes = Math.max(0, Math.floor((end - start) / 60000))
  if (diffMinutes < 1) return '不足 1 分钟'
  const hours = Math.floor(diffMinutes / 60)
  const mins = diffMinutes % 60
  if (hours > 0) {
    return mins > 0 ? `${hours}小时${mins}分` : `${hours}小时`
  }
  return `${mins}分钟`
})

function onClickRow() {
  router.push({
    name: 'manage-liveDetail',
    params: { id: props.live.liveId },
  })
}
</script>

<template>
  <div
    class="live-info-container"
    @click="onClickRow"
  >
    <!-- 封面 -->
    <div class="cover-wrapper">
      <img
        v-if="live.coverUrl && !coverError"
        referrerpolicy="no-referrer"
        class="live-cover"
        :class="{ 'is-live': !live.isFinish }"
        :src="`${live.coverUrl}@240w_135h_1c.webp`"
        loading="lazy"
        alt="直播封面"
        @error="coverError = true"
      />
      <div
        v-else
        class="cover-placeholder"
      >
        <NIcon
          :component="Video24Regular"
          size="28"
          depth="3"
        />
      </div>

      <div
        v-if="!live.isFinish"
        class="live-badge"
      >
        <span class="pulse-dot" />
        LIVE
      </div>
    </div>

    <!-- 中间主体信息 -->
    <div class="content-wrapper">
      <div class="info-section">
        <div class="title-row">
          <NText
            class="live-title"
            :class="{ 'is-live-title': !live.isFinish }"
          >
            {{ live.title || '无标题直播' }}
          </NText>
        </div>

        <div class="meta-row">
          <NFlex
            align="center"
            :size="8"
            wrap
          >
            <NTag
              v-if="!live.isFinish"
              size="small"
              :bordered="false"
              type="error"
              class="status-tag"
            >
              直播中
            </NTag>
            <NTag
              v-else
              size="small"
              :bordered="false"
              class="status-tag-finished"
            >
              已结束
            </NTag>

            <span
              v-if="live.parentArea || live.area"
              class="area-badge"
            >
              {{ live.parentArea ? `${live.parentArea} / ` : '' }}{{ live.area }}
            </span>

            <span class="meta-item">
              <NIcon
                :component="Clock24Regular"
                size="13"
              />
              <NPopover trigger="hover">
                <template #trigger>
                  <span class="meta-time-text">
                    <NTime
                      :time="live.startAt"
                      format="yyyy-MM-dd HH:mm"
                    />
                  </span>
                </template>
                <div>
                  开播时间: <NTime :time="live.startAt" /><br />
                  <template v-if="live.isFinish">
                    停播时间: <NTime :time="live.stopAt ?? 0" /><br />
                  </template>
                  总计历时: {{ durationText }}
                </div>
              </NPopover>
            </span>

            <span class="duration-badge">
              {{ live.isFinish ? '时长 ' : '已播 ' }}{{ durationText }}
            </span>
          </NFlex>
        </div>
      </div>

      <!-- 右侧数据指标统计 -->
      <div class="stats-section">
        <div class="stat-item">
          <span class="stat-label">
            <NIcon
              :component="Chat24Regular"
              size="14"
            />
            弹幕
          </span>
          <span class="stat-value">
            <NNumberAnimation
              :from="defaultDanmakusCount"
              :to="live.danmakusCount"
              show-separator
            />
          </span>
        </div>

        <div class="stat-item">
          <span class="stat-label">
            <NIcon
              :component="HandRight24Regular"
              size="14"
            />
            互动
          </span>
          <span class="stat-value">
            <NNumberAnimation
              :from="0"
              :to="live.interactionCount"
              show-separator
            />
          </span>
        </div>

        <div class="stat-item income">
          <span class="stat-label">
            <NIcon
              :component="Money24Regular"
              size="14"
            />
            收益
            <NTooltip v-if="new Date(live.startAt) < guartPriceStartData">
              <template #trigger>
                <NIcon
                  :component="Info24Filled"
                  style="cursor: help"
                />
              </template>
              该场直播时间早于官方价格调整，舰长价格按照打折折算（舰长 138，提督 1598，总督 15998）。
            </NTooltip>
          </span>
          <span class="stat-value income-value">
            <span class="currency-symbol">¥</span>
            <NNumberAnimation
              :from="0"
              :to="new Date(live.startAt) < guartPriceStartData ? live.totalIncomeWithGuard : live.totalIncome"
              show-separator
              :precision="1"
            />
          </span>
        </div>

        <div
          v-if="showActions !== false"
          class="arrow-action"
          title="查看复盘与弹幕"
        >
          <NIcon
            :component="Open24Regular"
            size="16"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.live-info-container {
  display: flex;
  gap: 16px;
  width: 100%;
  align-items: center;
  cursor: pointer;
  padding: 4px 0;
  transition: opacity 0.2s ease;
}

.live-info-container:hover .live-title {
  color: var(--vtsuru-brand);
}

.live-info-container:hover .arrow-action {
  color: var(--vtsuru-brand);
  transform: translateX(2px);
}

.cover-wrapper {
  position: relative;
  flex-shrink: 0;
  width: 136px;
  aspect-ratio: 16 / 9;
  border-radius: var(--vtsuru-radius);
  overflow: hidden;
  background-color: var(--vtsuru-bg-muted);
  border: 1px solid var(--vtsuru-border);
}

.live-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--vtsuru-fg-muted);
}

.live-badge {
  position: absolute;
  top: 4px;
  left: 4px;
  background-color: #ef4444;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  gap: 4px;
  letter-spacing: 0.5px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.pulse-dot {
  width: 5px;
  height: 5px;
  background: #fff;
  border-radius: 50%;
  animation: live-pulse 1.4s ease-in-out infinite;
}

@keyframes live-pulse {
  0% {
    transform: scale(0.9);
    opacity: 0.8;
  }
  50% {
    transform: scale(1.3);
    opacity: 1;
  }
  100% {
    transform: scale(0.9);
    opacity: 0.8;
  }
}

.content-wrapper {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  min-width: 0;
}

.info-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.title-row {
  margin: 0;
}

.live-title {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  transition: color 0.2s ease;
}

.is-live-title {
  color: var(--vtsuru-brand);
}

.meta-row {
  font-size: 12px;
  color: var(--vtsuru-fg-muted);
}

.status-tag {
  font-weight: 600;
}

.status-tag-finished {
  background-color: var(--vtsuru-bg-muted);
  color: var(--vtsuru-fg-muted);
}

.area-badge {
  font-size: 12px;
  color: var(--vtsuru-fg-muted);
  background: var(--vtsuru-bg-muted);
  padding: 1px 6px;
  border-radius: 4px;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.meta-time-text {
  font-variant-numeric: tabular-nums;
}

.duration-badge {
  font-size: 11px;
  color: var(--vtsuru-fg-muted);
  background: var(--vtsuru-card);
  border: 1px solid var(--vtsuru-border);
  padding: 1px 6px;
  border-radius: 4px;
  font-variant-numeric: tabular-nums;
}

.stats-section {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  background-color: var(--vtsuru-bg-muted);
  padding: 8px 14px;
  border-radius: var(--vtsuru-radius);
  border: 1px solid var(--vtsuru-border);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  min-width: 58px;
}

.stat-label {
  font-size: 11px;
  color: var(--vtsuru-fg-muted);
  display: flex;
  align-items: center;
  gap: 3px;
  line-height: 1;
}

.stat-value {
  font-size: 15px;
  font-weight: 700;
  color: var(--vtsuru-fg);
  font-variant-numeric: tabular-nums;
  margin-top: 4px;
  line-height: 1;
}

.income .income-value {
  color: #10b981;
}

.currency-symbol {
  font-size: 11px;
  margin-right: 1px;
  font-weight: normal;
}

.arrow-action {
  color: var(--vtsuru-fg-muted);
  margin-left: 4px;
  display: flex;
  align-items: center;
  transition: all 0.2s ease;
}

@media (max-width: 768px) {
  .live-info-container {
    flex-direction: column;
    align-items: flex-start;
  }
  .cover-wrapper {
    width: 100%;
    max-width: 240px;
  }
  .content-wrapper {
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
  }
  .stats-section {
    width: 100%;
    justify-content: space-around;
  }
}
</style>
