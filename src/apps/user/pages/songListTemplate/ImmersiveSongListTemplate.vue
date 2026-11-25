<script setup lang="ts">
import { useVirtualList } from '@vueuse/core'
import { ExternalLink, Heart, Music, Pin, Play } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

import type { ResponseSongModel } from '@/api/generated/model'
import SongPlayer from '@/components/SongPlayer.vue'
import type { SongListConfigType } from '@/shared/types/TemplateTypes'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Empty } from '@/shared/ui/empty'
import { SmartImage } from '@/shared/ui/image'
import { ImagePreview } from '@/shared/ui/image-preview'
import { toast } from '@/shared/utils'
import { getPlayableAudioUrl, getSongExternalLink } from '@/shared/utils/songMedia'

import SongListFilterToolbar from './components/SongListFilterToolbar.vue'
import SongOptionBadges from './components/SongOptionBadges.vue'
import SongRandomDialog from './components/SongRandomDialog.vue'
import SongRequestButton from './components/SongRequestButton.vue'
import SongStatusBadge from './components/SongStatusBadge.vue'
import SongTagChips from './components/SongTagChips.vue'
import { canRequestSong, getSongRequestTooltip } from './utils/songRequestUtils'
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

const selectedSong = ref<ResponseSongModel>()
const randomDialogOpen = ref(false)
const randomSong = ref<ResponseSongModel | null>(null)

const { list, containerProps, wrapperProps } = useVirtualList(filteredSongs, {
  itemHeight: 58,
  overscan: 10,
})

watch(
  filteredSongs,
  (songs) => {
    if (!songs.length) {
      selectedSong.value = undefined
      return
    }
    if (!selectedSong.value || !songs.some((s) => s.key === selectedSong.value!.key)) {
      selectedSong.value = songs[0]
    }
  },
  { immediate: true },
)

const stageEpoch = ref(0)
function selectSong(song: ResponseSongModel) {
  if (selectedSong.value?.key === song.key) return
  selectedSong.value = song
  stageEpoch.value += 1
}

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

const stageRequestLabel = computed(() => {
  if (!selectedSong.value) return '点歌'
  return getSongRequestTooltip(selectedSong.value, props.liveRequestSettings, requestAuthState.value)
})

const playableSelectedUrl = computed(() => (selectedSong.value ? getPlayableAudioUrl(selectedSong.value) : undefined))
const externalSelectedLink = computed(() => (selectedSong.value ? getSongExternalLink(selectedSong.value) : undefined))
</script>

<template>
  <div
    class="relative grid grid-cols-1 md:grid-cols-[minmax(280px,360px)_minmax(0,1fr)] gap-[clamp(16px,3vw,36px)] w-full max-w-[var(--vtsuru-page-max-width,1240px)] min-w-0 mx-auto p-[clamp(12px,2.5vw,32px)]"
  >
    <!-- 左侧舞台（桌面 sticky） -->
    <aside class="flex flex-col gap-3 md:sticky md:top-4 md:self-start min-w-0">
      <span class="text-[10px] font-bold tracking-widest text-primary">NOW SELECTED</span>
      <Transition
        name="stage-cover"
        mode="out-in"
      >
        <div
          :key="selectedSong?.key ?? 'empty'"
          class="w-full max-w-[260px] md:max-w-none mx-auto aspect-square rounded-[var(--vtsuru-page-radius,var(--radius))] overflow-hidden bg-muted flex-center border border-border/60"
        >
          <ImagePreview
            v-if="selectedSong?.cover"
            :src="selectedSong.cover"
            :alt="selectedSong.name"
            wrapper-class="block size-full"
          >
            <template #default="{ open }">
              <button
                type="button"
                class="block size-full cursor-zoom-in p-0 border-0 bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                :aria-label="`放大查看 ${selectedSong.name} 封面`"
                @click="open()"
              >
                <SmartImage
                  :src="selectedSong.cover"
                  :alt="selectedSong.name"
                  class="size-full object-cover"
                />
              </button>
            </template>
          </ImagePreview>
          <Music
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
          class="stage-meta flex flex-col gap-2.5 min-w-0"
        >
          <div class="min-w-0">
            <div class="flex items-center gap-1.5 flex-wrap">
              <Pin
                v-if="selectedSong.isPinned"
                class="size-3.5 text-primary shrink-0"
              />
              <span class="text-lg font-bold text-card-foreground break-words">
                {{ selectedSong.name }}
              </span>
              <Badge
                v-if="isNewSong(selectedSong)"
                variant="brand"
                size="xs"
              >
                NEW
              </Badge>
              <Badge
                v-if="selectedSong.isDisabled"
                variant="secondary"
                size="xs"
              >
                暂不接歌
              </Badge>
            </div>
            <div
              v-if="selectedSong.translateName"
              class="text-xs text-muted-foreground mt-0.5"
            >
              {{ selectedSong.translateName }}
            </div>
            <div
              v-if="selectedSong.author?.length"
              class="text-[13px] text-muted-foreground mt-0.5"
            >
              {{ selectedSong.author.join(' / ') }}
            </div>
          </div>

          <p
            v-if="selectedSong.description"
            class="text-xs text-muted-foreground m-0 leading-relaxed"
          >
            {{ selectedSong.description }}
          </p>

          <SongTagChips
            v-if="selectedSong.language?.length || selectedSong.tags?.length"
            :tags="selectedSong.tags"
            :languages="selectedSong.language"
            :selected-tag="selectedTag"
            :selected-language="selectedLanguage"
            :max-tags="6"
            :max-languages="4"
            @toggle-tag="selectedTag = selectedTag === $event ? null : $event"
            @toggle-language="selectedLanguage = selectedLanguage === $event ? null : $event"
          />

          <SongOptionBadges
            v-if="selectedSong.options"
            :options="selectedSong.options"
            variant="guard"
          />

          <div class="flex flex-wrap items-center gap-2">
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
            <Button
              v-if="playableSelectedUrl"
              variant="secondary"
              size="sm"
              class="gap-1.5"
              :disabled="isLrcLoading === selectedSong.key"
              @click="playSong(selectedSong)"
            >
              <Play class="size-3.5" />
              试听
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              :class="isFavorite(selectedSong.key) ? 'text-rose-500 border-rose-500/30' : 'text-muted-foreground'"
              :aria-label="isFavorite(selectedSong.key) ? '取消收藏' : '收藏'"
              @click="toggleFavorite(selectedSong.key)"
            >
              <Heart
                class="size-3.5"
                :class="{ 'fill-current': isFavorite(selectedSong.key) }"
              />
            </Button>
            <a
              v-if="externalSelectedLink"
              :href="externalSelectedLink.url"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                variant="outline"
                size="sm"
                class="gap-1.5"
              >
                <ExternalLink class="size-3.5" />
                {{ externalSelectedLink.label }}
              </Button>
            </a>
          </div>

          <SongPlayer
            v-if="!isSharedPlayer && previewSong"
            v-model:is-lrc-loading="isLrcLoading"
            :song="previewSong"
            @close="closePlayer"
          />
        </div>
      </Transition>
    </aside>

    <!-- 右侧虚拟滚动列表 -->
    <section class="min-w-0 space-y-3">
      <header class="flex items-end justify-between gap-2">
        <div>
          <span class="text-[10px] font-bold tracking-widest text-primary">LIBRARY</span>
          <h2 class="m-0 text-xl text-card-foreground">选择一首歌</h2>
        </div>
        <span class="text-xs font-mono tabular-nums text-muted-foreground">{{ filteredSongs.length }} 首</span>
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

      <Empty
        v-if="filteredSongs.length === 0"
        :description="data?.length ? '没有符合条件的歌曲' : '暂无曲目'"
        class="mt-12 py-8"
      />

      <div
        v-else
        v-bind="containerProps"
        class="h-[clamp(400px,65vh,760px)] overflow-y-auto scrollbar-thin rounded-[var(--vtsuru-page-radius,var(--radius))] border border-border/70 bg-card/60 p-1.5"
      >
        <div v-bind="wrapperProps">
          <div
            v-for="{ data: song } in list"
            :key="song.key"
            class="flex items-center gap-2 h-[58px] px-2 rounded-lg transition-colors hover:bg-muted/70 min-w-0"
            :class="{
              'bg-muted': selectedSong?.key === song.key,
              'is-singing': singingSongKeySet.has(song.key),
              'is-queued': queuedSongKeySet.has(song.key),
              'is-pinned': song.isPinned,
              'is-disabled': song.isDisabled,
            }"
          >
            <button
              type="button"
              class="flex items-center gap-2.5 flex-1 min-w-0 bg-transparent border-0 p-0 cursor-pointer text-left"
              :aria-current="selectedSong?.key === song.key ? 'true' : undefined"
              @click="selectSong(song)"
            >
              <span
                class="size-9 rounded-md overflow-hidden bg-muted flex-center text-xs font-semibold text-muted-foreground shrink-0"
              >
                <SmartImage
                  v-if="song.cover"
                  :src="song.cover"
                  :alt="song.name"
                  class="size-full object-cover"
                />
                <span v-else>{{ song.name.charAt(0) }}</span>
              </span>
              <span class="flex flex-col min-w-0">
                <span class="flex items-center gap-1 min-w-0">
                  <Pin
                    v-if="song.isPinned"
                    class="size-3 text-primary shrink-0"
                  />
                  <span
                    class="text-[13px] font-medium text-card-foreground truncate"
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
                </span>
                <span class="flex items-center gap-1.5 text-[11px] text-muted-foreground min-w-0">
                  <span
                    v-if="song.author?.length"
                    class="truncate"
                  >
                    {{ song.author.join(' / ') }}
                  </span>
                  <SongOptionBadges
                    v-if="song.options"
                    :options="song.options"
                    variant="semantic"
                    size="tiny"
                    class="shrink-0"
                  />
                </span>
              </span>
            </button>

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
              :queued-keys="queuedSongKeySet"
              variant="text"
            />
            <Button
              size="icon-xs"
              variant="ghost"
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
              size="icon-xs"
              variant="ghost"
              class="rounded-full text-muted-foreground"
              :disabled="isLrcLoading === song.key"
              :aria-label="`试听《${song.name}》`"
              @click="playSong(song)"
            >
              <Play class="size-3.5" />
            </Button>
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
    </section>

    <!-- 移动端吸底快捷栏（点击试听直接唤起全局吸底播放器，不再跳回顶部） -->
    <div
      v-if="selectedSong && !previewSong"
      data-site-sticky="bottom"
      data-site-surface="bar"
      class="md:hidden sticky bottom-2 z-20 flex items-center justify-between gap-2 p-2.5 rounded-xl border border-border bg-card/95 backdrop-blur-md shadow-md"
    >
      <div class="flex items-center gap-2 min-w-0 flex-1">
        <SmartImage
          v-if="selectedSong.cover"
          :src="selectedSong.cover"
          :alt="selectedSong.name"
          class="size-8 rounded object-cover shrink-0"
        />
        <div class="min-w-0 flex-1">
          <div class="text-xs font-medium text-foreground truncate">{{ selectedSong.name }}</div>
          <div class="text-[11px] text-muted-foreground truncate">
            {{ selectedSong.author?.join(' / ') || '未知歌手' }}
          </div>
        </div>
      </div>
      <div class="flex items-center gap-1 shrink-0">
        <Button
          size="icon-xs"
          variant="ghost"
          :class="isFavorite(selectedSong.key) ? 'text-rose-500' : 'text-muted-foreground'"
          :aria-label="isFavorite(selectedSong.key) ? '取消收藏' : '收藏'"
          @click="toggleFavorite(selectedSong.key)"
        >
          <Heart
            class="size-3.5"
            :class="{ 'fill-current': isFavorite(selectedSong.key) }"
          />
        </Button>
        <Button
          v-if="playableSelectedUrl"
          size="icon-xs"
          variant="ghost"
          aria-label="播放试听"
          @click="playSong(selectedSong)"
        >
          <Play class="size-3.5" />
        </Button>
        <SongRequestButton
          :song="selectedSong"
          :live-request-settings="liveRequestSettings"
          :auth-state="requestAuthState"
          :loading="requestingKey === selectedSong.key"
          :hidden="isSelf"
          size="tiny"
          :circle="false"
          @request="requestSong"
        />
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
