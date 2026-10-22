<script setup lang="ts">
import { Play24Filled, Search24Regular } from '@vicons/fluent'
import { computed, ref } from 'vue'

import type { SongsInfo } from '@/api/api-models'
import { FunctionTypes } from '@/api/api-models'
import LiveRequestOBS from '@/apps/obs/pages/request/LiveRequestOBS.vue'
import SongPlayer from '@/components/SongPlayer.vue'
import type { SongListConfigType } from '@/shared/types/TemplateTypes'
import { Button } from '@/shared/ui/button'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'

import SongOptionBadges from './components/SongOptionBadges.vue'
import SongRequestButton from './components/SongRequestButton.vue'
import SongStatusBadge from './components/SongStatusBadge.vue'
import { filterSongs, getSongFieldOptions, getSongFieldValues } from './utils/songListData'
import { useProgressiveList } from './utils/useProgressiveList'
import { useFilterListKey, useSongListTemplateCore } from './utils/useSongListTemplateCore'

const props = defineProps<SongListConfigType>()
const emits = defineEmits(['requestSong'])

const searchKeyword = ref('')
const selectedTag = ref<string | null>(null)
const selectedAuthor = ref<string | null>(null)
const selectedSong = ref<SongsInfo>()
const isLrcLoading = ref('')

const {
  requestAuthState,
  requestingKey,
  singingSongKeys: singingKeys,
  queuedSongKeys: queuedKeys,
  beginRequest,
} = useSongListTemplateCore({
  userInfo: () => props.userInfo,
  liveRequestActive: () => props.liveRequestActive,
})

const tags = computed(() => getSongFieldValues(props.data, 'tags'))
const authorOptions = computed(() => getSongFieldOptions(props.data, 'author'))
const filteredSongs = computed(() =>
  filterSongs(props.data, {
    keyword: searchKeyword.value,
    tag: selectedTag.value,
    author: selectedAuthor.value,
  }),
)
const hasFilters = computed(() => !!searchKeyword.value.trim() || !!selectedTag.value || !!selectedAuthor.value)
const showRequestQueue = computed(
  () => props.userInfo?.extra?.enableFunctions.includes(FunctionTypes.LiveRequest) ?? false,
)

const { listKey } = useFilterListKey({ tag: selectedTag, author: selectedAuthor })
const { visibleItems, hasMore, loadMoreTrigger, loadMore } = useProgressiveList(filteredSongs, 24)

function toggleTag(tag: string) {
  selectedTag.value = selectedTag.value === tag ? null : tag
}

function toggleAuthor(author: string) {
  selectedAuthor.value = selectedAuthor.value === author ? null : author
}

function clearFilters() {
  searchKeyword.value = ''
  selectedTag.value = null
  selectedAuthor.value = null
}

function requestSong(song: SongsInfo) {
  if (!beginRequest(song)) return
  emits('requestSong', song)
}
</script>

<template>
  <div class="simple-template">
    <div class="simple-layout grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6">
      <aside class="filter-panel">
        <div class="filter-panel-scroll max-h-[85vh] overflow-y-auto pr-2">
          <div class="filter-panel-body space-y-4">
            <header class="filter-heading flex items-center justify-between pb-2 border-b border-border/60">
              <div class="flex flex-col">
                <strong class="text-sm font-semibold">曲库筛选</strong>
                <span class="text-xs text-muted-foreground font-mono">{{ filteredSongs.length }} / {{ data?.length ?? 0 }} 首</span>
              </div>
              <Button v-if="hasFilters" variant="ghost" class="text-muted-foreground hover:text-foreground" @click="clearFilters">
                清除
              </Button>
            </header>

            <div class="filter-fields space-y-2">
              <div class="relative w-full">
                <component :is="Search24Regular" class="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input v-model="searchKeyword" class="pl-8 w-full" placeholder="搜索歌名、歌手或标签" />
              </div>
              <Select
                :model-value="selectedAuthor || 'all'"
                @update:model-value="selectedAuthor = $event === 'all' ? null : String($event)"
              >
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="筛选歌手" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" class="text-xs">全部歌手</SelectItem>
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
            </div>

            <div
              v-if="tags.length"
              class="tag-list flex flex-wrap gap-1.5"
            >
              <Button v-for="tag in tags" :key="tag" :variant="selectedTag === tag ? 'default' : 'secondary'" size="xs" class="rounded-full font-normal" :aria-pressed="selectedTag === tag" @click="toggleTag(tag)">
                {{ tag }}
              </Button>
            </div>

            <section
              v-if="selectedSong"
              class="sidebar-section p-3 rounded-lg border border-border/80 bg-muted/20 space-y-2"
            >
              <small class="text-[11px] text-muted-foreground block">正在试听</small>
              <strong class="text-xs font-semibold block truncate">{{ selectedSong.name }}</strong>
              <SongPlayer
                v-model:is-lrc-loading="isLrcLoading"
                :song="selectedSong"
              />
            </section>

            <section
              v-if="showRequestQueue"
              class="sidebar-section p-3 rounded-lg border border-border/80 bg-muted/20 space-y-2"
            >
              <small class="text-[11px] text-muted-foreground block">点歌队列</small>
              <div class="queue-frame"><LiveRequestOBS /></div>
            </section>
          </div>
        </div>
      </aside>

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
              class="song-card p-3 rounded-lg border border-border/80 bg-card flex flex-col justify-between gap-2.5 transition hover:border-primary/50"
              :class="{ 'is-singing': singingKeys.has(item.key), 'is-queued': queuedKeys.has(item.key) }"
            >
              <header class="song-header flex items-start justify-between gap-2">
                <div class="min-w-0 flex-1">
                  <strong class="text-xs font-medium text-foreground block truncate" :title="item.name">{{ item.name }}</strong>
                  <small
                    v-if="item.translateName"
                    class="text-[11px] text-muted-foreground block truncate"
                    :title="item.translateName"
                  >
                    {{ item.translateName }}
                  </small>
                </div>
                <SongStatusBadge
                  :song-key="item.key"
                  :singing-keys="singingKeys"
                  :queued-keys="queuedKeys"
                  variant="tag"
                />
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
                  :class="{ 'text-primary font-medium': selectedAuthor === author }"
                  :aria-pressed="selectedAuthor === author"
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

              <footer class="flex items-center justify-between gap-2 pt-2 border-t border-border/50 text-xs">
                <div class="card-tags flex items-center gap-1 flex-wrap">
                  <button
                    v-for="tag in (item.tags ?? []).slice(0, 3)"
                    :key="tag"
                    type="button"
                    class="px-1.5 py-0.5 rounded text-[10px] transition cursor-pointer"
                    :class="selectedTag === tag ? 'bg-primary text-primary-foreground font-medium' : 'bg-muted text-muted-foreground hover:bg-muted/80'"
                    :aria-pressed="selectedTag === tag"
                    @click="toggleTag(tag)"
                  >
                    {{ tag }}
                  </button>
                  <small v-if="(item.tags?.length ?? 0) > 3" class="text-muted-foreground text-[10px]">+{{ (item.tags?.length ?? 0) - 3 }}</small>
                </div>

                <div class="actions flex items-center gap-1 shrink-0">
                  <Button v-if="item.url" variant="ghost" size="icon" class="size-7 rounded-full text-muted-foreground hover:text-foreground" title="试听" :aria-label="`试听《${item.name}》`" :disabled="isLrcLoading === item.key" @click="selectedSong = item">
                    <component :is="Play24Filled" class="size-3.5" />
                  </Button>
                  <SongRequestButton
                    :song="item"
                    :live-request-settings="liveRequestSettings"
                    :auth-state="requestAuthState"
                    :loading="requestingKey === item.key"
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
            <Button variant="outline" @click="loadMore">
              加载更多
            </Button>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.simple-template {
  width: 100%;
  max-width: var(--vtsuru-page-max-width, 1200px);
  margin: 0 auto;
  padding: clamp(12px, 2vw, 24px);
}
</style>
