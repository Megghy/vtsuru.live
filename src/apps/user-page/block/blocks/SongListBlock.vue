<script setup lang="ts">
import { MusicalNotesOutline, OpenOutline, RefreshOutline, SearchOutline } from '@vicons/ionicons5'
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

import type { Setting_LiveRequest, SongsInfo, UserInfo } from '@/api/api-models'
import { FunctionTypes } from '@/api/api-models'
import { fetchPublicSongList, fetchPublicSongRequestSettings } from '@/apps/user-page/api'
import { getEnabledUserFunctions } from '@/apps/user-page/featureNavigation'
import { useUserPageRuntimeQuery } from '@/apps/user-page/runtime/query'

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
  if (song.options) return { label: '有点歌要求', type: 'warning' as const }
  const settings = query.data.value?.settings
  if (!settings?.allowFromWeb) return { label: '直播间点歌', type: 'default' as const }
  if (!settings.allowAnonymousFromWeb) return { label: '登录后可点', type: 'info' as const }
  return { label: '可网页点歌', type: 'success' as const }
}
</script>

<template>
  <BlockCard
    :framed="values.framed !== false"
    :backgrounded="values.backgrounded !== false"
  >
    <template #header>
      <div class="song-header">
        <span class="song-heading">
          <span><MusicalNotesOutline /></span>
          歌单与点歌
        </span>
        <RouterLink
          v-if="props.userInfo?.name"
          v-slot="{ navigate }"
          :to="{ name: 'user-songList', params: { id: props.userInfo.name } }"
          custom
        >
          <UButton
            variant="link"
            color="primary"
            size="sm"
            @click="navigate"
          >
            完整歌单
            <template #leading>
              <span><OpenOutline /></span>
            </template>
          </UButton>
        </RouterLink>
      </div>
    </template>

    <UAlert
      v-if="!songListEnabled"
      color="info"
      ><template #description> 歌单功能未启用 </template></UAlert
    >
    <UAlert
      v-else-if="query.status.value === 'error'"
      color="error"
    >
      <template #description
        ><div class="error-row">
          <span>歌单加载失败</span>
          <UButton
            size="sm"
            variant="soft"
            @click="load(true)"
          >
            <template #leading>
              <span><RefreshOutline /></span>
            </template>
            重试
          </UButton>
        </div></template
      >
    </UAlert>
    <div
      v-else
      :aria-busy="query.status.value === 'loading' || query.status.value === 'idle'"
      size="small"
    >
      <UInput
        v-if="showSearch"
        v-model="search"
        clearable
        size="sm"
        placeholder="搜索歌曲或歌手"
        class="song-search"
      >
        <template #leading>
          <span><SearchOutline /></span>
        </template>
      </UInput>
      <UEmpty
        v-if="query.status.value === 'success' && filteredSongs.length === 0"
        size="sm"
        :description="search ? '没有匹配的歌曲' : '歌单暂时为空'"
        class="public-empty"
      />
      <div
        v-else
        class="song-list"
        :class="`song-list--${variant}`"
      >
        <article
          v-for="song in filteredSongs"
          :key="song.key"
          class="song-item"
        >
          <div class="song-main">
            <strong>{{ song.name }}</strong>
            <span
              v-if="song.translateName"
              class="song-translation"
              >{{ song.translateName }}</span
            >
            <span class="song-author">{{ song.author?.join(' / ') || '未填写歌手' }}</span>
          </div>
          <p
            v-if="variant === 'full' && song.description"
            class="song-summary"
          >
            {{ song.description }}
          </p>
          <div
            v-if="variant === 'full' && song.tags?.length"
            class="song-tags"
          >
            <UBadge
              v-for="tag in song.tags.slice(0, 4)"
              :key="tag"
              size="sm"
              :bordered="false"
            >
              {{ tag }}
            </UBadge>
          </div>
          <UBadge
            v-if="showRequestStatus"
            :color="requestStatus(song).type"
            size="sm"
            :bordered="false"
            class="request-status"
          >
            {{ requestStatus(song).label }}
          </UBadge>
        </article>
      </div>
    </div>
  </BlockCard>
</template>

<style scoped>
.song-header,
.song-heading,
.error-row {
  display: flex;
  align-items: center;
}
.song-header,
.error-row {
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}
.song-heading {
  gap: 7px;
  font-weight: 600;
}
.song-search {
  margin-bottom: 10px;
}
.song-list {
  container-type: inline-size;
  display: grid;
  gap: 6px;
}
.song-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 6px 12px;
  align-items: center;
  min-width: 0;
  padding: 9px 10px;
  border: var(--vtsuru-page-border-width) var(--vtsuru-page-border-style) var(--vtsuru-border);
  border-radius: var(--vtsuru-page-radius);
  background: var(--vtsuru-bg-muted);
}
.song-main {
  min-width: 0;
}
.song-main strong,
.song-translation,
.song-author {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.song-main strong {
  font-size: 14px;
}
.song-translation,
.song-author,
.song-summary {
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}
.song-translation {
  margin-top: 2px;
}
.song-author {
  margin-top: 3px;
}
.song-summary {
  grid-column: 1 / -1;
  margin: 0;
  line-height: 1.5;
  white-space: pre-wrap;
}
.song-tags {
  display: flex;
  grid-column: 1 / -1;
  gap: 5px;
  flex-wrap: wrap;
}
.request-status {
  grid-column: 2;
  grid-row: 1;
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
