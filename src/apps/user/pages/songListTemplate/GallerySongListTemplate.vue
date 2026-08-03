<script setup lang="ts">
import { CloudAdd20Filled, Play24Filled, Search24Regular } from '@vicons/fluent'
import { computed, ref } from 'vue'

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

// 无封面时根据歌名生成稳定的渐变色
const GRADIENTS = [
  ['#fbcfe8', '#fecaca'],
  ['#fde68a', '#fca5a5'],
  ['#bfdbfe', '#a5b4fc'],
  ['#bbf7d0', '#7dd3fc'],
  ['#ddd6fe', '#fbcfe8'],
  ['#a7f3d0', '#fde68a'],
  ['#fbcfe8', '#c7d2fe'],
  ['#fed7aa', '#fecdd3'],
]
function gradientFor(song: SongsInfo) {
  let hash = 0
  for (let i = 0; i < song.name.length; i++) hash = (hash * 31 + song.name.charCodeAt(i)) >>> 0
  const [a, b] = GRADIENTS[hash % GRADIENTS.length]
  return `linear-gradient(135deg, ${a}, ${b})`
}

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
        v-model="selectedTag"
        class="tag-select"
        clearable
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
      class="grid"
    >
      <div
        v-for="song in filteredSongs"
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
            :style="{ background: gradientFor(song) }"
          >
            <span>{{ song.name.charAt(0) }}</span>
          </div>

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
            <UTooltip v-if="song.url">
              <UButton
                square
                size="lg"
                :loading="isLrcLoading === song.key"
                @click="previewSong = song"
              >
                <template #leading>
                  <component :is="Play24Filled" />
                </template>
              </UButton>
              <template #content> 试听 </template></UTooltip
            >
            <UTooltip v-if="!isSelf">
              <UButton
                square
                size="lg"
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
            <UBadge
              v-if="song.options?.fanMedalMinLevel"
              size="xs"
              :bordered="false"
              color="info"
            >
              粉丝牌 {{ song.options.fanMedalMinLevel }}
            </UBadge>
            <UBadge
              v-if="song.options?.needZongdu"
              size="xs"
              :bordered="false"
              :style="{ backgroundColor: GetGuardColor(1), color: '#fff' }"
            >
              总督
            </UBadge>
            <UBadge
              v-if="song.options?.needTidu"
              size="xs"
              :bordered="false"
              :style="{ backgroundColor: GetGuardColor(2), color: '#fff' }"
            >
              提督
            </UBadge>
            <UBadge
              v-if="song.options?.needJianzhang"
              size="xs"
              :bordered="false"
              :style="{ backgroundColor: GetGuardColor(3), color: '#fff' }"
            >
              舰长
            </UBadge>
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
  margin: 0 auto;
  padding: 8px 4px 24px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
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
  margin-left: auto;
  font-size: 13px;
  color: var(--vtsuru-surface-fg-subtle, var(--vtsuru-fg-muted));
}

.preview-player {
  margin-bottom: 16px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 16px;
}

.cover-card {
  display: flex;
  flex-direction: column;
  border-radius: var(--vtsuru-page-radius);
  overflow: hidden;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease;
}

.cover-card:hover {
  transform: translateY(-3px);
}

.cover {
  position: relative;
  aspect-ratio: 1 / 1;
  border-radius: var(--vtsuru-page-radius);
  overflow: hidden;
  background: var(--vtsuru-bg-inset);
  box-shadow: var(--vtsuru-page-shadow);
}

.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cover-placeholder span {
  font-size: 48px;
  font-weight: 800;
  color: rgba(0, 0, 0, 0.35);
  user-select: none;
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
  background: rgba(240, 160, 64, 0.92);
  animation: pulse 2s ease-in-out infinite;
}

.flag-queued {
  background: rgba(82, 196, 26, 0.92);
}

.flag-sc {
  top: auto;
  bottom: 8px;
  left: 8px;
  background: rgba(189, 87, 87, 0.92);
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
  background: rgba(0, 0, 0, 0.42);
  opacity: 0;
  transition: opacity 0.18s ease;
}

.cover:hover .cover-overlay {
  opacity: 1;
}

.cover-card.is-singing .cover {
  outline: 2px solid rgba(240, 160, 64, 0.7);
  outline-offset: -2px;
}

.cover-card.is-queued .cover {
  outline: 2px solid rgba(82, 196, 26, 0.6);
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
  color: var(--vtsuru-fg);
}

.author {
  margin-top: 2px;
  font-size: 12px;
  color: var(--vtsuru-surface-fg-subtle, var(--vtsuru-fg-muted));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.translate {
  margin-top: 2px;
  font-size: 12px;
  color: var(--vtsuru-surface-fg-muted, var(--vtsuru-fg-muted));
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
  .grid {
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 12px;
  }

  .cover-placeholder span {
    font-size: 36px;
  }
}
</style>
