<script setup lang="ts">
import { ExternalLink, Heart, Pin, Play } from 'lucide-vue-next'
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
import { useProgressiveList } from './utils/useProgressiveList'
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

const { visibleItems, hasMore, loadMoreTrigger, loadMore } = useProgressiveList(filteredSongs, 24)
const { previewSong, isLrcLoading, playSong, closePlayer, isShared: isSharedPlayer } = useSongPreviewPlayer()

const randomDialogOpen = ref(false)
const randomSong = ref<ResponseSongModel | null>(null)

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
  <div class="w-full max-w-[var(--vtsuru-page-max-width,1180px)] mx-auto p-[clamp(12px,2vw,24px)] space-y-4">
    <header class="flex items-end justify-between gap-3">
      <div>
        <span class="block mb-0.5 text-primary text-[10px] font-bold">COVER ARCHIVE</span>
        <h2 class="m-0 text-card-foreground text-[clamp(20px,3vw,26px)] leading-[1.15]">
          {{ userInfo?.name ? `${userInfo.name} · 封面曲库` : '封面曲库' }}
        </h2>
      </div>
      <span class="text-xs font-mono tabular-nums text-muted-foreground"> {{ filteredSongs.length }} 首 </span>
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
      class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3"
    >
      <article
        v-for="(song, index) in visibleItems"
        :key="song.key"
        class="cover-card flex flex-col justify-between gap-2 rounded-[var(--vtsuru-page-radius,var(--radius))] border border-border/80 bg-card p-2 transition hover:border-primary/50"
        :class="{
          'is-singing': singingSongKeySet.has(song.key),
          'is-queued': queuedSongKeySet.has(song.key),
          'is-pinned': song.isPinned,
          'is-disabled': song.isDisabled,
        }"
      >
        <div class="space-y-2">
          <div class="cover relative aspect-square w-full rounded-md overflow-hidden bg-muted/60 group">
            <SmartImage
              v-if="song.cover"
              :src="song.cover"
              :alt="song.name"
              class="w-full h-full object-cover transition duration-300 group-hover:scale-105"
            />
            <div
              v-else
              class="cover-placeholder w-full h-full flex-center font-bold text-lg text-muted-foreground"
            >
              <span>{{ song.name.charAt(0) }}</span>
            </div>

            <span
              class="cover-index absolute top-1.5 left-1.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/60 text-white inline-flex items-center gap-0.5"
            >
              <Pin
                v-if="song.isPinned"
                class="size-2.5 text-sky-300"
              />
              {{ String(index + 1).padStart(2, '0') }}
            </span>

            <div class="absolute top-1.5 right-1.5 flex items-center gap-1">
              <Badge
                v-if="isNewSong(song)"
                variant="brand"
                size="xs"
              >
                NEW
              </Badge>
              <SongStatusBadge
                :song-key="song.key"
                :singing-keys="singingSongKeySet"
                :queued-keys="queuedSongKeySet"
                variant="tag"
              />
            </div>

            <Badge
              v-if="song.isDisabled"
              variant="secondary"
              size="xs"
              class="absolute bottom-1.5 left-1.5"
            >
              暂不接歌
            </Badge>

            <!-- 桌面端悬浮与键盘聚焦快捷层 -->
            <div
              class="hidden md:flex cover-overlay absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition flex-center gap-1.5"
            >
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    variant="secondary"
                    size="icon-xs"
                    class="rounded-full bg-background/90 hover:bg-background"
                    :class="isFavorite(song.key) ? 'text-rose-500' : 'text-foreground'"
                    :aria-label="isFavorite(song.key) ? `取消收藏《${song.name}》` : `收藏《${song.name}》`"
                    @click="toggleFavorite(song.key)"
                  >
                    <Heart
                      class="size-3.5"
                      :class="{ 'fill-current': isFavorite(song.key) }"
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{{ isFavorite(song.key) ? '取消收藏' : '收藏' }}</TooltipContent>
              </Tooltip>
              <Tooltip v-if="getPlayableAudioUrl(song)">
                <TooltipTrigger as-child>
                  <Button
                    variant="secondary"
                    size="icon-xs"
                    class="rounded-full bg-background/90 text-foreground hover:bg-background"
                    :aria-label="`试听：${song.name}`"
                    :disabled="isLrcLoading === song.key"
                    @click="playSong(song)"
                  >
                    <Play class="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>试听</TooltipContent>
              </Tooltip>
              <Tooltip v-if="getSongExternalLink(song)">
                <TooltipTrigger as-child>
                  <a
                    :href="getSongExternalLink(song)!.url"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button
                      variant="secondary"
                      size="icon-xs"
                      class="rounded-full bg-background/90 text-foreground hover:bg-background"
                      :aria-label="getSongExternalLink(song)!.label"
                    >
                      <ExternalLink class="size-3.5" />
                    </Button>
                  </a>
                </TooltipTrigger>
                <TooltipContent>{{ getSongExternalLink(song)!.label }}</TooltipContent>
              </Tooltip>
              <SongRequestButton
                v-if="!isSelf"
                :song="song"
                :live-request-settings="liveRequestSettings"
                :auth-state="requestAuthState"
                :loading="requestingKey === song.key"
                :circle="true"
                size="tiny"
                @request="requestSong"
              />
            </div>
          </div>

          <div class="info flex flex-col gap-0.5 text-xs min-w-0">
            <div
              class="title font-medium truncate text-foreground"
              :title="song.name"
            >
              {{ song.name }}
            </div>
            <div
              v-if="song.translateName"
              class="translate text-[11px] text-muted-foreground truncate"
              :title="song.translateName"
            >
              {{ song.translateName }}
            </div>
            <div
              v-if="song.author?.length"
              class="author text-[11px] text-muted-foreground truncate"
              :title="song.author.join(' / ')"
            >
              {{ song.author.join(' / ') }}
            </div>

            <Tooltip v-if="song.description">
              <TooltipTrigger as-child>
                <p class="text-[11px] text-muted-foreground/85 truncate m-0 mt-0.5 cursor-help">
                  {{ song.description }}
                </p>
              </TooltipTrigger>
              <TooltipContent class="max-w-xs">{{ song.description }}</TooltipContent>
            </Tooltip>

            <SongTagChips
              v-if="song.tags?.length || song.language?.length"
              :tags="song.tags"
              :languages="song.language"
              :selected-tag="selectedTag"
              :selected-language="selectedLanguage"
              :max-tags="2"
              :max-languages="1"
              class="mt-1"
              @toggle-tag="selectedTag = selectedTag === $event ? null : $event"
              @toggle-language="selectedLanguage = selectedLanguage === $event ? null : $event"
            />

            <SongOptionBadges
              :options="song.options"
              variant="guard"
              size="tiny"
              class="mt-1"
            />
          </div>
        </div>

        <!-- 移动端常驻操作栏，解除 hover 死锁 -->
        <div class="flex md:hidden items-center justify-end gap-1 pt-1.5 border-t border-border/50">
          <Button
            variant="ghost"
            size="icon-xs"
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
            :aria-label="`试听：${song.name}`"
            :disabled="isLrcLoading === song.key"
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
            :circle="false"
            @request="requestSong"
          />
        </div>
      </article>

      <div
        v-if="hasMore"
        ref="loadMoreTrigger"
        class="col-span-full flex justify-center py-4"
      >
        <Button
          type="button"
          variant="outline"
          @click="loadMore"
        >
          加载更多 ({{ visibleItems.length }} / {{ filteredSongs.length }})
        </Button>
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
