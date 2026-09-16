<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Vue3Marquee } from 'vue3-marquee'

import { OpenLiveLotteryType, type UpdateLiveLotteryUsersModel } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import {
  DEFAULT_LOTTERY_AVATAR,
  formatLotteryAvatar,
  type LotteryObsMode,
  type LotteryObsStyle,
} from '@/apps/open-live/components/lottery/lotteryUtils'
import { LOTTERY_API_URL } from '@/shared/config'
import { firstQueryValue, parsePositiveId } from '@/shared/obs/obsUrl'

const props = defineProps<{
  code?: string
  id?: number | string | null
  style?: LotteryObsStyle | string
  mode?: LotteryObsMode | string
}>()

const route = useRoute()
const currentId = computed(() => parsePositiveId(props.id ?? route.query.id))
const currentCode = computed(() => firstQueryValue(props.code ?? route.query.code).trim())

const activeMode = computed<LotteryObsMode>(() => {
  const queryMode = firstQueryValue(props.mode ?? route.query.mode)
    .trim()
    .toLowerCase()
  if (['card', 'banner', 'compact', 'grid'].includes(queryMode)) {
    return queryMode as LotteryObsMode
  }
  return 'card'
})

const activeStyle = computed<string>(() => {
  const queryStyle = firstQueryValue(props.style ?? route.query.style ?? route.query.theme)
    .trim()
    .toLowerCase()
  if (['slate', 'transparent', 'champagne', 'classic'].includes(queryStyle)) {
    return queryStyle
  }
  return 'slate'
})

const listContainerRef = ref<HTMLElement | null>(null)
const { height } = useElementSize(listContainerRef)

const result = ref<UpdateLiveLotteryUsersModel>({
  users: [],
  resultUsers: [],
  type: OpenLiveLotteryType.Waiting,
})

const users = computed(() => result.value.users ?? [])
const resultUsers = computed(() => result.value.resultUsers ?? [])
const isDrawing = computed(() => result.value.type === OpenLiveLotteryType.Drawing)
const isResult = computed(() => result.value.type === OpenLiveLotteryType.Result)
const isMoreThanContainer = computed(() => users.value.length * 44 > (height.value || 200))

let pollTimer: number | undefined

async function refreshUsers() {
  if (!currentId.value && !currentCode.value) return
  try {
    const data = await QueryGetAPI<UpdateLiveLotteryUsersModel>(`${LOTTERY_API_URL}live/get-users`, {
      ...(currentId.value ? { id: currentId.value } : {}),
      ...(currentCode.value ? { code: currentCode.value } : {}),
    })
    if (data.code === 200 && data.data) {
      result.value = data.data
    }
  } catch (err) {
    console.error('[LiveLotteryOBS] 获取抽奖数据失败:', err)
  }
}

void refreshUsers()

function handleImageError(e: Event) {
  const img = e.target as HTMLImageElement
  if (img.src !== DEFAULT_LOTTERY_AVATAR) {
    img.src = DEFAULT_LOTTERY_AVATAR
  }
}

onMounted(() => {
  pollTimer = window.setInterval(() => {
    void refreshUsers()
  }, 1000)
})

onUnmounted(() => {
  if (pollTimer !== undefined) window.clearInterval(pollTimer)
})
</script>

<template>
  <div
    class="obs-lottery-root"
    :class="[`theme-${activeStyle}`, `mode-${activeMode}`, { 'is-drawing': isDrawing, 'is-result': isResult }]"
  >
    <!-- ================================================================= -->
    <!-- 模式 1: banner (横向长条 HUD，贴在顶部或底部)                        -->
    <!-- ================================================================= -->
    <div
      v-if="activeMode === 'banner'"
      class="obs-lottery-shell banner-shell"
    >
      <div class="banner-status-panel">
        <span
          class="obs-status-dot"
          :class="{
            'status-drawing': isDrawing,
            'status-result': isResult,
            'status-waiting': !isDrawing && !isResult,
          }"
        />
        <span class="banner-title">
          {{ isResult ? '中奖结果' : '直播抽奖' }}
        </span>
        <span class="obs-status-pill">
          <template v-if="isResult"> 中奖 {{ resultUsers.length }} 人 </template>
          <template v-else-if="isDrawing"> 正在抽取... </template>
          <template v-else> {{ users.length }} 人 </template>
        </span>
      </div>

      <div class="banner-divider" />

      <div
        ref="listContainerRef"
        class="banner-stream-panel"
      >
        <!-- 结果展示 -->
        <template v-if="isResult">
          <div
            v-if="resultUsers.length === 0"
            class="banner-empty-text"
          >
            未产生中奖用户
          </div>
          <Vue3Marquee
            v-else
            :duration="Math.max(10, resultUsers.length * 3)"
            :pause="resultUsers.length <= 4"
          >
            <div
              v-for="(user, index) in resultUsers"
              :key="user.openId || user.uId"
              class="banner-winner-chip"
            >
              <span class="chip-rank">{{ String(index + 1).padStart(2, '0') }}</span>
              <img
                class="chip-avatar"
                :src="formatLotteryAvatar(user.avatar, 48)"
                referrerpolicy="no-referrer"
                @error="handleImageError"
              />
              <span class="chip-name">{{ user.name }}</span>
            </div>
          </Vue3Marquee>
        </template>

        <!-- 等待与抽取 -->
        <template v-else>
          <div
            v-if="users.length === 0"
            class="banner-empty-text"
          >
            等待观众发送弹幕参与...
          </div>
          <!-- 人数少且未抽取时：静态横向列表，渲染更稳定 -->
          <div
            v-else-if="!isDrawing && users.length <= 4"
            class="banner-static-stream"
          >
            <div
              v-for="user in users"
              :key="user.openId || user.uId"
              class="banner-user-chip"
            >
              <img
                class="chip-avatar"
                :src="formatLotteryAvatar(user.avatar, 48)"
                referrerpolicy="no-referrer"
                @error="handleImageError"
              />
              <span class="chip-name">{{ user.name }}</span>
            </div>
          </div>
          <!-- 人数多或抽取中：平滑跑马灯 -->
          <Vue3Marquee
            v-else
            :duration="isDrawing ? 6 : 24"
          >
            <div
              v-for="user in users"
              :key="user.openId || user.uId"
              class="banner-user-chip"
            >
              <img
                class="chip-avatar"
                :src="formatLotteryAvatar(user.avatar, 48)"
                referrerpolicy="no-referrer"
                @error="handleImageError"
              />
              <span class="chip-name">{{ user.name }}</span>
            </div>
          </Vue3Marquee>
        </template>
      </div>
    </div>

    <!-- ================================================================= -->
    <!-- 模式 2: compact (极简悬浮胶囊，小挂件)                             -->
    <!-- ================================================================= -->
    <div
      v-else-if="activeMode === 'compact'"
      class="obs-lottery-shell compact-shell"
    >
      <div class="compact-header">
        <div class="compact-header-left">
          <span
            class="obs-status-dot"
            :class="{
              'status-drawing': isDrawing,
              'status-result': isResult,
              'status-waiting': !isDrawing && !isResult,
            }"
          />
          <span class="compact-title">{{ isResult ? '中奖' : '抽奖' }}</span>
        </div>
        <span class="compact-count">
          {{ isResult ? `${resultUsers.length} 人` : isDrawing ? '抽取中' : `${users.length} 人` }}
        </span>
      </div>

      <div
        ref="listContainerRef"
        class="compact-body"
      >
        <template v-if="isResult">
          <div
            v-if="resultUsers.length > 0"
            class="compact-user-chip"
          >
            <img
              class="compact-avatar"
              :src="formatLotteryAvatar(resultUsers[0].avatar, 48)"
              referrerpolicy="no-referrer"
              @error="handleImageError"
            />
            <span class="compact-name">{{ resultUsers[0].name }}</span>
            <span
              v-if="resultUsers.length > 1"
              class="compact-more-tag"
            >
              +{{ resultUsers.length - 1 }}
            </span>
          </div>
          <span
            v-else
            class="compact-empty"
            >无中奖用户</span
          >
        </template>

        <template v-else>
          <div
            v-if="users.length > 0"
            class="compact-user-chip"
          >
            <img
              class="compact-avatar"
              :src="formatLotteryAvatar(users[users.length - 1].avatar, 48)"
              referrerpolicy="no-referrer"
              @error="handleImageError"
            />
            <span class="compact-name">{{ users[users.length - 1].name }}</span>
          </div>
          <span
            v-else
            class="compact-empty"
            >等待参与...</span
          >
        </template>
      </div>
    </div>

    <!-- ================================================================= -->
    <!-- 模式 3: grid (舞台多列大网格) / 模式 4: card (标准竖版卡片)           -->
    <!-- ================================================================= -->
    <div
      v-else
      class="obs-lottery-shell"
      :class="{ 'grid-shell': activeMode === 'grid', 'card-shell': activeMode === 'card' }"
    >
      <!-- 顶栏 -->
      <header class="obs-lottery-header">
        <div class="obs-header-left">
          <span
            class="obs-status-dot"
            :class="{
              'status-drawing': isDrawing,
              'status-result': isResult,
              'status-waiting': !isDrawing && !isResult,
            }"
          />
          <h1 class="obs-header-title">
            {{ isResult ? '中奖结果' : '直播抽奖' }}
          </h1>
        </div>

        <div class="obs-header-right">
          <span
            class="obs-status-pill"
            :class="{ 'pill-highlight': isDrawing || isResult }"
          >
            <template v-if="isResult"> 中奖 {{ resultUsers.length }} 人 </template>
            <template v-else-if="isDrawing"> 正在抽取... </template>
            <template v-else> {{ users.length }} 人参与 </template>
          </span>
        </div>
      </header>

      <!-- 主体内容 -->
      <main
        ref="listContainerRef"
        class="obs-lottery-body"
      >
        <!-- 结果展示 -->
        <div
          v-if="isResult"
          class="obs-result-stage"
        >
          <div
            v-if="resultUsers.length === 0"
            class="obs-empty-state"
          >
            <span class="empty-text">未产生中奖用户</span>
          </div>

          <!-- 单人特写 -->
          <div
            v-else-if="resultUsers.length === 1"
            class="solo-winner-card"
          >
            <div class="winner-avatar-wrap">
              <img
                class="solo-avatar"
                :src="formatLotteryAvatar(resultUsers[0].avatar, 96)"
                referrerpolicy="no-referrer"
                @error="handleImageError"
              />
              <span class="solo-badge">中奖者</span>
            </div>
            <div
              class="solo-name"
              :title="resultUsers[0].name"
            >
              {{ resultUsers[0].name }}
            </div>
            <div
              v-if="resultUsers[0].fans_medal_name && resultUsers[0].fans_medal_level > 0"
              class="user-medal-badge"
            >
              {{ resultUsers[0].fans_medal_name }} {{ resultUsers[0].fans_medal_level }}
            </div>
          </div>

          <!-- 2 ~ 6 人 Bento Grid (在 grid 模式下自动多列) -->
          <div
            v-else-if="resultUsers.length <= 6"
            class="bento-winner-grid"
            :class="{ 'multi-column': activeMode === 'grid' }"
          >
            <div
              v-for="(user, index) in resultUsers"
              :key="user.openId || user.uId"
              class="bento-winner-item"
            >
              <div class="bento-rank-tag">
                {{ String(index + 1).padStart(2, '0') }}
              </div>
              <img
                class="bento-avatar"
                :src="formatLotteryAvatar(user.avatar, 64)"
                referrerpolicy="no-referrer"
                @error="handleImageError"
              />
              <div class="bento-info">
                <span
                  class="bento-name"
                  :title="user.name"
                  >{{ user.name }}</span
                >
                <span
                  v-if="user.fans_medal_name && user.fans_medal_level > 0"
                  class="user-medal-badge compact"
                >
                  {{ user.fans_medal_name }} {{ user.fans_medal_level }}
                </span>
              </div>
            </div>
          </div>

          <!-- 7 人以上滚动 -->
          <div
            v-else
            class="multi-winner-container"
          >
            <Vue3Marquee
              vertical
              :duration="Math.max(12, resultUsers.length * 2.5)"
              :style="`height: ${height || 280}px;`"
            >
              <div
                v-for="(user, index) in resultUsers"
                :key="user.openId || user.uId"
                class="multi-winner-row"
              >
                <span class="multi-rank">{{ String(index + 1).padStart(2, '0') }}</span>
                <img
                  class="multi-avatar"
                  :src="formatLotteryAvatar(user.avatar, 48)"
                  referrerpolicy="no-referrer"
                  @error="handleImageError"
                />
                <span class="multi-name">{{ user.name }}</span>
                <span
                  v-if="user.fans_medal_name && user.fans_medal_level > 0"
                  class="user-medal-badge compact"
                >
                  {{ user.fans_medal_name }} {{ user.fans_medal_level }}
                </span>
              </div>
            </Vue3Marquee>
          </div>
        </div>

        <!-- 等待与抽取 -->
        <div
          v-else
          class="obs-queue-stage"
        >
          <div
            v-if="users.length === 0"
            class="obs-empty-state"
          >
            <span class="empty-text">等待观众发送弹幕参与...</span>
          </div>

          <!-- 舞台网格模式等待 -->
          <div
            v-else-if="activeMode === 'grid'"
            class="obs-grid-stage-wrap"
          >
            <div class="stage-avatar-grid">
              <div
                v-for="user in users"
                :key="user.openId || user.uId"
                class="stage-avatar-cell"
                :class="{ 'is-drawing-cell': isDrawing }"
              >
                <img
                  class="stage-avatar"
                  :src="formatLotteryAvatar(user.avatar, 64)"
                  referrerpolicy="no-referrer"
                  @error="handleImageError"
                />
                <span class="stage-name">{{ user.name }}</span>
              </div>
            </div>
          </div>

          <!-- 标准卡片列表 -->
          <div
            v-else
            class="obs-user-marquee-wrap"
          >
            <!-- 当人数未超出且不在抽取中：使用可靠的静态列表，避免跑马灯空转或丢失元素 -->
            <div
              v-if="!isDrawing && !isMoreThanContainer"
              class="lottery-user-static-list"
            >
              <div
                v-for="user in users"
                :key="user.openId || user.uId"
                class="lottery-user-row"
              >
                <img
                  class="user-avatar"
                  :src="formatLotteryAvatar(user.avatar, 48)"
                  referrerpolicy="no-referrer"
                  @error="handleImageError"
                />
                <div class="user-info">
                  <span
                    class="user-name"
                    :title="user.name"
                    >{{ user.name }}</span
                  >
                  <span
                    v-if="user.fans_medal_name && user.fans_medal_level > 0"
                    class="user-medal-badge"
                  >
                    {{ user.fans_medal_name }} {{ user.fans_medal_level }}
                  </span>
                </div>
              </div>
            </div>

            <!-- 当人数超出容器或正在抽取中：启用平滑跑马灯 -->
            <Vue3Marquee
              v-else
              vertical
              :duration="isDrawing ? 4.5 : 22"
              :style="`height: ${height || 280}px;`"
            >
              <div
                v-for="user in users"
                :key="user.openId || user.uId"
                class="lottery-user-row"
                :class="{ 'is-drawing-row': isDrawing }"
              >
                <img
                  class="user-avatar"
                  :src="formatLotteryAvatar(user.avatar, 48)"
                  referrerpolicy="no-referrer"
                  @error="handleImageError"
                />
                <div class="user-info">
                  <span
                    class="user-name"
                    :title="user.name"
                    >{{ user.name }}</span
                  >
                  <span
                    v-if="user.fans_medal_name && user.fans_medal_level > 0"
                    class="user-medal-badge"
                  >
                    {{ user.fans_medal_name }} {{ user.fans_medal_level }}
                  </span>
                </div>
              </div>
            </Vue3Marquee>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
/* ========================================================================= */
/* 0. 基础根节点                                                              */
/* ========================================================================= */
.obs-lottery-root {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  user-select: none;
}

.obs-lottery-shell {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding: 12px;
  gap: 10px;
  border-radius: 14px;
  position: relative;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

/* ========================================================================= */
/* 1. 主题样式 (Themes)                                                      */
/* ========================================================================= */

/* --- 1.1 现代深邃 (Slate) --- */
.theme-slate .obs-lottery-shell {
  background: rgba(15, 23, 42, 0.88);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.12),
    0 12px 32px rgba(0, 0, 0, 0.45);
  color: #f8fafc;
}

.theme-slate .obs-lottery-body,
.theme-slate .banner-stream-panel,
.theme-slate .compact-body {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.theme-slate .lottery-user-row,
.theme-slate .bento-winner-item,
.theme-slate .multi-winner-row,
.theme-slate .banner-user-chip,
.theme-slate .banner-winner-chip,
.theme-slate .compact-user-chip,
.theme-slate .stage-avatar-cell {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.theme-slate .solo-winner-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

/* --- 1.2 纯粹悬浮 (Transparent) --- */
.theme-transparent .obs-lottery-shell {
  background: transparent !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  border: none !important;
  box-shadow: none !important;
  padding: 6px;
  color: #ffffff;
}

.theme-transparent .obs-lottery-body,
.theme-transparent .banner-stream-panel,
.theme-transparent .compact-body {
  background: transparent !important;
  border: none !important;
}

.theme-transparent .obs-header-title,
.theme-transparent .banner-title,
.theme-transparent .compact-title {
  text-shadow:
    0 1px 3px rgba(0, 0, 0, 0.9),
    0 0 8px rgba(0, 0, 0, 0.6);
}

.theme-transparent .lottery-user-row,
.theme-transparent .bento-winner-item,
.theme-transparent .multi-winner-row,
.theme-transparent .banner-user-chip,
.theme-transparent .banner-winner-chip,
.theme-transparent .compact-user-chip,
.theme-transparent .stage-avatar-cell,
.theme-transparent .solo-winner-card {
  background: rgba(0, 0, 0, 0.55) !important;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.15) !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
}

/* --- 1.3 温润香槟金 (Champagne) --- */
.theme-champagne .obs-lottery-shell {
  background: rgba(18, 16, 14, 0.92);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(217, 180, 130, 0.25);
  box-shadow:
    inset 0 1px 0 rgba(217, 180, 130, 0.2),
    0 12px 32px rgba(0, 0, 0, 0.55);
  color: #f5eee6;
}

.theme-champagne .obs-lottery-body,
.theme-champagne .banner-stream-panel,
.theme-champagne .compact-body {
  background: rgba(0, 0, 0, 0.28);
  border: 1px solid rgba(217, 180, 130, 0.1);
}

.theme-champagne .obs-status-pill.pill-highlight {
  background: rgba(217, 180, 130, 0.2);
  border-color: rgba(217, 180, 130, 0.4);
  color: #e8cda2;
}

.theme-champagne .lottery-user-row,
.theme-champagne .bento-winner-item,
.theme-champagne .multi-winner-row,
.theme-champagne .banner-user-chip,
.theme-champagne .banner-winner-chip,
.theme-champagne .compact-user-chip,
.theme-champagne .stage-avatar-cell {
  background: rgba(217, 180, 130, 0.05);
  border: 1px solid rgba(217, 180, 130, 0.12);
}

.theme-champagne .solo-winner-card {
  background: rgba(217, 180, 130, 0.08);
  border: 1px solid rgba(217, 180, 130, 0.25);
}

.theme-champagne .solo-badge {
  background: linear-gradient(135deg, #dfc299, #c49b66);
  color: #1a140d;
}

/* ========================================================================= */
/* 2. 状态小圆点与徽章                                                        */
/* ========================================================================= */
.obs-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  transition: all 0.3s ease;
}

.status-waiting {
  background: #10b981;
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);
  animation: pulse-dot 2s infinite ease-in-out;
}

.status-drawing {
  background: #f59e0b;
  box-shadow: 0 0 10px rgba(245, 158, 11, 0.8);
  animation: pulse-drawing 0.8s infinite alternate ease-in-out;
}

.status-result {
  background: #38bdf8;
  box-shadow: 0 0 8px rgba(56, 189, 248, 0.6);
}

@keyframes pulse-dot {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.4;
    transform: scale(0.85);
  }
}

@keyframes pulse-drawing {
  0% {
    opacity: 0.6;
    transform: scale(0.9);
  }
  100% {
    opacity: 1;
    transform: scale(1.15);
  }
}

.obs-status-pill {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
  font-family: ui-monospace, SFMono-Regular, monospace;
  white-space: nowrap;
}

.obs-status-pill.pill-highlight {
  background: rgba(56, 189, 248, 0.15);
  border-color: rgba(56, 189, 248, 0.35);
  color: #7dd3fc;
}

/* ========================================================================= */
/* 3. 模式 1: banner (横向长条 HUD)                                          */
/* ========================================================================= */
.banner-shell {
  flex-direction: row !important;
  align-items: center !important;
  padding: 6px 12px !important;
  height: 100% !important;
  gap: 10px !important;
}

.banner-status-panel {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.banner-title {
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}

.banner-divider {
  width: 1px;
  height: 20px;
  background: rgba(255, 255, 255, 0.15);
  flex-shrink: 0;
}

.banner-stream-panel {
  flex: 1;
  height: 38px;
  border-radius: 8px;
  padding: 0 6px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  overflow: hidden;
  min-width: 0;
}

.banner-static-stream {
  display: flex;
  align-items: center;
  overflow-x: auto;
  width: 100%;
}

.banner-empty-text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  padding-left: 8px;
  white-space: nowrap;
}

.banner-user-chip,
.banner-winner-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  margin-right: 8px;
  border-radius: 6px;
  white-space: nowrap;
  flex-shrink: 0;
}

.chip-rank {
  font-size: 10px;
  font-weight: 700;
  font-family: ui-monospace, monospace;
  opacity: 0.7;
}

.chip-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.15);
  object-fit: cover;
}

.chip-name {
  font-size: 12px;
  font-weight: 500;
}

/* ========================================================================= */
/* 4. 模式 2: compact (极简悬浮胶囊)                                         */
/* ========================================================================= */
.compact-shell {
  padding: 8px 10px !important;
  gap: 6px !important;
}

.compact-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.compact-header-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.compact-title {
  font-size: 12px;
  font-weight: 700;
}

.compact-count {
  font-size: 10px;
  font-weight: 600;
  font-family: ui-monospace, monospace;
  opacity: 0.7;
}

.compact-body {
  flex: 1;
  border-radius: 8px;
  padding: 4px 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.compact-user-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 4px 6px;
  border-radius: 6px;
  box-sizing: border-box;
}

.compact-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.compact-name {
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.compact-more-tag {
  font-size: 10px;
  font-weight: 700;
  opacity: 0.7;
}

.compact-empty {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}

/* ========================================================================= */
/* 5. 模式 3/4: card & grid (标准竖版卡片 / 舞台网格)                         */
/* ========================================================================= */
.obs-lottery-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px;
  flex-shrink: 0;
}

.obs-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.obs-header-title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.obs-header-right {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.obs-lottery-body {
  flex: 1;
  min-height: 0;
  border-radius: 10px;
  padding: 8px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.obs-queue-stage,
.obs-result-stage {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.obs-empty-state {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 16px;
  box-sizing: border-box;
}

.empty-text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  text-align: center;
}

.obs-user-marquee-wrap {
  width: 100%;
  height: 100%;
  overflow-y: auto;
}

.lottery-user-static-list {
  width: 100%;
  display: flex;
  flex-direction: column;
}

.lottery-user-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  margin-bottom: 6px;
  border-radius: 8px;
  box-sizing: border-box;
  transition: all 0.25s ease;
}

.user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.15);
  object-fit: cover;
  flex-shrink: 0;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.user-name {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.user-medal-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.85);
  white-space: nowrap;
  flex-shrink: 0;
}

.user-medal-badge.compact {
  font-size: 9px;
  padding: 0 4px;
}

/* 舞台网格专用头像墙 */
.obs-grid-stage-wrap {
  width: 100%;
  height: 100%;
  overflow-y: auto;
}

.stage-avatar-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.stage-avatar-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 4px;
  border-radius: 8px;
  gap: 4px;
  box-sizing: border-box;
}

.stage-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.2);
  object-fit: cover;
}

.stage-name {
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 90%;
}

/* 揭榜：单人特写 */
.solo-winner-card {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px;
  border-radius: 10px;
  gap: 10px;
  animation: winner-pop 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

.winner-avatar-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.solo-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.25);
  object-fit: cover;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

.solo-badge {
  position: absolute;
  bottom: -6px;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 8px;
  border-radius: 9999px;
  background: #38bdf8;
  color: #0f172a;
  letter-spacing: 0.02em;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  white-space: nowrap;
}

.solo-name {
  font-size: 16px;
  font-weight: 700;
  margin-top: 4px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 90%;
}

/* 揭榜：Bento Grid */
.bento-winner-grid {
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
  overflow-y: auto;
  align-content: start;
  animation: winner-pop 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.bento-winner-grid.multi-column {
  grid-template-columns: repeat(2, 1fr);
}

.bento-winner-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 8px;
  box-sizing: border-box;
}

.bento-rank-tag {
  font-size: 10px;
  font-weight: 700;
  font-family: ui-monospace, monospace;
  opacity: 0.6;
}

.bento-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.2);
  object-fit: cover;
  flex-shrink: 0;
}

.bento-info {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.bento-name {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

/* 揭榜：多人跑马灯 */
.multi-winner-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.multi-winner-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  margin-bottom: 5px;
  border-radius: 6px;
  box-sizing: border-box;
}

.multi-rank {
  font-size: 10px;
  font-weight: 700;
  font-family: ui-monospace, monospace;
  opacity: 0.5;
}

.multi-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.15);
  object-fit: cover;
  flex-shrink: 0;
}

.multi-name {
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

@keyframes winner-pop {
  0% {
    opacity: 0;
    transform: scale(0.96) translateY(6px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
</style>
