<script setup lang="ts">
import { ChevronDown, ChevronUp, ExternalLink, ListMusic, Music, RefreshCw } from 'lucide-vue-next'
import { useIntervalFn } from '@vueuse/core'
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

import type { ResponseUserInfo } from '@/api/generated/model'
import { FunctionTypes, SongRequestStatus } from '@/api/generated/model'
import { fetchPublicSongRequestState } from '@/apps/user-page/api'
import { getEnabledUserFunctions } from '@/apps/user-page/featureNavigation'
import { useUserPageRuntimeQuery } from '@/apps/user-page/runtime/query'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Empty } from '@/shared/ui/empty'
import { Spin } from '@/shared/ui/spin'

import BlockCard from '../BlockCard.vue'

const props = defineProps<{ blockProps: unknown; userInfo?: ResponseUserInfo }>()
const values = computed<Record<string, unknown>>(() =>
  props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps)
    ? (props.blockProps as Record<string, unknown>)
    : {},
)
const enabled = computed(() => getEnabledUserFunctions(props.userInfo).has(FunctionTypes.SongRequest))
const query = useUserPageRuntimeQuery({
  key: () => `now-playing:${props.userInfo?.id ?? 0}`,
  ttlMs: 15_000,
  loader: (signal) => fetchPublicSongRequestState(props.userInfo!.id, { signal }),
})
const current = computed(() => query.data.value?.songs.find((song) => song.status === SongRequestStatus.Singing))
const waitingList = computed(
  () => query.data.value?.songs.filter((song) => song.status === SongRequestStatus.Waiting) ?? [],
)
const waitingCount = computed(() => waitingList.value.length)
const showRequester = computed(
  () => values.value.showRequester !== false && query.data.value?.setting.showUserName !== false,
)
const showQueue = computed(() => values.value.showQueue !== false)
const queueLimit = computed(() => {
  const n = Number(values.value.queueLimit)
  return Number.isInteger(n) ? Math.min(10, Math.max(1, n)) : 5
})
const queueExpanded = ref(false)
const visibleWaitingSongs = computed(() => waitingList.value.slice(0, queueLimit.value))

async function load(force = false) {
  if (!props.userInfo?.id || !enabled.value) {
    query.cancel()
    return
  }
  try {
    await query.execute(force)
  } catch (error) {
    console.error('用户页当前点歌区块加载失败', error)
  }
}

onMounted(() => {
  void load()
})
watch(
  () => [props.userInfo?.id, enabled.value] as const,
  () => {
    void load()
  },
)
useIntervalFn(() => {
  void load(true)
}, 30_000)
</script>

<template>
  <BlockCard
    :framed="values.framed !== false"
    :backgrounded="values.backgrounded !== false"
  >
    <template #header>
      <div class="playing-header flex-between w-full">
        <span class="playing-heading flex items-center gap-1.5 font-semibold text-sm">
          <Music class="size-4" />
          当前播放
        </span>
        <RouterLink
          v-if="props.userInfo?.name"
          v-slot="{ navigate }"
          :to="{ name: 'user-songList', params: { id: props.userInfo.name } }"
          custom
        >
          <Button
            variant="link"
            size="xs"
            class="h-auto p-0 gap-1"
            @click="navigate"
          >
            完整点歌页
            <ExternalLink class="size-3.5" />
          </Button>
        </RouterLink>
      </div>
    </template>

    <Alert v-if="!enabled">
      <AlertDescription>点歌功能未开放</AlertDescription>
    </Alert>
    <Alert
      v-else-if="query.status.value === 'error'"
      variant="destructive"
    >
      <AlertDescription class="flex-between w-full">
        <span>当前点歌状态加载失败</span>
        <Button
          variant="outline"
          size="xs"
          class="gap-1"
          @click="load(true)"
        >
          <RefreshCw class="size-3" />
          重试
        </Button>
      </AlertDescription>
    </Alert>
    <div
      v-else-if="query.status.value === 'loading' || query.status.value === 'idle'"
      class="py-6 flex justify-center"
    >
      <Spin />
    </div>
    <div
      v-else
      class="space-y-2.5"
    >
      <div
        v-if="current"
        class="@container flex items-center gap-3 p-1"
      >
        <div class="size-10 @max-[340px]:size-9 rounded-full flex-center shrink-0 bg-primary/10 text-primary">
          <Music class="size-5" />
        </div>
        <div class="playing-copy flex-1 min-w-0 grid gap-0.5">
          <span class="status text-xs text-muted-foreground">正在演唱</span>
          <strong class="text-sm font-semibold truncate">{{ current.songName }}</strong>
          <span
            v-if="showRequester && current.user?.name"
            class="requester text-xs text-muted-foreground"
          >
            由 {{ current.user.name }} 点播
          </span>
        </div>
        <div class="text-center shrink-0 min-w-[54px] @max-[340px]:min-w-[42px]">
          <strong class="text-lg font-bold text-primary block leading-tight tabular-nums">{{ waitingCount }}</strong>
          <span class="text-xs text-muted-foreground">首等待</span>
        </div>
      </div>
      <Empty
        v-else
        :description="waitingCount ? `当前空闲，待唱队列共 ${waitingCount} 首` : '当前暂无正在演唱的歌曲'"
        class="py-4 text-xs"
      />

      <!-- 接下来待唱队列 -->
      <div
        v-if="showQueue && visibleWaitingSongs.length > 0"
        class="border-t border-border pt-2"
      >
        <button
          type="button"
          class="w-full flex-between text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-0.5"
          @click="queueExpanded = !queueExpanded"
        >
          <span class="inline-flex items-center gap-1.5 font-medium">
            <ListMusic class="size-3.5" />
            接下来待唱（显示前 {{ visibleWaitingSongs.length }} 首 / 共 {{ waitingCount }} 首）
          </span>
          <component
            :is="queueExpanded ? ChevronUp : ChevronDown"
            class="size-3.5"
          />
        </button>
        <ol
          v-if="queueExpanded"
          class="mt-2 space-y-1 pl-0 list-none"
        >
          <li
            v-for="(song, idx) in visibleWaitingSongs"
            :key="song.id ?? `${song.songName}-${idx}`"
            class="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/45 text-xs"
          >
            <span class="w-4 text-center text-[11px] font-semibold text-muted-foreground tabular-nums shrink-0">
              {{ idx + 1 }}
            </span>
            <span class="flex-1 min-w-0 truncate font-medium">{{ song.songName }}</span>
            <span
              v-if="showRequester && song.user?.name"
              class="text-[11px] text-muted-foreground truncate max-w-[96px] shrink-0"
            >
              {{ song.user.name }}
            </span>
          </li>
        </ol>
      </div>
    </div>
  </BlockCard>
</template>
