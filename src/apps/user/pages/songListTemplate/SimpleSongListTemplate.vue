<script setup lang="ts">
import { Play24Filled, Search24Regular } from '@vicons/fluent'
import { NButton, NEmpty, NIcon, NInput, NScrollbar, NSelect } from 'naive-ui'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import type { SongsInfo } from '@/api/api-models'
import { FunctionTypes } from '@/api/api-models'
import LiveRequestOBS from '@/apps/obs/pages/request/LiveRequestOBS.vue'
import SongPlayer from '@/components/SongPlayer.vue'
import type { SongListConfigType } from '@/shared/types/TemplateTypes'

import SongOptionBadges from './components/SongOptionBadges.vue'
import SongRequestButton from './components/SongRequestButton.vue'
import SongStatusBadge from './components/SongStatusBadge.vue'
import { filterSongs, getSongFieldOptions, getSongFieldValues } from './utils/songListData'
import { useFilterListKey, useSongListTemplateCore } from './utils/useSongListTemplateCore'

const props = defineProps<SongListConfigType>()
const emits = defineEmits(['requestSong'])
const PAGE_SIZE = 20

const searchKeyword = ref('')
const selectedTag = ref<string | null>(null)
const selectedAuthor = ref<string | null>(null)
const selectedSong = ref<SongsInfo>()
const visibleCount = ref(PAGE_SIZE)
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
const visibleSongs = computed(() => filteredSongs.value.slice(0, visibleCount.value))
const hasFilters = computed(() => !!searchKeyword.value.trim() || !!selectedTag.value || !!selectedAuthor.value)
const showRequestQueue = computed(
  () => props.userInfo?.extra?.enableFunctions.includes(FunctionTypes.LiveRequest) ?? false,
)

const { listKey } = useFilterListKey({ tag: selectedTag, author: selectedAuthor })
const loadMoreSentinel = ref<HTMLElement>()
let loadMoreObserver: IntersectionObserver | undefined

watch([selectedTag, selectedAuthor, searchKeyword], () => {
  visibleCount.value = PAGE_SIZE
})

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

function loadMore() {
  visibleCount.value = Math.min(visibleCount.value + PAGE_SIZE, filteredSongs.value.length)
}

/** 找最近可滚动祖先；无则用视口 (root=null) */
function findScrollRoot(el: HTMLElement): Element | null {
  let node: HTMLElement | null = el.parentElement
  while (node && node !== document.documentElement) {
    const { overflowY } = getComputedStyle(node)
    if (
      (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
      node.scrollHeight > node.clientHeight + 1
    ) {
      return node
    }
    node = node.parentElement
  }
  return null
}

function tryLoadMoreWhileVisible() {
  const el = loadMoreSentinel.value
  if (!el || visibleCount.value >= filteredSongs.value.length) return
  const root = findScrollRoot(el)
  const elRect = el.getBoundingClientRect()
  const rootRect = root?.getBoundingClientRect()
  const bottom = rootRect ? rootRect.bottom + 120 : window.innerHeight + 120
  const top = rootRect ? rootRect.top - 120 : -120
  if (elRect.top < bottom && elRect.bottom > top) {
    const before = visibleCount.value
    loadMore()
    if (visibleCount.value > before) {
      requestAnimationFrame(tryLoadMoreWhileVisible)
    }
  }
}

function bindLoadMoreObserver(el: HTMLElement | null | undefined) {
  loadMoreObserver?.disconnect()
  loadMoreObserver = undefined
  if (!el) return
  const root = findScrollRoot(el)
  loadMoreObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) tryLoadMoreWhileVisible()
    },
    { root, rootMargin: '120px 0px' },
  )
  loadMoreObserver.observe(el)
}

watch(loadMoreSentinel, (el) => bindLoadMoreObserver(el), { flush: 'post' })
onBeforeUnmount(() => loadMoreObserver?.disconnect())

function requestSong(song: SongsInfo) {
  if (!beginRequest(song)) return
  emits('requestSong', song)
}
</script>

<template>
  <div class="simple-template">
    <div class="simple-layout">
      <aside class="filter-panel">
        <NScrollbar class="filter-panel-scroll">
          <div class="filter-panel-body">
            <header class="filter-heading">
              <div>
                <strong>曲库筛选</strong>
                <span>{{ filteredSongs.length }} / {{ data?.length ?? 0 }} 首</span>
              </div>
              <NButton
                v-if="hasFilters"
                size="tiny"
                quaternary
                @click="clearFilters"
              >
                清除
              </NButton>
            </header>

            <div class="filter-fields">
              <NInput
                v-model:value="searchKeyword"
                clearable
                placeholder="搜索歌名、歌手或标签"
              >
                <template #prefix><NIcon :component="Search24Regular" /></template>
              </NInput>
              <NSelect
                v-model:value="selectedAuthor"
                :options="authorOptions"
                clearable
                filterable
                placeholder="筛选歌手"
              />
            </div>

            <div
              v-if="tags.length"
              class="tag-list"
            >
              <NButton
                v-for="tag in tags"
                :key="tag"
                size="tiny"
                secondary
                :type="selectedTag === tag ? 'primary' : 'default'"
                :class="{ active: selectedTag === tag }"
                :aria-pressed="selectedTag === tag"
                @click="toggleTag(tag)"
              >
                {{ tag }}
              </NButton>
            </div>

            <section
              v-if="selectedSong"
              class="sidebar-section"
            >
              <small>正在试听</small>
              <strong>{{ selectedSong.name }}</strong>
              <SongPlayer
                v-model:is-lrc-loading="isLrcLoading"
                :song="selectedSong"
              />
            </section>

            <section
              v-if="showRequestQueue"
              class="sidebar-section"
            >
              <small>点歌队列</small>
              <div class="queue-frame"><LiveRequestOBS /></div>
            </section>
          </div>
        </NScrollbar>
      </aside>

      <main class="song-content">
        <Transition
          name="song-filter-swap"
          mode="out-in"
        >
          <NEmpty
            v-if="visibleSongs.length === 0"
            :key="`empty-${listKey}`"
            class="empty-state"
            :description="data?.length ? '没有符合条件的歌曲' : '暂无曲目'"
          />

          <div
            v-else
            :key="listKey"
            class="song-list"
          >
            <TransitionGroup
              name="song-card-item"
              tag="div"
              class="song-grid"
            >
              <article
                v-for="(item, index) in visibleSongs"
                :key="item.key"
                class="song-card"
                :class="{ 'is-singing': singingKeys.has(item.key), 'is-queued': queuedKeys.has(item.key) }"
                :style="{ '--card-index': index }"
              >
              <header class="song-header">
                <i />
                <div>
                  <strong :title="item.name">{{ item.name }}</strong>
                  <small
                    v-if="item.translateName"
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
                class="author-list"
              >
                <NButton
                  v-for="author in item.author"
                  :key="author"
                  size="tiny"
                  text
                  :type="selectedAuthor === author ? 'primary' : 'default'"
                  :class="{ active: selectedAuthor === author }"
                  :aria-pressed="selectedAuthor === author"
                  @click="toggleAuthor(author)"
                >
                  {{ author }}
                </NButton>
              </div>

              <p
                v-if="item.description"
                :title="item.description"
              >
                {{ item.description }}
              </p>

              <SongOptionBadges
                :options="item.options"
                variant="semantic"
              />

              <footer>
                <div class="card-tags">
                  <NButton
                    v-for="tag in (item.tags ?? []).slice(0, 3)"
                    :key="tag"
                    size="tiny"
                    secondary
                    :type="selectedTag === tag ? 'primary' : 'default'"
                    :aria-pressed="selectedTag === tag"
                    @click="toggleTag(tag)"
                  >
                    {{ tag }}
                  </NButton>
                  <small v-if="(item.tags?.length ?? 0) > 3">+{{ (item.tags?.length ?? 0) - 3 }}</small>
                </div>

                <div class="actions">
                  <NButton
                    v-if="item.url"
                    circle
                    secondary
                    size="small"
                    title="试听"
                    :aria-label="`试听《${item.name}》`"
                    :loading="isLrcLoading === item.key"
                    @click="selectedSong = item"
                  >
                    <template #icon><NIcon :component="Play24Filled" /></template>
                  </NButton>
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
            </TransitionGroup>

            <div
              v-if="visibleCount < filteredSongs.length"
              ref="loadMoreSentinel"
              class="load-more"
            >
              <NButton
                secondary
                @click="loadMore"
              >
                加载更多
              </NButton>
            </div>
          </div>
        </Transition>
      </main>
    </div>
  </div>
</template>

<style scoped>
.simple-template {
  width: 100%;
  max-width: var(--vtsuru-page-max-width, 1180px);
  margin: 0 auto;
  padding: clamp(8px, 2vw, 18px);
  color: var(--song-fg);
  container-type: inline-size;
}

.simple-template * {
  min-width: 0;
}

.simple-layout {
  display: grid;
  grid-template-columns: minmax(240px, 280px) minmax(0, 1fr);
  align-items: start;
  gap: var(--vtsuru-page-spacing, 16px);
}

.filter-panel,
.song-card,
.empty-state {
  border: var(--vtsuru-page-border, 1px solid var(--song-border));
  border-radius: var(--vtsuru-page-radius, 8px);
  background: var(--song-panel);
  box-shadow: var(--vtsuru-page-shadow, none);
}

.filter-panel {
  position: sticky;
  top: 12px;
  overflow: hidden;
}

.filter-panel-scroll {
  max-height: calc(100dvh - 32px);
}

.filter-panel-scroll :deep(.n-scrollbar-container) {
  overflow-x: hidden !important;
}

.filter-panel-body {
  display: grid;
  padding: var(--vtsuru-page-spacing, 16px);
  gap: 14px;
  overflow-x: clip;
}

.filter-heading,
.filter-heading > div,
.sidebar-section,
.song-header > div {
  display: flex;
}

.filter-heading {
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.filter-heading > div,
.sidebar-section,
.song-header > div {
  flex-direction: column;
}

.filter-heading span,
.sidebar-section small,
.song-header small,
.song-card p,
.card-tags small {
  color: var(--song-muted);
  font-size: 12px;
}

.filter-fields,
.sidebar-section {
  display: grid;
  gap: 8px;
}

.tag-list,
.author-list,
.badge-list,
.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.tag-list :deep(.n-button.active),
.author-list :deep(.n-button.active) {
  transform: scale(1.05);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--song-accent) 16%, transparent);
  animation: tag-pop 0.34s cubic-bezier(0.22, 1.4, 0.36, 1);
}

.song-filter-swap-enter-active,
.song-filter-swap-leave-active {
  transition:
    opacity 0.28s ease,
    transform 0.34s cubic-bezier(0.22, 1, 0.36, 1),
    filter 0.28s ease;
}

.song-filter-swap-enter-from {
  opacity: 0;
  filter: blur(4px);
  transform: translateY(16px) scale(0.985);
}

.song-filter-swap-leave-to {
  opacity: 0;
  filter: blur(3px);
  transform: translateY(-10px) scale(0.98);
}

.song-card-item-enter-active,
.song-card-item-leave-active {
  transition:
    opacity 0.28s ease,
    transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
}

.song-card-item-enter-from,
.song-card-item-leave-to {
  opacity: 0;
  transform: translateY(14px) scale(0.97);
}

.song-card-item-move {
  transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
}

.sidebar-section {
  padding-top: 12px;
  border-top: 1px solid color-mix(in srgb, var(--song-border) 70%, transparent);
}

.sidebar-section strong {
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queue-frame {
  min-height: 240px;
  overflow: hidden;
  border-radius: var(--vtsuru-page-radius, 8px);
}

.empty-state {
  min-height: 240px;
  padding: 48px 20px;
}

.song-list {
  padding: 2px;
  min-width: 0;
}

.song-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
  gap: var(--vtsuru-page-spacing, 16px);
}

.song-card {
  display: flex;
  min-height: 174px;
  flex-direction: column;
  padding: var(--vtsuru-page-spacing, 16px);
  overflow: hidden;
  gap: 8px;
  animation: card-enter 0.42s calc(var(--card-index, 0) * 40ms) cubic-bezier(0.22, 1, 0.36, 1) both;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    transform 0.18s ease,
    box-shadow 0.18s ease;
}

.song-card:hover {
  border-color: color-mix(in srgb, var(--song-accent) 38%, var(--song-border));
  background: color-mix(in srgb, var(--song-panel) 92%, var(--song-accent-soft));
  transform: translateY(-2px);
  box-shadow: 0 10px 24px color-mix(in srgb, var(--song-fg) 8%, transparent);
}

.song-header {
  display: grid;
  grid-template-columns: 4px minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
}

.song-header i {
  width: 4px;
  height: 30px;
  border-radius: 999px;
  background: var(--song-accent);
}

.song-header strong,
.song-header small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-card.is-singing .song-header i {
  background: var(--vtsuru-warning, #f59e0b);
}

.song-card.is-queued .song-header i {
  background: var(--vtsuru-success, #22c55e);
}

.song-card p {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.badge-list {
  margin-top: auto;
}

.song-card footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 8px;
  border-top: 1px solid color-mix(in srgb, var(--song-border) 66%, transparent);
  gap: 8px;
}

.card-tags {
  flex: 1;
  overflow: hidden;
}

.actions {
  display: flex;
  flex: none;
  gap: 6px;
}

.load-more {
  display: flex;
  justify-content: center;
  padding-top: 18px;
}

@container (max-width: 760px) {
  .simple-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .filter-panel {
    position: static;
  }

  .filter-panel-scroll {
    max-height: none;
  }
}

@keyframes card-enter {
  from {
    opacity: 0;
    transform: translateY(14px) scale(0.97);
  }
}

@keyframes tag-pop {
  0% {
    transform: scale(0.94);
  }
  55% {
    transform: scale(1.08);
  }
  100% {
    transform: scale(1.05);
  }
}

@media (prefers-reduced-motion: reduce) {
  .song-card,
  .tag-list :deep(.n-button.active),
  .author-list :deep(.n-button.active) {
    animation: none;
  }

  .song-filter-swap-enter-active,
  .song-filter-swap-leave-active,
  .song-card-item-enter-active,
  .song-card-item-leave-active,
  .song-card-item-move,
  .song-card {
    transition: none;
  }

  .song-card:hover {
    transform: none;
  }
}
</style>
