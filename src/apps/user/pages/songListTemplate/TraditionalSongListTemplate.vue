<script setup lang="ts">
import { ArrowDownWideNarrow, ArrowUpNarrowWide, ExternalLink, Heart, Pin, Play } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

import type { ResponseSongModel } from '@/api/generated/model'
import SongPlayer from '@/components/SongPlayer.vue'
import { transformImageUrl } from '@/shared/services/imageTransform'
import type { SongListConfigTypeWithConfig } from '@/shared/types/TemplateTypes'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Empty } from '@/shared/ui/empty'
import { SmartImage } from '@/shared/ui/image'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'
import { getUserAvatarUrl, toast } from '@/shared/utils'
import { getPlayableAudioUrl, getSongExternalLink, isSafeHttpUrl } from '@/shared/utils/songMedia'
import bilibili from '@/svgs/bilibili.svg'
import douyin from '@/svgs/douyin.svg'
import neteaseMusic from '@/svgs/neteaseMusic.svg'
import qqMusic from '@/svgs/qqMusic.svg'

import SongListFilterToolbar from './components/SongListFilterToolbar.vue'
import SongOptionBadges from './components/SongOptionBadges.vue'
import SongRandomDialog from './components/SongRandomDialog.vue'
import SongRequestButton from './components/SongRequestButton.vue'
import SongStatusBadge from './components/SongStatusBadge.vue'
import SongTagChips from './components/SongTagChips.vue'
import { Config, DefaultConfig, type TraditionalConfigType } from './traditionalSongListConfig'
import { canRequestSong, getSongRequestTooltip } from './utils/songRequestUtils'
import { useProgressiveList } from './utils/useProgressiveList'
import { isNewSong, type SongListPublicSortKey, useSongListQueryState } from './utils/useSongListQueryState'
import { useSongListTemplateCore } from './utils/useSongListTemplateCore'
import { useSongPreviewPlayer } from './utils/useSongPreviewPlayer'

interface ProfileLink {
  label: string
  url: string
  icon: typeof bilibili
}

const props = defineProps<SongListConfigTypeWithConfig<TraditionalConfigType>>()
const emit = defineEmits<{ requestSong: [song: ResponseSongModel] }>()
defineExpose({ Config, DefaultConfig })

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
  setSort,
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

const { visibleItems, hasMore, loadMoreTrigger, loadMore } = useProgressiveList(filteredSongs, 48)
const { previewSong, isLrcLoading, playSong, closePlayer, isShared: isSharedPlayer } = useSongPreviewPlayer()

const randomDialogOpen = ref(false)
const randomSong = ref<ResponseSongModel | null>(null)

const bgStyle = computed(() => {
  const path = props.config?.backgroundFile?.[0]?.path
  if (!path) return undefined
  const url = transformImageUrl(path, '1920w_90q')
  return url ? { '--song-list-bg-image': `url("${url}")` } : undefined
})

const profileLinks = computed<ProfileLink[]>(() => {
  const links: ProfileLink[] = []
  if (props.userInfo?.biliId) {
    links.push({ label: '哔哩哔哩', url: `https://space.bilibili.com/${props.userInfo.biliId}`, icon: bilibili })
  }
  addProfileLink(links, '抖音', props.config?.douyinLink, douyin)
  addProfileLink(links, '网易云音乐', props.config?.neteaseLink, neteaseMusic)
  addProfileLink(links, 'QQ 音乐', props.config?.qqMusicLink, qqMusic)
  return links
})

const customLinks = computed(() =>
  (props.config?.links ?? [])
    .map((link) => ({ ...link, url: isSafeHttpUrl(link.url) }))
    .filter((link): link is { name: string; url: string } => !!link.url),
)

const tableHeaders: { key: SongListPublicSortKey; label: string; widthClass?: string }[] = [
  { key: 'name', label: '歌名', widthClass: 'min-w-[200px]' },
  { key: 'author', label: '歌手', widthClass: 'min-w-[110px]' },
  { key: 'language', label: '语言', widthClass: 'w-20' },
  { key: 'tags', label: '标签', widthClass: 'min-w-[90px]' },
  { key: 'options', label: '点歌条件', widthClass: 'w-24' },
  { key: 'description', label: '备注', widthClass: 'max-w-[180px]' },
]

watch(artistOptions, (options) => {
  if (selectedArtist.value && !options.some((option) => option.value === selectedArtist.value)) {
    selectedArtist.value = null
  }
})

function addProfileLink(links: ProfileLink[], label: string, value: string | undefined, icon: typeof bilibili) {
  const url = isSafeHttpUrl(value)
  if (url) links.push({ label, url, icon })
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

function requestSong(song: ResponseSongModel) {
  if (!beginRequest(song)) return
  emit('requestSong', song)
}
</script>

<template>
  <section
    class="traditional-song-list w-full"
    :class="{ 'has-background': config?.backgroundFile?.length }"
    :style="bgStyle"
  >
    <div class="content-frame max-w-[var(--vtsuru-page-max-width,1180px)] mx-auto px-[clamp(12px,2vw,24px)] py-6 space-y-5">
      <header
        data-site-surface="card"
        class="profile-panel flex flex-wrap items-center gap-5 p-5 sm:p-6 rounded-[var(--vtsuru-page-radius,var(--radius))] bg-card/85 backdrop-blur-md border border-border/80 shadow-xs"
      >
        <SmartImage
          class="profile-avatar size-16 sm:size-20 rounded-full object-cover border-2 border-primary/20 shrink-0"
          :src="userInfo?.faceUrl || userInfo?.streamerInfo?.faceUrl || getUserAvatarUrl(userInfo?.id)"
          :alt="userInfo?.name ?? '主播头像'"
          fallback-transform="avatar"
          referrerpolicy="no-referrer"
        />
        <div class="profile-copy flex-1 min-w-0">
          <p class="eyebrow text-[11px] font-semibold tracking-wider text-primary uppercase">SONG LIBRARY</p>
          <h1 class="text-xl sm:text-2xl font-bold text-foreground mt-0.5 truncate">
            {{ config?.title ?? `${userInfo?.name ?? ''}的歌单` }}
          </h1>
          <p class="profile-summary text-xs text-muted-foreground mt-1">
            {{ config?.description || '选择喜欢的歌曲，点击歌名或点歌按钮即可点歌' }}
          </p>
        </div>
        <div
          v-if="profileLinks.length || customLinks.length"
          class="profile-links flex items-center gap-2 flex-wrap"
        >
          <a
            v-for="link in profileLinks"
            :key="link.label"
            :href="link.url"
            :title="link.label"
            target="_blank"
            rel="noopener noreferrer"
            class="profile-icon-link p-2 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition size-9 flex-center"
          >
            <component
              :is="link.icon"
              class="size-4"
            />
          </a>
          <a
            v-for="link in customLinks"
            :key="`${link.name}-${link.url}`"
            :href="link.url"
            target="_blank"
            rel="noopener noreferrer"
            class="custom-link px-3 py-1.5 rounded-full bg-muted/60 hover:bg-muted text-xs font-medium text-foreground transition"
          >
            {{ link.name }}
          </a>
        </div>
      </header>

      <div
        v-if="config?.detailTitle || config?.longDescription"
        class="px-1 space-y-1"
      >
        <h2
          v-if="config?.detailTitle"
          class="text-sm font-semibold text-foreground"
        >
          {{ config.detailTitle }}
        </h2>
        <p
          v-if="config?.longDescription"
          class="long-description text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap m-0"
        >
          {{ config.longDescription }}
        </p>
      </div>

      <main
        data-site-surface="card"
        class="song-panel p-4 sm:p-5 rounded-[var(--vtsuru-page-radius,var(--radius))] bg-card/85 backdrop-blur-md border border-border/80 shadow-xs space-y-4"
      >
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
          v-if="!filteredSongs.length"
          :description="data?.length ? '没有符合条件的歌曲' : '歌单里还没有歌曲'"
          class="py-12"
        />

        <template v-else>
          <!-- 桌面端表格 -->
          <div
            class="song-table-shell hidden md:block overflow-x-auto"
            :class="{ 'is-fixed': config?.fixedHeight }"
          >
            <div
              class="song-table-scroller scrollbar-thin"
              :style="config?.fixedHeight ? 'max-height: 560px; overflow-y: auto;' : undefined"
            >
              <table class="song-table w-full text-left border-collapse text-xs">
                <thead class="sticky top-0 z-10 bg-card/95 backdrop-blur">
                  <tr class="border-b border-border/80 text-muted-foreground font-medium">
                    <th
                      v-for="column in tableHeaders"
                      :key="column.key"
                      class="py-2.5 px-3 whitespace-nowrap"
                      :class="column.widthClass"
                    >
                      <button
                        type="button"
                        class="sort-heading flex items-center gap-1 hover:text-foreground cursor-pointer font-medium"
                        @click="setSort(column.key)"
                      >
                        {{ column.label }}
                        <component
                          :is="sortOrder === 'asc' ? ArrowUpNarrowWide : ArrowDownWideNarrow"
                          v-if="sortKey === column.key"
                          class="size-3"
                        />
                      </button>
                    </th>
                    <th class="py-2.5 px-3 text-right whitespace-nowrap w-28">操作</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border/40">
                  <tr
                    v-for="song in visibleItems"
                    :key="song.key || `${song.name}-${song.author?.join('/')}`"
                    class="hover:bg-muted/40 transition"
                    :class="{
                      'is-singing': singingSongKeySet.has(song.key),
                      'is-queued': queuedSongKeySet.has(song.key),
                      'is-pinned': song.isPinned,
                      'is-disabled': song.isDisabled,
                    }"
                  >
                    <td class="title-cell py-2 px-3">
                      <div class="title-content flex items-center gap-1.5 min-w-0">
                        <Pin
                          v-if="song.isPinned"
                          class="size-3 text-primary shrink-0"
                          aria-label="置顶"
                        />
                        <SongStatusBadge
                          :song-key="song.key"
                          :singing-keys="singingSongKeySet"
                          :queued-keys="queuedSongKeySet"
                          variant="text"
                        />
                        <Badge
                          v-if="song.isDisabled"
                          variant="secondary"
                          size="xs"
                        >
                          暂不接歌
                        </Badge>
                        <div class="min-w-0">
                          <div class="flex items-center gap-1.5 flex-wrap">
                            <Tooltip :disabled="isSelf || Boolean(song.isDisabled)">
                              <TooltipTrigger as-child>
                                <button
                                  class="song-title-button font-medium text-foreground hover:text-primary transition cursor-pointer text-left disabled:cursor-default disabled:hover:text-foreground break-words"
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
                            <Badge
                              v-if="isNewSong(song)"
                              variant="brand"
                              size="xs"
                            >
                              NEW
                            </Badge>
                          </div>
                          <div
                            v-if="song.translateName"
                            class="text-[11px] text-muted-foreground truncate max-w-[240px]"
                          >
                            {{ song.translateName }}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td class="py-2 px-3">
                      <span
                        v-if="song.author?.length"
                        class="inline-list flex items-center gap-1 flex-wrap"
                      >
                        <Button
                          v-for="artist in song.author"
                          :key="artist"
                          type="button"
                          variant="ghost"
                          size="none"
                          class="h-auto px-1 py-0.5 text-xs font-normal"
                          :class="selectedArtist === artist ? 'text-primary font-medium' : 'text-foreground/90'"
                          @click="selectedArtist = selectedArtist === artist ? null : artist"
                        >
                          {{ artist }}
                        </Button>
                      </span>
                      <span
                        v-else
                        class="text-muted-foreground/60"
                      >
                        未知
                      </span>
                    </td>

                    <td class="py-2 px-3">
                      <SongTagChips
                        :languages="song.language"
                        :selected-language="selectedLanguage"
                        :max-tags="0"
                        :max-languages="4"
                        @toggle-language="selectedLanguage = selectedLanguage === $event ? null : $event"
                      />
                    </td>

                    <td class="py-2 px-3">
                      <SongTagChips
                        :tags="song.tags"
                        :selected-tag="selectedTag"
                        :max-tags="6"
                        :max-languages="0"
                        @toggle-tag="selectedTag = selectedTag === $event ? null : $event"
                      />
                    </td>

                    <td class="py-2 px-3">
                      <SongOptionBadges
                        :options="song.options"
                        variant="semantic"
                        empty-text="无限制"
                      />
                    </td>

                    <td class="py-2 px-3">
                      <span
                        class="block truncate max-w-[200px]"
                        :class="{ 'text-muted-foreground/60': !song.description }"
                        :title="song.description || undefined"
                      >
                        {{ song.description || '-' }}
                      </span>
                    </td>

                    <td class="py-2 px-3 text-right">
                      <div class="flex items-center justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              :class="isFavorite(song.key) ? 'text-rose-500' : 'text-muted-foreground'"
                              :aria-label="isFavorite(song.key) ? `取消收藏《${song.name}》` : `收藏《${song.name}》`"
                              @click="toggleFavorite(song.key)"
                            >
                              <Heart
                                class="size-3.5"
                                :class="{ 'fill-current': isFavorite(song.key) }"
                              />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{{ isFavorite(song.key) ? '取消收藏' : '收藏歌曲' }}</TooltipContent>
                        </Tooltip>

                        <Tooltip v-if="getPlayableAudioUrl(song)">
                          <TooltipTrigger as-child>
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              :disabled="isLrcLoading === song.key"
                              :aria-label="`试听《${song.name}》`"
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
                                size="icon-xs"
                                variant="ghost"
                                :aria-label="getSongExternalLink(song)!.label"
                              >
                                <ExternalLink class="size-3.5" />
                              </Button>
                            </a>
                          </TooltipTrigger>
                          <TooltipContent>{{ getSongExternalLink(song)!.label }}</TooltipContent>
                        </Tooltip>

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
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- 移动端紧凑列表（确保 360px 零横向溢出） -->
          <div class="md:hidden space-y-2">
            <article
              v-for="song in visibleItems"
              :key="`m-${song.key || song.name}`"
              class="p-3 rounded-lg border border-border/70 bg-background/40 space-y-1.5 min-w-0"
              :class="{
                'is-singing': singingSongKeySet.has(song.key),
                'is-queued': queuedSongKeySet.has(song.key),
                'is-pinned': song.isPinned,
                'is-disabled': song.isDisabled,
              }"
            >
              <div class="flex items-start justify-between gap-2 min-w-0">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <Pin
                      v-if="song.isPinned"
                      class="size-3 text-primary shrink-0"
                    />
                    <button
                      type="button"
                      class="font-medium text-xs text-foreground hover:text-primary transition text-left break-words disabled:cursor-default disabled:hover:text-foreground"
                      :disabled="isSelf || Boolean(song.isDisabled)"
                      @click="requestSong(song)"
                    >
                      {{ song.name }}
                    </button>
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
                    <Badge
                      v-if="song.isDisabled"
                      variant="secondary"
                      size="xs"
                    >
                      暂不接歌
                    </Badge>
                  </div>
                  <div
                    v-if="song.translateName"
                    class="text-[11px] text-muted-foreground truncate mt-0.5"
                  >
                    {{ song.translateName }}
                  </div>
                  <div class="text-[11px] text-muted-foreground truncate mt-0.5">
                    {{ song.author?.length ? song.author.join(' / ') : '未知歌手' }}
                    <template v-if="song.language?.length"> · {{ song.language.join(' / ') }}</template>
                  </div>
                </div>

                <div class="flex items-center gap-1 shrink-0">
                  <Button
                    size="icon-xs"
                    variant="ghost"
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
                    :disabled="isLrcLoading === song.key"
                    :aria-label="`试听《${song.name}》`"
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
                    @request="requestSong"
                  />
                </div>
              </div>

              <div
                v-if="song.tags?.length || song.options"
                class="flex flex-wrap items-center gap-1 pt-0.5"
              >
                <SongTagChips
                  :tags="song.tags"
                  :selected-tag="selectedTag"
                  :max-tags="5"
                  :max-languages="0"
                  @toggle-tag="selectedTag = selectedTag === $event ? null : $event"
                />
                <SongOptionBadges
                  :options="song.options"
                  variant="semantic"
                  size="tiny"
                />
              </div>

              <p
                v-if="song.description"
                class="text-[11px] text-muted-foreground m-0 line-clamp-2"
              >
                {{ song.description }}
              </p>
            </article>
          </div>

          <div
            v-if="hasMore"
            ref="loadMoreTrigger"
            class="flex justify-center pt-2"
          >
            <Button
              type="button"
              variant="outline"
              @click="loadMore"
            >
              加载更多 ({{ visibleItems.length }} / {{ filteredSongs.length }})
            </Button>
          </div>
        </template>
      </main>
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
  </section>
</template>
