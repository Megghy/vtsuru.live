<script setup lang="ts">
import { MusicNote224Filled, Search24Regular } from '@vicons/fluent'
import { useVirtualList } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import type { SongsInfo } from '@/api/api-models'
import SongPlayer from '@/components/SongPlayer.vue'
import type { SongListConfigType } from '@/shared/types/TemplateTypes'
import { Badge } from '@/shared/ui/badge'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'

import SongOptionBadges from './components/SongOptionBadges.vue'
import SongRequestButton from './components/SongRequestButton.vue'
import SongStatusBadge from './components/SongStatusBadge.vue'
import { filterSongs } from './utils/songListData'
import { getSongRequestTooltip } from './utils/songRequestUtils'
import { useSongListTemplateCore } from './utils/useSongListTemplateCore'

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
const selectedSong = ref<SongsInfo>()
const isLrcLoading = ref('')

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

const stageEpoch = ref(0)
function selectSong(song: SongsInfo) {
  if (selectedSong.value?.key === song.key) return
  selectedSong.value = song
  stageEpoch.value += 1
}

function requestSong(song: SongsInfo) {
  if (!beginRequest(song)) return
  emits('requestSong', song)
}

const stageRequestLabel = computed(() => {
  if (!selectedSong.value) return '点歌'
  return getSongRequestTooltip(selectedSong.value, props.liveRequestSettings, requestAuthState.value)
})
</script>

<template>
  <div
    class="immersive-template"
    :style="{ '--immersive-cover': selectedSong?.cover ? `url(${selectedSong.cover})` : 'none' }"
  >
    <aside class="stage">
      <span class="stage-kicker">NOW SELECTED</span>
      <Transition
        name="stage-cover"
        mode="out-in"
      >
        <div
          :key="selectedSong?.key ?? 'empty'"
          class="stage-cover"
          :class="{ 'is-empty': !selectedSong?.cover }"
        >
          <img
            v-if="selectedSong?.cover"
            :src="selectedSong.cover"
            :alt="selectedSong.name"
            referrerpolicy="no-referrer"
          />
          <component
            :is="MusicNote224Filled"
            v-else
            class="stage-cover-icon size-12 text-muted-foreground"
          />
        </div>
      </Transition>

      <Transition
        name="stage-meta"
        mode="out-in"
      >
        <div
          v-if="selectedSong"
          :key="`${selectedSong.key}-${stageEpoch}`"
          class="stage-meta"
        >
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
            class="stage-tags flex flex-wrap gap-1"
          >
            <Badge
              v-for="lang in selectedSong.language ?? []"
              :key="`l-${lang}`"
              variant="secondary"
              class="text-xs h-5 px-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-normal"
            >
              {{ lang }}
            </Badge>
            <Badge
              v-for="tag in (selectedSong.tags ?? []).slice(0, 4)"
              :key="`t-${tag}`"
              variant="secondary"
              class="text-xs h-5 px-2 font-normal"
            >
              {{ tag }}
            </Badge>
          </div>

          <SongOptionBadges
            v-if="selectedSong.options"
            :options="selectedSong.options"
            variant="guard"
          />

          <SongRequestButton
            v-if="!isSelf"
            class="stage-request"
            :song="selectedSong"
            :live-request-settings="liveRequestSettings"
            :auth-state="requestAuthState"
            :loading="requestingKey === selectedSong.key"
            :circle="false"
            :secondary="false"
            size="medium"
            :label="stageRequestLabel"
            @request="requestSong"
          />

          <SongPlayer
            v-if="selectedSong.url"
            v-model:is-lrc-loading="isLrcLoading"
            :song="selectedSong"
            class="stage-player"
          />
        </div>
      </Transition>
    </aside>

    <section class="library">
      <header class="library-heading">
        <div>
          <span class="library-kicker">LIBRARY</span>
          <h2>选择一首歌</h2>
        </div>
        <span class="library-count">{{ filteredSongs.length }} 首</span>
      </header>

      <div class="search-shell mb-3">
        <div class="relative w-full">
          <component :is="Search24Regular" class="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input v-model="searchKeyword" class="pl-8 w-full" placeholder="搜索曲库…" />
        </div>
      </div>

      <Empty
        v-if="filteredSongs.length === 0"
        description="暂无曲目"
        class="mt-12 py-8"
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
            <SongStatusBadge
              :song-key="song.key"
              :singing-keys="singingSongKeySet"
              :queued-keys="queuedSongKeySet"
              variant="text"
            />
            <SongRequestButton
              :song="song"
              :live-request-settings="liveRequestSettings"
              :auth-state="requestAuthState"
              :loading="requestingKey === song.key"
              :hidden="isSelf"
              @request="requestSong"
            />
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.immersive-template {
  position: relative;
  display: grid;
  grid-template-columns: minmax(280px, 380px) minmax(320px, 1fr);
  gap: clamp(16px, 3vw, 40px);
  width: 100%;
  max-width: var(--vtsuru-page-max-width, 1280px);
  min-width: 0;
  margin: 0 auto;
  padding: clamp(16px, 3vw, 36px);
}

@media (max-width: 768px) {
  .immersive-template {
    grid-template-columns: 1fr;
  }
}

.stage {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stage-kicker,
.library-kicker {
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.1em;
  color: var(--song-accent, #23ade5);
}

.stage-cover {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 12px;
  overflow: hidden;
  background: var(--muted, rgba(128, 128, 128, 0.08));
  display: flex;
  align-items: center;
  justify-content: center;
}

.stage-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.stage-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--song-fg);
}

.stage-subtitle {
  font-size: 12px;
  color: var(--song-muted, #888);
}

.stage-author {
  font-size: 13px;
  color: var(--song-muted, #888);
}

.library-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 12px;
}

.library-heading h2 {
  margin: 0;
  font-size: 20px;
  color: var(--song-fg);
}

.library-count {
  font-size: 12px;
  font-family: monospace;
  color: var(--song-muted, #888);
}

.library-list {
  height: clamp(400px, 65vh, 760px);
  overflow-y: auto;
}

.lib-row {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 52px;
  padding: 0 8px;
  border-radius: 8px;
  transition: background-color 0.15s ease;
}

.lib-row:hover,
.lib-row.active {
  background: var(--muted, rgba(128, 128, 128, 0.06));
}

.lib-select {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
}

.lib-cover {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--muted, rgba(128, 128, 128, 0.08));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--song-muted);
  flex-shrink: 0;
}

.lib-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.lib-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.lib-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--song-fg);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lib-author {
  font-size: 11px;
  color: var(--song-muted, #888);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
