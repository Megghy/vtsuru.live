<script setup lang="ts">
import { CloudAdd20Filled, MusicNote224Filled, Search24Regular } from '@vicons/fluent'
import { useVirtualList } from '@vueuse/core'
import { NButton, NEmpty, NIcon, NInput, NTag, NTooltip } from 'naive-ui'
import { computed, ref, watch } from 'vue'

import { useAccount } from '@/api/account'
import type { SongsInfo } from '@/api/api-models'
import SongPlayer from '@/components/SongPlayer.vue'
import type { SongListConfigType } from '@/shared/types/TemplateTypes'
import { GetGuardColor } from '@/shared/utils'
import { useBiliAuth } from '@/store/useBiliAuth'

import { filterSongs } from './utils/songListData'
import { getSongRequestButtonType, getSongRequestTooltip } from './utils/songRequestUtils'
import { useLiveRequestStatus } from './utils/useLiveRequestStatus'

const props = defineProps<SongListConfigType>()
const emits = defineEmits(['requestSong'])

const accountInfo = useAccount()
const biliAuth = useBiliAuth()

const searchKeyword = ref('')
const selectedSong = ref<SongsInfo>()
const isLrcLoading = ref('')
const requestingKey = ref('')

const requestAuthState = computed(() => ({
  isLoggedIn: !!accountInfo.value.id,
  isBiliAuthed: biliAuth.isAuthed,
}))

const isSelf = computed(() => !!props.userInfo?.id && accountInfo.value?.id === props.userInfo.id)

const { singing: singingSongKeySet, queued: queuedSongKeySet } = useLiveRequestStatus(() => props.liveRequestActive)

const filteredSongs = computed<SongsInfo[]>(() => {
  return filterSongs(props.data, { keyword: searchKeyword.value })
})

const { list, containerProps, wrapperProps } = useVirtualList(filteredSongs, {
  itemHeight: 52,
  overscan: 10,
})

// 默认选中第一首
watch(
  filteredSongs,
  (songs) => {
    if (!selectedSong.value && songs.length) selectedSong.value = songs[0]
  },
  { immediate: true },
)

function selectSong(song: SongsInfo) {
  selectedSong.value = song
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
  <div
    class="immersive-template"
    :style="{ '--immersive-cover': selectedSong?.cover ? `url(${selectedSong.cover})` : 'none' }"
  >
    <aside class="stage">
      <span class="stage-kicker">NOW SELECTED</span>
      <div
        class="stage-cover"
        :class="{ 'is-empty': !selectedSong?.cover }"
      >
        <img
          v-if="selectedSong?.cover"
          :src="selectedSong.cover"
          :alt="selectedSong.name"
          referrerpolicy="no-referrer"
        />
        <NIcon
          v-else
          :component="MusicNote224Filled"
          class="stage-cover-icon"
        />
      </div>

      <template v-if="selectedSong">
        <div class="stage-title">
          {{ selectedSong.name }}
        </div>
        <div
          v-if="selectedSong.translateName"
          class="stage-subtitle"
        >
          {{ selectedSong.translateName }}
        </div>
        <div
          v-if="selectedSong.author?.length"
          class="stage-author"
        >
          {{ selectedSong.author.join(' / ') }}
        </div>

        <div
          v-if="selectedSong.language?.length || selectedSong.tags?.length"
          class="stage-tags"
        >
          <NTag
            v-for="lang in selectedSong.language ?? []"
            :key="`l-${lang}`"
            size="small"
            :bordered="false"
            type="info"
          >
            {{ lang }}
          </NTag>
          <NTag
            v-for="tag in (selectedSong.tags ?? []).slice(0, 4)"
            :key="`t-${tag}`"
            size="small"
            :bordered="false"
          >
            {{ tag }}
          </NTag>
        </div>

        <div
          v-if="selectedSong.options"
          class="stage-tags"
        >
          <NTag
            v-if="selectedSong.options.scMinPrice"
            size="small"
            :bordered="false"
            type="error"
          >
            SC ¥{{ selectedSong.options.scMinPrice }}
          </NTag>
          <NTag
            v-if="selectedSong.options.fanMedalMinLevel"
            size="small"
            :bordered="false"
            type="warning"
          >
            粉丝牌 {{ selectedSong.options.fanMedalMinLevel }}
          </NTag>
          <NTag
            v-if="selectedSong.options.needZongdu"
            size="small"
            :bordered="false"
            :color="{ color: GetGuardColor(1) }"
          >
            总督
          </NTag>
          <NTag
            v-if="selectedSong.options.needTidu"
            size="small"
            :bordered="false"
            :color="{ color: GetGuardColor(2) }"
          >
            提督
          </NTag>
          <NTag
            v-if="selectedSong.options.needJianzhang"
            size="small"
            :bordered="false"
            :color="{ color: GetGuardColor(3) }"
          >
            舰长
          </NTag>
        </div>

        <NButton
          v-if="!isSelf"
          class="stage-request"
          :type="getSongRequestButtonType(selectedSong, liveRequestSettings, requestAuthState)"
          :loading="requestingKey === selectedSong.key"
          @click="requestSong(selectedSong)"
        >
          <template #icon>
            <NIcon :component="CloudAdd20Filled" />
          </template>
          {{ getSongRequestTooltip(selectedSong, liveRequestSettings, requestAuthState) }}
        </NButton>

        <SongPlayer
          v-if="selectedSong.url"
          v-model:is-lrc-loading="isLrcLoading"
          :song="selectedSong"
          class="stage-player"
        />
      </template>
    </aside>

    <section class="library">
      <header class="library-heading">
        <div>
          <span class="library-kicker">LIBRARY</span>
          <h2>选择一首歌</h2>
        </div>
        <span class="library-count">{{ filteredSongs.length }} 首</span>
      </header>

      <div class="search-shell">
        <NInput
          v-model:value="searchKeyword"
          class="library-search"
          clearable
          placeholder="搜索曲库…"
        >
          <template #prefix>
            <NIcon :component="Search24Regular" />
          </template>
        </NInput>
      </div>

      <NEmpty
        v-if="filteredSongs.length === 0"
        description="暂无曲目"
        style="margin-top: 48px"
      />

      <div
        v-else
        v-bind="containerProps"
        class="library-list"
      >
        <div v-bind="wrapperProps">
          <div
            v-for="{ data: song } in list"
            :key="song.key"
            class="lib-row"
            :class="{
              active: selectedSong?.key === song.key,
              'is-singing': singingSongKeySet.has(song.key),
              'is-queued': queuedSongKeySet.has(song.key),
            }"
          >
            <button
              type="button"
              class="lib-select"
              :aria-current="selectedSong?.key === song.key ? 'true' : undefined"
              @click="selectSong(song)"
            >
              <span class="lib-cover">
                <img
                  v-if="song.cover"
                  :src="song.cover"
                  :alt="song.name"
                  loading="lazy"
                  referrerpolicy="no-referrer"
                />
                <span v-else>{{ song.name.charAt(0) }}</span>
              </span>
              <span class="lib-main">
                <span
                  class="lib-name"
                  :title="song.name"
                  >{{ song.name }}</span
                >
                <span
                  v-if="song.author?.length"
                  class="lib-author"
                  >{{ song.author.join(' / ') }}</span
                >
              </span>
            </button>
            <span
              v-if="singingSongKeySet.has(song.key)"
              class="lib-flag singing"
              >演唱中</span
            >
            <span
              v-else-if="queuedSongKeySet.has(song.key)"
              class="lib-flag queued"
              >排队</span
            >
            <NTooltip v-if="!isSelf">
              <template #trigger>
                <NButton
                  size="tiny"
                  circle
                  :aria-label="`点歌：${song.name}`"
                  :type="getSongRequestButtonType(song, liveRequestSettings, requestAuthState)"
                  :loading="requestingKey === song.key"
                  @click.stop="requestSong(song)"
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
    </section>
  </div>
</template>

<style scoped>
.immersive-template {
  position: relative;
  isolation: isolate;
  display: flex;
  overflow: hidden;
  padding: clamp(12px, 2vw, 22px);
  border: var(--vtsuru-page-border, 1px solid var(--song-border));
  border-radius: var(--vtsuru-page-radius, 8px);
  background: var(--song-panel);
  box-shadow: var(--vtsuru-page-shadow, none);
  gap: clamp(16px, 3vw, 34px);
  width: 100%;
  max-width: var(--vtsuru-page-max-width, 1180px);
  margin: 0 auto;
  height: min(760px, calc(100dvh - 130px));
  min-height: 480px;
}

.immersive-template::before {
  position: absolute;
  z-index: -1;
  inset: -50px;
  background-image: var(--immersive-cover);
  background-position: center;
  background-size: cover;
  filter: blur(54px) saturate(1.18);
  opacity: 0.16;
  content: '';
  transform: scale(1.08);
}

.stage,
.library {
  position: relative;
  z-index: 1;
}

.stage {
  flex: 0 0 min(34%, 360px);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 4px 4px 16px;
  overflow-x: hidden;
  overflow-y: auto;
}

.stage-kicker,
.library-kicker {
  align-self: flex-start;
  margin-bottom: 8px;
  color: var(--song-accent);
  font-size: 10px;
  font-weight: 750;
}

.stage-cover {
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: var(--vtsuru-page-radius);
  overflow: hidden;
  box-shadow: var(--vtsuru-page-shadow);
  border: var(--vtsuru-page-border);
  background: var(--song-panel-strong);
  display: flex;
  align-items: center;
  justify-content: center;
}

.stage-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.stage-cover.is-empty {
  background: color-mix(in srgb, var(--song-accent) 12%, var(--song-panel-strong));
}

.stage-cover-icon {
  font-size: 80px;
  color: var(--song-subtle);
  opacity: 0.5;
}

.stage-title {
  margin-top: 18px;
  font-size: 20px;
  font-weight: 750;
  line-height: 1.25;
  color: var(--song-fg);
}

.stage-subtitle {
  margin-top: 4px;
  font-size: 13px;
  color: var(--song-subtle);
}

.stage-author {
  margin-top: 6px;
  font-size: 14px;
  color: var(--song-muted);
}

.stage-tags {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
}

.stage-request {
  margin-top: 18px;
  width: 100%;
  max-width: 240px;
}

.stage-player {
  margin-top: 16px;
  width: 100%;
}

.library {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.library-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 12px;
  gap: 12px;
}

.library-kicker {
  display: block;
  margin-bottom: 3px;
}

.library-heading h2 {
  margin: 0;
  color: var(--song-fg);
  font-size: clamp(20px, 3vw, 28px);
  line-height: 1.15;
}

.library-count {
  color: var(--song-muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.search-shell {
  margin-bottom: 10px;
  padding: 6px;
  border: 1px solid color-mix(in srgb, var(--song-border) 78%, transparent);
  border-radius: var(--vtsuru-page-radius, 8px);
  background: var(--song-panel-strong);
}

.library-search {
  flex: 0 0 auto;
}

.library-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border: var(--vtsuru-page-border, 1px solid var(--song-border));
  border-radius: var(--vtsuru-page-radius);
  background: var(--song-panel-strong);
  backdrop-filter: blur(14px);
  box-shadow: var(--vtsuru-page-shadow);
}

.lib-row {
  width: 100%;
  height: 52px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px 0 0;
  box-sizing: border-box;
  border: none;
  border-bottom: 1px solid color-mix(in srgb, var(--song-border) 62%, transparent);
  background: transparent;
  text-align: left;
  transition: background-color 0.12s ease;
}

.lib-row:last-child {
  border-bottom: none;
}

.lib-row:hover {
  background: var(--song-bg-hover);
}

.lib-row.active {
  background: var(--song-accent-soft);
  box-shadow: inset 3px 0 0 0 var(--song-accent);
}

.lib-row.is-singing:not(.active) {
  box-shadow: inset 3px 0 0 0 var(--song-warning);
}

.lib-row.is-queued:not(.active) {
  box-shadow: inset 3px 0 0 0 var(--song-success);
}

.lib-select {
  display: flex;
  min-width: 0;
  height: 100%;
  flex: 1;
  align-items: center;
  padding: 0 0 0 12px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  gap: 10px;
}

.lib-select:focus-visible {
  outline: 2px solid var(--vtsuru-page-primary-focus, var(--song-accent));
  outline-offset: -3px;
}

.lib-cover {
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  border-radius: var(--vtsuru-page-radius);
  overflow: hidden;
  background: color-mix(in srgb, var(--song-fg) 7%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
  color: var(--song-subtle);
}

.lib-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.lib-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.lib-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--song-fg);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lib-author {
  font-size: 12px;
  color: var(--song-subtle);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lib-flag {
  flex: 0 0 auto;
  font-size: 11px;
  font-weight: 700;
}

.lib-flag.singing {
  color: var(--song-warning);
}

.lib-flag.queued {
  color: var(--song-success);
}

@media (max-width: 860px) {
  .immersive-template {
    flex-direction: column;
    height: auto;
    min-height: 0;
    padding: 12px;
  }

  .stage {
    flex: 0 0 auto;
    overflow: visible;
  }

  .stage-cover {
    max-width: 260px;
  }

  .library-list {
    height: min(560px, 62dvh);
    min-height: 360px;
  }
}

@media (max-width: 520px) {
  .immersive-template {
    border-right: 0;
    border-left: 0;
  }

  .stage-cover {
    max-width: 220px;
  }

  .lib-flag {
    display: none;
  }
}
</style>
