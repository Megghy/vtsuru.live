<script setup lang="ts">
import { ExternalLink, Pin, Play, RotateCcw, Search, Shuffle, SlidersHorizontal } from 'lucide-vue-next'
import { computed, ref } from 'vue'

import type { ResponseSongModel } from '@/api/generated/model'
import { FunctionTypes } from '@/api/generated/model'
import LiveRequestOBS from '@/apps/obs/pages/request/LiveRequestOBS.vue'
import SongPlayer from '@/components/SongPlayer.vue'
import type { SongListConfigType } from '@/shared/types/TemplateTypes'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { toast } from '@/shared/utils'
import { getPlayableAudioUrl, getSongExternalLink } from '@/shared/utils/songMedia'

import SongOptionBadges from './components/SongOptionBadges.vue'
import SongRandomDialog from './components/SongRandomDialog.vue'
import SongRequestButton from './components/SongRequestButton.vue'
import SongStatusBadge from './components/SongStatusBadge.vue'
import { useProgressiveList } from './utils/useProgressiveList'
import {
  PUBLIC_OPTION_FILTER_ITEMS,
  PUBLIC_SORT_ITEMS,
  type SongListPublicOptionFilter,
  type SongListPublicSortKey,
  useSongListQueryState,
} from './utils/useSongListQueryState'
import { useFilterListKey, useSongListTemplateCore } from './utils/useSongListTemplateCore'

const props = defineProps<SongListConfigType>()
const emits = defineEmits(['requestSong'])

const {
  requestAuthState,
  isSelf,
  requestingKey,
  singingSongKeys: singingKeys,
  queuedSongKeys: queuedKeys,
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
  artistOptions,
  languageOptions,
  tagOptions,
  filteredSongs,
  hasFilters,
  clearFilters,
  pickRandomSong,
} = useSongListQueryState(() => props.data)

const selectedSong = ref<ResponseSongModel>()
const isLrcLoading = ref<string>()
const mobileFiltersOpen = ref(false)
const randomDialogOpen = ref(false)
const randomSong = ref<ResponseSongModel | null>(null)

const tags = computed(() => tagOptions.value.map((o) => o.value).filter((v) => v !== '__unset'))
const showRequestQueue = computed(
  () => props.userInfo?.extra?.enableFunctions.includes(FunctionTypes.SongRequest) ?? false,
)

const { listKey } = useFilterListKey({
  tag: selectedTag,
  author: selectedArtist,
  language: selectedLanguage,
})
const { visibleItems, hasMore, loadMoreTrigger, loadMore } = useProgressiveList(filteredSongs, 24)

function toggleTag(tag: string) {
  selectedTag.value = selectedTag.value === tag ? null : tag
}

function toggleAuthor(author: string) {
  selectedArtist.value = selectedArtist.value === author ? null : author
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
</script>

<template>
  <div class="w-full max-w-[var(--vtsuru-page-max-width,1200px)] mx-auto p-[clamp(12px,2vw,24px)] space-y-5">
    <div class="simple-layout grid grid-cols-1 md:grid-cols-[280px_1fr] gap-5 items-start">
      <!-- 侧边筛选栏（桌面 sticky，移动端紧凑可折叠） -->
      <aside class="filter-panel md:sticky md:top-4 md:self-start">
        <div
          data-site-surface="card"
          class="rounded-[var(--vtsuru-page-radius,var(--radius))] border border-border/80 bg-card/85 p-3.5 space-y-3 md:max-h-[85vh] md:overflow-y-auto scrollbar-thin"
        >
          <header class="filter-heading flex-between pb-2 border-b border-border/60">
            <div class="flex flex-col">
              <strong class="text-sm font-semibold">曲库筛选</strong>
              <span class="text-xs text-muted-foreground font-mono tabular-nums">
                {{ filteredSongs.length }} / {{ data?.length ?? 0 }} 首
              </span>
            </div>
            <div class="flex items-center gap-1">
              <Button
                v-if="hasFilters"
                variant="ghost"
                size="xs"
                class="gap-1 text-muted-foreground"
                @click="clearFilters"
              >
                <RotateCcw class="size-3" />
                清除
              </Button>
              <Button
                variant="secondary"
                size="xs"
                class="gap-1"
                :disabled="!data?.length"
                @click="handleRandomPick"
              >
                <Shuffle class="size-3" />
                随机
              </Button>
              <Button
                variant="outline"
                size="icon-xs"
                class="md:hidden"
                :aria-label="mobileFiltersOpen ? '收起筛选' : '展开筛选'"
                @click="mobileFiltersOpen = !mobileFiltersOpen"
              >
                <SlidersHorizontal class="size-3.5" />
              </Button>
            </div>
          </header>

          <div class="relative w-full">
            <Search class="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              v-model="searchKeyword"
              class="pl-8 w-full"
              placeholder="搜索歌名、歌手或标签"
            />
          </div>

          <div
            class="space-y-3"
            :class="mobileFiltersOpen ? 'block' : 'hidden md:block'"
          >
            <div class="space-y-2">
              <Select
                :model-value="selectedArtist || 'all'"
                @update:model-value="selectedArtist = $event === 'all' ? null : String($event)"
              >
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="筛选歌手" />
                </SelectTrigger>
                <SelectContent class="max-h-56">
                  <SelectItem value="all">全部歌手</SelectItem>
                  <SelectItem
                    v-for="opt in artistOptions"
                    :key="opt.value"
                    :value="opt.value"
                  >
                    {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select
                :model-value="selectedLanguage || 'all'"
                @update:model-value="selectedLanguage = $event === 'all' ? null : String($event)"
              >
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="筛选语言" />
                </SelectTrigger>
                <SelectContent class="max-h-56">
                  <SelectItem value="all">全部语言</SelectItem>
                  <SelectItem
                    v-for="opt in languageOptions"
                    :key="opt.value"
                    :value="opt.value"
                  >
                    {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select
                :model-value="selectedOption"
                @update:model-value="selectedOption = $event as SongListPublicOptionFilter"
              >
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="点歌条件" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="opt in PUBLIC_OPTION_FILTER_ITEMS"
                    :key="opt.value"
                    :value="opt.value"
                  >
                    {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>

              <div class="flex items-center gap-1">
                <Select
                  :model-value="sortKey"
                  @update:model-value="sortKey = $event as SongListPublicSortKey"
                >
                  <SelectTrigger class="flex-1 min-w-0">
                    <SelectValue placeholder="排序方式" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="opt in PUBLIC_SORT_ITEMS"
                      :key="opt.value"
                      :value="opt.value"
                    >
                      {{ opt.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  v-if="sortKey !== 'default'"
                  size="xs"
                  variant="ghost"
                  @click="sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'"
                >
                  {{ sortOrder === 'asc' ? '升序' : '降序' }}
                </Button>
              </div>
            </div>

            <div
              v-if="tags.length"
              class="tag-list flex flex-wrap gap-1.5"
            >
              <Button
                v-for="tag in tags"
                :key="tag"
                :variant="selectedTag === tag ? 'default' : 'secondary'"
                size="xs"
                class="rounded-full font-normal"
                :aria-pressed="selectedTag === tag"
                @click="toggleTag(tag)"
              >
                {{ tag }}
              </Button>
            </div>
          </div>

          <SongPlayer
            v-if="selectedSong"
            v-model:is-lrc-loading="isLrcLoading"
            :song="selectedSong"
            @close="selectedSong = undefined"
          />

          <section
            v-if="showRequestQueue"
            class="hidden md:block p-3 rounded-lg border border-border/80 bg-muted/20 space-y-2"
          >
            <small class="text-[11px] text-muted-foreground block">点歌队列</small>
            <div class="queue-frame"><LiveRequestOBS :id="props.userInfo?.id" /></div>
          </section>
        </div>
      </aside>

      <!-- 主曲库区 -->
      <main class="song-content min-w-0">
        <Empty
          v-if="filteredSongs.length === 0"
          :key="`empty-${listKey}`"
          class="empty-state py-12"
          :description="data?.length ? '没有符合条件的歌曲' : '暂无曲目'"
        />

        <div
          v-else
          :key="listKey"
          class="song-list space-y-4"
        >
          <div class="song-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <article
              v-for="item in visibleItems"
              :key="item.key"
              class="song-card p-3 rounded-[var(--vtsuru-page-radius,var(--radius))] border border-border/80 bg-card flex flex-col justify-between gap-2.5 transition hover:border-primary/50"
              :class="{
                'is-singing': singingKeys.has(item.key),
                'is-queued': queuedKeys.has(item.key),
                'is-pinned': item.isPinned,
                'is-disabled': item.isDisabled,
              }"
            >
              <header class="song-header flex items-start justify-between gap-2">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1 min-w-0">
                    <Pin
                      v-if="item.isPinned"
                      class="size-3 text-primary shrink-0"
                    />
                    <strong
                      class="text-xs font-medium text-foreground block truncate"
                      :title="item.name"
                    >
                      {{ item.name }}
                    </strong>
                  </div>
                  <small
                    v-if="item.translateName"
                    class="text-[11px] text-muted-foreground block truncate"
                    :title="item.translateName"
                  >
                    {{ item.translateName }}
                  </small>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                  <Badge
                    v-if="item.isDisabled"
                    variant="secondary"
                    size="xs"
                  >
                    暂不接歌
                  </Badge>
                  <SongStatusBadge
                    :song-key="item.key"
                    :singing-keys="singingKeys"
                    :queued-keys="queuedKeys"
                    variant="tag"
                  />
                </div>
              </header>

              <div
                v-if="item.author?.length"
                class="author-list flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground"
              >
                <button
                  v-for="author in item.author"
                  :key="author"
                  type="button"
                  class="hover:text-primary transition cursor-pointer"
                  :class="{ 'text-primary font-medium': selectedArtist === author }"
                  :aria-pressed="selectedArtist === author"
                  @click="toggleAuthor(author)"
                >
                  {{ author }}
                </button>
              </div>

              <p
                v-if="item.description"
                class="text-xs text-muted-foreground line-clamp-2 m-0"
                :title="item.description"
              >
                {{ item.description }}
              </p>

              <SongOptionBadges
                :options="item.options"
                variant="semantic"
              />

              <footer class="flex-between gap-2 pt-2 border-t border-border/50 text-xs">
                <div class="card-tags flex items-center gap-1 flex-wrap min-w-0">
                  <button
                    v-for="tag in (item.tags ?? []).slice(0, 3)"
                    :key="tag"
                    type="button"
                    class="px-1.5 py-0.5 rounded text-[10px] transition cursor-pointer"
                    :class="
                      selectedTag === tag
                        ? 'bg-primary text-primary-foreground font-medium'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    "
                    :aria-pressed="selectedTag === tag"
                    @click="toggleTag(tag)"
                  >
                    {{ tag }}
                  </button>
                  <small
                    v-if="(item.tags?.length ?? 0) > 3"
                    class="text-muted-foreground text-[10px]"
                  >
                    +{{ (item.tags?.length ?? 0) - 3 }}
                  </small>
                </div>

                <div class="actions flex items-center gap-1 shrink-0">
                  <Button
                    v-if="getPlayableAudioUrl(item)"
                    variant="ghost"
                    size="icon-xs"
                    class="rounded-full text-muted-foreground"
                    :aria-label="`试听《${item.name}》`"
                    :disabled="isLrcLoading === item.key"
                    @click="selectedSong = item"
                  >
                    <Play class="size-3.5" />
                  </Button>
                  <a
                    v-if="getSongExternalLink(item)"
                    :href="getSongExternalLink(item)!.url"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      class="rounded-full text-muted-foreground"
                      :aria-label="getSongExternalLink(item)!.label"
                    >
                      <ExternalLink class="size-3.5" />
                    </Button>
                  </a>
                  <SongRequestButton
                    :song="item"
                    :live-request-settings="liveRequestSettings"
                    :auth-state="requestAuthState"
                    :loading="requestingKey === item.key"
                    :hidden="isSelf"
                    size="tiny"
                    @request="requestSong"
                  />
                </div>
              </footer>
            </article>
          </div>

          <div
            v-if="hasMore"
            ref="loadMoreTrigger"
            class="load-more flex justify-center py-4"
          >
            <Button
              variant="outline"
              @click="loadMore"
            >
              加载更多
            </Button>
          </div>
        </div>
      </main>
    </div>

    <!-- 移动端把当前点歌队列放在主要曲库之后 -->
    <section
      v-if="showRequestQueue"
      class="md:hidden p-3 rounded-[var(--vtsuru-page-radius,var(--radius))] border border-border/80 bg-card/85 space-y-2"
    >
      <small class="text-[11px] text-muted-foreground block">点歌队列</small>
      <div class="queue-frame"><LiveRequestOBS :id="props.userInfo?.id" /></div>
    </section>

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
