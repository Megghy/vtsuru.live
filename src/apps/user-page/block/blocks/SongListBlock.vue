<script setup lang="ts">
import { Copy, ExternalLink, Music, RefreshCw, Search, Send } from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import { postApiLiveRequestAddFromWeb } from '@/api/generated/live-request/live-request'
import type { ResponseSongModel, ResponseUserInfo, SettingSongRequest } from '@/api/generated/model'
import { FunctionTypes } from '@/api/generated/model'
import { fetchPublicSongList, fetchPublicSongRequestSettings } from '@/apps/user-page/api'
import { getEnabledUserFunctions } from '@/apps/user-page/featureNavigation'
import { useUserPageRuntimeQuery } from '@/apps/user-page/runtime/query'
import { canRequestSong } from '@/apps/user/pages/songListTemplate/utils/songRequestUtils'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Spin } from '@/shared/ui/spin'
import { useBiliAuth } from '@/store/useBiliAuth'

import BlockCard from '../BlockCard.vue'

const props = defineProps<{
  blockProps: unknown
  userInfo?: ResponseUserInfo
}>()

const account = useAccount()
const biliAuth = useBiliAuth()

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
const pendingSong = ref<ResponseSongModel | null>(null)
const requesting = ref(false)
const nextRequestTime = ref(new Date(0))

const query = useUserPageRuntimeQuery<{ songs: ResponseSongModel[]; settings: SettingSongRequest }>({
  key: () => `song-list-summary:${props.userInfo?.id ?? 0}`,
  ttlMs: 60_000,
  loader: async (signal) => {
    const [songs, settings] = await Promise.all([
      fetchPublicSongList(props.userInfo!.id, { signal }),
      fetchPublicSongRequestSettings(props.userInfo!.id, { signal }),
    ])
    return { songs, settings }
  },
})

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
  const keyword = search.value.trim().toLocaleLowerCase()
  const songs = query.data.value?.songs ?? []
  const filtered = keyword
    ? songs.filter((song) =>
        [song.name, song.translateName, ...(song.author ?? [])].some((value) =>
          value?.toLocaleLowerCase().includes(keyword),
        ),
      )
    : songs
  return filtered.slice(0, maxItems.value)
})

function requestStatus(song: ResponseSongModel) {
  if (song.options) return { label: '有点歌要求', variant: 'outline' as const }
  const settings = query.data.value?.settings
  if (!settings?.allowFromWeb) return { label: '直播间点歌', variant: 'secondary' as const }
  if (!settings.allowAnonymousFromWeb) return { label: '登录后可点', variant: 'secondary' as const }
  return { label: '可网页点歌', variant: 'default' as const }
}

function getSongAction(song: ResponseSongModel) {
  if (!props.userInfo || !query.data.value?.settings) return { kind: 'copy' as const, reason: '' }
  const check = canRequestSong(
    song,
    props.userInfo,
    query.data.value.settings,
    Boolean(account.value.id),
    biliAuth.isAuthed,
    nextRequestTime.value,
  )
  if (check.shouldCopyOnly) return { kind: 'copy' as const, reason: check.reason }
  if (!check.canRequest) return { kind: 'disabled' as const, reason: check.reason }
  return { kind: 'request' as const, reason: '' }
}

async function handleQuickAction(song: ResponseSongModel) {
  const action = getSongAction(song)
  if (action.kind === 'copy') {
    const prefix = query.data.value?.settings?.orderPrefix ?? ''
    const cmd = `${prefix} ${song.name}`.trim()
    try {
      await navigator.clipboard.writeText(cmd)
      toast.success(`已复制点歌指令：${cmd}`)
    } catch {
      toast.error('复制失败，请手动复制')
    }
    return
  }
  if (action.kind === 'disabled') {
    toast.info(action.reason || '暂不可点歌')
    return
  }
  pendingSong.value = song
}

async function confirmQuickRequest() {
  const song = pendingSong.value
  const ownerId = props.userInfo?.id
  if (!song || !ownerId || requesting.value) return
  requesting.value = true
  try {
    const requestOptions = biliAuth.isAuthed
      ? { headers: Object.fromEntries(await biliAuth.getBiliAuthHeaders()) }
      : undefined
    const res = await postApiLiveRequestAddFromWeb({ target: ownerId, song: song.key }, requestOptions)
    if (res.code !== 200) {
      throw new Error(res.message || '点歌失败')
    }
    nextRequestTime.value = new Date(Date.now() + 30_000)
    toast.success(`已成功点播《${song.name}》`)
    pendingSong.value = null
  } catch (err: any) {
    toast.error(err?.message || '点歌失败，请稍后重试')
  } finally {
    requesting.value = false
  }
}
</script>

<template>
  <BlockCard
    :framed="values.framed !== false"
    :backgrounded="values.backgrounded !== false"
  >
    <template #header>
      <div class="song-header flex-between w-full">
        <span class="song-heading flex items-center gap-1.5 font-semibold text-sm">
          <Music class="size-4" />
          歌单与点歌
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
            完整歌单
            <ExternalLink class="size-3.5" />
          </Button>
        </RouterLink>
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
    <div v-else>
      <div
        v-if="showSearch"
        class="relative mb-2.5"
      >
        <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input
          v-model="search"
          placeholder="搜索歌曲或歌手"
          class="pl-8"
        />
      </div>
      <Empty
        v-if="filteredSongs.length === 0"
        :description="search ? '没有匹配的歌曲' : '歌单暂时为空'"
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
        >
          <div class="song-main min-w-0">
            <strong class="text-xs font-semibold truncate block">{{ song.name }}</strong>
            <span
              v-if="song.translateName"
              class="song-translation text-[11px] text-muted-foreground truncate block mt-0.5"
            >
              {{ song.translateName }}
            </span>
            <span class="song-author text-[11px] text-muted-foreground truncate block mt-0.5">
              {{ song.author?.join(' / ') || '未填写歌手' }}
            </span>
          </div>
          <div class="flex items-center gap-1.5 justify-end @max-[420px]:justify-start">
            <Badge
              v-if="showRequestStatus"
              :variant="requestStatus(song).variant"
              size="xs"
            >
              {{ requestStatus(song).label }}
            </Badge>
            <Button
              v-if="allowQuickRequest"
              variant="outline"
              size="xs"
              class="gap-1"
              @click="handleQuickAction(song)"
            >
              <component
                :is="getSongAction(song).kind === 'request' ? Send : Copy"
                class="size-3"
              />
              {{ getSongAction(song).kind === 'request' ? '点歌' : '复制' }}
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

    <AlertDialog
      :open="!!pendingSong"
      @update:open="(val) => !val && (pendingSong = null)"
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认点歌</AlertDialogTitle>
          <AlertDialogDescription>
            确定向主播点播《{{ pendingSong?.name }}》吗？
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="requesting">取消</AlertDialogCancel>
          <AlertDialogAction
            :disabled="requesting"
            @click.prevent="confirmQuickRequest"
          >
            {{ requesting ? '提交中...' : '确认点歌' }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </BlockCard>
</template>
