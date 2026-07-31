<script setup lang="ts">
import {
  ArrowCounterclockwise20Filled,
  ArrowSortDown20Filled,
  ArrowSortUp20Filled,
  SquareArrowForward24Filled,
} from '@vicons/fluent'
import { NButton, NEmpty, NIcon, NInput, NScrollbar, NSelect, NTag, NTooltip } from 'naive-ui'
import { computed, ref, watch } from 'vue'

import { useAccount } from '@/api/account'
import type { SongRequestOption, SongsInfo } from '@/api/api-models'
import { SongFrom } from '@/api/api-models'
import type { SongListConfigTypeWithConfig } from '@/shared/types/TemplateTypes'
import { getUserAvatarUrl } from '@/shared/utils'
import { useBiliAuth } from '@/store/useBiliAuth'
import bilibili from '@/svgs/bilibili.svg'
import douyin from '@/svgs/douyin.svg'
import neteaseMusic from '@/svgs/neteaseMusic.svg'
import qqMusic from '@/svgs/qqMusic.svg'

import { Config, DefaultConfig, type TraditionalConfigType } from './traditionalSongListConfig'
import { filterSongs, getSongFieldOptions } from './utils/songListData'
import { getSongRequestConfirmText, getSongRequestTooltip } from './utils/songRequestUtils'
import { useLiveRequestStatus } from './utils/useLiveRequestStatus'

type SortKey = 'name' | 'author' | 'language' | 'tags' | 'options' | 'description'
type TagType = 'default' | 'info' | 'success' | 'warning' | 'error'

interface RequestBadge {
  label: string
  type: TagType
}

interface ProfileLink {
  label: string
  url: string
  icon: typeof bilibili
}

const props = defineProps<SongListConfigTypeWithConfig<TraditionalConfigType>>()
const emit = defineEmits<{ requestSong: [song: SongsInfo] }>()
defineExpose({ Config, DefaultConfig })

const accountInfo = useAccount()
const biliAuth = useBiliAuth()
const searchQuery = ref('')
const selectedArtist = ref<string | null>(null)
const selectedLanguage = ref<string | null>(null)
const selectedTag = ref<string | null>(null)
const selectedOption = ref<string | null>(null)
const sortKey = ref<SortKey | null>(null)
const sortOrder = ref<'asc' | 'desc'>('asc')

const requestAuthState = computed(() => ({
  isLoggedIn: !!accountInfo.value.id,
  isBiliAuthed: biliAuth.isAuthed,
}))
const isSelf = computed(() => !!props.userInfo?.id && accountInfo.value.id === props.userInfo.id)
const { singing: singingSongKeySet, queued: queuedSongKeySet } = useLiveRequestStatus(() => props.liveRequestActive)

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
  { label: '未设定', value: 'unset' },
  { label: '舰长', value: 'captain' },
  { label: '提督', value: 'admiral' },
  { label: '总督', value: 'governor' },
  { label: '粉丝牌', value: 'medal' },
  { label: 'SC', value: 'sc' },
]
const sortOptions = [
  { label: '默认顺序', value: null },
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
    return !selectedOption.value || optionFilters[selectedOption.value](song)
  })

  if (!sortKey.value) return songs
  const direction = sortOrder.value === 'asc' ? 1 : -1
  return songs.toSorted((left, right) => {
    const compared = compareSongs(left, right, sortKey.value as SortKey)
    return compared === 0 ? left.name.localeCompare(right.name, 'zh-CN') : compared * direction
  })
})

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
  if (!selected) return true
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
    window.$message?.warning('当前没有可选歌曲')
    return
  }
  const song = songs[Math.floor(Math.random() * songs.length)]
  window.$modal.create({
    preset: 'dialog',
    type: 'success',
    title: '随机结果',
    content: `${song.name}${song.author?.length ? ` · ${song.author.join(' / ')}` : ''}`,
    positiveText: isSelf.value ? '知道了' : '点这首',
    negativeText: isSelf.value ? undefined : '再看看',
    onPositiveClick: () => {
      if (!isSelf.value) emit('requestSong', song)
    },
  })
}

function requestSong(song: SongsInfo) {
  if (isSelf.value) return
  const tooltip = getSongRequestTooltip(song, props.liveRequestSettings, requestAuthState.value)
  window.$modal.create({
    preset: 'dialog',
    title: '点歌',
    content: `${getSongRequestConfirmText(song)}${tooltip === '点歌' ? '' : `\n${tooltip}`}`,
    positiveText: '点歌',
    negativeText: '取消',
    onPositiveClick: () => emit('requestSong', song),
  })
}

function getRequestBadges(options?: SongRequestOption): RequestBadge[] {
  if (!options) return []
  const badges: RequestBadge[] = []
  if (options.needJianzhang) badges.push({ label: '舰长', type: 'info' })
  if (options.needTidu) badges.push({ label: '提督', type: 'warning' })
  if (options.needZongdu) badges.push({ label: '总督', type: 'error' })
  if ((options.fanMedalMinLevel ?? 0) > 0) {
    badges.push({ label: `粉丝牌 ${options.fanMedalMinLevel} 级`, type: 'success' })
  }
  if ((options.scMinPrice ?? 0) > 0) badges.push({ label: `SC ¥${options.scMinPrice}`, type: 'error' })
  return badges
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
  <section
    class="traditional-song-list"
    :class="{ 'has-background': config?.backgroundFile?.length }"
    :style="{
      backgroundImage: config?.backgroundFile?.length ? `url(${config.backgroundFile[0].path})` : undefined,
    }"
  >
    <div class="content-frame">
      <header class="profile-panel">
        <img
          class="profile-avatar"
          :src="getUserAvatarUrl(userInfo?.id)"
          :alt="userInfo?.name ?? '主播头像'"
          referrerpolicy="no-referrer"
        />
        <div class="profile-copy">
          <p class="eyebrow">SONG LIBRARY</p>
          <h1>{{ config?.title ?? `${userInfo?.name ?? ''}的歌单` }}</h1>
          <p
            v-if="config?.description"
            class="profile-summary"
          >
            {{ config.description }}
          </p>
          <p
            v-else
            class="profile-summary"
          >
            选择喜欢的歌曲，点击歌名即可点歌
          </p>
        </div>
        <div
          v-if="profileLinks.length || customLinks.length"
          class="profile-links"
        >
          <a
            v-for="link in profileLinks"
            :key="link.label"
            :href="link.url"
            :title="link.label"
            target="_blank"
            rel="noopener noreferrer"
            class="profile-icon-link"
          >
            <component :is="link.icon" />
          </a>
          <a
            v-for="link in customLinks"
            :key="`${link.name}-${link.url}`"
            :href="link.url"
            target="_blank"
            rel="noopener noreferrer"
            class="custom-link"
          >
            {{ link.name }}
          </a>
        </div>
      </header>

      <p
        v-if="config?.longDescription"
        class="long-description"
      >
        {{ config.longDescription }}
      </p>

      <main class="song-panel">
        <div class="filter-grid">
          <NInput
            v-model:value="searchQuery"
            clearable
            placeholder="搜索歌名、歌手、语言、标签或备注"
            class="search-input"
          />
          <NSelect
            v-model:value="selectedArtist"
            :options="artistOptions"
            filterable
            clearable
            placeholder="歌手"
          />
          <NSelect
            v-model:value="selectedLanguage"
            :options="languageOptions"
            filterable
            clearable
            placeholder="语言"
          />
          <NSelect
            v-model:value="selectedTag"
            :options="tagOptions"
            filterable
            clearable
            placeholder="标签"
          />
          <NSelect
            v-model:value="selectedOption"
            :options="optionOptions"
            clearable
            placeholder="点歌条件"
          />
          <div class="sort-control">
            <NSelect
              v-model:value="sortKey"
              :options="sortOptions"
              placeholder="排序"
            />
            <NButton
              secondary
              circle
              :disabled="!sortKey"
              :title="sortOrder === 'asc' ? '升序' : '降序'"
              @click="sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'"
            >
              <template #icon
                ><NIcon :component="sortOrder === 'asc' ? ArrowSortUp20Filled : ArrowSortDown20Filled"
              /></template>
            </NButton>
          </div>
        </div>

        <div class="result-toolbar">
          <span class="result-count">{{ filteredAndSortedSongs.length }} / {{ data?.length ?? 0 }} 首</span>
          <div class="toolbar-actions">
            <NButton
              quaternary
              :disabled="!hasFilters"
              @click="clearFilters"
            >
              <template #icon><NIcon :component="ArrowCounterclockwise20Filled" /></template>
              清空
            </NButton>
            <NButton
              type="primary"
              secondary
              @click="randomOrder"
              >随机一首</NButton
            >
          </div>
        </div>

        <div
          class="song-table-shell"
          :class="{ 'is-fixed': config?.fixedHeight }"
        >
          <NScrollbar
            class="song-table-scroller"
            style="max-height: var(--song-table-max-height)"
          >
            <NEmpty
              v-if="!filteredAndSortedSongs.length"
              :description="data?.length ? '没有符合条件的歌曲' : '歌单里还没有歌曲'"
            />
            <table
              v-else
              class="song-table"
            >
              <thead>
                <tr>
                  <th
                    v-for="column in sortOptions.slice(1)"
                    :key="column.value"
                  >
                    <button
                      type="button"
                      class="sort-heading"
                      @click="setSort(column.value as SortKey)"
                    >
                      {{ column.label.replace('按', '') }}
                      <NIcon
                        v-if="sortKey === column.value"
                        :component="sortOrder === 'asc' ? ArrowSortUp20Filled : ArrowSortDown20Filled"
                      />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="song in filteredAndSortedSongs"
                  :key="song.key || `${song.name}-${song.author?.join('/')}`"
                  :class="{
                    'is-singing': singingSongKeySet.has(song.key),
                    'is-queued': queuedSongKeySet.has(song.key),
                  }"
                >
                  <td class="title-cell">
                    <div class="title-content">
                      <span
                        v-if="singingSongKeySet.has(song.key)"
                        class="status singing"
                        >演唱中</span
                      >
                      <span
                        v-else-if="queuedSongKeySet.has(song.key)"
                        class="status queued"
                        >排队中</span
                      >
                      <NTooltip :disabled="isSelf">
                        <template #trigger>
                          <button
                            class="song-title-button"
                            type="button"
                            :disabled="isSelf"
                            @click="requestSong(song)"
                          >
                            {{ song.name }}
                          </button>
                        </template>
                        {{ getSongRequestTooltip(song, liveRequestSettings, requestAuthState) }}
                      </NTooltip>
                      <NButton
                        v-if="getSongLink(song)"
                        tag="a"
                        text
                        :href="getSongLink(song)"
                        target="_blank"
                        rel="noopener noreferrer"
                        title="打开歌曲链接"
                      >
                        <template #icon><NIcon :component="SquareArrowForward24Filled" /></template>
                      </NButton>
                    </div>
                  </td>
                  <td>
                    <span class="cell-label">歌手</span>
                    <span
                      v-if="song.author?.length"
                      class="inline-list"
                    >
                      <button
                        v-for="artist in song.author"
                        :key="artist"
                        type="button"
                        :class="{ active: selectedArtist === artist }"
                        @click="selectedArtist = selectedArtist === artist ? null : artist"
                      >
                        {{ artist }}
                      </button>
                    </span>
                    <span
                      v-else
                      class="muted"
                      >未知</span
                    >
                  </td>
                  <td>
                    <span class="cell-label">语言</span>
                    <span class="inline-list">
                      <button
                        v-for="language in song.language"
                        :key="language"
                        type="button"
                        :class="{ active: selectedLanguage === language }"
                        @click="selectedLanguage = selectedLanguage === language ? null : language"
                      >
                        {{ language }}
                      </button>
                    </span>
                  </td>
                  <td>
                    <span class="cell-label">标签</span>
                    <div class="tag-list">
                      <NTag
                        v-for="tag in song.tags"
                        :key="tag"
                        class="song-tag"
                        :class="{ active: selectedTag === tag }"
                        size="small"
                        checkable
                        round
                        :bordered="false"
                        :checked="selectedTag === tag"
                        @update:checked="selectedTag = selectedTag === tag ? null : tag"
                        >{{ tag }}</NTag
                      >
                    </div>
                  </td>
                  <td>
                    <span class="cell-label">点歌条件</span>
                    <div class="tag-list">
                      <NTag
                        v-for="badge in getRequestBadges(song.options)"
                        :key="badge.label"
                        class="request-tag"
                        size="small"
                        :type="badge.type"
                        round
                        :bordered="false"
                      >
                        {{ badge.label }}
                      </NTag>
                      <span
                        v-if="!getRequestBadges(song.options).length"
                        class="muted"
                        >无限制</span
                      >
                    </div>
                  </td>
                  <td>
                    <span class="cell-label">备注</span>
                    <span :class="{ muted: !song.description }">{{ song.description || '无' }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </NScrollbar>
        </div>
      </main>
    </div>
  </section>
</template>

<style scoped>
.traditional-song-list {
  width: 100%;
  min-width: 0;
  padding: clamp(12px, 2vw, 24px);
  border-radius: var(--vtsuru-page-radius, 8px);
  background-position: center;
  background-size: cover;
  color: var(--song-fg);
}

.traditional-song-list.has-background {
  position: relative;
  isolation: isolate;
}

.traditional-song-list.has-background::before {
  position: absolute;
  z-index: -1;
  inset: 0;
  border-radius: inherit;
  background: color-mix(in srgb, var(--song-bg) 78%, transparent);
  backdrop-filter: blur(12px) saturate(1.15);
  content: '';
}

.content-frame {
  display: grid;
  width: min(100%, var(--vtsuru-page-max-width, 1180px));
  min-width: 0;
  margin: 0 auto;
  gap: var(--vtsuru-page-spacing, 16px);
}

.profile-panel,
.song-panel,
.long-description {
  border: var(--vtsuru-page-border, 1px solid var(--song-border));
  border-radius: var(--vtsuru-page-radius, 8px);
  background: var(--song-panel);
  box-shadow: var(--vtsuru-page-shadow, none);
  backdrop-filter: blur(12px);
}

.profile-panel {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  padding: clamp(16px, 2vw, 24px);
  gap: 16px;
}

.profile-avatar {
  width: 68px;
  height: 68px;
  border: var(--vtsuru-page-border, 1px solid var(--song-border));
  border-radius: 50%;
  object-fit: cover;
  box-shadow: var(--vtsuru-page-shadow, none);
}

.profile-copy {
  min-width: 0;
}

.eyebrow {
  margin: 0 0 3px;
  color: var(--song-accent);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0;
}

.profile-copy h1 {
  margin: 0;
  overflow-wrap: anywhere;
  font-size: clamp(22px, 3vw, 32px);
  line-height: 1.15;
}

.profile-summary {
  margin: 7px 0 0;
  color: var(--song-muted);
  line-height: 1.5;
}

.profile-links {
  display: flex;
  max-width: 360px;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 7px;
}

.profile-icon-link,
.custom-link {
  display: inline-flex;
  min-height: 32px;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--song-border) 80%, transparent);
  border-radius: var(--vtsuru-page-radius, 8px);
  background: var(--song-bg);
  color: var(--song-muted);
  text-decoration: none;
  transition: 160ms ease;
}

.profile-icon-link {
  width: 34px;
}

.profile-icon-link svg {
  width: 17px;
  height: 17px;
}

.custom-link {
  max-width: 150px;
  padding: 0 10px;
  overflow: hidden;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-icon-link:hover,
.custom-link:hover {
  border-color: var(--song-accent);
  background: var(--song-accent-soft);
  color: var(--song-accent);
  transform: translateY(-1px);
}

.long-description {
  margin: 0;
  padding: 14px 18px;
  color: var(--song-muted);
  line-height: 1.7;
  white-space: pre-wrap;
}

.song-panel {
  min-width: 0;
  padding: clamp(12px, 2vw, 20px);
}

.filter-grid {
  display: grid;
  grid-template-columns: minmax(220px, 2fr) repeat(4, minmax(110px, 0.8fr)) minmax(150px, 1fr);
  align-items: center;
  gap: 8px;
}

.search-input {
  min-width: 0;
}

.sort-control {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  min-width: 0;
  gap: 6px;
}

.result-toolbar {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0 10px;
  gap: 12px;
}

.result-count {
  color: var(--song-muted);
  font-size: 13px;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.song-table-shell {
  --song-table-max-height: none;

  min-width: 0;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--song-border) 78%, transparent);
  border-radius: var(--vtsuru-page-radius, 8px);
  background: color-mix(in srgb, var(--song-bg) 88%, transparent);
}

.song-table-shell.is-fixed {
  --song-table-max-height: 55vh;
}

.song-table-shell :deep(.n-empty) {
  padding: 72px 20px;
}

.song-table {
  width: 100%;
  min-width: 0;
  border-spacing: 0;
  table-layout: fixed;
}

.song-table th,
.song-table td {
  min-width: 0;
  padding: 11px 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--song-border) 68%, transparent);
  text-align: left;
  vertical-align: middle;
}

.song-table th:first-child,
.song-table td:first-child {
  width: 28%;
}

.song-table th:nth-child(2),
.song-table td:nth-child(2) {
  width: 14%;
}

.song-table th:nth-child(3),
.song-table td:nth-child(3) {
  width: 10%;
}

.song-table th:nth-child(4),
.song-table td:nth-child(4) {
  width: 14%;
}

.song-table th:nth-child(5),
.song-table td:nth-child(5) {
  width: 17%;
}

.song-table th {
  position: sticky;
  z-index: 2;
  top: 0;
  background: color-mix(in srgb, var(--song-bg) 94%, transparent);
  color: var(--song-muted);
  font-size: 12px;
  font-weight: 600;
  backdrop-filter: blur(12px);
}

.song-table tbody tr:last-child td {
  border-bottom: 0;
}

.song-table tbody tr {
  transition: background-color 150ms ease;
}

.song-table tbody tr:hover {
  background: var(--song-bg-hover);
}

.song-table tbody tr.is-singing {
  box-shadow: inset 3px 0 var(--vtsuru-success, #22c55e);
}

.song-table tbody tr.is-queued {
  box-shadow: inset 3px 0 var(--vtsuru-warning, #f59e0b);
}

.sort-heading {
  display: inline-flex;
  align-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
  gap: 3px;
}

.sort-heading .n-icon {
  color: var(--song-accent);
}

.title-cell {
  min-width: 0;
}

.title-content {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.song-title-button {
  flex: 1;
  min-width: 0;
  padding: 0;
  overflow: hidden;
  border: 0;
  background: transparent;
  color: var(--song-fg);
  font: inherit;
  font-weight: 650;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.song-title-button:not(:disabled):hover {
  color: var(--song-accent);
}

.song-title-button:disabled {
  cursor: default;
}

.status {
  flex: 0 0 auto;
  padding: 2px 6px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  line-height: 1.4;
}

.status.singing {
  background: color-mix(in srgb, var(--vtsuru-success, #22c55e) 16%, transparent);
  color: var(--vtsuru-success, #16a34a);
}

.status.queued {
  background: color-mix(in srgb, var(--vtsuru-warning, #f59e0b) 16%, transparent);
  color: var(--vtsuru-warning, #d97706);
}

.inline-list,
.tag-list {
  display: flex;
  min-width: 0;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}

.song-tag,
.request-tag {
  font-weight: 600;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, currentColor 16%, transparent);
}

.song-tag {
  color: var(--song-muted) !important;
  background: color-mix(in srgb, var(--song-accent) 9%, var(--song-bg)) !important;
  transition:
    color 150ms ease,
    background-color 150ms ease,
    transform 150ms ease;
}

.song-tag:hover,
.song-tag.active {
  color: var(--vtsuru-page-primary-readable, var(--song-accent)) !important;
  background: color-mix(in srgb, var(--song-accent) 22%, var(--song-bg)) !important;
  transform: translateY(-1px);
}

.inline-list button {
  max-width: 100%;
  padding: 0;
  overflow: hidden;
  border: 0;
  background: transparent;
  color: var(--song-muted);
  font: inherit;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.inline-list button:hover,
.inline-list button.active {
  color: var(--song-accent);
}

.muted {
  color: var(--song-subtle);
}

.cell-label {
  display: none;
}

@media (max-width: 980px) {
  .filter-grid {
    grid-template-columns: minmax(220px, 2fr) repeat(2, minmax(120px, 1fr));
  }

  .profile-panel {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .profile-links {
    grid-column: 1 / -1;
    max-width: none;
    justify-content: flex-start;
  }
}

@media (max-width: 640px) {
  .traditional-song-list {
    padding: 0;
    background-image: none !important;
  }

  .traditional-song-list.has-background::before {
    display: none;
  }

  .content-frame {
    gap: 10px;
  }

  .profile-panel,
  .song-panel,
  .long-description {
    border-radius: var(--vtsuru-page-radius, 8px);
  }

  .profile-panel {
    grid-template-columns: 52px minmax(0, 1fr);
    padding: 14px;
    gap: 11px;
  }

  .profile-avatar {
    width: 52px;
    height: 52px;
  }

  .profile-copy h1 {
    font-size: 20px;
  }

  .profile-summary {
    margin-top: 4px;
    font-size: 13px;
  }

  .profile-links {
    grid-column: 1 / -1;
  }

  .long-description {
    padding: 12px 14px;
    font-size: 13px;
  }

  .song-panel {
    padding: 12px;
  }

  .filter-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .search-input,
  .sort-control {
    grid-column: 1 / -1;
  }

  .result-toolbar {
    padding: 10px 0;
  }

  .song-table-shell,
  .song-table-shell.is-fixed {
    --song-table-max-height: none;

    border: 0;
    background: transparent;
  }

  .song-table,
  .song-table tbody {
    display: block;
    width: 100%;
  }

  .song-table thead {
    display: none;
  }

  .song-table tbody {
    display: grid;
    gap: 8px;
  }

  .song-table tbody tr {
    display: grid;
    width: 100%;
    min-width: 0;
    padding: 12px;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--song-border) 72%, transparent);
    border-radius: var(--vtsuru-page-radius, 8px);
    background: color-mix(in srgb, var(--song-bg) 92%, transparent);
    gap: 9px;
  }

  .song-table tbody tr.is-singing,
  .song-table tbody tr.is-queued {
    padding-left: 14px;
  }

  .song-table th,
  .song-table td,
  .song-table th:first-child,
  .song-table td:first-child,
  .song-table th:nth-child(2),
  .song-table td:nth-child(2),
  .song-table th:nth-child(3),
  .song-table td:nth-child(3),
  .song-table th:nth-child(4),
  .song-table td:nth-child(4),
  .song-table th:nth-child(5),
  .song-table td:nth-child(5),
  .song-table th:nth-child(6),
  .song-table td:nth-child(6) {
    display: flex;
    width: 100%;
    min-width: 0;
    align-items: flex-start;
    padding: 0;
    border: 0;
    gap: 10px;
  }

  .title-content {
    align-items: center !important;
    padding-bottom: 3px !important;
  }

  .song-title-button {
    flex: 1;
    font-size: 15px;
  }

  .cell-label {
    display: block;
    width: 58px;
    flex: 0 0 58px;
    color: var(--song-subtle);
    font-size: 12px;
  }

  .inline-list,
  .tag-list,
  .song-table td > :last-child {
    min-width: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .profile-icon-link,
  .custom-link,
  .song-table tbody tr {
    transition: none;
  }
}
</style>
