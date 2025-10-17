<script setup lang="ts">
import type { EventModel, VoteConfig, VoteOBSData, VoteOption } from '@/api/api-models'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { clearInterval, setInterval } from 'worker-timers'
import { QueryGetAPI } from '@/api/query'
import { VOTE_API_URL } from '@/data/constants'
import { useDanmakuClient } from '@/store/useDanmakuClient'

const props = defineProps<{
  roomId?: number
  code?: string
  active?: boolean
  visible?: boolean
}>()

const route = useRoute()
const client = useDanmakuClient()
const voteData = ref<VoteOBSData | null>(null)
const fetchIntervalId = ref<number | null>(null)
const config = ref<VoteConfig | null>(null)
const isLoading = ref(true)
const nowMs = ref<number>(Date.now())
const tickIntervalId = ref<number | null>(null)

const timeLeftMs = computed(() => {
  if (!voteData.value?.endTime) return null
  const remain = voteData.value.endTime * 1000 - nowMs.value
  return Math.max(0, remain)
})

function formatRemain(ms: number | null | undefined) {
  if (ms == null) return ''
  const total = Math.floor(ms / 1000)
  const mm = Math.floor(total / 60).toString().padStart(2, '0')
  const ss = (total % 60).toString().padStart(2, '0')
  return `${mm}:${ss}`
}

// 可见性检测
const isVisible = computed(() => props.visible !== false)
const isActive = computed(() => props.active !== false)

// 从后端获取投票数据
async function fetchVoteData() {
  try {
    const userId = getUserIdFromUrl()
    if (!userId) return

    const result = await QueryGetAPI<VoteOBSData>(`${VOTE_API_URL}obs-data`, { user: userId })

    if (result.code === 200 && result.data) {
      voteData.value = result.data
      // 更新每个选项的百分比（若后端未提供）
      if (voteData.value && voteData.value.options) {
        voteData.value.options.forEach((option) => {
          if (option.percentage == null && voteData.value!.totalVotes > 0) {
            option.percentage = calculatePercentage(option.count, voteData.value!.totalVotes)
          }
        })
      }
    } else if (voteData.value && !result.data) {
      // 投票结束或无投票
      voteData.value = null
    }
  } catch (error) {
    console.error('获取投票数据失败:', error)
  }
}

// 处理接收到的弹幕
function processDanmaku(event: EventModel) {
  // 当使用API获取投票数据时，此处不需要处理投票逻辑
  // 仅用于获取房间连接
}

// 从URL获取用户ID
function getUserIdFromUrl(): string | null {
  const hash = route.query.hash as string
  if (hash) {
    const parts = hash.split('_')
    if (parts.length === 2) {
      return parts[1]
    }
  }
  return route.query.user as string || null
}

// 计算百分比
function calculatePercentage(count: number, total: number): number {
  if (total === 0) return 0
  return Math.round((count / total) * 100)
}

// 获取投票配置
async function fetchVoteConfig() {
  try {
    const userId = getUserIdFromUrl()
    if (!userId) return

    const result = await QueryGetAPI<VoteConfig>(`${VOTE_API_URL}get-config`, { user: userId })

    if (result.code === 200 && result.data) {
      config.value = result.data
    }
  } catch (error) {
    console.error('获取投票配置失败:', error)
  } finally {
    isLoading.value = false
  }
}

// 设置投票数据轮询
function setupPolling() {
  if (fetchIntervalId.value) {
    clearInterval(fetchIntervalId.value)
  }

  // 每秒获取一次投票数据
  fetchVoteData()
  fetchIntervalId.value = setInterval(() => {
    fetchVoteData()
  }, 1000)
}

// 获取某个选项占总票数的百分比
function getPercentage(option: VoteOption): number {
  if (!voteData.value || voteData.value.totalVotes === 0) return 0
  return option.percentage || 0
}

// 主题相关
const theme = computed(() => {
  if (route.query.theme && typeof route.query.theme === 'string') {
    return route.query.theme
  }
  return 'default'
})

onMounted(async () => {
  // 设置房间ID和代码并连接
  const roomId = props.roomId || Number(route.query.roomId)
  const code = props.code || route.query.code

  if (roomId && code) {
    await client.initOpenlive()
    // 监听弹幕事件 (仅用于保持连接)
    client.onEvent('danmaku', processDanmaku)
  }

  // 获取投票配置和投票数据
  await fetchVoteConfig()
  setupPolling()
  // 本地计时器用于倒计时显示
  tickIntervalId.value = setInterval(() => {
    nowMs.value = Date.now()
  }, 1000)

  onUnmounted(() => {
    client.dispose()
    if (fetchIntervalId.value) {
      clearInterval(fetchIntervalId.value)
    }
    if (tickIntervalId.value) {
      clearInterval(tickIntervalId.value)
    }
  })
})
</script>

<template>
  <div
    v-if="voteData && isVisible && isActive"
    class="danmaku-vote-obs"
    :class="[
      `theme-${theme}`,
      `position-${voteData.displayPosition || 'right'}`,
      { rounded: voteData.roundedCorners },
    ]"
    :style="{
      '--bg-color': voteData.backgroundColor || '#1e1e2e',
      '--text-color': voteData.textColor || '#ffffff',
      '--option-color': voteData.optionColor || '#89b4fa',
      '--bg-image': voteData.backgroundImage ? `url(${voteData.backgroundImage})` : 'none',
    }"
  >
    <div class="vote-container">
      <div class="vote-header">
        <div class="vote-title">
          {{ voteData.title }}
          <span v-if="timeLeftMs !== null" class="vote-timer">剩余 {{ formatRemain(timeLeftMs) }}</span>
        </div>
      </div>

      <div class="vote-stats">
        总票数: <span class="vote-count">{{ voteData.totalVotes }}</span>
      </div>

      <div class="vote-options">
        <div
          v-for="(option, index) in voteData.options"
          :key="index"
          class="vote-option"
        >
          <div class="option-header">
            <div class="option-name">
              {{ index + 1 }}. {{ option.text }}
            </div>
            <div
              v-if="voteData.showResults"
              class="option-count-wrapper"
            >
              <span class="option-count">{{ option.count }}</span>
              <span class="option-percent">{{ getPercentage(option) }}%</span>
            </div>
          </div>

          <div
            v-if="voteData.showResults"
            class="progress-wrapper"
          >
            <div
              class="progress-bar"
              :style="`width: ${getPercentage(option)}%`"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
  <div
    v-else-if="isLoading"
    class="danmaku-vote-loading"
  >
    加载中...
  </div>
</template>

<style scoped>
.danmaku-vote-obs {
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: "Microsoft YaHei", sans-serif;
  color: var(--text-color);
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.danmaku-vote-loading {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-family: "Microsoft YaHei", sans-serif;
}

.vote-container {
  width: 90%;
  max-width: 600px;
  background-color: var(--bg-color);
  background-image: var(--bg-image);
  background-size: cover;
  background-position: center;
  padding: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.danmaku-vote-obs.rounded .vote-container {
  border-radius: 12px;
}

.vote-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.vote-title {
  font-size: 24px;
  font-weight: bold;
}

.vote-stats {
  margin-bottom: 16px;
  font-size: 16px;
  opacity: 0.9;
}

.vote-count {
  font-weight: bold;
  color: var(--option-color);
}

.vote-options {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.vote-option {
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 12px;
}

.option-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.option-name {
  font-size: 18px;
  font-weight: 500;
}

.option-count-wrapper {
  display: flex;
  gap: 8px;
}

.option-count {
  background-color: var(--option-color);
  color: var(--bg-color);
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: bold;
}

.option-percent {
  background-color: rgba(255, 255, 255, 0.2);
  color: var(--text-color);
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: bold;
}

.progress-wrapper {
  height: 8px;
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-bar {
  height: 100%;
  background: var(--option-color);
  border-radius: 4px;
  transition: width 0.3s ease;
}

/* 位置样式 */
.position-right {
  justify-content: flex-end;
}

.position-left {
  justify-content: flex-start;
}

.position-top {
  align-items: flex-start;
}

.position-bottom {
  align-items: flex-end;
}

/* 主题样式 */
.theme-transparent .vote-container {
  background-color: rgba(0, 0, 0, 0.6);
  box-shadow: none;
}
</style>
