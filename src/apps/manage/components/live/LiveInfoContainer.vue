<script setup lang="ts">
import type { ResponseLiveInfoModel } from '@/api/api-models'
import {
  Info24Filled,
  Chat24Regular,
  HandRight24Regular,
  Money24Regular
} from '@vicons/fluent'
import {
  NIcon,
  NNumberAnimation,
  NPopover,
  NSpace,
  NTag,
  NTime,
  NTooltip,
  NText,
} from 'naive-ui'
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps<{
  live: ResponseLiveInfoModel
}>()
const router = useRouter()

const defaultDanmakusCount = ref(0)
function OnClickCover() {
  router.push({
    name: 'manage-liveDetail',
    params: { id: props.live.liveId },
  })
}
const guartPriceStartData = new Date(Date.UTC(2024, 2, 24, 10, 0, 0))

watch(
  () => props.live,
  (newValue) => {
    defaultDanmakusCount.value = newValue.danmakusCount
  },
  { immediate: true }
)
</script>

<template>
  <div class="live-info-container">
    <!-- Cover Image -->
    <div class="cover-wrapper" @click.stop="OnClickCover">
      <img
        referrerpolicy="no-referrer" class="live-cover" :class="[{ 'is-live': !live.isFinish }]"
        :src="`${live.coverUrl}@200w`" loading="lazy"
      >
      <div v-if="!live.isFinish" class="live-badge">
        LIVE
      </div>
    </div>

    <!-- Main Content -->
    <div class="content-wrapper">
      <div class="info-section">
        <!-- Title -->
        <div class="title-row" @click.stop="OnClickCover">
          <NText class="live-title">
            {{ live.title }}
          </NText>
        </div>

        <!-- Meta Data -->
        <div class="meta-row">
          <NSpace align="center" size="small" wrap>
            <NTag v-if="!live.isFinish" size="small" :bordered="false" type="success" class="status-tag">
              直播中
            </NTag>
            <NTag v-else size="small" :bordered="false" disabled>
              已结束
            </NTag>

            <span class="meta-divider">|</span>

            <span class="meta-text">{{ live.parentArea }} / {{ live.area }}</span>

            <span class="meta-divider">|</span>

            <NPopover trigger="hover">
              <template #trigger>
                <span class="meta-text">
                  <NTime :time="live.startAt" format="yyyy-MM-dd HH:mm" />
                </span>
              </template>
              <div v-if="live.isFinish">
                结束于:
                <NTime :time="live.stopAt ?? 0" />
                <br>
                时长: {{ (((live.stopAt ?? 0) - (live.startAt ?? 0)) / (3600 * 1000)).toFixed(1) }} 小时
              </div>
              <div v-else>
                已直播: {{ ((Date.now() - (live.startAt ?? 0)) / (3600 * 1000)).toFixed(1) }} 小时
              </div>
            </NPopover>
          </NSpace>
        </div>
      </div>

      <!-- Statistics -->
      <div class="stats-section">
        <div class="stat-item">
          <span class="stat-label">
            <NIcon :component="Chat24Regular" depth="3" size="14" style="margin-right: 4px; vertical-align: -2px;" />
            弹幕
          </span>
          <span class="stat-value">
            <NNumberAnimation :from="defaultDanmakusCount" :to="live.danmakusCount" show-separator />
          </span>
        </div>

        <div class="stat-item">
          <span class="stat-label">
            <NIcon
              :component="HandRight24Regular" depth="3" size="14"
              style="margin-right: 4px; vertical-align: -2px;"
            />
            互动
          </span>
          <span class="stat-value">
            <NNumberAnimation :from="0" :to="live.interactionCount" show-separator />
          </span>
        </div>

        <div class="stat-item income">
          <span class="stat-label">
            <NIcon :component="Money24Regular" depth="3" size="14" style="margin-right: 4px; vertical-align: -2px;" />
            收益
            <NTooltip v-if="new Date(live.startAt) < guartPriceStartData">
              <template #trigger>
                <NIcon :component="Info24Filled" style="vertical-align: middle; cursor: help;" />
              </template>
              因为官方并没有提供上舰的价格, 所以记录中的舰长价格一律按照打折价格计算
              <br>
              即舰长 138, 提督 1598, 总督 15998
              <br>
              把鼠标放在下面的价格上就可以查看排除舰长后的收益
            </NTooltip>
          </span>
          <NTooltip>
            <template #trigger>
              <span class="stat-value income-value">
                ¥
                <NNumberAnimation
                  :from="0"
                  :to="new Date(live.startAt) < guartPriceStartData ? live.totalIncomeWithGuard : live.totalIncome"
                  show-separator :precision="1"
                />
              </span>
            </template>
            纯收益: ¥{{ live.totalIncome }}
          </NTooltip>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.live-info-container {
  display: flex;
  gap: 12px;
  width: 100%;
}

.cover-wrapper {
  position: relative;
  flex-shrink: 0;
  width: 140px;
  /* 16:9 approx height 78px */
  aspect-ratio: 16 / 9;
  border-radius: var(--n-border-radius);
  overflow: hidden;
  cursor: pointer;
  background-color: var(--n-color-embedded);
  border: 1px solid var(--n-border-color);
}

.live-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.live-badge {
  position: absolute;
  top: 4px;
  left: 4px;
  background-color: var(--n-error-color);
  color: white;
  font-size: 10px;
  font-weight: bold;
  padding: 1px 5px;
  border-radius: 999px;
  z-index: 2;
}

.content-wrapper {
  flex: 1;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  /* prevent flex item overflow */
}

.info-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-width: 0;
  padding-top: 2px;
  padding-bottom: 2px;
}

.title-row {
  cursor: pointer;
  margin-bottom: 0;
}

.live-title {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  transition: color 0.2s;
}

.title-row:hover .live-title {
  color: var(--n-primary-color);
}

.meta-row {
  margin-top: 2px;
}

.meta-text {
  font-size: 11px;
  color: var(--n-text-color-3);
}

.meta-divider {
  color: var(--n-text-color-3);
  opacity: 0.7;
  font-size: 11px;
  margin: 0 2px;
}

.stats-section {
  display: flex;
  gap: 14px;
  align-items: center;
  padding: 8px 10px;
  border: 1px solid var(--n-border-color);
  border-radius: var(--n-border-radius);
  background-color: var(--n-color-embedded);
  flex-shrink: 0;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  min-width: 60px;
}

.stat-label {
  font-size: 11px;
  color: var(--n-text-color-3);
  margin-bottom: 2px;
  display: flex;
  align-items: center;
}

.stat-value {
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.5px;
}

.stat-value.income-value {
  color: var(--n-success-color);
}

/* Mobile / Tablet Responsive */
@media (max-width: 768px) {
  .live-info-container {
    flex-direction: column;
    gap: 12px;
  }

  .cover-wrapper {
    width: 100%;
    max-width: 320px;
    /* Limit max width on phone */
    margin: 0 auto;
    /* Center cover if column */
  }

  .content-wrapper {
    flex-direction: column;
    gap: 8px;
  }

  .info-section {
    gap: 8px;
  }

  .stats-section {
    width: 100%;
    justify-content: space-around;
    gap: 12px;
  }

  .stat-item {
    align-items: center;
  }
}
</style>
