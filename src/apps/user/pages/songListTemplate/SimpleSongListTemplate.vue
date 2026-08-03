<script setup lang="ts">
import { CloudAdd20Filled, Play24Filled, Search24Regular } from '@vicons/fluent'
import { NButton, NEmpty, NIcon, NInput, NSelect, NTag, NTooltip } from 'naive-ui'
import { computed, ref, watch } from 'vue'

import { useAccount } from '@/api/account'
import type { SongsInfo } from '@/api/api-models'
import { FunctionTypes } from '@/api/api-models'
import LiveRequestOBS from '@/apps/obs/pages/request/LiveRequestOBS.vue'
import SongPlayer from '@/components/SongPlayer.vue'
import type { SongListConfigType } from '@/shared/types/TemplateTypes'
import { useBiliAuth } from '@/store/useBiliAuth'

import { filterSongs, getSongFieldOptions, getSongFieldValues } from './utils/songListData'
import { getSongRequestButtonType, getSongRequestTooltip } from './utils/songRequestUtils'
import { useLiveRequestStatus } from './utils/useLiveRequestStatus'

const props = defineProps<SongListConfigType>()
const emits = defineEmits(['requestSong'])
const PAGE_SIZE = 20

const accountInfo = useAccount()
const biliAuth = useBiliAuth()
const searchKeyword = ref('')
const selectedTag = ref<string | null>(null)
const selectedAuthor = ref<string | null>(null)
const selectedSong = ref<SongsInfo>()
const visibleCount = ref(PAGE_SIZE)
const isLrcLoading = ref('')
const requestingKey = ref('')

const requestAuthState = computed(() => ({
  isLoggedIn: !!accountInfo.value.id,
  isBiliAuthed: biliAuth.isAuthed,
}))
const { singing: singingKeys, queued: queuedKeys } = useLiveRequestStatus(() => props.liveRequestActive)
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

watch([searchKeyword, selectedTag, selectedAuthor], () => (visibleCount.value = PAGE_SIZE))

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

function handleScroll(event: Event) {
  const element = event.currentTarget as HTMLElement
  if (element.scrollTop + element.clientHeight >= element.scrollHeight - 48) loadMore()
}

function handleRequestSong(song: SongsInfo) {
  requestingKey.value = song.key
  emits('requestSong', song)
  window.setTimeout(() => (requestingKey.value = ''), 2000)
}

function getBadges(song: SongsInfo) {
  const options = song.options
  if (!options) return []

  return [
    options.scMinPrice && { label: `SC ¥${options.scMinPrice}`, type: 'error' },
    options.fanMedalMinLevel && { label: `粉丝牌 Lv${options.fanMedalMinLevel}`, type: 'info' },
    options.needZongdu && { label: '总督', type: 'warning' },
    options.needTidu && { label: '提督', type: 'info' },
    options.needJianzhang && { label: '舰长', type: 'default' },
  ].filter((badge): badge is { label: string; type: 'default' | 'error' | 'info' | 'warning' } => !!badge)
}
</script>

<template>
  <div class="simple-template">
    <div class="simple-layout">
      <aside class="filter-panel">
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
      </aside>

      <main class="song-content">
        <NEmpty
          v-if="visibleSongs.length === 0"
          class="empty-state"
          :description="data?.length ? '没有符合条件的歌曲' : '暂无曲目'"
        />

        <div
          v-else
          class="song-list"
          @scroll="handleScroll"
        >
          <div class="song-grid">
            <article
              v-for="item in visibleSongs"
              :key="item.key"
              class="song-card"
              :class="{ 'is-singing': singingKeys.has(item.key), 'is-queued': queuedKeys.has(item.key) }"
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
                <NTag
                  v-if="singingKeys.has(item.key)"
                  class="status singing"
                  size="tiny"
                  type="warning"
                  :bordered="false"
                >
                  演唱中
                </NTag>
                <NTag
                  v-else-if="queuedKeys.has(item.key)"
                  class="status queued"
                  size="tiny"
                  type="success"
                  :bordered="false"
                >
                  排队中
                </NTag>
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

              <div
                v-if="getBadges(item).length"
                class="badge-list"
              >
                <NTag
                  v-for="badge in getBadges(item)"
                  :key="badge.label"
                  size="small"
                  :type="badge.type"
                  :bordered="false"
                >
                  {{ badge.label }}
                </NTag>
              </div>

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
                  <NTooltip>
                    <template #trigger>
                      <NButton
                        circle
                        size="small"
                        :aria-label="`点歌《${item.name}》`"
                        :type="getSongRequestButtonType(item, liveRequestSettings, requestAuthState)"
                        :loading="requestingKey === item.key"
                        @click="handleRequestSong(item)"
                      >
                        <template #icon><NIcon :component="CloudAdd20Filled" /></template>
                      </NButton>
                    </template>
                    {{ getSongRequestTooltip(item, liveRequestSettings, requestAuthState) }}
                  </NTooltip>
                </div>
              </footer>
            </article>
          </div>

          <div
            v-if="visibleCount < filteredSongs.length"
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
  display: grid;
  max-height: calc(100dvh - 32px);
  padding: var(--vtsuru-page-spacing, 16px);
  overflow: auto;
  gap: 14px;
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
  max-height: min(82dvh, 960px);
  padding: 2px;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-gutter: stable;
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
}

.song-card:hover {
  border-color: color-mix(in srgb, var(--song-accent) 38%, var(--song-border));
  background: color-mix(in srgb, var(--song-panel) 92%, var(--song-accent-soft));
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
    max-height: none;
  }

  .song-list {
    max-height: none;
    overflow: visible;
    scrollbar-gutter: auto;
  }
}
</style>
