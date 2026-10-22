<script setup lang="ts">
import { Play24Filled, Search24Regular } from '@vicons/fluent'
import { useVirtualList } from '@vueuse/core'
import { computed, ref } from 'vue'

import type { SongsInfo } from '@/api/api-models'
import SongPlayer from '@/components/SongPlayer.vue'
import type { SongListConfigType } from '@/shared/types/TemplateTypes'
import { Button } from '@/shared/ui/button'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'

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
const selectedAuthor = ref<string | null>(null)
const previewSong = ref<SongsInfo>()
const isLrcLoading = ref('')

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

const { listKey } = useFilterListKey({ tag: selectedTag, author: selectedAuthor })

const { list, containerProps, wrapperProps } = useVirtualList(filteredSongs, {
  itemHeight: 60,
  overscan: 8,
})

function requestSong(song: SongsInfo) {
  if (!beginRequest(song)) return
  emits('requestSong', song)
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

    <div class="toolbar flex flex-wrap gap-2.5 items-center mb-3.5">
      <div class="relative search flex-1 min-w-48">
        <component
          :is="Search24Regular"
          class="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          v-model="searchKeyword"
          class="pl-8"
          placeholder="搜索歌曲 / 歌手 / 标签…"
        />
      </div>
      <Select
        :model-value="selectedAuthor || 'all'"
        @update:model-value="selectedAuthor = $event === 'all' ? null : String($event)"
      >
        <SelectTrigger class="w-36">
          <SelectValue placeholder="歌手" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            value="all"
            class="text-xs"
            >全部歌手</SelectItem
          >
          <SelectItem
            v-for="opt in authorOptions"
            :key="opt.value"
            :value="opt.value"
            class="text-xs"
          >
            {{ opt.label }}
          </SelectItem>
        </SelectContent>
      </Select>
      <Select
        :model-value="selectedTag || 'all'"
        @update:model-value="selectedTag = $event === 'all' ? null : String($event)"
      >
        <SelectTrigger class="w-36">
          <SelectValue placeholder="标签" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            value="all"
            class="text-xs"
            >全部标签</SelectItem
          >
          <SelectItem
            v-for="opt in tagOptions"
            :key="opt.value"
            :value="opt.value"
            class="text-xs"
          >
            {{ opt.label }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <SongPlayer
      v-if="previewSong"
      v-model:is-lrc-loading="isLrcLoading"
      :song="previewSong"
      class="preview-player mb-3"
    />

    <Transition
      name="compact-swap"
      mode="out-in"
    >
      <Empty
        v-if="filteredSongs.length === 0"
        :key="`empty-${listKey}`"
        description="暂无曲目"
        class="mt-12 py-8"
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
                <SongStatusBadge
                  :song-key="song.key"
                  :singing-keys="singingSongKeySet"
                  :queued-keys="queuedSongKeySet"
                  variant="tag"
                />
                <SongOptionBadges
                  :options="song.options"
                  variant="semantic"
                  size="tiny"
                />
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
            <div class="row-actions flex items-center gap-1">
              <Button
                v-if="song.url"
                variant="ghost"
                size="icon"
                class="size-7 rounded-full text-muted-foreground hover:text-foreground"
                :disabled="isLrcLoading === song.key"
                title="试听"
                @click="previewSong = song"
              >
                <component
                  :is="Play24Filled"
                  class="size-3.5"
                />
              </Button>
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

.list-container {
  height: clamp(480px, 68vh, 840px);
  overflow-y: auto;
}

.row {
  display: grid;
  grid-template-columns: 36px 40px minmax(140px, 1fr) auto auto;
  align-items: center;
  gap: 12px;
  height: 60px;
  padding: 0 12px;
  border-bottom: 1px solid var(--song-border, rgba(128, 128, 128, 0.1));
  transition: background-color 0.15s ease;
}

.row:hover {
  background-color: var(--muted, rgba(128, 128, 128, 0.04));
}

.row.is-odd {
  background-color: var(--background-subtle, rgba(128, 128, 128, 0.02));
}

.row-index {
  font-size: 12px;
  font-family: monospace;
  color: var(--song-muted, #888);
  text-align: center;
}

.row-cover {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--muted, rgba(128, 128, 128, 0.08));
}

.row-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.row-cover-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 14px;
  font-weight: 600;
  color: var(--song-muted, #888);
}

.row-main {
  min-width: 0;
}

.row-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--song-fg);
}

.row-title .name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-title .translate {
  font-size: 11px;
  color: var(--song-muted, #888);
}

.row-author {
  font-size: 11px;
  color: var(--song-muted, #888);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-tags {
  display: flex;
  gap: 4px;
}

.clickable-tag {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  color: var(--song-muted, #888);
  background: var(--muted, rgba(128, 128, 128, 0.08));
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
}

.clickable-tag:hover,
.clickable-tag.is-active {
  color: var(--song-accent, #23ade5);
  background: var(--brand-soft, rgba(35, 173, 229, 0.12));
}

.count {
  font-size: 12px;
  font-family: monospace;
  color: var(--song-muted, #888);
}
</style>
