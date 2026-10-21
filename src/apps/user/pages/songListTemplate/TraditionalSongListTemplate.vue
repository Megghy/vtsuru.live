<script setup lang="ts">
import {
  ArrowCounterclockwise20Filled,
  ArrowSortDown20Filled,
  ArrowSortUp20Filled,
  SquareArrowForward24Filled,
} from '@vicons/fluent'
import { computed, ref, watch } from 'vue'

import type { SongsInfo } from '@/api/api-models'
import { SongFrom } from '@/api/api-models'
import type { SongListConfigTypeWithConfig } from '@/shared/types/TemplateTypes'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { getUserAvatarUrl, toast } from '@/shared/utils'
import bilibili from '@/svgs/bilibili.svg'
import douyin from '@/svgs/douyin.svg'
import neteaseMusic from '@/svgs/neteaseMusic.svg'
import qqMusic from '@/svgs/qqMusic.svg'

import SongOptionBadges from './components/SongOptionBadges.vue'
import SongStatusBadge from './components/SongStatusBadge.vue'
import { Config, DefaultConfig, type TraditionalConfigType } from './traditionalSongListConfig'
import { filterSongs, getSongFieldOptions } from './utils/songListData'
import { getSongRequestConfirmText, getSongRequestTooltip } from './utils/songRequestUtils'
import { useProgressiveList } from './utils/useProgressiveList'
import { useSongListTemplateCore } from './utils/useSongListTemplateCore'

type SortKey = 'name' | 'author' | 'language' | 'tags' | 'options' | 'description'

interface ProfileLink {
  label: string
  url: string
  icon: typeof bilibili
}

const props = defineProps<SongListConfigTypeWithConfig<TraditionalConfigType>>()
const emit = defineEmits<{ requestSong: [song: SongsInfo] }>()
defineExpose({ Config, DefaultConfig })

const searchQuery = ref('')
const selectedArtist = ref<string | null>(null)
const selectedLanguage = ref<string | null>(null)
const selectedTag = ref<string | null>(null)
const selectedOption = ref<string | null>(null)
const sortKey = ref<SortKey | null>(null)
const sortOrder = ref<'asc' | 'desc'>('asc')

const dialogState = ref<{
  open: boolean
  title: string
  content: string
  positiveText: string
  negativeText?: string
  onConfirm: () => void
}>({
  open: false,
  title: '',
  content: '',
  positiveText: '',
  onConfirm: () => {},
})

const {
  requestAuthState,
  isSelf,
  singingSongKeys: singingSongKeySet,
  queuedSongKeys: queuedSongKeySet,
} = useSongListTemplateCore({
  userInfo: () => props.userInfo,
  liveRequestActive: () => props.liveRequestActive,
})

const artistOptions = computed(() => getSongFieldOptions(props.data, 'author'))
const languageOptions = computed(() => [
  { label: '未设定', value: '__unset' },
  ...getSongFieldOptions(props.data, 'language'),
])
const tagOptions = computed(() => [{ label: '未设定', value: '__unset' }, ...getSongFieldOptions(props.data, 'tags')])
const optionFilters: Record<string, (song: SongsInfo) => boolean> = {
  unset: (song) => !song.options,
  captain: (song) => song.options?.needJianzhang === true,
  admiral: (song) => song.options?.needTidu === true,
  governor: (song) => song.options?.needZongdu === true,
  medal: (song) => (song.options?.fanMedalMinLevel ?? 0) > 0,
  sc: (song) => (song.options?.scMinPrice ?? 0) > 0,
}
const optionOptions = [
  { label: '全部条件', value: 'all' },
  { label: '未设定', value: 'unset' },
  { label: '舰长', value: 'captain' },
  { label: '提督', value: 'admiral' },
  { label: '总督', value: 'governor' },
  { label: '粉丝牌', value: 'medal' },
  { label: 'SC', value: 'sc' },
]
const sortOptions: { label: string; value: SortKey | 'default' }[] = [
  { label: '默认顺序', value: 'default' },
  { label: '按歌名', value: 'name' },
  { label: '按歌手', value: 'author' },
  { label: '按语言', value: 'language' },
  { label: '按标签', value: 'tags' },
  { label: '按点歌条件', value: 'options' },
  { label: '按备注', value: 'description' },
]

const filteredAndSortedSongs = computed(() => {
  const songs = filterSongs(props.data, {
    keyword: searchQuery.value,
    author: selectedArtist.value,
  }).filter((song) => {
    if (!matchesField(song.language, selectedLanguage.value)) return false
    if (!matchesField(song.tags, selectedTag.value)) return false
    return !selectedOption.value || selectedOption.value === 'all' || optionFilters[selectedOption.value]?.(song)
  })

  if (!sortKey.value || (sortKey.value as any) === 'default') return songs
  const direction = sortOrder.value === 'asc' ? 1 : -1
  return songs.toSorted((left, right) => {
    const compared = compareSongs(left, right, sortKey.value as SortKey)
    return compared === 0 ? left.name.localeCompare(right.name, 'zh-CN') : compared * direction
  })
})

const { visibleItems, hasMore, loadMoreTrigger, loadMore } = useProgressiveList(filteredAndSortedSongs, 48)

const hasFilters = computed(
  () =>
    !!searchQuery.value ||
    !!selectedArtist.value ||
    !!selectedLanguage.value ||
    !!selectedTag.value ||
    !!selectedOption.value,
)

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
    .map((link) => ({ ...link, url: getSafeUrl(link.url) }))
    .filter((link): link is { name: string; url: string } => !!link.url),
)

watch(artistOptions, (options) => {
  if (selectedArtist.value && !options.some((option) => option.value === selectedArtist.value)) {
    selectedArtist.value = null
  }
})

function matchesField(values: string[] | undefined, selected: string | null) {
  if (!selected || selected === 'all') return true
  return selected === '__unset' ? !values?.length : values?.includes(selected) === true
}

function compareSongs(left: SongsInfo, right: SongsInfo, key: SortKey) {
  const leftValue = getSortValue(left, key)
  const rightValue = getSortValue(right, key)
  return leftValue.localeCompare(rightValue, 'zh-CN', { numeric: true })
}

function getSortValue(song: SongsInfo, key: SortKey) {
  if (key === 'options') return song.options ? '1' : '0'
  const value = song[key]
  return Array.isArray(value) ? value.join(' ') : String(value ?? '')
}

function setSort(key: SortKey) {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
    return
  }
  sortKey.value = key
  sortOrder.value = 'asc'
}

function clearFilters() {
  searchQuery.value = ''
  selectedArtist.value = null
  selectedLanguage.value = null
  selectedTag.value = null
  selectedOption.value = null
}

function randomOrder() {
  const songs = filteredAndSortedSongs.value.length ? filteredAndSortedSongs.value : (props.data ?? [])
  if (!songs.length) {
    toast.warning('当前没有可选歌曲')
    return
  }
  const song = songs[Math.floor(Math.random() * songs.length)]
  dialogState.value = {
    open: true,
    title: '随机结果',
    content: `${song.name}${song.author?.length ? ` · ${song.author.join(' / ')}` : ''}`,
    positiveText: isSelf.value ? '知道了' : '点这首',
    negativeText: isSelf.value ? undefined : '再看看',
    onConfirm: () => {
      if (!isSelf.value) emit('requestSong', song)
    },
  }
}

function requestSong(song: SongsInfo) {
  if (isSelf.value) return
  const tooltip = getSongRequestTooltip(song, props.liveRequestSettings, requestAuthState.value)
  dialogState.value = {
    open: true,
    title: '点歌',
    content: `${getSongRequestConfirmText(song)}${tooltip === '点歌' ? '' : `\n${tooltip}`}`,
    positiveText: '点歌',
    negativeText: '取消',
    onConfirm: () => emit('requestSong', song),
  }
}

function getSongLink(song: SongsInfo) {
  if (song.from === SongFrom.Netease) return `https://music.163.com/#/song?id=${song.id}`
  if (song.from === SongFrom.FiveSing) return `https://5sing.kugou.com/bz/${song.id}.html`
  return getSafeUrl(song.url)
}

function addProfileLink(links: ProfileLink[], label: string, value: string | undefined, icon: typeof bilibili) {
  const url = getSafeUrl(value)
  if (url) links.push({ label, url, icon })
}

function getSafeUrl(value?: string) {
  if (!value) return
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined
  } catch {
    return undefined
  }
}
</script>

<template>
  <TooltipProvider>
    <section
      class="traditional-song-list"
      :class="{ 'has-background': config?.backgroundFile?.length }"
      :style="{
        '--song-list-bg-image': config?.backgroundFile?.length ? `url(&quot;${config.backgroundFile[0].path}&quot;)` : undefined,
      }"
    >
      <div class="content-frame max-w-5xl mx-auto px-4 py-8 space-y-6">
        <header class="profile-panel flex flex-wrap items-center gap-6 p-6 rounded-2xl bg-card/80 backdrop-blur-md border border-border/80 shadow-xs">
          <img
            class="profile-avatar size-20 rounded-full object-cover border-2 border-primary/20"
            :src="userInfo?.faceUrl || userInfo?.streamerInfo?.faceUrl || getUserAvatarUrl(userInfo?.id)"
            :alt="userInfo?.name ?? '主播头像'"
            referrerpolicy="no-referrer"
          />
          <div class="profile-copy flex-1 min-w-48">
            <p class="eyebrow text-xs font-semibold tracking-wider text-primary uppercase">SONG LIBRARY</p>
            <h1 class="text-2xl font-bold text-foreground mt-0.5">{{ config?.title ?? `${userInfo?.name ?? ''}的歌单` }}</h1>
            <p
              v-if="config?.description"
              class="profile-summary text-xs text-muted-foreground mt-1"
            >
              {{ config.description }}
            </p>
            <p
              v-else
              class="profile-summary text-xs text-muted-foreground mt-1"
            >
              选择喜欢的歌曲，点击歌名即可点歌
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
              class="profile-icon-link p-2 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition size-9 flex items-center justify-center"
            >
              <component :is="link.icon" class="size-4" />
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

        <p
          v-if="config?.longDescription"
          class="long-description text-xs text-muted-foreground leading-relaxed px-2"
        >
          {{ config.longDescription }}
        </p>

        <main class="song-panel p-5 rounded-2xl bg-card/85 backdrop-blur-md border border-border/80 shadow-xs space-y-4">
          <div class="filter-grid grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <Input
              v-model="searchQuery"
              placeholder="搜索歌名、歌手、语言、标签或备注"
              class="search-input h-8 text-xs col-span-1 sm:col-span-2"
            />
            <Select
              :model-value="selectedArtist || 'all'"
              @update:model-value="selectedArtist = $event === 'all' ? null : String($event)"
            >
              <SelectTrigger class="h-8 text-xs">
                <SelectValue placeholder="歌手" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" class="text-xs">全部歌手</SelectItem>
                <SelectItem
                  v-for="opt in artistOptions"
                  :key="opt.value"
                  :value="opt.value"
                  class="text-xs"
                >
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
            <Select
              :model-value="selectedLanguage || 'all'"
              @update:model-value="selectedLanguage = $event === 'all' ? null : String($event)"
            >
              <SelectTrigger class="h-8 text-xs">
                <SelectValue placeholder="语言" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" class="text-xs">全部语言</SelectItem>
                <SelectItem
                  v-for="opt in languageOptions"
                  :key="opt.value"
                  :value="opt.value"
                  class="text-xs"
                >
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
            <Select
              :model-value="selectedTag || 'all'"
              @update:model-value="selectedTag = $event === 'all' ? null : String($event)"
            >
              <SelectTrigger class="h-8 text-xs">
                <SelectValue placeholder="标签" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" class="text-xs">全部标签</SelectItem>
                <SelectItem
                  v-for="opt in tagOptions"
                  :key="opt.value"
                  :value="opt.value"
                  class="text-xs"
                >
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
            <div class="sort-control flex items-center gap-1">
              <Select
                :model-value="sortKey || 'default'"
                @update:model-value="sortKey = $event === 'default' ? null : ($event as SortKey)"
              >
                <SelectTrigger class="h-8 text-xs flex-1">
                  <SelectValue placeholder="排序" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="opt in sortOptions"
                    :key="opt.value"
                    :value="opt.value"
                    class="text-xs"
                  >
                    {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                class="size-8 shrink-0 text-muted-foreground"
                :disabled="!sortKey"
                :title="sortOrder === 'asc' ? '升序' : '降序'"
                @click="sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'"
              >
                <component :is="sortOrder === 'asc' ? ArrowSortUp20Filled : ArrowSortDown20Filled" class="size-4" />
              </Button>
            </div>
          </div>

          <div class="result-toolbar flex items-center justify-between gap-3 text-xs pt-1 border-t border-border/50">
            <span class="result-count text-muted-foreground font-mono">{{ filteredAndSortedSongs.length }} / {{ data?.length ?? 0 }} 首</span>
            <div class="toolbar-actions flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                class="h-7 text-xs flex items-center gap-1 text-muted-foreground"
                :disabled="!hasFilters"
                @click="clearFilters"
              >
                <component :is="ArrowCounterclockwise20Filled" class="size-3.5" />
                清空
              </Button>
              <Button
                variant="secondary"
                size="sm"
                class="h-7 text-xs"
                @click="randomOrder"
              >
                随机一首
              </Button>
            </div>
          </div>

          <div
            class="song-table-shell overflow-x-auto"
            :class="{ 'is-fixed': config?.fixedHeight }"
          >
            <div
              class="song-table-scroller"
              :style="config?.fixedHeight ? 'max-height: 560px; overflow-y: auto;' : undefined"
            >
              <Empty
                v-if="!filteredAndSortedSongs.length"
                :description="data?.length ? '没有符合条件的歌曲' : '歌单里还没有歌曲'"
                class="py-12"
              />
              <table
                v-else
                class="song-table w-full text-left border-collapse text-xs"
              >
                <thead>
                  <tr class="border-b border-border/80 text-muted-foreground font-medium">
                    <th
                      v-for="column in sortOptions.slice(1)"
                      :key="column.value"
                      class="py-2.5 px-3 whitespace-nowrap"
                    >
                      <button
                        type="button"
                        class="sort-heading flex items-center gap-1 hover:text-foreground cursor-pointer font-medium"
                        @click="setSort(column.value as SortKey)"
                      >
                        {{ column.label.replace('按', '') }}
                        <component
                          :is="sortOrder === 'asc' ? ArrowSortUp20Filled : ArrowSortDown20Filled"
                          v-if="sortKey === column.value"
                          class="size-3"
                        />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border/40">
                  <tr
                    v-for="song in visibleItems"
                    :key="song.key || `${song.name}-${song.author?.join('/')}`"
                    class="hover:bg-muted/40 transition"
                    :class="{
                      'bg-amber-500/5': singingSongKeySet.has(song.key),
                      'bg-emerald-500/5': queuedSongKeySet.has(song.key),
                    }"
                  >
                    <td class="title-cell py-2 px-3">
                      <div class="title-content flex items-center gap-1.5 flex-wrap">
                        <SongStatusBadge
                          :song-key="song.key"
                          :singing-keys="singingSongKeySet"
                          :queued-keys="queuedSongKeySet"
                          variant="text"
                        />
                        <Tooltip :disabled="isSelf">
                          <TooltipTrigger as-child>
                            <button
                              class="song-title-button font-medium text-foreground hover:text-primary transition cursor-pointer text-left"
                              type="button"
                              :disabled="isSelf"
                              @click="requestSong(song)"
                            >
                              {{ song.name }}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent class="text-xs">
                            {{ getSongRequestTooltip(song, liveRequestSettings, requestAuthState) }}
                          </TooltipContent>
                        </Tooltip>
                        <a
                          v-if="getSongLink(song)"
                          :href="getSongLink(song)"
                          target="_blank"
                          rel="noopener noreferrer"
                          title="打开歌曲链接"
                          class="text-muted-foreground hover:text-primary p-0.5"
                        >
                          <component :is="SquareArrowForward24Filled" class="size-3.5" />
                        </a>
                      </div>
                    </td>
                    <td class="py-2 px-3">
                      <span
                        v-if="song.author?.length"
                        class="inline-list flex items-center gap-1 flex-wrap"
                      >
                        <button
                          v-for="artist in song.author"
                          :key="artist"
                          type="button"
                          class="hover:text-primary transition cursor-pointer"
                          :class="{ 'text-primary font-medium': selectedArtist === artist }"
                          @click="selectedArtist = selectedArtist === artist ? null : artist"
                        >
                          {{ artist }}
                        </button>
                      </span>
                      <span
                        v-else
                        class="muted text-muted-foreground/60"
                      >
                        未知
                      </span>
                    </td>
                    <td class="py-2 px-3">
                      <span class="inline-list flex items-center gap-1 flex-wrap">
                        <button
                          v-for="language in song.language"
                          :key="language"
                          type="button"
                          class="hover:text-primary transition cursor-pointer"
                          :class="{ 'text-primary font-medium': selectedLanguage === language }"
                          @click="selectedLanguage = selectedLanguage === language ? null : language"
                        >
                          {{ language }}
                        </button>
                      </span>
                    </td>
                    <td class="py-2 px-3">
                      <div class="tag-list flex items-center gap-1 flex-wrap">
                        <button
                          v-for="tag in song.tags"
                          :key="tag"
                          type="button"
                          class="px-1.5 py-0.5 rounded text-[10px] transition cursor-pointer"
                          :class="selectedTag === tag ? 'bg-primary text-primary-foreground font-medium' : 'bg-muted text-muted-foreground hover:bg-muted/80'"
                          @click="selectedTag = selectedTag === tag ? null : tag"
                        >
                          {{ tag }}
                        </button>
                      </div>
                    </td>
                    <td class="py-2 px-3">
                      <SongOptionBadges
                        :options="song.options"
                        variant="semantic"
                        empty-text="无限制"
                      />
                    </td>
                    <td class="py-2 px-3">
                      <span :class="{ 'text-muted-foreground/60': !song.description }">{{ song.description || '无' }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>

              <button
                v-if="hasMore"
                ref="loadMoreTrigger"
                type="button"
                class="load-more-trigger w-full py-4 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                @click="loadMore"
              >
                加载更多
              </button>
            </div>
          </div>
        </main>
      </div>

      <!-- 点歌/随机结果弹窗 -->
      <Dialog v-model:open="dialogState.open">
        <DialogContent class="sm:max-w-md">
          <DialogHeader>
            <DialogTitle class="text-sm font-semibold">{{ dialogState.title }}</DialogTitle>
            <DialogDescription class="text-xs whitespace-pre-wrap pt-2">
              {{ dialogState.content }}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter class="pt-3">
            <Button
              v-if="dialogState.negativeText"
              variant="outline"
              size="sm"
              class="h-8 text-xs"
              @click="dialogState.open = false"
            >
              {{ dialogState.negativeText }}
            </Button>
            <Button
              size="sm"
              class="h-8 text-xs"
              @click="() => { dialogState.onConfirm(); dialogState.open = false; }"
            >
              {{ dialogState.positiveText }}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  </TooltipProvider>
</template>

<style scoped>
.traditional-song-list {
  width: 100%;
}
</style>
