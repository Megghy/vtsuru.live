<script setup lang="ts">
import { MusicalNotesOutline, OpenOutline, RefreshOutline, SearchOutline } from '@vicons/ionicons5'
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

import type { Setting_LiveRequest, SongsInfo, UserInfo } from '@/api/api-models'
import { FunctionTypes } from '@/api/api-models'
import { fetchPublicSongList, fetchPublicSongRequestSettings } from '@/apps/user-page/api'
import { getEnabledUserFunctions } from '@/apps/user-page/featureNavigation'
import { useUserPageRuntimeQuery } from '@/apps/user-page/runtime/query'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Spin } from '@/shared/ui/spin'

import BlockCard from '../BlockCard.vue'

const props = defineProps<{
  blockProps: unknown
  userInfo?: UserInfo
}>()

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
const songListEnabled = computed(() => getEnabledUserFunctions(props.userInfo).has(FunctionTypes.SongList))
const search = ref('')

const query = useUserPageRuntimeQuery<{ songs: SongsInfo[]; settings: Setting_LiveRequest }>({
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

function requestStatus(song: SongsInfo) {
  if (song.options) return { label: '有点歌要求', variant: 'outline' as const }
  const settings = query.data.value?.settings
  if (!settings?.allowFromWeb) return { label: '直播间点歌', variant: 'secondary' as const }
  if (!settings.allowAnonymousFromWeb) return { label: '登录后可点', variant: 'secondary' as const }
  return { label: '可网页点歌', variant: 'default' as const }
}
</script>

<template>
  <BlockCard
    :framed="values.framed !== false"
    :backgrounded="values.backgrounded !== false"
  >
    <template #header>
      <div class="song-header flex items-center justify-between w-full">
        <span class="song-heading flex items-center gap-1.5 font-semibold text-sm">
          <component :is="MusicalNotesOutline" class="size-4" />
          歌单与点歌
        </span>
        <RouterLink
          v-if="props.userInfo?.name"
          v-slot="{ navigate }"
          :to="{ name: 'user-songList', params: { id: props.userInfo.name } }"
          custom
        >
          <Button variant="ghost" class="text-primary font-medium p-0" @click="navigate">
            完整歌单
            <component :is="OpenOutline" class="size-3.5 ml-1" />
          </Button>
        </RouterLink>
      </div>
    </template>

    <Alert
      v-if="!songListEnabled"
      class="text-xs py-2"
    >
      <AlertDescription>
        歌单功能未启用
      </AlertDescription>
    </Alert>
    <Alert
      v-else-if="query.status.value === 'error'"
      variant="destructive"
      class="text-xs py-2"
    >
      <AlertDescription class="flex items-center justify-between w-full">
        <span>歌单加载失败</span>
        <Button variant="outline" size="xs" class="gap-1" @click="load(true)">
          <component :is="RefreshOutline" class="size-3" />
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
        <component :is="SearchOutline" class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input v-model="search" placeholder="搜索歌曲或歌手" class="pl-8" />
      </div>
      <Empty
        v-if="filteredSongs.length === 0"
        :description="search ? '没有匹配的歌曲' : '歌单暂时为空'"
        class="py-4 text-xs"
      />
      <div
        v-else
        class="song-list grid gap-1.5"
        :class="`song-list--${variant}`"
      >
        <article
          v-for="song in filteredSongs"
          :key="song.key"
          class="song-item grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-center p-2 rounded-lg border border-border bg-muted/40"
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
              class="text-[10px] h-4 px-1"
            >
              {{ tag }}
            </Badge>
          </div>
          <Badge
            v-if="showRequestStatus"
            :variant="requestStatus(song).variant"
            class="request-status text-[10px] h-4 px-1.5"
          >
            {{ requestStatus(song).label }}
          </Badge>
        </article>
      </div>
    </div>
  </BlockCard>
</template>

<style scoped>
.song-list {
  container-type: inline-size;
}
@container (max-width: 420px) {
  .song-item {
    grid-template-columns: minmax(0, 1fr);
  }
  .request-status {
    grid-column: 1;
    grid-row: auto;
    justify-self: start;
  }
}
</style>
