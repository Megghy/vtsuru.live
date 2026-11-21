<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useAccount } from '@/api/account'
import { getApiVoteObsData, getApiVoteObsHash } from '@/api/generated/bullet-vote/bullet-vote'
import type { VoteOBSDataModel } from '@/api/vote'
import { createVotePreviewScene } from '@/apps/manage/pages/votePreview'
import { useObsRealtimeSync } from '@/apps/obs/composables/useObsRealtimeSync'
import DanmakuVoteCard from '@/shared/components/DanmakuVoteCard.vue'
import { firstQueryValue, parsePositiveId } from '@/shared/obs/obsUrl'

const props = withDefaults(
  defineProps<{
    id?: string | number
    token?: string
    theme?: string
    position?: string
    layout?: 'auto' | 'card' | 'banner'
    max?: number
    inlineMode?: boolean
    previewMode?: boolean
    borderRadiusOverride?: number
    fontFamilyOverride?: string
    showResultsOverride?: boolean | null
    disableShadow?: boolean
    active?: boolean
    visible?: boolean
  }>(),
  { active: true, visible: true, inlineMode: false, previewMode: false, layout: 'auto', showResultsOverride: null },
)

const route = useRoute()
const account = useAccount()

const voteData = ref<VoteOBSDataModel | null>(null)
const lastHash = ref<string>('')
const isLoading = ref<boolean>(true)
const nowMs = ref(Date.now())

const targetUserId = computed(() =>
  parsePositiveId(props.id !== undefined ? String(props.id) : firstQueryValue(route.query.id)),
)
const token = computed(() => props.token || firstQueryValue(route.query.token) || undefined)
const voteTopic = computed(() => {
  const uid = targetUserId.value || (account.value.id > 0 ? String(account.value.id) : '')
  return uid ? `obs:display:vote:${uid}` : ''
})
const currentTheme = computed(() => props.theme || firstQueryValue(route.query.theme) || undefined)
// 未显式指定位置时铺满视口：OBS 里一般把本页作为单组件源嵌入，尺寸由源决定
const currentPosition = computed(() => props.position || firstQueryValue(route.query.position) || 'fill')
const currentLayout = computed<'auto' | 'card' | 'banner'>(() => {
  const raw = props.layout !== 'auto' ? props.layout : firstQueryValue(route.query.layout)
  if (raw === 'banner' || raw === 'card') return raw
  return 'auto'
})
const maxDisplayCount = computed(() => {
  if (props.max && props.max > 0) return props.max
  const parsed = Number(parsePositiveId(firstQueryValue(route.query.max)))
  return parsed > 0 ? parsed : 6
})

// 场景编辑器编辑态无活跃投票时展示实时 Mock 预览，便于所见即所得排版
const fallbackPreviewData = computed<VoteOBSDataModel | null>(() => {
  if (!props.previewMode || voteData.value) return null
  const isDuel = currentTheme.value === 'duel'
  const scene = isDuel ? (currentLayout.value === 'banner' ? 'duel-top' : 'duel') : 'standard'
  return createVotePreviewScene(scene, currentPosition.value)
})

const renderedData = computed<VoteOBSDataModel | null>(() => voteData.value ?? fallbackPreviewData.value)

let clockTimer: number | undefined

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

async function fetchFullData() {
  try {
    const params: Record<string, any> = {}
    if (targetUserId.value) params.id = targetUserId.value
    if (token.value) params.token = token.value

    const res = await getApiVoteObsData(params)
    if (res.code === 200 && res.data) {
      voteData.value = res.data as VoteOBSDataModel
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

on<{ hash?: string; snapshot?: VoteOBSDataModel | null }>('Snapshot', (payload) => {
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
  <div
    class="relative overflow-hidden bg-transparent"
    :class="props.inlineMode ? 'w-full h-full' : 'w-screen h-screen'"
  >
    <DanmakuVoteCard
      :data="renderedData"
      :theme="currentTheme"
      :position="currentPosition"
      :layout="currentLayout"
      :max-display="maxDisplayCount"
      :current-time-ms="nowMs"
      :border-radius-override="props.borderRadiusOverride"
      :font-family-override="props.fontFamilyOverride"
      :show-results-override="props.showResultsOverride"
      :disable-shadow="props.disableShadow"
    />
    <span
      v-if="props.previewMode && !voteData"
      class="pointer-events-none absolute top-1.5 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white/80"
    >
      示例预览（有投票时自动切换实时画面）
    </span>
  </div>
</template>
