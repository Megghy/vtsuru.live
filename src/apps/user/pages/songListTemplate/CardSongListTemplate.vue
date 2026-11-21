<script setup lang="ts">
import { ExternalLink, Music, Pin, Play } from 'lucide-vue-next'
import { ref } from 'vue'

import type { ResponseSongModel } from '@/api/generated/model'
import SongPlayer from '@/components/SongPlayer.vue'
import type { SongListConfigType } from '@/shared/types/TemplateTypes'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Empty } from '@/shared/ui/empty'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { toast } from '@/shared/utils'
import { getPlayableAudioUrl, getSongExternalLink } from '@/shared/utils/songMedia'

import SongListFilterToolbar from './components/SongListFilterToolbar.vue'
import SongOptionBadges from './components/SongOptionBadges.vue'
import SongRandomDialog from './components/SongRandomDialog.vue'
import SongRequestButton from './components/SongRequestButton.vue'
import SongStatusBadge from './components/SongStatusBadge.vue'
import { getSongRequestTooltip } from './utils/songRequestUtils'
import { useProgressiveList } from './utils/useProgressiveList'
import { useSongListQueryState } from './utils/useSongListQueryState'
import { useFilterListKey, useSongListTemplateCore } from './utils/useSongListTemplateCore'

const props = defineProps<SongListConfigType>()
const emits = defineEmits(['requestSong'])

const {
  requestAuthState,
  isSelf,
  requestingKey,
  activeSongKeys: activeSongKeySet,
  singingSongKeys: singingSongKeySet,
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

const { visibleItems, hasMore, loadMoreTrigger, loadMore } = useProgressiveList(filteredSongs, 24)
const { listKey } = useFilterListKey({
  committedKeyword: searchKeyword,
  tag: selectedTag,
  author: selectedArtist,
  language: selectedLanguage,
})

const previewSong = ref<ResponseSongModel>()
const isLrcLoading = ref<string>()
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
  <TooltipProvider>
    <div class="w-full max-w-[var(--vtsuru-page-max-width,1180px)] mx-auto p-[clamp(12px,2vw,24px)] space-y-3.5">
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

      <Empty
        v-if="!data || filteredSongs.length === 0"
        :key="`empty-${listKey}`"
        class="empty-state py-12"
        :description="data?.length ? '没有符合条件的歌曲' : '暂无曲目'"
      />

      <div
        v-else
        :key="listKey"
        class="song-cards grid grid-cols-1 md:grid-cols-2 gap-3"
      >
        <article
          v-for="song in visibleItems"
          :key="song.key"
          class="song-card p-3 rounded-[var(--vtsuru-page-radius,var(--radius))] border border-border/80 bg-card flex flex-col justify-between gap-2 transition hover:border-primary/50"
          :class="{
            'is-active': activeSongKeySet.has(song.key),
            'is-singing': singingSongKeySet.has(song.key),
            'is-pinned': song.isPinned,
            'is-disabled': song.isDisabled,
          }"
        >
          <div class="card-top flex items-start justify-between gap-2 min-w-0">
            <div class="title-left flex items-start gap-2.5 min-w-0 flex-1">
              <div class="size-9 rounded-md overflow-hidden bg-muted/60 flex-center shrink-0 text-muted-foreground">
                <img
                  v-if="song.cover"
                  :src="song.cover"
                  :alt="song.name"
                  loading="lazy"
                  referrerpolicy="no-referrer"
                  class="size-full object-cover"
                />
                <Music
                  v-else
                  class="size-4"
                />
              </div>

              <div class="title-block min-w-0 flex-1">
                <div class="flex items-center gap-1 min-w-0">
                  <Pin
                    v-if="song.isPinned"
                    class="size-3 text-primary shrink-0"
                  />
                  <Tooltip :disabled="isSelf || Boolean(song.isDisabled)">
                    <TooltipTrigger as-child>
                      <button
                        class="song-title text-left font-medium text-xs text-foreground hover:text-primary transition truncate block flex-1 min-w-0 cursor-pointer disabled:cursor-default disabled:hover:text-foreground"
                        type="button"
                        :disabled="isSelf || Boolean(song.isDisabled)"
                        @click="requestSong(song)"
                      >
                        {{ song.name }}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {{ getSongRequestTooltip(song, liveRequestSettings, requestAuthState) }}
                    </TooltipContent>
                  </Tooltip>
                </div>

                <div
                  v-if="song.translateName"
                  class="text-[11px] text-muted-foreground truncate mt-0.5"
                >
                  {{ song.translateName }}
                </div>

                <div
                  v-if="song.author?.length"
                  class="text-[11px] text-muted-foreground truncate mt-0.5"
                >
                  {{ song.author.join(' / ') }}
                </div>
              </div>
            </div>

            <div class="title-right flex items-center gap-1 shrink-0">
              <Badge
                v-if="song.isDisabled"
                variant="secondary"
                size="xs"
              >
                暂不接歌
              </Badge>
              <SongStatusBadge
                :song-key="song.key"
                :singing-keys="singingSongKeySet"
                :queued-keys="activeSongKeySet"
                variant="tag"
              />
              <Button
                v-if="getPlayableAudioUrl(song)"
                size="icon-xs"
                variant="ghost"
                :disabled="isLrcLoading === song.key"
                :aria-label="`试听《${song.name}》`"
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
                  size="icon-xs"
                  variant="ghost"
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
          </div>

          <div
            v-if="song.tags?.length || song.language?.length || song.options || song.description"
            class="card-bottom flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-border/40 text-[11px]"
          >
            <div class="pills flex items-center gap-1 flex-wrap min-w-0">
              <button
                v-for="tag in (song.tags ?? []).slice(0, 3)"
                :key="tag"
                type="button"
                class="px-1.5 py-0.5 rounded text-[10px] truncate max-w-24 cursor-pointer transition-colors"
                :class="
                  selectedTag === tag
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                "
                @click="selectedTag = selectedTag === tag ? null : tag"
              >
                {{ tag }}
              </button>
              <button
                v-for="lang in (song.language ?? []).slice(0, 2)"
                :key="lang"
                type="button"
                class="px-1.5 py-0.5 rounded text-[10px] truncate max-w-24 cursor-pointer transition-colors"
                :class="
                  selectedLanguage === lang
                    ? 'bg-primary/15 text-primary font-medium'
                    : 'bg-muted/40 text-muted-foreground/80 hover:bg-muted/60'
                "
                @click="selectedLanguage = selectedLanguage === lang ? null : lang"
              >
                {{ lang }}
              </button>
            </div>

            <div class="flex items-center gap-2 ml-auto min-w-0">
              <SongOptionBadges
                :options="song.options"
                variant="guard"
                size="tiny"
              />
              <Tooltip v-if="song.description">
                <TooltipTrigger as-child>
                  <span class="text-muted-foreground truncate max-w-40 text-right cursor-help">
                    {{ song.description }}
                  </span>
                </TooltipTrigger>
                <TooltipContent class="max-w-xs">{{ song.description }}</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </article>

        <div
          v-if="hasMore"
          ref="loadMoreTrigger"
          class="load-more col-span-full flex justify-center py-4"
        >
          <Button
            variant="outline"
            @click="loadMore"
          >
            加载更多
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
  </TooltipProvider>
</template>
