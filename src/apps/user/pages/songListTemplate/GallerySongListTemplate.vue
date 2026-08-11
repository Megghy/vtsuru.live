<script setup lang="ts">
import { CloudAdd20Filled, Play24Filled, Search24Regular } from '@vicons/fluent'
import { NButton, NEmpty, NIcon, NInput, NSelect, NTag, NTooltip } from 'naive-ui'
import { computed, ref, watch } from 'vue'

import { useAccount } from '@/api/account'
import type { SongsInfo } from '@/api/api-models'
import SongPlayer from '@/components/SongPlayer.vue'
import type { SongListConfigType } from '@/shared/types/TemplateTypes'
import { GetGuardColor } from '@/shared/utils'
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

const filteredSongs = computed<SongsInfo[]>(() => {
  return filterSongs(props.data, {
    keyword: searchKeyword.value,
    tag: selectedTag.value,
  })
})
const filterEpoch = ref(0)
watch([searchKeyword, selectedTag], () => {
  filterEpoch.value += 1
})
const listKey = computed(() => `${selectedTag.value ?? 'all'}:${filterEpoch.value}`)

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

    <Transition
      name="gallery-swap"
      mode="out-in"
    >
      <NEmpty
        v-if="filteredSongs.length === 0"
        :key="`empty-${listKey}`"
        description="暂无曲目"
        style="margin-top: 48px"
      />

      <TransitionGroup
        v-else
        :key="listKey"
        name="gallery-card"
        tag="div"
        class="grid"
      >
        <div
          v-for="(song, index) in filteredSongs"
          :key="song.key"
          class="cover-card"
          :class="{
            'is-singing': singingSongKeySet.has(song.key),
            'is-queued': queuedSongKeySet.has(song.key),
          }"
          :style="{ '--card-index': index }"
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

          <span class="cover-index">{{ String(index + 1).padStart(2, '0') }}</span>

          <span
            v-if="singingSongKeySet.has(song.key)"
            class="status-flag flag-singing"
            >正在演唱</span
          >
          <span
            v-else-if="queuedSongKeySet.has(song.key)"
            class="status-flag flag-queued"
            >排队中</span
          >
          <span
            v-if="song.options?.scMinPrice"
            class="status-flag flag-sc"
            >SC ¥{{ song.options.scMinPrice }}</span
          >

          <div class="cover-overlay">
            <NTooltip v-if="song.url">
              <template #trigger>
                <NButton
                  circle
                  size="large"
                  :aria-label="`试听：${song.name}`"
                  :loading="isLrcLoading === song.key"
                  @click="previewSong = song"
                >
                  <template #icon>
                    <NIcon :component="Play24Filled" />
                  </template>
                </NButton>
              </template>
              试听
            </NTooltip>
            <NTooltip v-if="!isSelf">
              <template #trigger>
                <NButton
                  circle
                  size="large"
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
          <div
            v-if="
              song.options?.needZongdu ||
              song.options?.needTidu ||
              song.options?.needJianzhang ||
              song.options?.fanMedalMinLevel
            "
            class="guard-row"
          >
            <NTag
              v-if="song.options?.fanMedalMinLevel"
              size="tiny"
              :bordered="false"
              type="info"
            >
              粉丝牌 {{ song.options.fanMedalMinLevel }}
            </NTag>
            <NTag
              v-if="song.options?.needZongdu"
              size="tiny"
              :bordered="false"
              :color="{ color: GetGuardColor(1) }"
            >
              总督
            </NTag>
            <NTag
              v-if="song.options?.needTidu"
              size="tiny"
              :bordered="false"
              :color="{ color: GetGuardColor(2) }"
            >
              提督
            </NTag>
            <NTag
              v-if="song.options?.needJianzhang"
              size="tiny"
              :bordered="false"
              :color="{ color: GetGuardColor(3) }"
            >
              舰长
            </NTag>
          </div>
        </div>
      </div>
      </TransitionGroup>
    </Transition>
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

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 176px), 1fr));
  gap: clamp(12px, 2vw, 20px);
}

.cover-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  border-radius: var(--vtsuru-page-radius);
  animation: gallery-enter 0.46s calc(var(--card-index, 0) * 35ms) cubic-bezier(0.22, 1, 0.36, 1) both;
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

.guard-row {
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

@media (max-width: 520px) {
  .gallery-template {
    padding: 8px 0 16px;
  }

  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px 10px;
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
