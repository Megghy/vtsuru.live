<script setup lang="ts">
import { Ban, Copy, ExternalLink, Music, Pin, RefreshCw, Search, Send, Shuffle } from 'lucide-vue-next'
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
import SongRandomDialog from '@/apps/user/pages/songListTemplate/components/SongRandomDialog.vue'
import { getSongFieldOptions } from '@/apps/user/pages/songListTemplate/utils/songListData'
import { canRequestSong } from '@/apps/user/pages/songListTemplate/utils/songRequestUtils'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
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
const selectedTag = ref<string | null>(null)
const pendingSong = ref<ResponseSongModel | null>(null)
const usePriorityOnRequest = ref(false)
const userPoints = ref<number | null>(null)
const requesting = ref(false)
const nextRequestTime = ref(new Date(0))
const randomDialogOpen = ref(false)
const randomSong = ref<ResponseSongModel | null>(null)

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

const totalSongs = computed(() => query.data.value?.songs ?? [])
const topTagOptions = computed(() => getSongFieldOptions(totalSongs.value, 'tags').slice(0, 8))

const basePointCost = computed(() => {
  const settings = query.data.value?.settings
  return settings?.enablePointRequest ? Math.max(0, settings.pointRequestCost ?? 0) : 0
})

const priorityPointCost = computed(() => {
  const settings = query.data.value?.settings
  return settings?.allowPointPriority ? Math.max(0, settings.pointPriorityCost ?? 0) : 0
})

const totalPendingPointCost = computed(
  () => basePointCost.value + (usePriorityOnRequest.value ? priorityPointCost.value : 0),
)

async function refreshUserPoints() {
  if (!props.userInfo?.id || !biliAuth.isAuthed) {
    userPoints.value = null
    return
  }
  const pts = await biliAuth.GetSpecificPoint(props.userInfo.id)
  userPoints.value = typeof pts === 'number' ? pts : null
}

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
  const filtered = totalSongs.value.filter((song) => {
    if (selectedTag.value && !song.tags?.includes(selectedTag.value)) return false
    if (!keyword) return true
    return [song.name, song.translateName, ...(song.author ?? [])].some((value) =>
      value?.toLocaleLowerCase().includes(keyword),
    )
  })
  return filtered.slice(0, maxItems.value)
})

function requestStatus(song: ResponseSongModel) {
  if (song.isDisabled) return { label: '暂不接歌', variant: 'secondary' as const }
  if (song.options) return { label: '有点歌要求', variant: 'outline' as const }
  const settings = query.data.value?.settings
  if (!settings?.allowFromWeb) return { label: '直播间点歌', variant: 'secondary' as const }
  if (!settings.allowAnonymousFromWeb) return { label: '登录后可点', variant: 'secondary' as const }
  return { label: '可网页点歌', variant: 'default' as const }
}

function getSongAction(song: ResponseSongModel) {
  if (song.isDisabled) return { kind: 'disabled' as const, reason: '主播暂未开放此曲目点歌' }
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
  usePriorityOnRequest.value = false
  if (basePointCost.value > 0 || query.data.value?.settings?.allowPointPriority) {
    void refreshUserPoints()
  }
}

async function confirmQuickRequest() {
  const song = pendingSong.value
  const ownerId = props.userInfo?.id
  if (!song || !ownerId || requesting.value) return
  if (totalPendingPointCost.value > 0 && !biliAuth.isAuthed) {
    toast.warning('使用积分点歌或插队需要先绑定 B 站账号')
    return
  }

  requesting.value = true
  try {
    const requestOptions = biliAuth.isAuthed
      ? { headers: Object.fromEntries(await biliAuth.getBiliAuthHeaders()) }
      : undefined
    const res = await postApiLiveRequestAddFromWeb(
      { target: ownerId, song: song.key, usePriority: usePriorityOnRequest.value },
      requestOptions,
    )
    if (res.code !== 200) {
      throw new Error(res.message || '点歌失败')
    }
    nextRequestTime.value = new Date(Date.now() + 30_000)
    toast.success(usePriorityOnRequest.value ? `已积分插队点播《${song.name}》` : `已成功点播《${song.name}》`)
    pendingSong.value = null
    await refreshUserPoints()
  } catch (err: any) {
    toast.error(err?.message || '点歌失败，请稍后重试')
  } finally {
    requesting.value = false
  }
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
          placeholder="搜索歌曲或歌手"
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
          :class="{ 'opacity-65': song.isDisabled }"
        >
          <div class="song-main min-w-0">
            <div class="flex items-center gap-1 min-w-0">
              <Pin
                v-if="song.isPinned"
                class="size-3 text-primary shrink-0"
              />
              <strong class="text-xs font-semibold truncate block">{{ song.name }}</strong>
            </div>
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
              :disabled="getSongAction(song).kind === 'disabled'"
              @click="handleQuickAction(song)"
            >
              <component
                :is="
                  getSongAction(song).kind === 'disabled' ? Ban : getSongAction(song).kind === 'request' ? Send : Copy
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

    <!-- 区块点歌确认弹窗（支持积分点歌与积分插队） -->
    <Dialog
      :open="Boolean(pendingSong)"
      @update:open="(val) => !val && (pendingSong = null)"
    >
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>确认在线点歌</DialogTitle>
          <DialogDescription> 确定向主播点播《{{ pendingSong?.name }}》吗？ </DialogDescription>
        </DialogHeader>

        <div
          v-if="basePointCost > 0 || query.data.value?.settings?.allowPointPriority"
          class="space-y-3 text-xs"
        >
          <div class="flex-between rounded-md border bg-muted/40 px-3 py-2">
            <span class="text-muted-foreground">基础点歌消耗</span>
            <span class="font-medium font-mono">
              {{ basePointCost > 0 ? `${basePointCost} 积分` : '免费' }}
            </span>
          </div>

          <label
            v-if="query.data.value?.settings?.allowPointPriority"
            class="flex-between rounded-md border px-3 py-2 cursor-pointer"
          >
            <span class="flex items-center gap-2">
              <Checkbox v-model:checked="usePriorityOnRequest" />
              <span>同时使用积分插队</span>
            </span>
            <span class="font-medium font-mono">+{{ priorityPointCost }} 积分</span>
          </label>

          <div class="flex-between px-1 pt-1 border-t">
            <span class="text-muted-foreground">
              合计消耗：<strong class="text-foreground font-mono">{{ totalPendingPointCost }} 积分</strong>
            </span>
            <span
              v-if="biliAuth.isAuthed"
              class="text-muted-foreground"
            >
              当前余额：<strong class="text-foreground font-mono">{{ userPoints ?? '...' }}</strong>
            </span>
            <span
              v-else-if="totalPendingPointCost > 0"
              class="text-destructive"
            >
              需先绑定 B 站账号
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            :disabled="requesting"
            @click="pendingSong = null"
          >
            取消
          </Button>
          <Button
            :loading="requesting"
            :disabled="totalPendingPointCost > 0 && !biliAuth.isAuthed"
            @click="confirmQuickRequest"
          >
            {{ totalPendingPointCost > 0 ? `确认消耗 ${totalPendingPointCost} 积分点歌` : '确认点歌' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <SongRandomDialog
      v-model:open="randomDialogOpen"
      :song="randomSong"
      :is-self="account.id === userInfo?.id"
      :live-request-settings="query.data.value?.settings"
      :can-reroll="totalSongs.filter((s) => !s.isDisabled).length > 1"
      @reroll="handleRandomPick"
      @request="handleQuickAction"
    />
  </BlockCard>
</template>
