<script setup lang="ts">
import { RefreshCw, Vote } from 'lucide-vue-next'
import { useDocumentVisibility, useIntervalFn } from '@vueuse/core'
import { computed, onMounted, ref, watch } from 'vue'

import { getApiVoteObsData, getApiVoteObsHash } from '@/api/generated/bullet-vote/bullet-vote'
import type { ResponseUserInfo } from '@/api/generated/model'
import type { VoteOBSDataModel } from '@/api/vote'
import DanmakuVoteCard from '@/shared/components/DanmakuVoteCard.vue'
import { Button } from '@/shared/ui/button'
import { Empty } from '@/shared/ui/empty'
import { Spin } from '@/shared/ui/spin'

import BlockCard from '../BlockCard.vue'

const props = defineProps<{
  blockProps: unknown
  userInfo?: ResponseUserInfo
}>()

const values = computed<Record<string, unknown>>(() =>
  props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps)
    ? (props.blockProps as Record<string, unknown>)
    : {},
)

const title = computed(() => (typeof values.value.title === 'string' && values.value.title.trim() ? values.value.title.trim() : '直播弹幕投票'))
const theme = computed(() => {
  const v = values.value.theme
  return v === 'glass' || v === 'neon' || v === 'minimal' || v === 'duel' || v === 'light' ? v : 'glass'
})
const maxDisplay = computed(() => {
  const n = Number(values.value.maxDisplay)
  return Number.isInteger(n) ? Math.min(10, Math.max(2, n)) : 6
})
const showWhenIdle = computed(() => values.value.showWhenIdle !== false)
const idleText = computed(() =>
  typeof values.value.idleText === 'string' && values.value.idleText.trim()
    ? values.value.idleText.trim()
    : '当前暂无进行中的弹幕投票',
)

const voteData = ref<VoteOBSDataModel | null>(null)
const lastHash = ref('')
const loading = ref(true)
const nowMs = ref(Date.now())
const visibility = useDocumentVisibility()

async function poll(force = false) {
  const uid = props.userInfo?.id
  if (!uid) {
    voteData.value = null
    loading.value = false
    return
  }
  try {
    const hashRes = await getApiVoteObsHash({ id: uid })
    if (hashRes.code !== 200) return
    const hash = hashRes.data || 'empty'
    if (hash === 'empty') {
      voteData.value = null
      lastHash.value = 'empty'
      return
    }
    if (force || hash !== lastHash.value) {
      const dataRes = await getApiVoteObsData({ id: uid })
      if (dataRes.code === 200 && dataRes.data) {
        voteData.value = dataRes.data as VoteOBSDataModel
        lastHash.value = hash
      } else {
        voteData.value = null
      }
    }
  } catch (err) {
    console.warn('[DanmakuVoteBlock] 同步弹幕投票状态失败:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void poll(true)
})

watch(
  () => props.userInfo?.id,
  () => {
    lastHash.value = ''
    loading.value = true
    void poll(true)
  },
)

useIntervalFn(() => {
  if (visibility.value === 'visible') {
    void poll(false)
  }
}, 5_000)

useIntervalFn(() => {
  if (voteData.value?.isActive) {
    nowMs.value = Date.now()
  }
}, 1_000)
</script>

<template>
  <BlockCard
    v-if="voteData || showWhenIdle"
    :framed="values.framed !== false"
    :backgrounded="values.backgrounded !== false"
  >
    <template #header>
      <div class="flex-between w-full">
        <span class="flex items-center gap-1.5 font-semibold text-sm">
          <Vote class="size-4" />
          {{ title }}
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          title="刷新投票状态"
          @click="poll(true)"
        >
          <RefreshCw class="size-3.5" />
        </Button>
      </div>
    </template>

    <div
      v-if="loading"
      class="py-6 flex justify-center"
    >
      <Spin />
    </div>
    <div
      v-else-if="voteData"
      class="w-full overflow-hidden rounded-[var(--radius)]"
    >
      <DanmakuVoteCard
        :data="voteData"
        :theme="theme"
        position="fill"
        :max-display="maxDisplay"
        :current-time-ms="nowMs"
      />
    </div>
    <Empty
      v-else
      :description="idleText"
      class="py-4 text-xs"
    />
  </BlockCard>
</template>
