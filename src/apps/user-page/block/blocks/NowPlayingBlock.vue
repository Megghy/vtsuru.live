<script setup lang="ts">
import { MusicalNotesOutline, OpenOutline, RefreshOutline } from '@vicons/ionicons5'
import { useIntervalFn } from '@vueuse/core'
import { computed, onMounted, watch } from 'vue'
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
const waitingCount = computed(
  () => query.data.value?.songs.filter((song) => song.status === SongRequestStatus.Waiting).length ?? 0,
)
const showRequester = computed(
  () => values.value.showRequester !== false && query.data.value?.setting.showUserName !== false,
)

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
      <div class="playing-header flex items-center justify-between w-full">
        <span class="playing-heading flex items-center gap-1.5 font-semibold text-sm">
          <component
            :is="MusicalNotesOutline"
            class="size-4"
          />
          当前播放
        </span>
        <RouterLink
          v-if="props.userInfo?.name"
          v-slot="{ navigate }"
          :to="{ name: 'user-songList', params: { id: props.userInfo.name } }"
          custom
        >
          <Button
            variant="ghost"
            class="text-primary font-medium p-0"
            @click="navigate"
          >
            完整点歌页
            <component
              :is="OpenOutline"
              class="size-3.5 ml-1"
            />
          </Button>
        </RouterLink>
      </div>
    </template>

    <Alert
      v-if="!enabled"
      class="text-xs py-2"
    >
      <AlertDescription> 点歌功能未开放 </AlertDescription>
    </Alert>
    <Alert
      v-else-if="query.status.value === 'error'"
      variant="destructive"
      class="text-xs py-2"
    >
      <AlertDescription class="flex items-center justify-between w-full">
        <span>当前点歌状态加载失败</span>
        <Button
          variant="outline"
          size="xs"
          class="gap-1"
          @click="load(true)"
        >
          <component
            :is="RefreshOutline"
            class="size-3"
          />
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
    <div v-else>
      <div
        v-if="current"
        class="@container flex items-center gap-3 p-1"
      >
        <div
          class="size-10 @max-[340px]:size-9 rounded-full flex items-center justify-center shrink-0 bg-primary/10 text-primary"
        >
          <component
            :is="MusicalNotesOutline"
            class="size-5"
          />
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
          <strong class="text-lg font-bold text-primary block leading-tight">{{ waitingCount }}</strong>
          <span class="text-xs text-muted-foreground">首等待</span>
        </div>
      </div>
      <div
        v-else-if="query.status.value === 'success'"
        class="playing-empty flex flex-col items-center justify-center py-4 gap-2"
      >
        <Empty
          description="当前没有正在演唱的歌曲"
          class="text-xs"
        />
        <span
          v-if="waitingCount"
          class="waiting-note text-xs text-muted-foreground"
        >
          队列中还有 {{ waitingCount }} 首歌曲
        </span>
      </div>
    </div>
  </BlockCard>
</template>
