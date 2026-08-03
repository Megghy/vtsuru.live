<script setup lang="ts">
import { CloudAdd20Filled, Play24Filled, Search24Regular } from '@vicons/fluent'
import { useVirtualList } from '@vueuse/core'
import { computed, ref } from 'vue'

import { useAccount } from '@/api/account'
import type { SongsInfo } from '@/api/api-models'
import SongPlayer from '@/components/SongPlayer.vue'
import type { SongListConfigType } from '@/shared/types/TemplateTypes'
import { useBiliAuth } from '@/store/useBiliAuth'

import { filterSongs, getSongFieldOptions } from './utils/songListData'
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
  return getSongFieldOptions(props.data, 'tags')
})
const authorOptions = computed(() => {
  return getSongFieldOptions(props.data, 'author')
})

const filteredSongs = computed<SongsInfo[]>(() => {
  return filterSongs(props.data, {
    keyword: searchKeyword.value,
    tag: selectedTag.value,
    author: selectedAuthor.value,
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
  window.setTimeout(() => {
    requestingKey.value = ''
  }, 2000)
}
</script>

<template>
  <div class="compact-template">
    <div class="toolbar">
      <UInput
        v-model="searchKeyword"
        class="search"
        clearable
        placeholder="搜索歌曲 / 歌手 / 标签…"
      >
        <template #leading>
          <component :is="Search24Regular" />
        </template>
      </UInput>
      <USelect
        v-model="selectedAuthor"
        class="filter"
        clearable
        filterable
        placeholder="歌手"
        :items="authorOptions"
      />
      <USelect
        v-model="selectedTag"
        class="filter"
        clearable
        filterable
        placeholder="标签"
        :items="tagOptions"
      />
      <span class="count">{{ filteredSongs.length }} 首</span>
    </div>

    <SongPlayer
      v-if="previewSong"
      v-model:is-lrc-loading="isLrcLoading"
      :song="previewSong"
      class="preview-player"
    />

    <UEmpty
      v-if="filteredSongs.length === 0"
      description="暂无曲目"
      style="margin-top: 48px"
      class="public-empty"
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
            />
            <span
              v-else
              class="row-cover-fallback"
              >{{ song.name.charAt(0) }}</span
            >
          </div>
          <div class="row-main">
            <div class="row-title">
              <span
                class="name"
                :title="song.name"
                >{{ song.name }}</span
              >
              <span
                v-if="song.translateName"
                class="translate"
                >{{ song.translateName }}</span
              >
              <UBadge
                v-if="singingSongKeySet.has(song.key)"
                size="xs"
                :bordered="false"
                style="background: rgba(240, 160, 64, 0.15); color: #e08a20"
              >
                演唱中
              </UBadge>
              <UBadge
                v-else-if="queuedSongKeySet.has(song.key)"
                size="xs"
                :bordered="false"
                color="success"
              >
                排队中
              </UBadge>
              <UBadge
                v-if="song.options?.scMinPrice"
                size="xs"
                :bordered="false"
                color="error"
              >
                SC ¥{{ song.options.scMinPrice }}
              </UBadge>
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
            <UBadge
              v-for="tag in (song.tags ?? []).slice(0, 3)"
              :key="tag"
              size="xs"
              :bordered="false"
              class="clickable-tag"
              @click="selectedTag = selectedTag === tag ? null : tag"
            >
              {{ tag }}
            </UBadge>
          </div>
          <div class="row-actions">
            <UButton
              v-if="song.url"
              variant="ghost"
              square
              size="sm"
              :loading="isLrcLoading === song.key"
              title="试听"
              @click="previewSong = song"
            >
              <template #leading>
                <component :is="Play24Filled" />
              </template>
            </UButton>
            <UTooltip v-if="!isSelf">
              <UButton
                size="sm"
                square
                :color="getSongRequestButtonType(song, liveRequestSettings, requestAuthState)"
                :loading="requestingKey === song.key"
                @click="requestSong(song)"
              >
                <template #leading>
                  <component :is="CloudAdd20Filled" />
                </template>
              </UButton>

              <template #content>{{ getSongRequestTooltip(song, liveRequestSettings, requestAuthState) }}</template>
            </UTooltip>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.compact-template {
  width: 100%;
  max-width: var(--vtsuru-page-max-width, 1180px);
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
  color: var(--vtsuru-surface-fg-subtle, var(--vtsuru-fg-muted));
}

.preview-player {
  margin-bottom: 14px;
}

.list-container {
  height: 70vh;
  min-height: 400px;
  border: var(--vtsuru-page-border);
  border-radius: var(--vtsuru-page-radius);
  box-shadow: var(--vtsuru-page-shadow);
  overflow: auto;
}

.row {
  height: 56px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 14px;
  box-sizing: border-box;
  border-bottom: 1px solid var(--vtsuru-border);
  transition: background-color 0.12s ease;
}

.row.is-odd {
  background: var(--vtsuru-bg-inset);
}

.row:hover {
  background: var(--vtsuru-bg-muted, rgba(127, 127, 127, 0.08));
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
  color: var(--vtsuru-surface-fg-subtle, var(--vtsuru-fg-muted));
}

.row-cover {
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  border-radius: var(--vtsuru-page-radius);
  overflow: hidden;
  background: var(--vtsuru-bg-inset);
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
  color: var(--vtsuru-surface-fg-subtle, var(--vtsuru-fg-muted));
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
  color: var(--vtsuru-fg);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.row-title .translate {
  font-size: 12px;
  color: var(--vtsuru-surface-fg-subtle, var(--vtsuru-fg-muted));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 1;
  min-width: 0;
}

.row-author {
  margin-top: 1px;
  font-size: 12px;
  color: var(--vtsuru-surface-fg-subtle, var(--vtsuru-fg-muted));
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
