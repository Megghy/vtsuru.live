<script setup lang="ts">
import { computed } from 'vue'

import type { VoteOBSData, VoteOptionDto } from '@/api/api-models'

const props = withDefaults(
  defineProps<{
    data: VoteOBSData | null
    theme?: string
    position?: string
    maxDisplay?: number
    currentTimeMs?: number
  }>(),
  {
    theme: 'glass',
    position: 'bottom-right',
    maxDisplay: 6,
    currentTimeMs: () => Date.now(),
  },
)

// 当前主题
const activeTheme = computed(() => {
  if (props.theme && ['glass', 'duel', 'minimal', 'transparent'].includes(props.theme)) {
    return props.theme
  }
  return props.data?.theme || 'glass'
})

// 倒计时计算
const timeLeftMs = computed(() => {
  if (!props.data?.endTime) return null
  const remain = props.data.endTime * 1000 - props.currentTimeMs
  return Math.max(0, remain)
})

const isUrgent = computed(() => {
  if (timeLeftMs.value === null || !props.data?.isActive) return false
  return timeLeftMs.value > 0 && timeLeftMs.value <= 10000 // 最后 10 秒进入紧急呼吸状态
})

function formatTime(ms: number | null | undefined): string {
  if (ms == null) return ''
  const total = Math.ceil(ms / 1000)
  const mm = Math.floor(total / 60).toString().padStart(2, '0')
  const ss = (total % 60).toString().padStart(2, '0')
  return `${mm}:${ss}`
}

// 选项排序（支持 FLIP 动态赛跑平滑换位）
const sortedOptions = computed<VoteOptionDto[]>(() => {
  if (!props.data?.options?.length) return []
  return [...props.data.options].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    return a.index - b.index
  })
})

const displayedOptions = computed<VoteOptionDto[]>(() => {
  if (sortedOptions.value.length <= props.maxDisplay) {
    return sortedOptions.value
  }
  return sortedOptions.value.slice(0, props.maxDisplay)
})

const remainingOptionsCount = computed(() => {
  return Math.max(0, (props.data?.options?.length || 0) - props.maxDisplay)
})

const remainingOptionsVotes = computed(() => {
  if (remainingOptionsCount.value <= 0) return 0
  const hidden = sortedOptions.value.slice(props.maxDisplay)
  return hidden.reduce((sum, item) => sum + item.count, 0)
})

// 是否为 2 项红蓝对决模式
const isDuelMode = computed(() => {
  return activeTheme.value === 'duel' && (props.data?.options?.length ?? 0) === 2
})

// 顶端长条 HUD 模式 (当处于红蓝对决且停靠在顶部时，或者专门使用长条展示)
const isDuelTopBanner = computed(() => {
  return isDuelMode.value && props.position.startsWith('top')
})

const duelLeftOption = computed(() => props.data?.options?.[0] || null)
const duelRightOption = computed(() => props.data?.options?.[1] || null)
const duelLeftPercent = computed(() => {
  if (!props.data || props.data.totalVotes <= 0) return 50
  const lCount = duelLeftOption.value?.count || 0
  const rCount = duelRightOption.value?.count || 0
  if (lCount + rCount === 0) return 50
  return Math.round((lCount / (lCount + rCount)) * 100)
})
</script>

<template>
  <div
    class="danmaku-vote-card-root"
    :class="[`pos-${props.position}`, { 'is-duel-banner-root': isDuelTopBanner }]"
  >
    <Transition name="vote-pop" mode="out-in">
      <!-- 样式分支 1：红蓝对决顶端贯通长条 HUD (Top Duel Banner) -->
      <div
        v-if="props.data && isDuelTopBanner && duelLeftOption && duelRightOption"
        :key="props.data.sessionId + '_duel_banner_' + (props.data.isEnding ? 'ended' : 'active')"
        class="duel-top-banner"
        :class="{
          'is-urgent': isUrgent,
          'is-ended': props.data.isEnding,
        }"
      >
        <!-- 顶栏微标行：主题标题与居中时间 -->
        <div class="banner-top-bar">
          <div class="banner-title-pill">
            <span class="pulse-dot" :class="{ ending: props.data.isEnding }"></span>
            <span class="banner-title">{{ props.data.title }}</span>
          </div>

          <div class="banner-center-status">
            <span v-if="props.data.isEnding" class="banner-badge-ended">已结算</span>
            <span v-else-if="timeLeftMs !== null" class="banner-badge-timer" :class="{ urgent: isUrgent }">
              ⏱️ {{ formatTime(timeLeftMs) }}
            </span>
          </div>

          <div class="banner-total-votes">
            总投：<strong>{{ props.data.totalVotes }}</strong> 票
          </div>
        </div>

        <!-- 选手对决主区域 -->
        <div class="banner-duel-main">
          <!-- 红方战队 (左侧) -->
          <div class="banner-side left" :class="{ winner: props.data.isEnding && duelLeftPercent >= 50 }">
            <div class="side-info-left">
              <span class="side-tag">1.</span>
              <span class="side-name" :title="duelLeftOption.text">{{ duelLeftOption.text }}</span>
              <span v-if="props.data.isEnding && duelLeftPercent >= 50" class="winner-pill">👑 胜出</span>
            </div>
            <div class="side-stats-left">
              <span class="side-votes">{{ duelLeftOption.count }} 票</span>
              <span class="side-percent">{{ duelLeftPercent }}%</span>
            </div>
          </div>

          <!-- 居中能量 VS 徽章 -->
          <div class="banner-vs-wrap">
            <div class="banner-vs-badge" :class="{ urgent: isUrgent }">
              <span class="vs-fire">⚔️</span>
              <span class="vs-text">VS</span>
            </div>
          </div>

          <!-- 蓝方战队 (右侧) -->
          <div class="banner-side right" :class="{ winner: props.data.isEnding && duelLeftPercent < 50 }">
            <div class="side-stats-right">
              <span class="side-percent">{{ 100 - duelLeftPercent }}%</span>
              <span class="side-votes">{{ duelRightOption.count }} 票</span>
            </div>
            <div class="side-info-right">
              <span v-if="props.data.isEnding && duelLeftPercent < 50" class="winner-pill">👑 胜出</span>
              <span class="side-name" :title="duelRightOption.text">{{ duelRightOption.text }}</span>
              <span class="side-tag">2.</span>
            </div>
          </div>
        </div>

        <!-- 贯通拔河能量长槽 (斜切竞技感) -->
        <div class="banner-track-container">
          <div class="banner-track">
            <div
              class="banner-fill-left"
              :style="{ width: `${duelLeftPercent}%` }"
              :class="{ winner: props.data.isEnding && duelLeftPercent >= 50 }"
            >
              <div class="fill-spark"></div>
            </div>
            <div
              class="banner-fill-right"
              :style="{ width: `${100 - duelLeftPercent}%` }"
              :class="{ winner: props.data.isEnding && duelLeftPercent < 50 }"
            >
              <div class="fill-spark"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- 样式分支 2：标准卡片 / 无背景通透款 / 紧凑对决卡片 -->
      <div
        v-else-if="props.data"
        :key="props.data.sessionId + '_' + (props.data.isEnding ? 'ended' : 'active')"
        class="danmaku-vote-card"
        :class="[
          `theme-${activeTheme}`,
          {
            'is-urgent': isUrgent,
            'is-ended': props.data.isEnding,
            'rounded-box': props.data.roundedCorners,
          },
        ]"
      >
        <!-- 头部：标题与倒计时/状态标签 -->
        <header class="vote-header">
          <div class="header-left">
            <span class="status-indicator" :class="{ ending: props.data.isEnding }"></span>
            <h1 class="vote-title">{{ props.data.title }}</h1>
          </div>

          <div class="header-right">
            <span v-if="props.data.isEnding" class="badge-ended">已结束</span>
            <span v-else-if="timeLeftMs !== null" class="badge-timer" :class="{ urgent: isUrgent }">
              <svg class="timer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="9" stroke-width="2" />
                <path d="M12 7v5l3 3" stroke-width="2" stroke-linecap="round" />
              </svg>
              {{ formatTime(timeLeftMs) }}
            </span>
          </div>
        </header>

        <!-- 统计总票数 -->
        <div class="vote-sub-stats">
          <span class="total-label">总投票</span>
          <span class="total-value">{{ props.data.totalVotes }} 票</span>
          <span v-if="props.data.winnerOption && props.data.isEnding" class="winner-summary">
            🏆 胜出：<strong>{{ props.data.winnerOption }}</strong>
          </span>
        </div>

        <!-- 模式 A：红蓝对决紧凑条 (当处于非顶部的普通卡片内时) -->
        <div v-if="isDuelMode && duelLeftOption && duelRightOption" class="duel-bar-wrapper">
          <div class="duel-names">
            <div class="duel-player left">
              <span class="player-num">1.</span>
              <span class="player-name">{{ duelLeftOption.text }}</span>
              <span class="player-votes">{{ duelLeftOption.count }} 票 ({{ duelLeftPercent }}%)</span>
            </div>
            <div class="duel-vs-badge">VS</div>
            <div class="duel-player right">
              <span class="player-votes">{{ 100 - duelLeftPercent }}% ({{ duelRightOption.count }} 票)</span>
              <span class="player-name">{{ duelRightOption.text }}</span>
              <span class="player-num">2.</span>
            </div>
          </div>

          <div class="duel-track">
            <div
              class="duel-fill-left"
              :style="{ width: `${duelLeftPercent}%` }"
              :class="{ winner: props.data.isEnding && duelLeftPercent >= 50 }"
            ></div>
            <div
              class="duel-fill-right"
              :style="{ width: `${100 - duelLeftPercent}%` }"
              :class="{ winner: props.data.isEnding && duelLeftPercent < 50 }"
            ></div>
          </div>
        </div>

        <!-- 模式 B：标准多选项 / 动态排行榜模式 (带 FLIP 平滑赛跑换位) -->
        <div v-else class="options-list-wrapper">
          <TransitionGroup name="flip-list" tag="div" class="options-list">
            <div
              v-for="(opt, rankIdx) in displayedOptions"
              :key="opt.text"
              class="option-row"
              :class="{
                'is-leading': rankIdx === 0 && opt.count > 0 && !props.data.isEnding,
                'is-winner': props.data.isEnding && opt.text === props.data.winnerOption,
                'is-dimmed': props.data.isEnding && props.data.winnerOption && opt.text !== props.data.winnerOption,
              }"
            >
              <!-- 进度背景层 -->
              <div
                v-if="props.data.showResults"
                class="option-progress-bg"
                :style="{ width: `${opt.percentage}%` }"
              ></div>

              <!-- 内容信息层 -->
              <div class="option-content">
                <div class="option-left">
                  <!-- 排名奖牌徽章 -->
                  <span v-if="rankIdx === 0 && opt.count > 0" class="rank-badge rank-1">🥇</span>
                  <span v-else-if="rankIdx === 1 && opt.count > 0" class="rank-badge rank-2">🥈</span>
                  <span v-else-if="rankIdx === 2 && opt.count > 0" class="rank-badge rank-3">🥉</span>
                  <span v-else class="option-num">{{ opt.index }}</span>

                  <span class="option-text" :title="opt.text">{{ opt.text }}</span>

                  <span v-if="props.data.isEnding && opt.text === props.data.winnerOption" class="winner-crown">
                    👑 获胜
                  </span>
                  <span v-else-if="rankIdx === 0 && opt.count > 0 && !props.data.isEnding" class="leading-badge">
                    TOP 1
                  </span>
                </div>

                <div v-if="props.data.showResults" class="option-right">
                  <span class="option-count">{{ opt.count }} 票</span>
                  <span class="option-percentage">{{ opt.percentage }}%</span>
                </div>
              </div>
            </div>
          </TransitionGroup>

          <!-- 多选项折叠提示 -->
          <div v-if="remainingOptionsCount > 0" class="remaining-hint">
            <span>另有 {{ remainingOptionsCount }} 个候选项 (共 {{ remainingOptionsVotes }} 票)</span>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.danmaku-vote-card-root {
  width: 100%;
  height: 100%;
  display: flex;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
}

/* 位置变体 */
.pos-top-left { justify-content: flex-start; align-items: flex-start; }
.pos-top-center { justify-content: center; align-items: flex-start; }
.pos-top-right { justify-content: flex-end; align-items: flex-start; }
.pos-center-left { justify-content: flex-start; align-items: center; }
.pos-center { justify-content: center; align-items: center; }
.pos-center-right { justify-content: flex-end; align-items: center; }
.pos-bottom-left { justify-content: flex-start; align-items: flex-end; }
.pos-bottom-center { justify-content: center; align-items: flex-end; }
.pos-bottom-right { justify-content: flex-end; align-items: flex-end; }

/* 顶部长条 root 适配 */
.is-duel-banner-root {
  align-items: flex-start !important;
}

/* ========================================================================= */
/* 🌟 1. 顶部长条 HUD 样式 (Top Duel Banner)                                  */
/* ========================================================================= */
.duel-top-banner {
  width: 100%;
  max-width: 860px;
  margin: 0 auto;
  box-sizing: border-box;
  padding: 10px 16px 12px;
  background: rgba(10, 12, 20, 0.9);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-top: none;
  border-bottom-left-radius: 20px;
  border-bottom-right-radius: 20px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.7), 0 0 20px rgba(59, 130, 246, 0.15);
  color: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: all 0.4s ease;
}

.duel-top-banner.is-urgent {
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.8), 0 0 30px rgba(239, 68, 68, 0.4);
}

.banner-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
}

.banner-title-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.08);
  padding: 2px 10px;
  border-radius: 9999px;
  font-weight: 600;
  max-width: 35%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 6px #10b981;
  flex-shrink: 0;
  animation: pulse-dot-anim 1.5s infinite;
}

.pulse-dot.ending {
  background: #f59e0b;
  box-shadow: 0 0 6px #f59e0b;
  animation: none;
}

@keyframes pulse-dot-anim {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.85); }
}

.banner-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.banner-center-status {
  display: flex;
  align-items: center;
}

.banner-badge-timer {
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-weight: 800;
  font-size: 13px;
  padding: 2px 10px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.1);
  color: #e2e8f0;
}

.banner-badge-timer.urgent {
  background: rgba(239, 68, 68, 0.3);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.6);
  animation: urgent-pulse 1s infinite alternate ease-in-out;
}

.banner-badge-ended {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 10px;
  border-radius: 6px;
  background: rgba(245, 158, 11, 0.25);
  color: #fcd34d;
  border: 1px solid rgba(245, 158, 11, 0.5);
}

.banner-total-votes {
  color: rgba(255, 255, 255, 0.6);
  font-size: 11px;
}

.banner-total-votes strong {
  color: #ffffff;
  font-family: monospace;
}

/* 选手主区域 */
.banner-duel-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 4px;
}

.banner-side {
  flex: 1;
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 12px;
  transition: all 0.3s ease;
}

.banner-side.left {
  justify-content: space-between;
}

.banner-side.right {
  justify-content: space-between;
}

.side-info-left, .side-info-right {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.banner-side.left .side-tag {
  color: #60a5fa;
  font-weight: 900;
  font-size: 13px;
}

.banner-side.right .side-tag {
  color: #f87171;
  font-weight: 900;
  font-size: 13px;
}

.side-name {
  font-size: 15px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: -0.01em;
}

.banner-side.left .side-name { color: #93c5fd; }
.banner-side.right .side-name { color: #fca5a5; }

.side-stats-left {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-shrink: 0;
}

.side-stats-right {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-shrink: 0;
}

.side-votes {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  font-family: monospace;
}

.side-percent {
  font-size: 18px;
  font-weight: 900;
  font-family: ui-monospace, SFMono-Regular, monospace;
}

.banner-side.left .side-percent { color: #60a5fa; }
.banner-side.right .side-percent { color: #f87171; }

.winner-pill {
  font-size: 10px;
  font-weight: 800;
  padding: 1px 6px;
  border-radius: 4px;
  background: linear-gradient(90deg, #f59e0b, #ef4444);
  color: #ffffff;
  box-shadow: 0 0 10px rgba(245, 158, 11, 0.6);
  flex-shrink: 0;
}

/* VS 能量徽章 */
.banner-vs-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.banner-vs-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
  padding: 2px 10px;
  border-radius: 9999px;
  border: 1px solid rgba(251, 191, 36, 0.5);
  box-shadow: 0 0 12px rgba(251, 191, 36, 0.3);
}

.vs-fire { font-size: 12px; }
.vs-text {
  color: #fbbf24;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.1em;
}

/* 贯通拔河长条 */
.banner-track-container {
  width: 100%;
  padding: 0 2px;
}

.banner-track {
  height: 14px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 9999px;
  overflow: hidden;
  display: flex;
  border: 1px solid rgba(255, 255, 255, 0.15);
  transform: skewX(-12deg);
}

.banner-fill-left {
  height: 100%;
  background: linear-gradient(90deg, #2563eb, #60a5fa);
  transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  position: relative;
}

.banner-fill-right {
  height: 100%;
  background: linear-gradient(90deg, #f87171, #dc2626);
  transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  position: relative;
}

.banner-fill-left.winner {
  background: linear-gradient(90deg, #f59e0b, #fbbf24);
  box-shadow: 0 0 16px rgba(245, 158, 11, 0.8);
}

.banner-fill-right.winner {
  background: linear-gradient(90deg, #fbbf24, #f59e0b);
  box-shadow: 0 0 16px rgba(245, 158, 11, 0.8);
}

/* ========================================================================= */
/* 🌟 2. 标准卡片与主题容器                                                  */
/* ========================================================================= */
.danmaku-vote-card {
  width: 100%;
  max-width: 440px;
  box-sizing: border-box;
  padding: 16px 20px;
  color: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.4s ease;
  pointer-events: auto;
}

.danmaku-vote-card.rounded-box {
  border-radius: 20px;
}

/* ================= 主题预设 1: Modern Glass (毛玻璃) ================= */
.theme-glass {
  background: rgba(15, 23, 42, 0.88);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 16px 40px -8px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.2);
}

.theme-glass .option-row {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.theme-glass .option-progress-bg {
  background: linear-gradient(90deg, rgba(56, 189, 248, 0.35) 0%, rgba(99, 102, 241, 0.45) 100%);
}

.theme-glass .option-row.is-leading .option-progress-bg {
  background: linear-gradient(90deg, rgba(245, 158, 11, 0.45) 0%, rgba(239, 68, 68, 0.55) 100%);
}

/* ================= 主题预设 2: Duel VS (红蓝对决卡片款) ================= */
.theme-duel {
  background: rgba(10, 10, 15, 0.94);
  border: 1px solid rgba(99, 102, 241, 0.25);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7);
}

.duel-bar-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}

.duel-names {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 600;
}

.duel-player {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 42%;
}

.duel-player.left { color: #60a5fa; }
.duel-player.right { color: #f87171; text-align: right; }
.duel-player .player-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.duel-player .player-votes {
  font-size: 11px;
  opacity: 0.8;
  font-family: monospace;
}

.duel-vs-badge {
  background: #1e1b4b;
  color: #fbbf24;
  font-size: 11px;
  font-weight: 900;
  padding: 2px 8px;
  border-radius: 9999px;
  border: 1px solid rgba(251, 191, 36, 0.4);
  letter-spacing: 0.05em;
}

.duel-track {
  height: 20px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 9999px;
  overflow: hidden;
  display: flex;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.duel-fill-left {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #60a5fa);
  transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.duel-fill-right {
  height: 100%;
  background: linear-gradient(90deg, #f87171, #ef4444);
  transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.duel-fill-left.winner {
  background: linear-gradient(90deg, #fbbf24, #f59e0b);
  box-shadow: 0 0 16px rgba(245, 158, 11, 0.8);
}

.duel-fill-right.winner {
  background: linear-gradient(90deg, #fbbf24, #f59e0b);
  box-shadow: 0 0 16px rgba(245, 158, 11, 0.8);
}

/* ================= 主题预设 3: Minimal (极简通透) ================= */
.theme-minimal {
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.theme-minimal .option-row {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

/* ================= 🌟 主题预设 4: Transparent (纯透明无底壳，专为主播底图定制) ================= */
.theme-transparent {
  background: transparent !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  border: none !important;
  box-shadow: none !important;
  padding: 8px 12px;
}

.theme-transparent .vote-title {
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.9), 0 0 8px rgba(0, 0, 0, 0.6);
}

.theme-transparent .total-label,
.theme-transparent .total-value,
.theme-transparent .option-text,
.theme-transparent .option-count,
.theme-transparent .option-percentage,
.theme-transparent .option-num {
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.95), 0 0 6px rgba(0, 0, 0, 0.8);
}

.theme-transparent .option-row {
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
}

.theme-transparent .option-progress-bg {
  background: linear-gradient(90deg, rgba(14, 165, 233, 0.65) 0%, rgba(99, 102, 241, 0.75) 100%);
}

.theme-transparent .option-row.is-leading .option-progress-bg {
  background: linear-gradient(90deg, rgba(245, 158, 11, 0.75) 0%, rgba(239, 68, 68, 0.85) 100%);
}

.theme-transparent .duel-track {
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.25);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
}

/* ================= 头部组件 ================= */
.vote-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 8px #10b981;
  flex-shrink: 0;
  animation: pulse-dot 2s infinite ease-in-out;
}

.status-indicator.ending {
  background: #f59e0b;
  box-shadow: 0 0 8px #f59e0b;
  animation: none;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.85); }
}

.vote-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-right {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.badge-timer {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.1);
  color: #e2e8f0;
}

.badge-timer.urgent {
  background: rgba(239, 68, 68, 0.25);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.5);
  animation: urgent-pulse 1s infinite alternate ease-in-out;
}

@keyframes urgent-pulse {
  0% { transform: scale(1); box-shadow: 0 0 4px rgba(239, 68, 68, 0.4); }
  100% { transform: scale(1.06); box-shadow: 0 0 14px rgba(239, 68, 68, 0.8); }
}

.timer-icon {
  width: 14px;
  height: 14px;
}

.badge-ended {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 6px;
  background: rgba(245, 158, 11, 0.2);
  color: #fcd34d;
  border: 1px solid rgba(245, 158, 11, 0.4);
}

/* 总票数与胜出横条 */
.vote-sub-stats {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.65);
}

.total-value {
  font-weight: 700;
  color: #ffffff;
  font-family: ui-monospace, monospace;
}

.winner-summary {
  margin-left: auto;
  color: #fbbf24;
  font-size: 12px;
}

/* ================= 选项列表 ================= */
.options-list-wrapper {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option-row {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  height: 42px;
  display: flex;
  align-items: center;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.option-progress-bg {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  border-radius: 12px;
  transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  z-index: 1;
}

.option-content {
  position: relative;
  z-index: 2;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  gap: 12px;
}

.option-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.rank-badge {
  font-size: 14px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.option-num {
  font-size: 12px;
  font-weight: 800;
  opacity: 0.5;
  font-family: ui-monospace, monospace;
}

.option-text {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.leading-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(245, 158, 11, 0.25);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.4);
}

.winner-crown {
  font-size: 11px;
  font-weight: 800;
  padding: 1px 6px;
  border-radius: 4px;
  background: linear-gradient(90deg, #f59e0b, #ef4444);
  color: #ffffff;
  box-shadow: 0 0 10px rgba(245, 158, 11, 0.6);
}

.option-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.option-count {
  font-size: 12px;
  opacity: 0.8;
}

.option-percentage {
  font-size: 13px;
  font-weight: 800;
}

/* 胜出高亮与压暗动效 */
.option-row.is-winner {
  border-color: rgba(251, 191, 36, 0.6);
  box-shadow: 0 0 20px rgba(245, 158, 11, 0.4);
}

.option-row.is-winner .option-progress-bg {
  background: linear-gradient(90deg, rgba(245, 158, 11, 0.5) 0%, rgba(239, 68, 68, 0.6) 100%);
}

.option-row.is-dimmed {
  opacity: 0.4;
  filter: grayscale(40%);
}

.remaining-hint {
  text-align: center;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  padding: 4px 0 0;
}

/* FLIP 顺位实时平滑赛跑动画 */
.flip-list-move {
  transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.flip-list-enter-active,
.flip-list-leave-active {
  transition: all 0.4s ease;
}

.flip-list-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.flip-list-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}

/* ================= 进出场 Transition ================= */
.vote-pop-enter-active,
.vote-pop-leave-active {
  transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

.vote-pop-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
}

.vote-pop-leave-to {
  opacity: 0;
  transform: translateY(-16px) scale(0.95);
}
</style>
