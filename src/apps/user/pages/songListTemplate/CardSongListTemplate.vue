<script setup lang="ts">
import { CloudAdd20Filled, Search24Regular } from '@vicons/fluent'
import { MusicalNote } from '@vicons/ionicons5'
import { NButton, NEllipsis, NEmpty, NFlex, NIcon, NInput, NTag, NTooltip } from 'naive-ui'
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
      <NInput
        v-model:value="inputKeyword"
        class="search-field"
        clearable
        placeholder="搜索歌曲或歌手…"
        @keyup.enter="commitSearch"
      >
        <template #prefix>
          <NIcon :component="Search24Regular" />
        </template>
      </NInput>
      <NButton
        type="primary"
        class="search-button"
        @click="commitSearch"
      >
        搜索
      </NButton>
    </div>

    <div class="count-row">共 {{ filteredSongs.length }} 首歌曲</div>

    <NEmpty
      v-if="!data || filteredSongs.length === 0"
      class="empty-state"
      description="暂无曲目"
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
              <NIcon :component="MusicalNote" />
            </div>
            <div class="title-block">
              <NTooltip
                trigger="hover"
                :disabled="isSelf"
              >
                <template #trigger>
                  <button
                    class="song-title"
                    type="button"
                    :disabled="isSelf"
                    @click="requestSong(song)"
                  >
                    <NEllipsis :tooltip="false">
                      {{ song.name }}
                    </NEllipsis>
                  </button>
                </template>
                {{ getSongRequestTooltip(song, liveRequestSettings, requestAuthState) }}
              </NTooltip>

              <div class="sub">
                <span
                  v-if="song.author?.length"
                  class="song-author"
                >
                  <NEllipsis :tooltip="false">
                    {{ song.author.join(' / ') }}
                  </NEllipsis>
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
              <NTooltip>
                <template #trigger>
                  <NButton
                    size="small"
                    quaternary
                    class="request-button"
                    :type="getSongRequestButtonType(song, liveRequestSettings, requestAuthState)"
                    :aria-label="`点歌：${song.name}`"
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

        <div class="card-bottom">
          <div class="pills">
            <span
              v-for="tag in (song.tags ?? []).slice(0, 2)"
              :key="tag"
              class="pill"
            >
              <NEllipsis :tooltip="false">
                {{ tag }}
              </NEllipsis>
            </span>
            <span
              v-for="lang in (song.language ?? []).slice(0, 2)"
              :key="lang"
              class="pill pill-muted"
            >
              <NEllipsis :tooltip="false">
                {{ lang }}
              </NEllipsis>
            </span>
          </div>

          <div class="desc">
            <NEllipsis :tooltip="false">
              {{ song.translateName || song.description || '' }}
            </NEllipsis>
          </div>

          <NFlex
            v-if="song.options"
            size="small"
            justify="end"
            class="badges"
          >
            <NTag
              v-if="song.options?.fanMedalMinLevel"
              size="small"
              :bordered="false"
              type="default"
            >
              粉丝牌 Lv{{ song.options.fanMedalMinLevel }}
            </NTag>
            <NTag
              v-if="song.options?.needZongdu"
              size="small"
              :bordered="false"
              :color="{ color: GetGuardColor(1) }"
            >
              总督
            </NTag>
            <NTag
              v-if="song.options?.needTidu"
              size="small"
              :bordered="false"
              :color="{ color: GetGuardColor(2) }"
            >
              提督
            </NTag>
            <NTag
              v-if="song.options?.needJianzhang"
              size="small"
              :bordered="false"
              :color="{ color: GetGuardColor(3) }"
            >
              舰长
            </NTag>
          </NFlex>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.song-list-card-template {
  --content-max-width: var(--vtsuru-page-max-width, 1180px);
  --card-max-width: 760px;

  width: 100%;
  min-width: 0;
  max-width: var(--content-max-width);
  margin: 0 auto;
  padding: var(--vtsuru-page-spacing, 16px) 12px;
}

.search-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  max-width: var(--card-max-width);
  margin: 0 auto;
}

.search-field {
  flex: 1;
  min-width: 0;
}

.search-field :deep(.n-input__prefix) {
  color: var(--song-subtle);
}

.search-button {
  flex: none;
  min-width: 72px;
  border-radius: var(--vtsuru-page-radius, 8px);
}

.count-row {
  width: 100%;
  max-width: var(--card-max-width);
  margin: 12px auto;
  color: var(--song-muted);
  font-size: 13px;
  line-height: 1.5;
}

.empty-state {
  margin-top: 28px;
}

.song-cards {
  display: grid;
  gap: var(--vtsuru-page-spacing, 16px);
  width: 100%;
  max-width: var(--card-max-width);
  margin: 0 auto;
}

.song-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  min-width: 0;
  padding: var(--vtsuru-page-spacing, 16px);
  overflow: hidden;
  border: var(--vtsuru-page-border-width, 1px) var(--vtsuru-page-border-style, solid) var(--song-border);
  border-radius: var(--vtsuru-page-radius, 8px);
  background: var(--song-panel);
  box-shadow: var(--vtsuru-page-shadow);
  transition:
    background-color 160ms ease,
    border-color 160ms ease,
    transform 160ms ease;
}

.song-card.is-active {
  border-color: color-mix(in srgb, var(--song-success) 48%, var(--song-border));
}

.song-card.is-singing {
  border-color: color-mix(in srgb, var(--song-warning) 56%, var(--song-border));
}

.song-card:focus-within {
  border-color: var(--song-accent);
  box-shadow:
    0 0 0 3px var(--song-accent-soft),
    var(--vtsuru-page-shadow);
}

.card-top {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: flex-start;
  gap: 10px 16px;
  min-width: 0;
}

.title-left {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.left-icon {
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: var(--vtsuru-page-radius, 8px);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--song-accent-soft);
  color: color-mix(in srgb, var(--song-accent) 72%, var(--song-fg));
}

.title-block {
  flex: 1;
  min-width: 0;
}

.title-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}

.sub {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  margin-top: 4px;
  color: var(--song-muted);
  font-size: 12px;
  line-height: 1.5;
}

.dot {
  flex: none;
  opacity: 0.55;
}

.meta {
  min-width: 0;
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
  line-height: 1.45;
  color: var(--song-fg);
}

.song-title:disabled {
  cursor: default;
  color: var(--song-muted);
}

.song-title:focus-visible {
  outline: 2px solid var(--song-accent);
  outline-offset: 3px;
  border-radius: calc(var(--vtsuru-page-radius, 8px) / 2);
}

.song-author {
  min-width: 0;
  max-width: 45%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  height: 22px;
  padding: 0 10px;
  overflow: hidden;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  user-select: none;
  white-space: nowrap;
  border: 1px solid var(--song-border);
  color: var(--song-muted);
  background: var(--song-panel-strong);
}

.badge-sc {
  background: var(--song-accent-soft);
  color: color-mix(in srgb, var(--song-accent) 72%, var(--song-fg));
  border-color: color-mix(in srgb, var(--song-accent) 30%, var(--song-border));
}

.badge-active {
  background: color-mix(in srgb, var(--song-success) 14%, transparent);
  color: color-mix(in srgb, var(--song-success) 72%, var(--song-fg));
  border-color: color-mix(in srgb, var(--song-success) 38%, var(--song-border));
}

.badge-singing {
  background: color-mix(in srgb, var(--song-warning) 14%, transparent);
  color: color-mix(in srgb, var(--song-warning) 74%, var(--song-fg));
  border-color: color-mix(in srgb, var(--song-warning) 40%, var(--song-border));
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
  border-radius: var(--vtsuru-page-radius, 8px);
}

.card-bottom {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px 12px;
  align-items: center;
  min-width: 0;
  padding-top: 12px;
  border-top: var(--vtsuru-page-border-width, 1px) var(--vtsuru-page-border-style, solid) var(--song-border);
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
  border: 1px solid var(--song-border);
  background: var(--song-panel-strong);
  color: var(--song-fg);
  max-width: 160px;
}

.pill :deep(.n-ellipsis) {
  max-width: 120px;
}

.pill-muted {
  color: var(--song-muted);
}

.desc {
  grid-column: 1 / -1;
  min-width: 0;
  color: var(--song-muted);
  font-size: 12px;
}

@media (hover: hover) and (pointer: fine) {
  .song-card:hover {
    background: var(--song-bg-hover);
    transform: translateY(-1px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .song-card,
  .badge-singing {
    transition: none;
    animation: none;
  }
}

@media (max-width: 560px) {
  .song-card {
    gap: 12px;
  }

  .card-top {
    grid-template-columns: minmax(0, 1fr);
  }

  .title-right {
    justify-content: flex-start;
    padding-left: 46px;
  }

  .action {
    margin-left: auto;
  }

  .card-bottom {
    grid-template-columns: 1fr;
  }

  .badges {
    justify-content: flex-start;
  }
}

@media (max-width: 380px) {
  .song-list-card-template {
    padding-inline: 8px;
  }

  .title-right {
    padding-left: 0;
  }

  .song-author {
    max-width: 40%;
  }
}
</style>
