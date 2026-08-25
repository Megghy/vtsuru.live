<script setup lang="ts">
import { Play24Filled, Search24Regular } from '@vicons/fluent'
import { useMediaQuery, useVirtualList } from '@vueuse/core'
import { NButton, NEmpty, NIcon, NInput, NSelect } from 'naive-ui'
import { computed, ref } from 'vue'

import type { SongsInfo } from '@/api/api-models'
import SongPlayer from '@/components/SongPlayer.vue'
import type { SongListConfigType } from '@/shared/types/TemplateTypes'

import SongOptionBadges from './components/SongOptionBadges.vue'
import SongRequestButton from './components/SongRequestButton.vue'
import SongStatusBadge from './components/SongStatusBadge.vue'
import { filterSongs, getSongFieldOptions } from './utils/songListData'
import { useFilterListKey, useSongListTemplateCore } from './utils/useSongListTemplateCore'

const props = defineProps<SongListConfigType>()
const emits = defineEmits(['requestSong'])

const {
  requestAuthState,
  isSelf,
  requestingKey,
  singingSongKeys: singingSongKeySet,
  queuedSongKeys: queuedSongKeySet,
  beginRequest,
} = useSongListTemplateCore({
  userInfo: () => props.userInfo,
  liveRequestActive: () => props.liveRequestActive,
})

const searchKeyword = ref('')
const selectedTag = ref<string | null>(null)
const previewSong = ref<SongsInfo>()
const isLrcLoading = ref('')

const tagOptions = computed(() => {
  return getSongFieldOptions(props.data, 'tags')
})

const filteredSongs = computed<SongsInfo[]>(() => {
  return filterSongs(props.data, {
    keyword: searchKeyword.value,
    tag: selectedTag.value,
  })
})

const isWide = useMediaQuery('(min-width: 900px)')
const isNarrow = useMediaQuery('(max-width: 359px)')
const galleryCols = computed(() => (isWide.value ? 3 : isNarrow.value ? 1 : 2))
const galleryRows = computed(() => {
  const cols = galleryCols.value
  const songs = filteredSongs.value
  const rows: { songs: SongsInfo[]; start: number }[] = []
  for (let i = 0; i < songs.length; i += cols) {
    rows.push({ songs: songs.slice(i, i + cols), start: i })
  }
  return rows
})
const { list, containerProps, wrapperProps } = useVirtualList(galleryRows, {
  itemHeight: 304,
  overscan: 4,
})
const { listKey } = useFilterListKey({ tag: selectedTag })

function requestSong(song: SongsInfo) {
  if (!beginRequest(song)) return
  emits('requestSong', song)
}
</script>

<template>
  <div class="gallery-template">
    <header class="gallery-heading">
      <div>
        <span class="heading-kicker">COVER ARCHIVE</span>
        <h2>封面曲库</h2>
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
        v-model:value="selectedTag"
        class="tag-select"
        clearable
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

    <NEmpty
      v-if="filteredSongs.length === 0"
      :key="`empty-${listKey}`"
      description="暂无曲目"
      style="margin-top: 48px"
    />

    <div
      v-else
      :key="`${listKey}:${galleryCols}`"
      v-bind="containerProps"
      class="gallery-viewport"
    >
      <div v-bind="wrapperProps">
        <div
          v-for="{ data: row } in list"
          :key="row.start"
          class="gallery-row"
          :style="{ gridTemplateColumns: `repeat(${galleryCols}, minmax(0, 1fr))` }"
        >
        <div
          v-for="(song, offset) in row.songs"
          :key="song.key"
          class="cover-card"
          :class="{
            'is-singing': singingSongKeySet.has(song.key),
            'is-queued': queuedSongKeySet.has(song.key),
          }"
        >
        <div class="cover">
          <img
            v-if="song.cover"
            :src="song.cover"
            :alt="song.name"
            loading="lazy"
            referrerpolicy="no-referrer"
          />
          <div
            v-else
            class="cover-placeholder"
          >
            <span>{{ song.name.charAt(0) }}</span>
          </div>

          <span class="cover-index">{{ String(row.start + offset + 1).padStart(2, '0') }}</span>

          <SongStatusBadge
            class="status-overlay"
            :song-key="song.key"
            :singing-keys="singingSongKeySet"
            :queued-keys="queuedSongKeySet"
            variant="text"
          />
          <span
            v-if="song.options?.scMinPrice"
            class="status-flag flag-sc"
            >SC ¥{{ song.options.scMinPrice }}</span
          >

          <div class="cover-overlay">
            <NButton
              v-if="song.url"
              circle
              size="large"
              title="试听"
              :aria-label="`试听：${song.name}`"
              :loading="isLrcLoading === song.key"
              @click="previewSong = song"
            >
              <template #icon>
                <NIcon :component="Play24Filled" />
              </template>
            </NButton>
            <SongRequestButton
              v-if="!isSelf"
              :song="song"
              :live-request-settings="liveRequestSettings"
              :auth-state="requestAuthState"
              :loading="requestingKey === song.key"
              :circle="true"
              size="large"
              @request="requestSong"
            />
          </div>
        </div>

        <div class="info">
          <div
            class="title"
            :title="song.name"
          >
            {{ song.name }}
          </div>
          <div
            v-if="song.translateName"
            class="translate"
            :title="song.translateName"
          >
            {{ song.translateName }}
          </div>
          <div
            v-if="song.author?.length"
            class="author"
            :title="song.author.join(' / ')"
          >
            {{ song.author.join(' / ') }}
          </div>

          <SongOptionBadges
            :options="song.options"
            variant="guard"
          />
        </div>
      </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gallery-template {
  width: 100%;
  max-width: var(--vtsuru-page-max-width, 1180px);
  min-width: 0;
  margin: 0 auto;
  padding: clamp(12px, 2vw, 24px);
}

.gallery-heading {
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

.gallery-heading h2 {
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
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.search {
  flex: 1;
  min-width: 200px;
  max-width: 420px;
}

.tag-select {
  width: 160px;
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

.gallery-swap-enter-active,
.gallery-swap-leave-active {
  transition:
    opacity 0.28s ease,
    transform 0.34s cubic-bezier(0.22, 1, 0.36, 1),
    filter 0.28s ease;
}

.gallery-swap-enter-from {
  opacity: 0;
  filter: blur(5px);
  transform: translateY(18px) scale(0.97);
}

.gallery-swap-leave-to {
  opacity: 0;
  filter: blur(4px);
  transform: translateY(-12px) scale(0.97);
}

.gallery-card-enter-active,
.gallery-card-leave-active {
  transition:
    opacity 0.28s ease,
    transform 0.34s cubic-bezier(0.22, 1, 0.36, 1);
}

.gallery-card-enter-from,
.gallery-card-leave-to {
  opacity: 0;
  transform: translateY(16px) scale(0.94);
}

.gallery-card-move {
  transition: transform 0.34s cubic-bezier(0.22, 1, 0.36, 1);
}

.preview-player {
  margin-bottom: 16px;
}

.gallery-viewport {
  height: min(720px, calc(100dvh - 220px));
  min-height: 320px;
}

.gallery-row {
  display: grid;
  height: 304px;
  box-sizing: border-box;
  padding-bottom: 16px;
  gap: clamp(12px, 2vw, 20px);
}

.cover-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  border-radius: var(--vtsuru-page-radius);
  transition:
    transform 0.22s cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 0.22s ease;
}

.cover-card:hover {
  transform: translateY(-4px) scale(1.01);
  box-shadow: 0 14px 28px color-mix(in srgb, var(--song-fg) 12%, transparent);
}

.cover {
  position: relative;
  aspect-ratio: 1 / 1;
  border-radius: var(--vtsuru-page-radius);
  overflow: hidden;
  background: var(--song-panel-strong);
  border: var(--vtsuru-page-border, 1px solid var(--song-border));
  box-shadow: var(--vtsuru-page-shadow);
}

.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}

.cover-card:hover .cover img {
  transform: scale(1.06);
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--song-accent) 14%, var(--song-panel-strong));
}

.cover-placeholder span {
  font-size: 48px;
  font-weight: 800;
  color: color-mix(in srgb, var(--song-accent) 72%, var(--song-fg));
  user-select: none;
}

.cover-index {
  position: absolute;
  top: 9px;
  right: 10px;
  color: rgba(255, 255, 255, 0.88);
  font-size: 10px;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 1px 5px rgba(0, 0, 0, 0.55);
}

.status-overlay :deep(.text) {
  position: absolute;
  top: 8px;
  left: 8px;
  height: 20px;
  padding: 0 8px;
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  backdrop-filter: blur(4px);
}

.status-overlay :deep(.text.singing) {
  background: color-mix(in srgb, var(--song-warning) 90%, transparent);
  animation: pulse 2s ease-in-out infinite;
}

.status-overlay :deep(.text.queued) {
  background: color-mix(in srgb, var(--song-success) 90%, transparent);
}

.status-flag {
  position: absolute;
  top: 8px;
  left: 8px;
  height: 20px;
  padding: 0 8px;
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 700;
  border-radius: 999px;
  color: #fff;
  backdrop-filter: blur(4px);
}

.flag-singing {
  background: color-mix(in srgb, var(--song-warning) 90%, transparent);
  animation: pulse 2s ease-in-out infinite;
}

.flag-queued {
  background: color-mix(in srgb, var(--song-success) 90%, transparent);
}

.flag-sc {
  top: auto;
  bottom: 8px;
  left: 8px;
  background: color-mix(in srgb, var(--song-danger) 90%, transparent);
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.65;
  }
}

.cover-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: color-mix(in srgb, #000 48%, transparent);
  opacity: 0;
  transition: opacity 0.18s ease;
}

.cover:hover .cover-overlay,
.cover:focus-within .cover-overlay {
  opacity: 1;
}

.cover-card.is-singing .cover {
  outline: 2px solid color-mix(in srgb, var(--song-warning) 72%, transparent);
  outline-offset: -2px;
}

.cover-card.is-queued .cover {
  outline: 2px solid color-mix(in srgb, var(--song-success) 66%, transparent);
  outline-offset: -2px;
}

.info {
  padding: 8px 4px 0;
}

.title {
  font-size: 14px;
  font-weight: 650;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--song-fg);
}

.author {
  margin-top: 2px;
  font-size: 12px;
  color: var(--song-subtle);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.translate {
  margin-top: 2px;
  font-size: 12px;
  color: var(--song-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 520px) {
  .gallery-template {
    padding: 8px 0 16px;
  }

  .cover-placeholder span {
    font-size: 36px;
  }
}

@media (hover: none) {
  .cover-overlay {
    inset: auto 8px 8px auto;
    justify-content: flex-end;
    background: transparent;
    opacity: 1;
  }
}

@keyframes gallery-enter {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.94);
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

@media (prefers-reduced-motion: reduce) {
  .cover-card,
  .count.is-pulsing {
    animation: none;
  }

  .gallery-swap-enter-active,
  .gallery-swap-leave-active,
  .gallery-card-enter-active,
  .gallery-card-leave-active,
  .gallery-card-move,
  .cover-card,
  .cover img {
    transition: none;
  }

  .cover-card:hover,
  .cover-card:hover .cover img {
    transform: none;
  }
}
</style>
