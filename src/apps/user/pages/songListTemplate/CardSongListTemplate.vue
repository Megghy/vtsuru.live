<script setup lang="ts">
import { Search24Regular } from '@vicons/fluent'
import { MusicalNote } from '@vicons/ionicons5'
import { NButton, NEllipsis, NEmpty, NIcon, NInput, NTooltip } from 'naive-ui'
import { computed, ref } from 'vue'

import type { SongsInfo } from '@/api/api-models'
import type { SongListConfigType } from '@/shared/types/TemplateTypes'

import SongOptionBadges from './components/SongOptionBadges.vue'
import SongRequestButton from './components/SongRequestButton.vue'
import SongStatusBadge from './components/SongStatusBadge.vue'
import { filterSongs } from './utils/songListData'
import { getSongRequestTooltip } from './utils/songRequestUtils'
import { useProgressiveList } from './utils/useProgressiveList'
import { useFilterListKey, useSongListTemplateCore } from './utils/useSongListTemplateCore'

const props = defineProps<SongListConfigType>()
const emits = defineEmits(['requestSong'])

const {
  requestAuthState,
  isSelf,
  activeSongKeys: activeSongKeySet,
  singingSongKeys: singingSongKeySet,
  beginRequest,
} = useSongListTemplateCore({
  userInfo: () => props.userInfo,
  liveRequestActive: () => props.liveRequestActive,
})

const inputKeyword = ref('')
const searchKeyword = ref('')

const filteredSongs = computed<SongsInfo[]>(() => {
  return filterSongs(props.data, { keyword: searchKeyword.value })
})
const { visibleItems, hasMore, loadMoreTrigger, loadMore } = useProgressiveList(filteredSongs, 24)
const { listKey } = useFilterListKey({ committedKeyword: searchKeyword })

function commitSearch() {
  searchKeyword.value = inputKeyword.value.trim()
}

function requestSong(song: SongsInfo) {
  if (!beginRequest(song)) return
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

    <div
      :key="listKey"
      class="count-row is-pulsing"
    >
      共 {{ filteredSongs.length }} 首歌曲
    </div>

    <NEmpty
      v-if="!data || filteredSongs.length === 0"
      :key="`empty-${listKey}`"
      class="empty-state"
      description="暂无曲目"
    />

    <div
      v-else
      :key="listKey"
      class="song-cards"
    >
      <div
        v-for="song in visibleItems"
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
            <SongStatusBadge
              :song-key="song.key"
              :singing-keys="singingSongKeySet"
              :queued-keys="activeSongKeySet"
              variant="text"
            />
            <SongRequestButton
              :song="song"
              :live-request-settings="liveRequestSettings"
              :auth-state="requestAuthState"
              :hidden="isSelf"
              size="small"
              :circle="false"
              @request="requestSong"
            />
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

          <SongOptionBadges
            :options="song.options"
            variant="guard"
          />

          <div class="desc">
            <NEllipsis :tooltip="false">
              {{ song.translateName || song.description || '' }}
            </NEllipsis>
          </div>
        </div>
      </div>

      <div
        v-if="hasMore"
        ref="loadMoreTrigger"
        class="load-more"
      >
        <NButton
          secondary
          @click="loadMore"
        >
          加载更多
        </NButton>
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

.count-row.is-pulsing {
  animation: count-pop 0.38s cubic-bezier(0.22, 1.4, 0.36, 1);
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
  content-visibility: auto;
  contain-intrinsic-size: auto 150px;
  border: var(--vtsuru-page-border-width, 1px) var(--vtsuru-page-border-style, solid) var(--song-border);
  border-radius: var(--vtsuru-page-radius, 8px);
  background: var(--song-panel);
  box-shadow: var(--vtsuru-page-shadow);
  transition:
    background-color 160ms ease,
    border-color 160ms ease,
    transform 160ms ease,
    box-shadow 160ms ease;
}

.song-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 24px color-mix(in srgb, var(--song-fg) 8%, transparent);
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

.load-more {
  display: flex;
  justify-content: center;
  padding-top: 2px;
}

@media (hover: hover) and (pointer: fine) {
  .song-card:hover {
    background: var(--song-bg-hover);
    transform: translateY(-1px);
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

  .card-bottom {
    grid-template-columns: 1fr;
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

@keyframes count-pop {
  0% {
    transform: scale(0.92);
    color: var(--song-accent);
  }
  55% {
    transform: scale(1.06);
  }
  100% {
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .song-card,
  .count-row.is-pulsing {
    animation: none;
  }

  .song-card {
    transition: none;
  }

  .song-card:hover {
    transform: none;
  }
}
</style>
