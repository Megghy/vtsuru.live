<script setup lang="ts">
import { CloudAdd20Filled, Play24Filled, Search24Regular } from '@vicons/fluent'
import { useVirtualList } from '@vueuse/core'
import { NButton, NEmpty, NIcon, NInput, NSelect, NTag, NTooltip } from 'naive-ui'
import { computed, ref, watch } from 'vue'

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
const filterEpoch = ref(0)
watch([searchKeyword, selectedTag, selectedAuthor], () => {
  filterEpoch.value += 1
})
const listKey = computed(() => `${selectedTag.value ?? 'all'}:${selectedAuthor.value ?? 'all'}:${filterEpoch.value}`)

const { list, containerProps, wrapperProps } = useVirtualList(filteredSongs, {
  itemHeight: 60,
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
    <header class="compact-heading">
      <div>
        <span class="heading-kicker">QUICK INDEX</span>
        <h2>快速曲库</h2>
      </div>
      <span
        :key="listKey"
        class="count is-pulsing"
      >
        {{ filteredSongs.length }} 首
      </span>
    </header>

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
    </div>

    <SongPlayer
      v-if="previewSong"
      v-model:is-lrc-loading="isLrcLoading"
      :song="previewSong"
      class="preview-player"
    />

    <Transition
      name="compact-swap"
      mode="out-in"
    >
      <NEmpty
        v-if="filteredSongs.length === 0"
        :key="`empty-${listKey}`"
        description="暂无曲目"
        style="margin-top: 48px"
      />

      <div
        v-else
        :key="listKey"
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
              'is-tag-active': selectedTag && song.tags?.includes(selectedTag),
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
              <NTag
                v-if="singingSongKeySet.has(song.key)"
                size="tiny"
                :bordered="false"
                type="warning"
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
            <button
              v-for="tag in (song.tags ?? []).slice(0, 3)"
              :key="tag"
              type="button"
              class="clickable-tag"
              :class="{ 'is-active': selectedTag === tag }"
              :aria-pressed="selectedTag === tag"
              @click="selectedTag = selectedTag === tag ? null : tag"
            >
              {{ tag }}
            </button>
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
                  :aria-label="`点歌：${song.name}`"
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
    </Transition>
  </div>
</template>

<style scoped>
.compact-template {
  width: 100%;
  max-width: var(--vtsuru-page-max-width, 1180px);
  min-width: 0;
  margin: 0 auto;
  padding: clamp(12px, 2vw, 24px);
}

.compact-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 14px;
  gap: 14px;
}

.heading-kicker {
  display: block;
  margin-bottom: 3px;
  color: var(--song-accent);
  font-size: 10px;
  font-weight: 750;
}

.compact-heading h2 {
  margin: 0;
  color: var(--song-fg);
  font-size: clamp(20px, 3vw, 28px);
  line-height: 1.15;
}

.toolbar {
  display: flex;
  align-items: center;
  padding: 8px;
  border: var(--vtsuru-page-border, 1px solid var(--song-border));
  border-radius: var(--vtsuru-page-radius, 8px);
  background: var(--song-panel);
  box-shadow: var(--vtsuru-page-shadow, none);
  gap: 8px;
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
  flex: 0 0 auto;
  font-size: 13px;
  color: var(--song-muted);
  font-variant-numeric: tabular-nums;
}

.count.is-pulsing {
  animation: count-pop 0.38s cubic-bezier(0.22, 1.4, 0.36, 1);
}

.compact-swap-enter-active,
.compact-swap-leave-active {
  transition:
    opacity 0.26s ease,
    transform 0.32s cubic-bezier(0.22, 1, 0.36, 1),
    filter 0.26s ease;
}

.compact-swap-enter-from {
  opacity: 0;
  filter: blur(3px);
  transform: translateY(12px);
}

.compact-swap-leave-to {
  opacity: 0;
  filter: blur(2px);
  transform: translateY(-8px);
}

.preview-player {
  margin-bottom: 14px;
}

.list-container {
  height: min(680px, 70dvh);
  min-height: 360px;
  border: var(--vtsuru-page-border, 1px solid var(--song-border));
  border-radius: var(--vtsuru-page-radius);
  background: var(--song-panel);
  box-shadow: var(--vtsuru-page-shadow);
  overflow: auto;
}

.row {
  height: 60px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 14px;
  box-sizing: border-box;
  border-bottom: 1px solid color-mix(in srgb, var(--song-border) 64%, transparent);
  transition:
    background-color 0.16s ease,
    transform 0.16s ease;
}

.row.is-odd {
  background: color-mix(in srgb, var(--song-fg) 2.5%, transparent);
}

.row:hover {
  background: var(--song-bg-hover);
  transform: translateX(2px);
}

.row.is-tag-active {
  background: color-mix(in srgb, var(--song-accent) 8%, transparent);
}

.row.is-singing {
  box-shadow: inset 3px 0 0 0 var(--song-warning);
}

.row.is-queued {
  box-shadow: inset 3px 0 0 0 var(--song-success);
}

.row-index {
  width: 28px;
  flex: 0 0 auto;
  text-align: right;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--song-subtle);
}

.row-cover {
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  border-radius: var(--vtsuru-page-radius);
  overflow: hidden;
  background: var(--song-panel-strong);
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
  color: var(--song-subtle);
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
  color: var(--song-fg);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.row-title .translate {
  font-size: 12px;
  color: var(--song-subtle);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 1;
  min-width: 0;
}

.row-author {
  margin-top: 1px;
  font-size: 12px;
  color: var(--song-subtle);
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
  max-width: 84px;
  height: 20px;
  padding: 0 7px;
  overflow: hidden;
  border: 0;
  border-radius: 999px;
  background: var(--song-panel-strong);
  color: var(--song-muted);
  font: inherit;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  transition:
    color 0.16s ease,
    background-color 0.16s ease,
    transform 0.2s cubic-bezier(0.22, 1.4, 0.36, 1),
    box-shadow 0.2s ease;
}

.clickable-tag:hover,
.clickable-tag:focus-visible {
  background: var(--song-accent-soft);
  color: var(--song-accent);
  outline: none;
  transform: translateY(-1px);
}

.clickable-tag.is-active {
  color: var(--song-accent);
  background: var(--song-accent-soft);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--song-accent) 18%, transparent);
  transform: scale(1.06);
  animation: tag-pop 0.34s cubic-bezier(0.22, 1.4, 0.36, 1);
}

.row-actions {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 6px;
}

@media (max-width: 640px) {
  .compact-template {
    padding: 8px 0 16px;
  }

  .search {
    max-width: none;
    flex-basis: 100%;
  }

  .row-tags {
    display: none;
  }

  .filter {
    flex: 1;
    width: auto;
  }

  .row-index {
    display: none;
  }

  .list-container {
    height: min(620px, 68dvh);
    min-height: 320px;
  }
}

@keyframes count-pop {
  0% {
    transform: scale(0.9);
    color: var(--song-accent);
  }
  55% {
    transform: scale(1.08);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes tag-pop {
  0% {
    transform: scale(0.94);
  }
  55% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1.06);
  }
}

@media (prefers-reduced-motion: reduce) {
  .count.is-pulsing,
  .clickable-tag.is-active {
    animation: none;
  }

  .compact-swap-enter-active,
  .compact-swap-leave-active,
  .row,
  .clickable-tag {
    transition: none;
  }

  .row:hover,
  .clickable-tag:hover,
  .clickable-tag.is-active {
    transform: none;
  }
}
</style>
