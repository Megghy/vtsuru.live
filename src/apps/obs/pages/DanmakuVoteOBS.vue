<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { QueryGetAPI } from '@/api/query'
import type { VoteOBSData } from '@/api/api-models'
import DanmakuVoteCard from '@/shared/components/DanmakuVoteCard.vue'
import { VOTE_API_URL } from '@/shared/config'
import { firstQueryValue, parsePositiveId } from '@/shared/obs/obsUrl'

const route = useRoute()

// 状态管理
const voteData = ref<VoteOBSData | null>(null)
const lastHash = ref<string>('')
const isLoading = ref<boolean>(true)
const nowMs = ref(Date.now())

// 路由与凭证参数
const targetUserId = computed(() => parsePositiveId(firstQueryValue(route.query.id)))
const token = computed(() => firstQueryValue(route.query.token) || undefined)
const currentTheme = computed(() => firstQueryValue(route.query.theme) || undefined)
// 未显式指定位置时铺满视口：OBS 里一般把本页作为单组件源嵌入，尺寸由源决定
const currentPosition = computed(() => firstQueryValue(route.query.position) || 'fill')
const maxDisplayCount = computed(() => {
  const parsed = Number(parsePositiveId(firstQueryValue(route.query.max)))
  return parsed > 0 ? parsed : 6
})

let pollTimer: number | undefined
let clockTimer: number | undefined

// 轮询轻量探针 Hash
async function pollHash() {
  if (!targetUserId.value && !token.value) {
    isLoading.value = false
    return
  }

  try {
    const params: Record<string, any> = {}
    if (targetUserId.value) params.id = targetUserId.value
    if (token.value) params.token = token.value

    const res = await QueryGetAPI<string>(`${VOTE_API_URL}obs-hash`, params)
    if (res.code === 200) {
      const hash = res.data || 'empty'
      if (hash === 'empty') {
        voteData.value = null
        lastHash.value = 'empty'
        return
      }
      if (hash !== lastHash.value) {
        await fetchFullData()
        lastHash.value = hash
      }
    }
  } catch (err) {
    console.warn('[DanmakuVoteOBS] 轮询哈希失败:', err)
  } finally {
    isLoading.value = false
  }
}

// 获取 OBS 全量展示快照
async function fetchFullData() {
  try {
    const params: Record<string, any> = {}
    if (targetUserId.value) params.id = targetUserId.value
    if (token.value) params.token = token.value

    const res = await QueryGetAPI<VoteOBSData>(`${VOTE_API_URL}obs-data`, params)
    if (res.code === 200 && res.data) {
      voteData.value = res.data
    } else {
      voteData.value = null
    }
  } catch (err) {
    console.error('[DanmakuVoteOBS] 获取数据失败:', err)
  }
}

onMounted(() => {
  pollHash()
  pollTimer = window.setInterval(pollHash, 1000)
  clockTimer = window.setInterval(() => {
    nowMs.value = Date.now()
  }, 500)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
  if (clockTimer) clearInterval(clockTimer)
})

watch([targetUserId, token], () => {
  lastHash.value = ''
  pollHash()
})
</script>

<template>
  <div class="danmaku-vote-obs-page">
    <DanmakuVoteCard
      :data="voteData"
      :theme="currentTheme"
      :position="currentPosition"
      :max-display="maxDisplayCount"
      :current-time-ms="nowMs"
    />
  </div>
</template>

<style scoped>
/* 铺满整页，对齐完全交给卡片自身，页不再重复补偿 */
.danmaku-vote-obs-page {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: transparent;
}
</style>
