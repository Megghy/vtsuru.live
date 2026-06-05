<script setup lang="ts">
import type { SongsInfo } from '@/api/api-models'
import type { SongListConfigType } from '@/shared/types/TemplateTypes'
import { CloudAdd20Filled, Play24Filled, Search24Regular } from '@vicons/fluent'
import { useVirtualList } from '@vueuse/core'
import { NButton, NEmpty, NIcon, NInput, NSelect, NTag, NTooltip } from 'naive-ui'
import { computed, ref } from 'vue'
import { useAccount } from '@/api/account'
import SongPlayer from '@/components/SongPlayer.vue'
import { useBiliAuth } from '@/store/useBiliAuth'
import { getSongRequestButtonType, getSongRequestTooltip } from './utils/songRequestUtils'
import { useLiveRequestStatus } from './utils/useLiveRequestStatus'

const props = defineProps<SongListConfigType>()
const emits = defineEmits(['requestSong'])

const accountInfo = useAccount()
const biliAuth = useBiliAuth()

const searchKeyword = ref('')
const selectedTag = ref<string | null>(null)
const selectedAuthor = ref<string | null>(null)
const previewSong = ref<SongsInfo>()
const isLrcLoading = ref('')
const requestingKey = ref('')

const requestAuthState = computed(() => ({
  isLoggedIn: !!accountInfo.value.id,
  isBiliAuthed: biliAuth.isAuthed,
}))

const isSelf = computed(() => !!props.userInfo?.id && accountInfo.value?.id === props.userInfo.id)

const { singing: singingSongKeySet, queued: queuedSongKeySet } = useLiveRequestStatus(() => props.liveRequestActive)

const tagOptions = computed(() => {
  const set = new Set<string>()
  props.data?.forEach((song) => song.tags?.forEach((t) => t && set.add(t)))
  return [...set].map((t) => ({ label: t, value: t }))
})
const authorOptions = computed(() => {
  const set = new Set<string>()
  props.data?.forEach((song) => song.author?.forEach((a) => a && set.add(a)))
  return [...set].map((a) => ({ label: a, value: a }))
})

const filteredSongs = computed<SongsInfo[]>(() => {
  const data = props.data
  if (!data) return []
  const keyword = searchKeyword.value.trim().toLowerCase()
  const tag = selectedTag.value
  const author = selectedAuthor.value
  return data.filter((song) => {
    if (tag && !song.tags?.includes(tag)) return false
    if (author && !song.author?.includes(author)) return false
    if (!keyword) return true
    const haystack = [
      song.name,
      song.translateName ?? '',
      song.author?.join(' ') ?? '',
      song.tags?.join(' ') ?? '',
    ].join(' ').toLowerCase()
    return haystack.includes(keyword)
  })
})

const { list, containerProps, wrapperProps } = useVirtualList(filteredSongs, {
  itemHeight: 56,
  overscan: 8,
})

function requestSong(song: SongsInfo) {
  if (isSelf.value) return
  requestingKey.value = song.key
  emits('requestSong', song)
  window.setTimeout(() => { requestingKey.value = '' }, 2000)
}
</script>

<template>
  <div class="compact-template">
    <div class="toolbar">
      <NInput
        v-model:value="searchKeyword"
        class="search"
        clearable
        placeholder="搜索歌曲 / 歌手 / 标签…"
      >
        <template #prefix>
          <NIcon :component="Search24Regular" />
        </template>
      </NInput>
      <NSelect
        v-model:value="selectedAuthor"
        class="filter"
        clearable
        filterable
        placeholder="歌手"
        :options="authorOptions"
      />
      <NSelect
        v-model:value="selectedTag"
        class="filter"
        clearable
        filterable
        placeholder="标签"
        :options="tagOptions"
      />
      <span class="count">{{ filteredSongs.length }} 首</span>
    </div>

    <SongPlayer
      v-if="previewSong"
      v-model:is-lrc-loading="isLrcLoading"
      :song="previewSong"
      class="preview-player"
    />

    <NEmpty
      v-if="filteredSongs.length === 0"
      description="暂无曲目"
      style="margin-top: 48px"
    />

    <div
      v-else
      v-bind="containerProps"
      class="list-container"
    >
      <div v-bind="wrapperProps">
        <div
          v-for="{ data: song, index } in list"
          :key="song.key"
          class="row"
          :class="{
            'is-singing': singingSongKeySet.has(song.key),
            'is-queued': queuedSongKeySet.has(song.key),
            'is-odd': index % 2 === 1,
          }"
        >
          <div class="row-index">
            {{ index + 1 }}
          </div>
          <div class="row-cover">
            <img
              v-if="song.cover"
              :src="song.cover"
              :alt="song.name"
              loading="lazy"
              referrerpolicy="no-referrer"
            >
            <span
              v-else
              class="row-cover-fallback"
            >{{ song.name.charAt(0) }}</span>
          </div>
          <div class="row-main">
            <div class="row-title">
              <span
                class="name"
                :title="song.name"
              >{{ song.name }}</span>
              <span
                v-if="song.translateName"
                class="translate"
              >{{ song.translateName }}</span>
              <NTag
                v-if="singingSongKeySet.has(song.key)"
                size="tiny"
                :bordered="false"
                :color="{ color: 'rgba(240,160,64,0.15)', textColor: '#e08a20' }"
              >
                演唱中
              </NTag>
              <NTag
                v-else-if="queuedSongKeySet.has(song.key)"
                size="tiny"
                :bordered="false"
                type="success"
              >
                排队中
              </NTag>
              <NTag
                v-if="song.options?.scMinPrice"
                size="tiny"
                :bordered="false"
                type="error"
              >
                SC ¥{{ song.options.scMinPrice }}
              </NTag>
            </div>
            <div
              v-if="song.author?.length"
              class="row-author"
              :title="song.author.join(' / ')"
            >
              {{ song.author.join(' / ') }}
            </div>
          </div>
          <div class="row-tags">
            <NTag
              v-for="tag in (song.tags ?? []).slice(0, 3)"
              :key="tag"
              size="tiny"
              :bordered="false"
              class="clickable-tag"
              @click="selectedTag = selectedTag === tag ? null : tag"
            >
              {{ tag }}
            </NTag>
          </div>
          <div class="row-actions">
            <NButton
              v-if="song.url"
              quaternary
              circle
              size="small"
              :loading="isLrcLoading === song.key"
              title="试听"
              @click="previewSong = song"
            >
              <template #icon>
                <NIcon :component="Play24Filled" />
              </template>
            </NButton>
            <NTooltip v-if="!isSelf">
              <template #trigger>
                <NButton
                  size="small"
                  circle
                  :type="getSongRequestButtonType(song, liveRequestSettings, requestAuthState)"
                  :loading="requestingKey === song.key"
                  @click="requestSong(song)"
                >
                  <template #icon>
                    <NIcon :component="CloudAdd20Filled" />
                  </template>
                </NButton>
              </template>
              {{ getSongRequestTooltip(song, liveRequestSettings, requestAuthState) }}
            </NTooltip>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.compact-template {
  width: 100%;
  max-width: 920px;
  margin: 0 auto;
  padding: 8px 4px 24px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.search {
  flex: 1;
  min-width: 180px;
  max-width: 360px;
}

.filter {
  width: 140px;
}

.count {
  margin-left: auto;
  font-size: 13px;
  color: var(--n-text-color-3);
}

.preview-player {
  margin-bottom: 14px;
}

.list-container {
  height: 70vh;
  min-height: 400px;
  border: 1px solid var(--n-border-color);
  border-radius: 12px;
  overflow: auto;
}

.row {
  height: 56px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 14px;
  box-sizing: border-box;
  border-bottom: 1px solid var(--n-divider-color);
  transition: background-color 0.12s ease;
}

.row.is-odd {
  background: var(--n-action-color);
}

.row:hover {
  background: var(--n-button-color-hover, rgba(127, 127, 127, 0.08));
}

.row.is-singing {
  box-shadow: inset 3px 0 0 0 #f0a040;
}

.row.is-queued {
  box-shadow: inset 3px 0 0 0 #52c41a;
}

.row-index {
  width: 28px;
  flex: 0 0 auto;
  text-align: right;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--n-text-color-3);
}

.row-cover {
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  border-radius: 8px;
  overflow: hidden;
  background: var(--n-action-color);
  display: flex;
  align-items: center;
  justify-content: center;
}

.row-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.row-cover-fallback {
  font-size: 18px;
  font-weight: 700;
  color: var(--n-text-color-3);
}

.row-main {
  flex: 1;
  min-width: 0;
}

.row-title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.row-title .name {
  font-size: 14px;
  font-weight: 600;
  color: var(--n-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.row-title .translate {
  font-size: 12px;
  color: var(--n-text-color-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 1;
  min-width: 0;
}

.row-author {
  margin-top: 1px;
  font-size: 12px;
  color: var(--n-text-color-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-tags {
  flex: 0 0 auto;
  display: flex;
  gap: 4px;
  max-width: 200px;
  overflow: hidden;
}

.clickable-tag {
  cursor: pointer;
}

.row-actions {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 6px;
}

@media (max-width: 640px) {
  .row-tags {
    display: none;
  }

  .filter {
    flex: 1;
    width: auto;
  }
}
</style>
