<script setup lang="ts">
import { useVirtualList } from '@vueuse/core'
import { ExternalLink, Heart, Info, Pin, Play } from 'lucide-vue-next'
import { ref } from 'vue'

import type { ResponseSongModel } from '@/api/generated/model'
import SongPlayer from '@/components/SongPlayer.vue'
import type { SongListConfigType } from '@/shared/types/TemplateTypes'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Empty } from '@/shared/ui/empty'
import { SmartImage } from '@/shared/ui/image'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'
import { toast } from '@/shared/utils'
import { getPlayableAudioUrl, getSongExternalLink } from '@/shared/utils/songMedia'

import SongListFilterToolbar from './components/SongListFilterToolbar.vue'
import SongOptionBadges from './components/SongOptionBadges.vue'
import SongRandomDialog from './components/SongRandomDialog.vue'
import SongRequestButton from './components/SongRequestButton.vue'
import SongStatusBadge from './components/SongStatusBadge.vue'
import SongTagChips from './components/SongTagChips.vue'
import { canRequestSong } from './utils/songRequestUtils'
import { isNewSong, useSongListQueryState } from './utils/useSongListQueryState'
import { useSongListTemplateCore } from './utils/useSongListTemplateCore'
import { useSongPreviewPlayer } from './utils/useSongPreviewPlayer'

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
  onlyRequestable,
  onlyFavorites,
  onlyPlayable,
  artistOptions,
  languageOptions,
  tagOptions,
  topLanguageOptions,
  topTagOptions,
  disabledCount,
  playableCount,
  favoriteCount,
  isFavorite,
  toggleFavorite,
  filteredSongs,
  hasFilters,
  clearFilters,
  pickRandomSong,
  copyShareLink,
} = useSongListQueryState(() => props.data, {
  ownerId: () => props.userInfo?.id,
  canRequestPredicate: (song) =>
    canRequestSong(
      song,
      props.userInfo,
      props.liveRequestSettings,
      requestAuthState.value.isLoggedIn,
      requestAuthState.value.isBiliAuthed,
    ).canRequest,
})

const { previewSong, isLrcLoading, playSong, closePlayer, isShared: isSharedPlayer } = useSongPreviewPlayer()

const randomDialogOpen = ref(false)
const randomSong = ref<ResponseSongModel | null>(null)

const { list, containerProps, wrapperProps } = useVirtualList(filteredSongs, {
  itemHeight: 62,
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
      <span class="text-xs font-mono tabular-nums text-muted-foreground shrink-0">
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
      v-model:only-requestable="onlyRequestable"
      v-model:only-favorites="onlyFavorites"
      v-model:only-playable="onlyPlayable"
      :artist-options="artistOptions"
      :language-options="languageOptions"
      :tag-options="tagOptions"
      :top-language-options="topLanguageOptions"
      :top-tag-options="topTagOptions"
      :total-count="data?.length ?? 0"
      :filtered-count="filteredSongs.length"
      :disabled-count="disabledCount"
      :playable-count="playableCount"
      :favorite-count="favoriteCount"
      :has-filters="hasFilters"
      @clear="clearFilters"
      @random="handleRandomPick"
      @share="copyShareLink"
    />

    <SongPlayer
      v-if="!isSharedPlayer && previewSong"
      v-model:is-lrc-loading="isLrcLoading"
      :song="previewSong"
      @close="closePlayer"
    />

    <Empty
      v-if="filteredSongs.length === 0"
      :description="data?.length ? '没有符合条件的歌曲' : '暂无曲目'"
      class="mt-12 py-8"
    />

    <div
      v-else
      v-bind="containerProps"
      class="h-[clamp(440px,68vh,840px)] overflow-y-auto scrollbar-thin rounded-[var(--vtsuru-page-radius,var(--radius))] border border-border/80 bg-card"
    >
      <div v-bind="wrapperProps">
        <div
          v-for="{ data: song, index } in list"
          :key="song.key"
          class="grid grid-cols-[36px_minmax(0,1fr)_auto] sm:grid-cols-[36px_40px_minmax(140px,1fr)_auto_auto] items-center gap-2.5 sm:gap-3 h-[62px] px-2.5 sm:px-3 border-b border-border/70 transition-colors hover:bg-muted/50 min-w-0"
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
            <SmartImage
              v-if="song.cover"
              :src="song.cover"
              :alt="song.name"
              class="size-full object-cover"
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
              <Badge
                v-if="isNewSong(song)"
                variant="brand"
                size="xs"
              >
                NEW
              </Badge>
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
            <div class="flex items-center gap-1.5 text-[11px] text-muted-foreground min-w-0">
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
              <SongOptionBadges
                v-if="song.options"
                :options="song.options"
                variant="semantic"
                size="tiny"
                class="flex sm:hidden shrink-0"
              />
              <Tooltip v-if="song.description">
                <TooltipTrigger as-child>
                  <Info class="size-3 text-muted-foreground/80 shrink-0 cursor-help hidden sm:inline" />
                </TooltipTrigger>
                <TooltipContent class="max-w-xs">{{ song.description }}</TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div class="hidden sm:flex">
            <SongTagChips
              :tags="song.tags"
              :selected-tag="selectedTag"
              :max-tags="3"
              :max-languages="0"
              @toggle-tag="selectedTag = selectedTag === $event ? null : $event"
            />
          </div>

          <div class="row-actions flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon-xs"
              class="rounded-full"
              :class="isFavorite(song.key) ? 'text-rose-500' : 'text-muted-foreground'"
              :aria-label="isFavorite(song.key) ? '取消收藏' : '收藏'"
              @click="toggleFavorite(song.key)"
            >
              <Heart
                class="size-3.5"
                :class="{ 'fill-current': isFavorite(song.key) }"
              />
            </Button>
            <Button
              v-if="getPlayableAudioUrl(song)"
              variant="ghost"
              size="icon-xs"
              class="rounded-full text-muted-foreground"
              :disabled="isLrcLoading === song.key"
              aria-label="试听"
              @click="playSong(song)"
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
