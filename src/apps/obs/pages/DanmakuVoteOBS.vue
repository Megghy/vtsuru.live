<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useAccount } from '@/api/account'
import { getApiVoteObsData, getApiVoteObsHash } from '@/api/generated/bullet-vote/bullet-vote'
import type { VoteOBSData } from '@/api/generated/model'
import { useObsRealtimeSync } from '@/apps/obs/composables/useObsRealtimeSync'
import DanmakuVoteCard from '@/shared/components/DanmakuVoteCard.vue'
import { firstQueryValue, parsePositiveId } from '@/shared/obs/obsUrl'

const props = withDefaults(
  defineProps<{
    active?: boolean
    visible?: boolean
  }>(),
  { active: true, visible: true },
)

const route = useRoute()
const account = useAccount()

// 状态管理
const voteData = ref<VoteOBSData | null>(null)
const lastHash = ref<string>('')
const isLoading = ref<boolean>(true)
const nowMs = ref(Date.now())

// 路由与凭证参数
const targetUserId = computed(() => parsePositiveId(firstQueryValue(route.query.id)))
const token = computed(() => firstQueryValue(route.query.token) || undefined)
const voteTopic = computed(() => {
  const uid = targetUserId.value || (account.value.id > 0 ? String(account.value.id) : '')
  return uid ? `obs:display:vote:${uid}` : ''
})
const currentTheme = computed(() => firstQueryValue(route.query.theme) || undefined)
// 未显式指定位置时铺满视口：OBS 里一般把本页作为单组件源嵌入，尺寸由源决定
const currentPosition = computed(() => firstQueryValue(route.query.position) || 'fill')
const maxDisplayCount = computed(() => {
  const parsed = Number(parsePositiveId(firstQueryValue(route.query.max)))
  return parsed > 0 ? parsed : 6
})

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

    const res = await getApiVoteObsHash(params)
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

    const res = await getApiVoteObsData(params)
    if (res.code === 200 && res.data) {
      voteData.value = res.data
    } else {
      voteData.value = null
    }
  } catch (err) {
    console.error('[DanmakuVoteOBS] 获取数据失败:', err)
  }
}

const { on } = useObsRealtimeSync({
  topic: voteTopic,
  active: () => props.active,
  visible: () => props.visible,
  onSync: pollHash,
  disconnectedFallbackMs: 2000,
})

on<{ hash?: string; snapshot?: VoteOBSData | null }>('Snapshot', (payload) => {
  if (!payload) return
  lastHash.value = payload.hash ?? ''
  voteData.value = payload.snapshot ?? null
  isLoading.value = false
})

onMounted(() => {
  clockTimer = window.setInterval(() => {
    nowMs.value = Date.now()
  }, 500)
})

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
})

watch([targetUserId, token], () => {
  lastHash.value = ''
  void pollHash()
})
</script>

<template>
  <div class="w-screen h-screen overflow-hidden bg-transparent">
    <DanmakuVoteCard
      :data="voteData"
      :theme="currentTheme"
      :position="currentPosition"
      :max-display="maxDisplayCount"
      :current-time-ms="nowMs"
    />
  </div>
</template>
