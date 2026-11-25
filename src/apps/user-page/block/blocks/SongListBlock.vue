<script setup lang="ts">
import { Ban, Copy, ExternalLink, Music, Pin, Play, RefreshCw, Search, Send, Shuffle } from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import type { SongRequestInfo } from '@/api/client-types'
import type { ResponseSongModel, ResponseUserInfo, SettingSongRequest } from '@/api/generated/model'
import { FunctionTypes } from '@/api/generated/model'
import { fetchPublicSongList, fetchPublicSongRequestState } from '@/apps/user-page/api'
import { getEnabledUserFunctions } from '@/apps/user-page/featureNavigation'
import { useUserPageRuntimeQuery } from '@/apps/user-page/runtime/query'
import SongOptionBadges from '@/apps/user/pages/songListTemplate/components/SongOptionBadges.vue'
import SongRandomDialog from '@/apps/user/pages/songListTemplate/components/SongRandomDialog.vue'
import SongRequestConfirmDialog from '@/apps/user/pages/songListTemplate/components/SongRequestConfirmDialog.vue'
import SongStatusBadge from '@/apps/user/pages/songListTemplate/components/SongStatusBadge.vue'
import { filterSongs, getSongFieldTopOptions } from '@/apps/user/pages/songListTemplate/utils/songListData'
import { useLiveRequestStatus } from '@/apps/user/pages/songListTemplate/utils/useLiveRequestStatus'
import { isNewSong } from '@/apps/user/pages/songListTemplate/utils/useSongListQueryState'
import { useSongRequestFlow } from '@/apps/user/pages/songListTemplate/utils/useSongRequestFlow'
import SongPlayer from '@/components/SongPlayer.vue'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Spin } from '@/shared/ui/spin'
import { TooltipProvider } from '@/shared/ui/tooltip'
import { getPlayableAudioUrl, getSongExternalLink } from '@/shared/utils/songMedia'

import BlockCard from '../BlockCard.vue'

const props = defineProps<{
  blockProps: unknown
  userInfo?: ResponseUserInfo
}>()

const account = useAccount()

const values = computed<Record<string, unknown>>(() =>
  props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps)
    ? (props.blockProps as Record<string, unknown>)
    : {},
)
const variant = computed(() => (values.value.variant === 'full' ? 'full' : 'compact'))
const maxItems = computed(() => {
  const value = Number(values.value.maxItems)
  return Number.isInteger(value) ? Math.min(30, Math.max(3, value)) : 6
})
const showSearch = computed(() => values.value.showSearch !== false)
const showRequestStatus = computed(() => values.value.showRequestStatus !== false)
const allowQuickRequest = computed(() => values.value.allowQuickRequest !== false)
const songListEnabled = computed(() => getEnabledUserFunctions(props.userInfo).has(FunctionTypes.SongList))

const search = ref('')
const selectedTag = ref<string | null>(null)
const previewSong = ref<ResponseSongModel | undefined>()
const isLrcLoading = ref<string | undefined>()
const randomDialogOpen = ref(false)
const randomSong = ref<ResponseSongModel | null>(null)

const query = useUserPageRuntimeQuery<{
  songs: ResponseSongModel[]
  settings: SettingSongRequest
  activeSongs: SongRequestInfo[]
}>({
  key: () => `song-list-summary:${props.userInfo?.id ?? 0}`,
  ttlMs: 60_000,
  loader: async (signal) => {
    const [songs, state] = await Promise.all([
      fetchPublicSongList(props.userInfo!.id, { signal }),
      fetchPublicSongRequestState(props.userInfo!.id, { signal }),
    ])
    return {
      songs,
      settings: state.setting,
      activeSongs: state.songs ?? [],
    }
  },
})

const totalSongs = computed(() => query.data.value?.songs ?? [])
const activeSongs = computed(() => query.data.value?.activeSongs ?? [])
const currentSettings = computed(() => query.data.value?.settings)
const topTagOptions = computed(() => getSongFieldTopOptions(totalSongs.value, 'tags', 8))

const { singing: singingKeys, queued: queuedKeys } = useLiveRequestStatus(() => activeSongs.value)

async function load(force = false) {
  if (!props.userInfo?.id || !songListEnabled.value) {
    query.cancel()
    return
  }
  try {
    await query.execute(force)
  } catch (error) {
    console.error('用户页歌单区块加载失败', error)
  }
}

const requestFlow = useSongRequestFlow({
  userInfo: () => props.userInfo,
  settings: () => currentSettings.value,
  songsActive: () => activeSongs.value,
  onActiveUpdated: () => load(true),
})

onMounted(() => {
  void load()
})
watch(
  () => [props.userInfo?.id, songListEnabled.value] as const,
  () => {
    void load()
  },
)

const filteredSongs = computed(() => {
  const matched = filterSongs(totalSongs.value, {
    keyword: search.value,
    tag: selectedTag.value,
  })
  return matched
    .toSorted((a, b) => Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned)))
    .slice(0, maxItems.value)
})

function requestStatus(song: ResponseSongModel) {
  if (song.isDisabled) return { label: '暂不接歌', variant: 'secondary' as const }
  const settings = currentSettings.value
  if (!settings?.allowFromWeb) return { label: '直播间点歌', variant: 'secondary' as const }
  if (!settings.allowAnonymousFromWeb) return { label: '登录后可点', variant: 'secondary' as const }
  return { label: '可网页点歌', variant: 'default' as const }
}

function getSongAction(song: ResponseSongModel) {
  if (song.isDisabled) return { kind: 'disabled' as const, reason: '主播暂未开放此曲目点歌' }
  if (!props.userInfo || !currentSettings.value) return { kind: 'copy' as const, reason: '' }
  const check = requestFlow.checkSongRequestable(song)
  if (check.shouldCopyOnly) return { kind: 'copy' as const, reason: check.reason }
  if (!check.canRequest) return { kind: 'disabled' as const, reason: check.reason }
  return { kind: 'request' as const, reason: '' }
}

function handleRandomPick() {
  const pool = totalSongs.value.filter((s) => !s.isDisabled)
  if (!pool.length) {
    toast.warning('当前没有可点选的歌曲')
    return
  }
  const candidates = randomSong.value && pool.length > 1 ? pool.filter((s) => s.key !== randomSong.value!.key) : pool
  randomSong.value = candidates[Math.floor(Math.random() * candidates.length)]
  randomDialogOpen.value = true
}
</script>

<template>
  <TooltipProvider>
    <BlockCard
      :framed="values.framed !== false"
      :backgrounded="values.backgrounded !== false"
    >
      <template #header>
        <div class="song-header flex-between gap-2 w-full">
          <div class="flex items-center gap-2 min-w-0">
            <span class="song-heading flex items-center gap-1.5 font-semibold text-sm">
              <Music class="size-4" />
              歌单与点歌
            </span>
            <Badge
              v-if="totalSongs.length > 0"
              variant="secondary"
              size="xs"
              class="tabular-nums"
            >
              {{ totalSongs.length }} 首
            </Badge>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <Button
              v-if="totalSongs.length > 0"
              variant="ghost"
              size="xs"
              class="gap-1"
              @click="handleRandomPick"
            >
              <Shuffle class="size-3" />
              随机
            </Button>
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
                完整歌单
                <ExternalLink class="size-3.5" />
              </Button>
            </RouterLink>
          </div>
        </div>
      </template>

      <Alert v-if="!songListEnabled">
        <AlertDescription>歌单功能未启用</AlertDescription>
      </Alert>
      <Alert
        v-else-if="query.status.value === 'error'"
        variant="destructive"
      >
        <AlertDescription class="flex-between w-full">
          <span>歌单加载失败</span>
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
          v-if="showSearch"
          class="relative"
        >
          <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            v-model="search"
            placeholder="搜索歌名、拼音首字母、歌手或标签"
            class="pl-8"
          />
        </div>

        <div
          v-if="variant === 'full' && topTagOptions.length > 0"
          class="flex flex-wrap gap-1"
        >
          <Button
            v-for="tag in topTagOptions"
            :key="tag.value"
            :variant="selectedTag === tag.value ? 'default' : 'secondary'"
            size="xs"
            class="rounded-full"
            @click="selectedTag = selectedTag === tag.value ? null : tag.value"
          >
            {{ tag.label }}
          </Button>
        </div>

        <SongPlayer
          v-if="previewSong"
          v-model:is-lrc-loading="isLrcLoading"
          :song="previewSong"
          @close="previewSong = undefined"
        />

        <Empty
          v-if="filteredSongs.length === 0"
          :description="search || selectedTag ? '没有匹配的歌曲' : '歌单暂时为空'"
          class="py-4 text-xs"
        />
        <div
          v-else
          class="@container grid gap-1.5"
        >
          <article
            v-for="song in filteredSongs"
            :key="song.key"
            class="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-center p-2 rounded-lg border border-border bg-muted/40 @max-[420px]:grid-cols-1"
            :class="{
              'opacity-65': song.isDisabled,
              'border-amber-500/40 bg-amber-500/5': singingKeys.has(song.key),
              'border-emerald-500/35 bg-emerald-500/5': !singingKeys.has(song.key) && queuedKeys.has(song.key),
            }"
          >
            <div class="song-main min-w-0">
              <div class="flex items-center gap-1 min-w-0 flex-wrap">
                <Pin
                  v-if="song.isPinned"
                  class="size-3 text-primary shrink-0"
                />
                <strong class="text-xs font-semibold truncate">{{ song.name }}</strong>
                <Badge
                  v-if="isNewSong(song)"
                  variant="brand"
                  size="xs"
                >
                  NEW
                </Badge>
                <SongStatusBadge
                  :song-key="song.key"
                  :singing-keys="singingKeys"
                  :queued-keys="queuedKeys"
                  variant="tag"
                />
              </div>
              <span
                v-if="song.translateName"
                class="song-translation text-[11px] text-muted-foreground truncate block mt-0.5"
              >
                {{ song.translateName }}
              </span>
              <span class="song-author text-[11px] text-muted-foreground truncate block mt-0.5">
                {{ song.author?.join(' / ') || '未填写歌手' }}
                <template v-if="song.language?.length"> · {{ song.language.join(' / ') }}</template>
              </span>
            </div>

            <div class="flex items-center gap-1 justify-end flex-wrap @max-[420px]:justify-start">
              <SongOptionBadges
                v-if="song.options"
                :options="song.options"
                variant="semantic"
                size="tiny"
              />
              <Badge
                v-else-if="showRequestStatus"
                :variant="requestStatus(song).variant"
                size="xs"
              >
                {{ requestStatus(song).label }}
              </Badge>
              <Button
                v-if="getPlayableAudioUrl(song)"
                variant="ghost"
                size="icon-xs"
                :disabled="isLrcLoading === song.key"
                :aria-label="`试听《${song.name}》`"
                @click="previewSong = song"
              >
                <Play class="size-3" />
              </Button>
              <a
                v-if="getSongExternalLink(song)"
                :href="getSongExternalLink(song)!.url"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  variant="ghost"
                  size="icon-xs"
                  :aria-label="getSongExternalLink(song)!.label"
                >
                  <ExternalLink class="size-3" />
                </Button>
              </a>
              <Button
                v-if="allowQuickRequest"
                variant="outline"
                size="xs"
                class="gap-1"
                :disabled="getSongAction(song).kind === 'disabled'"
                @click="requestFlow.requestSong(song)"
              >
                <component
                  :is="
                    getSongAction(song).kind === 'disabled'
                      ? Ban
                      : getSongAction(song).kind === 'request'
                        ? Send
                        : Copy
                  "
                  class="size-3"
                />
                {{
                  getSongAction(song).kind === 'disabled'
                    ? '暂不可点'
                    : getSongAction(song).kind === 'request'
                      ? '点歌'
                      : '复制'
                }}
              </Button>
            </div>

            <p
              v-if="variant === 'full' && song.description"
              class="song-summary col-span-2 text-xs text-muted-foreground m-0 leading-relaxed whitespace-pre-wrap"
            >
              {{ song.description }}
            </p>
            <div
              v-if="variant === 'full' && song.tags?.length"
              class="song-tags col-span-2 flex flex-wrap gap-1"
            >
              <Badge
                v-for="tag in song.tags.slice(0, 4)"
                :key="tag"
                variant="secondary"
                size="xs"
              >
                {{ tag }}
              </Badge>
            </div>
          </article>
        </div>
      </div>

      <!-- 复用统一点歌确认弹窗 -->
      <SongRequestConfirmDialog
        v-model:use-priority="requestFlow.usePriorityOnRequest.value"
        :song="requestFlow.pendingSong.value"
        :settings="currentSettings"
        :base-point-cost="requestFlow.basePointCost.value"
        :priority-point-cost="requestFlow.priorityPointCost.value"
        :total-point-cost="requestFlow.totalPendingPointCost.value"
        :user-points="requestFlow.userPoints.value"
        :is-bili-authed="requestFlow.biliAuth.isAuthed"
        :is-submitting="requestFlow.isSubmittingRequest.value"
        @close="requestFlow.cancelPending"
        @confirm="requestFlow.submitWebSongRequest"
      />

      <SongRandomDialog
        v-model:open="randomDialogOpen"
        :song="randomSong"
        :is-self="account.id === userInfo?.id"
        :live-request-settings="currentSettings"
        :can-reroll="totalSongs.filter((s) => !s.isDisabled).length > 1"
        @reroll="handleRandomPick"
        @request="requestFlow.requestSong"
      />
    </BlockCard>
  </TooltipProvider>
</template>
