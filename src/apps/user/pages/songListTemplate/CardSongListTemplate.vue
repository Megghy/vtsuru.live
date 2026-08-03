<script setup lang="ts">
import { CloudAdd20Filled } from '@vicons/fluent'
import { MusicalNote } from '@vicons/ionicons5'
import { computed, ref } from 'vue'

import { useAccount } from '@/api/account'
import type { SongsInfo } from '@/api/api-models'
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

const inputKeyword = ref('')
const searchKeyword = ref('')

const filteredSongs = computed<SongsInfo[]>(() => {
  return filterSongs(props.data, { keyword: searchKeyword.value })
})

const isSelf = computed(() => {
  return !!props.userInfo?.id && accountInfo.value?.id === props.userInfo.id
})

const requestAuthState = computed(() => ({
  isLoggedIn: !!accountInfo.value.id,
  isBiliAuthed: biliAuth.isAuthed,
}))

const { active: activeSongKeySet, singing: singingSongKeySet } = useLiveRequestStatus(() => props.liveRequestActive)

function commitSearch() {
  searchKeyword.value = inputKeyword.value.trim()
}

function requestSong(song: SongsInfo) {
  if (isSelf.value) return
  emits('requestSong', song)
}

function getMetaText(song: SongsInfo) {
  const tags = (song.tags ?? []).filter(Boolean)
  const languages = (song.language ?? []).filter(Boolean)
  const left = tags.slice(0, 2).join(', ')
  const right = languages.slice(0, 2).join(', ')
  return [left, right].filter(Boolean).join(' · ')
}
</script>

<template>
  <div class="song-list-card-template">
    <div class="search-row">
      <div class="search-input">
        <span class="search-icon" />
        <UInput
          v-model="inputKeyword"
          class="search-field"
          clearable
          placeholder="搜索歌曲或歌手…"
          @keyup.enter="commitSearch"
        />
      </div>
      <UButton
        color="primary"
        class="search-button"
        @click="commitSearch"
      >
        搜索
      </UButton>
    </div>

    <div class="count-row">共 {{ filteredSongs.length }} 首歌曲</div>

    <UEmpty
      v-if="!data || filteredSongs.length === 0"
      description="暂无曲目"
      style="margin-top: 24px"
      class="public-empty"
    />

    <div
      v-else
      class="song-cards"
    >
      <div
        v-for="song in filteredSongs"
        :key="song.key"
        class="song-card"
        :class="{
          'is-active': activeSongKeySet.has(song.key),
          'is-singing': singingSongKeySet.has(song.key),
        }"
      >
        <div class="card-top">
          <div class="title-left">
            <div class="left-icon">
              <component :is="MusicalNote" />
            </div>
            <div class="title-block">
              <UTooltip
                trigger="hover"
                :disabled="isSelf"
              >
                <button
                  class="song-title"
                  type="button"
                  :disabled="isSelf"
                  @click="requestSong(song)"
                >
                  <span :tooltip="false">
                    {{ song.name }}
                  </span>
                </button>

                <template #content>{{ getSongRequestTooltip(song, liveRequestSettings, requestAuthState) }}</template>
              </UTooltip>

              <div class="sub">
                <span
                  v-if="song.author?.length"
                  class="song-author"
                >
                  <span :tooltip="false">
                    {{ song.author.join(' / ') }}
                  </span>
                </span>
                <span class="dot">·</span>
                <span class="meta">
                  {{ getMetaText(song) }}
                </span>
              </div>
            </div>
          </div>

          <div class="title-right">
            <span
              v-if="song.options?.scMinPrice"
              class="badge badge-sc"
            >
              SC ¥{{ song.options.scMinPrice }}
            </span>
            <span
              v-if="singingSongKeySet.has(song.key)"
              class="badge badge-singing"
            >
              正在演唱
            </span>
            <span
              v-else-if="activeSongKeySet.has(song.key)"
              class="badge badge-active"
            >
              排队中
            </span>
            <div
              v-if="!isSelf"
              class="action"
            >
              <UTooltip>
                <UButton
                  size="sm"
                  variant="ghost"
                  class="request-button"
                  :color="getSongRequestButtonType(song, liveRequestSettings, requestAuthState)"
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

        <div class="card-bottom">
          <div class="pills">
            <span
              v-for="tag in (song.tags ?? []).slice(0, 2)"
              :key="tag"
              class="pill"
            >
              <span :tooltip="false">
                {{ tag }}
              </span>
            </span>
            <span
              v-for="lang in (song.language ?? []).slice(0, 2)"
              :key="lang"
              class="pill pill-muted"
            >
              <span :tooltip="false">
                {{ lang }}
              </span>
            </span>
          </div>

          <div class="desc">
            <span depth="3">
              <span :tooltip="false">
                {{ song.translateName || song.description || '' }}
              </span>
            </span>
          </div>

          <div
            v-if="song.options"
            size="small"
            justify="end"
            class="badges"
          >
            <UBadge
              v-if="song.options?.fanMedalMinLevel"
              size="sm"
              :bordered="false"
              color="neutral"
            >
              粉丝牌 Lv{{ song.options.fanMedalMinLevel }}
            </UBadge>
            <UBadge
              v-if="song.options?.needZongdu"
              size="sm"
              :bordered="false"
              :style="{ backgroundColor: GetGuardColor(1), color: '#fff' }"
            >
              总督
            </UBadge>
            <UBadge
              v-if="song.options?.needTidu"
              size="sm"
              :bordered="false"
              :style="{ backgroundColor: GetGuardColor(2), color: '#fff' }"
            >
              提督
            </UBadge>
            <UBadge
              v-if="song.options?.needJianzhang"
              size="sm"
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
.song-list-card-template {
  --content-max-width: var(--vtsuru-page-max-width, 1180px);
  --card-max-width: 720px;

  --sl-background: 0 0% 100%;
  --sl-card: 0 0% 100%;
  --sl-foreground: 240 10% 3.9%;
  --sl-muted: 240 4.8% 95.9%;
  --sl-muted-foreground: 240 3.8% 46.1%;
  --sl-border: 240 5.9% 90%;
  --sl-ring: 240 5.9% 10%;
  --sl-accent: 221 83% 53%;
  --sl-success: 142.1 76.2% 36.3%;

  width: 100%;
  max-width: var(--content-max-width);
  margin: 0 auto;
  padding: 16px 12px;
}

html.dark .song-list-card-template {
  --sl-background: 240 10% 3.9%;
  --sl-card: 240 10% 3.9%;
  --sl-foreground: 0 0% 98%;
  --sl-muted: 240 3.7% 15.9%;
  --sl-muted-foreground: 240 5% 64.9%;
  --sl-border: 240 3.7% 15.9%;
  --sl-ring: 240 4.9% 83.9%;
}

.search-row {
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: var(--card-max-width);
  margin: 0 auto;
}

.search-input {
  flex: 1;
  position: relative;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1;
  opacity: 0.65;
  font-size: 13px;
}

.search-field :deep(input) {
  padding-left: 32px;
}

.search-button {
  border-radius: var(--vtsuru-page-radius);
}

.count-row {
  margin-top: 12px;
  margin-bottom: 12px;
  max-width: var(--card-max-width);
  margin-left: auto;
  margin-right: auto;
  color: hsl(var(--sl-muted-foreground));
  font-size: 13px;
}

.song-cards {
  display: flex;
  flex-direction: column;
  gap: var(--vtsuru-page-spacing);
  align-items: center;
}

.song-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--vtsuru-page-spacing);
  padding: var(--vtsuru-page-spacing);
  width: 100%;
  max-width: var(--card-max-width);
  border-radius: var(--vtsuru-page-radius);
  background: hsl(var(--sl-card));
  border: var(--vtsuru-page-border);
  box-shadow: var(--vtsuru-page-shadow);
  transition:
    box-shadow 0.15s ease,
    transform 0.15s ease,
    border-color 0.15s ease;
}

.song-card.is-active {
  border-color: hsl(var(--sl-success) / 0.35);
}

.song-card.is-singing {
  border-color: hsla(30, 90%, 50%, 0.45);
}

.song-card:hover {
  transform: translateY(-1px);
}

.card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.title-left {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.left-icon {
  width: 38px;
  height: 38px;
  border-radius: var(--vtsuru-page-radius);
  display: flex;
  align-items: center;
  justify-content: center;
  background: hsl(var(--sl-muted));
  color: hsl(var(--sl-muted-foreground));
}

.title-block {
  min-width: 0;
}

.title-right {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
}

.sub {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
  color: hsl(var(--sl-muted-foreground));
  font-size: 12px;
  min-width: 0;
}

.dot {
  opacity: 0.55;
}

.meta {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-title {
  width: 100%;
  text-align: left;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  font-weight: 700;
  font-size: 15px;
  color: hsl(var(--sl-foreground));
}

.song-title:disabled {
  cursor: default;
  opacity: 0.75;
}

.song-title:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px hsl(var(--sl-ring) / 0.18);
  border-radius: var(--vtsuru-page-radius);
}

.song-author {
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  user-select: none;
  border: 1px solid hsl(var(--sl-border));
  color: hsl(var(--sl-muted-foreground));
  background: hsl(var(--sl-muted) / 0.35);
}

.badge-sc {
  background: hsl(var(--sl-accent) / 0.12);
  color: hsl(var(--sl-accent));
  border: 1px solid hsl(var(--sl-accent) / 0.22);
}

.badge-active {
  background: hsl(var(--sl-success) / 0.12);
  color: hsl(var(--sl-success));
  border: 1px solid hsl(var(--sl-success) / 0.28);
}

.badge-singing {
  background: hsla(30, 90%, 50%, 0.12);
  color: hsl(30, 90%, 45%);
  border: 1px solid hsla(30, 90%, 50%, 0.28);
  animation: pulse-singing 2s ease-in-out infinite;
}

@keyframes pulse-singing {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.request-button {
  border-radius: var(--vtsuru-page-radius);
}

.card-bottom {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items: center;
  padding-top: 10px;
  border-top: 1px solid hsl(var(--sl-border));
}

.pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}

.pill {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 12px;
  border: 1px solid hsl(var(--sl-border));
  background: hsl(var(--sl-muted) / 0.25);
  color: hsl(var(--sl-foreground));
  max-width: 160px;
}

.pill :deep(.pill) {
  max-width: 120px;
}

.pill-muted {
  color: hsl(var(--sl-muted-foreground));
}

.desc {
  grid-column: 1 / -1;
  min-width: 0;
  color: hsl(var(--sl-muted-foreground));
  font-size: 12px;
}

@media (max-width: 640px) {
  .search-row {
    flex-direction: column;
    align-items: stretch;
  }

  .search-button {
    width: 100%;
  }

  .song-card {
    padding: var(--vtsuru-page-spacing);
  }

  .left-icon {
    width: 44px;
    height: 44px;
    border-radius: var(--vtsuru-page-radius);
  }

  .card-bottom {
    grid-template-columns: 1fr;
  }

  .badges {
    justify-content: flex-start;
  }
}
</style>
