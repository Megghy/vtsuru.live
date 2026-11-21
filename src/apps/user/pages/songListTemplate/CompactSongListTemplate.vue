<script setup lang="ts">
import { useVirtualList } from '@vueuse/core'
import { ExternalLink, Pin, Play } from 'lucide-vue-next'
import { ref } from 'vue'

import type { ResponseSongModel } from '@/api/generated/model'
import SongPlayer from '@/components/SongPlayer.vue'
import type { SongListConfigType } from '@/shared/types/TemplateTypes'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Empty } from '@/shared/ui/empty'
import { toast } from '@/shared/utils'
import { getPlayableAudioUrl, getSongExternalLink } from '@/shared/utils/songMedia'

import SongListFilterToolbar from './components/SongListFilterToolbar.vue'
import SongOptionBadges from './components/SongOptionBadges.vue'
import SongRandomDialog from './components/SongRandomDialog.vue'
import SongRequestButton from './components/SongRequestButton.vue'
import SongStatusBadge from './components/SongStatusBadge.vue'
import { useSongListQueryState } from './utils/useSongListQueryState'
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

const {
  searchKeyword,
  selectedArtist,
  selectedLanguage,
  selectedTag,
  selectedOption,
  sortKey,
  sortOrder,
  hideDisabled,
  artistOptions,
  languageOptions,
  tagOptions,
  disabledCount,
  filteredSongs,
  hasFilters,
  clearFilters,
  pickRandomSong,
  copyShareLink,
} = useSongListQueryState(() => props.data)

const previewSong = ref<ResponseSongModel>()
const isLrcLoading = ref<string>()
const randomDialogOpen = ref(false)
const randomSong = ref<ResponseSongModel | null>(null)

const { listKey } = useFilterListKey({
  committedKeyword: searchKeyword,
  tag: selectedTag,
  author: selectedArtist,
  language: selectedLanguage,
})

const { list, containerProps, wrapperProps } = useVirtualList(filteredSongs, {
  itemHeight: 60,
  overscan: 8,
})

function requestSong(song: ResponseSongModel) {
  if (!beginRequest(song)) return
  emits('requestSong', song)
}

function handleRandomPick() {
  const picked = pickRandomSong(randomSong.value?.key)
  if (!picked) {
    toast.warning('当前没有可点选的歌曲')
    return
  }
  randomSong.value = picked
  randomDialogOpen.value = true
}
</script>

<template>
  <div class="w-full max-w-[var(--vtsuru-page-max-width,1180px)] min-w-0 mx-auto p-[clamp(12px,2vw,24px)] space-y-3.5">
    <header class="flex items-end justify-between gap-3">
      <div class="min-w-0">
        <span class="block mb-0.5 text-primary text-[10px] font-bold">QUICK INDEX</span>
        <h2 class="m-0 text-card-foreground text-[clamp(20px,3vw,26px)] leading-[1.15] truncate">
          {{ userInfo?.name ? `${userInfo.name} · 快速曲库` : '快速曲库' }}
        </h2>
      </div>
      <span
        :key="listKey"
        class="text-xs font-mono tabular-nums text-muted-foreground shrink-0"
      >
        {{ filteredSongs.length }} 首
      </span>
    </header>

    <SongListFilterToolbar
      v-model:search-keyword="searchKeyword"
      v-model:selected-artist="selectedArtist"
      v-model:selected-language="selectedLanguage"
      v-model:selected-tag="selectedTag"
      v-model:selected-option="selectedOption"
      v-model:sort-key="sortKey"
      v-model:sort-order="sortOrder"
      v-model:hide-disabled="hideDisabled"
      :artist-options="artistOptions"
      :language-options="languageOptions"
      :tag-options="tagOptions"
      :total-count="data?.length ?? 0"
      :filtered-count="filteredSongs.length"
      :disabled-count="disabledCount"
      :has-filters="hasFilters"
      @clear="clearFilters"
      @random="handleRandomPick"
      @share="copyShareLink"
    />

    <SongPlayer
      v-if="previewSong"
      v-model:is-lrc-loading="isLrcLoading"
      :song="previewSong"
      @close="previewSong = undefined"
    />

    <Transition
      name="compact-swap"
      mode="out-in"
    >
      <Empty
        v-if="filteredSongs.length === 0"
        :key="`empty-${listKey}`"
        :description="data?.length ? '没有符合条件的歌曲' : '暂无曲目'"
        class="mt-12 py-8"
      />

      <div
        v-else
        :key="listKey"
        v-bind="containerProps"
        class="h-[clamp(440px,68vh,840px)] overflow-y-auto scrollbar-thin rounded-[var(--vtsuru-page-radius,var(--radius))] border border-border/80 bg-card"
      >
        <div v-bind="wrapperProps">
          <div
            v-for="{ data: song, index } in list"
            :key="song.key"
            class="grid grid-cols-[36px_minmax(0,1fr)_auto] sm:grid-cols-[36px_40px_minmax(140px,1fr)_auto_auto] items-center gap-2.5 sm:gap-3 h-[60px] px-2.5 sm:px-3 border-b border-border/70 transition-colors hover:bg-muted/50 min-w-0"
            :class="{
              'bg-muted/25': index % 2 === 1,
              'is-singing': singingSongKeySet.has(song.key),
              'is-queued': queuedSongKeySet.has(song.key),
              'is-pinned': song.isPinned,
              'is-disabled': song.isDisabled,
            }"
          >
            <div class="hidden sm:block text-xs font-mono tabular-nums text-muted-foreground text-center">
              {{ index + 1 }}
            </div>

            <div class="size-9 sm:size-10 rounded-md overflow-hidden bg-muted shrink-0">
              <img
                v-if="song.cover"
                :src="song.cover"
                :alt="song.name"
                class="size-full object-cover"
                loading="lazy"
                referrerpolicy="no-referrer"
              />
              <span
                v-else
                class="flex-center size-full text-sm font-semibold text-muted-foreground"
              >
                {{ song.name.charAt(0) }}
              </span>
            </div>

            <div class="min-w-0">
              <div class="flex items-center gap-1.5 text-[13px] font-medium text-card-foreground min-w-0">
                <Pin
                  v-if="song.isPinned"
                  class="size-3 text-primary shrink-0"
                />
                <span
                  class="truncate"
                  :title="song.name"
                >
                  {{ song.name }}
                </span>
                <span
                  v-if="song.translateName"
                  class="text-[11px] text-muted-foreground truncate max-w-[120px] hidden sm:inline"
                  :title="song.translateName"
                >
                  {{ song.translateName }}
                </span>
                <Badge
                  v-if="song.isDisabled"
                  variant="secondary"
                  size="xs"
                  class="shrink-0"
                >
                  暂不接歌
                </Badge>
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
                  class="hidden sm:flex"
                />
              </div>
              <div class="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate min-w-0">
                <span
                  v-if="song.author?.length"
                  class="truncate"
                  :title="song.author.join(' / ')"
                >
                  {{ song.author.join(' / ') }}
                </span>
                <span
                  v-else
                  class="opacity-60"
                >
                  未知歌手
                </span>
                <template v-if="song.language?.length">
                  <span>·</span>
                  <span class="truncate">{{ song.language.join('/') }}</span>
                </template>
              </div>
            </div>

            <div class="hidden sm:flex gap-1">
              <button
                v-for="tag in (song.tags ?? []).slice(0, 3)"
                :key="tag"
                type="button"
                class="px-1.5 py-0.5 rounded text-[10px] text-muted-foreground bg-muted border-0 cursor-pointer transition-colors hover:text-primary hover:bg-primary/15"
                :class="{ 'text-primary bg-primary/15': selectedTag === tag }"
                :aria-pressed="selectedTag === tag"
                @click="selectedTag = selectedTag === tag ? null : tag"
              >
                {{ tag }}
              </button>
            </div>

            <div class="row-actions flex items-center gap-1 shrink-0">
              <Button
                v-if="getPlayableAudioUrl(song)"
                variant="ghost"
                size="icon-xs"
                class="rounded-full text-muted-foreground"
                :disabled="isLrcLoading === song.key"
                aria-label="试听"
                @click="previewSong = song"
              >
                <Play class="size-3.5" />
              </Button>
              <a
                v-if="getSongExternalLink(song)"
                :href="getSongExternalLink(song)!.url"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  variant="ghost"
                  size="icon-xs"
                  class="rounded-full text-muted-foreground"
                  :aria-label="getSongExternalLink(song)!.label"
                >
                  <ExternalLink class="size-3.5" />
                </Button>
              </a>
              <SongRequestButton
                :song="song"
                :live-request-settings="liveRequestSettings"
                :auth-state="requestAuthState"
                :loading="requestingKey === song.key"
                :hidden="isSelf"
                size="tiny"
                @request="requestSong"
              />
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <SongRandomDialog
      v-model:open="randomDialogOpen"
      :song="randomSong"
      :is-self="isSelf"
      :live-request-settings="liveRequestSettings"
      :can-reroll="filteredSongs.filter((s) => !s.isDisabled).length > 1"
      @reroll="handleRandomPick"
      @request="requestSong"
    />
  </div>
</template>
