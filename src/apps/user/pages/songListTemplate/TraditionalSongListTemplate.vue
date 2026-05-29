<script setup lang="ts">
import type { VNode } from 'vue'
import type { SongRequestOption, SongsInfo } from '@/api/api-models'
import type { SongListConfigTypeWithConfig } from '@/shared/types/TemplateTypes'
import type { ExtractConfigData } from '@/shared/types/VTsuruConfigTypes'
import { ArrowCounterclockwise20Filled, ArrowSortDown20Filled, ArrowSortUp20Filled, SquareArrowForward24Filled } from '@vicons/fluent'
import { NButton, NFlex, NIcon, NInput, NInputGroup, NInputGroupLabel, NSelect, NTag, NTooltip } from 'naive-ui';
import { computed, h, ref, watch } from 'vue'
import { SongFrom } from '@/api/api-models'
import { useAccount } from '@/api/account'
import { defineTemplateConfig } from '@/shared/types/VTsuruConfigTypes'
import { useBiliAuth } from '@/store/useBiliAuth'
import bilibili from '@/svgs/bilibili.svg'
import douyin from '@/svgs/douyin.svg'
import FiveSingIcon from '@/svgs/fivesing.svg'
import neteaseMusic from '@/svgs/neteaseMusic.svg'
import qqMusic from '@/svgs/qqMusic.svg'
import { isDarkMode } from '@/shared/utils'
import { getSongRequestConfirmText, getSongRequestTooltip } from './utils/songRequestUtils'
import { useLiveRequestStatus } from './utils/useLiveRequestStatus'

// Interface Tab - can be reused for both language and tag buttons
interface FilterButton {
  id: number
  name: string
}

const props = defineProps<SongListConfigTypeWithConfig<TraditionalConfigType>>()
const emits = defineEmits(['requestSong'])
defineExpose({ Config, DefaultConfig })
const isHovering = ref(false)
const accountInfo = useAccount()
const biliAuth = useBiliAuth()
const requestAuthState = computed(() => ({
  isLoggedIn: !!accountInfo.value.id,
  isBiliAuthed: biliAuth.isAuthed,
}))

const { singing: singingSongKeySet, queued: queuedSongKeySet } = useLiveRequestStatus(() => props.liveRequestActive)

// --- State for Filters ---
const selectedLanguage = ref<string | undefined>()
const selectedTag = ref<string | undefined>() // Renamed from activeTab for clarity
const searchQuery = ref<string>('')
const selectedArtist = ref<string | null>(null)
// 添加点歌条件筛选状态
const selectedOption = ref<string | undefined>()

// --- New: Sorting State ---
type SortKey = 'name' | 'author' | 'language' | 'tags' | 'options' | 'description' | null
const sortKey = ref<SortKey>(null) // 当前排序列
const sortOrder = ref<'asc' | 'desc'>('asc') // 当前排序顺序

const optionFilters: Record<string, (song: SongsInfo) => boolean> = {
  未设定: song => !song.options,
  舰长: song => song.options?.needJianzhang === true,
  提督: song => song.options?.needTidu === true,
  总督: song => song.options?.needZongdu === true,
  粉丝牌: song => (song.options?.fanMedalMinLevel ?? 0) > 0,
  SC: song => (song.options?.scMinPrice ?? 0) > 0,
}

// --- Computed Properties for Filter Buttons ---

// Extract unique languages
const allUniqueLanguages = computed<string[]>(() => {
  const languages = new Set<string>()

  // 添加"未设定"语言选项
  languages.add('未设定')

  props.data?.forEach((song) => {
    song.language?.forEach((lang) => {
      if (lang?.trim()) {
        languages.add(lang.trim())
      }
    })
  })
  return Array.from(languages).sort()
})

// Create structure for language buttons
const languageButtons = computed<FilterButton[]>(() =>
  allUniqueLanguages.value.map((lang, index) => ({ id: index, name: lang })),
)

// Extract unique tags (similar to original 'tabs' logic)
const allUniqueTags = computed<string[]>(() => {
  const tags = new Set<string>()

  // 添加"未设定"标签选项
  tags.add('未设定')

  props.data?.forEach((song) => {
    song.tags?.forEach((tag) => {
      if (tag?.trim()) {
        tags.add(tag.trim())
      }
    })
  })
  return Array.from(tags).sort()
})

// Create structure for tag buttons (reuse FilterButton interface)
const tagButtons = computed<FilterButton[]>(() =>
  allUniqueTags.value.map((tag, index) => ({ id: index, name: tag })),
)

// --- 添加点歌条件筛选按钮 ---
// 提取所有唯一的点歌条件类型
const allOptionTypes = computed<string[]>(() => Object.keys(optionFilters))

// 创建点歌条件筛选按钮
const optionButtons = computed<FilterButton[]>(() =>
  allOptionTypes.value.map((option, index) => ({ id: index, name: option })),
)

// --- Computed Properties for Data ---

// Get unique artists for the dropdown (unchanged)
const allArtists = computed(() => {
  const artists = new Set<string>()
  props.data?.forEach((song) => {
    song.author?.forEach((author) => {
      if (author?.trim()) {
        artists.add(author.trim())
      }
    })
  })
  return Array.from(artists).sort()
})

// Format artists for NSelect options (unchanged)
const artistOptions = computed(() => {
  return allArtists.value.map(artist => ({ label: artist, value: artist }))
})

const filteredAndSortedSongs = computed(() => {
  const lowerSearch = searchQuery.value.trim().toLowerCase()
  const songs = (props.data ?? []).filter((song) => {
    return matchesArrayFilter(song.language, selectedLanguage.value)
      && matchesArrayFilter(song.tags, selectedTag.value)
      && (!selectedArtist.value || song.author?.includes(selectedArtist.value))
      && (!selectedOption.value || optionFilters[selectedOption.value]?.(song))
      && (!lowerSearch || getSearchText(song).includes(lowerSearch))
  })

  if (!sortKey.value) return songs

  const order = sortOrder.value === 'asc' ? 1 : -1
  return songs.toSorted((left, right) => {
    const primary = compareSortValue(getSortValue(left, sortKey.value), getSortValue(right, sortKey.value))
    if (primary !== 0) return primary * order
    return compareSortValue(getStableSortValue(left), getStableSortValue(right))
  })
})

function matchesArrayFilter(values: string[] | undefined, selected: string | undefined) {
  if (!selected) return true
  if (selected === '未设定') return !values?.length
  return values?.includes(selected) ?? false
}

function getSearchText(song: SongsInfo) {
  return [
    song.name,
    song.author?.join(' '),
    song.language?.join(' '),
    song.tags?.join(' '),
    song.description,
  ].filter(Boolean).join(' ').toLowerCase()
}

function getSortValue(song: SongsInfo, key: Exclude<SortKey, null>) {
  if (key === 'options') return song.options ? 1 : 0
  const value = song[key]
  if (Array.isArray(value)) return value.join('').toLowerCase()
  return typeof value === 'string' ? value.toLowerCase() : value ?? ''
}

function getStableSortValue(song: SongsInfo) {
  return song.id ?? `${song.name}-${song.author?.join('/') ?? ''}`
}

function compareSortValue(left: string | number, right: string | number) {
  return String(left).localeCompare(String(right), undefined, { numeric: true })
}

// --- Methods ---

// Select/Deselect Language
function selectLanguage(langName: string) {
  if (langName === selectedLanguage.value) {
    selectedLanguage.value = undefined // Clear filter if clicking the active one
  } else {
    selectedLanguage.value = langName
  }
}

// Select/Deselect Tag
function selectTag(tagName: string) {
  if (tagName === selectedTag.value) {
    selectedTag.value = undefined // Clear filter if clicking the active one
  } else {
    selectedTag.value = tagName
  }
}

// 新增: 选择/取消选择点歌条件
function selectOption(optionName: string) {
  if (optionName === selectedOption.value) {
    selectedOption.value = undefined // 点击已激活的按钮则取消筛选
  } else {
    selectedOption.value = optionName
  }
}

// Select Artist (from table click, updated to allow deselect)
function selectArtistFromTable(artist: string) {
  if (selectedArtist.value === artist) {
    selectedArtist.value = null // Deselect if clicking the already selected artist
  } else {
    selectedArtist.value = artist // Select the new artist
  }
}

// Select Language (from table click, allows deselect)
function selectLanguageFromTable(lang: string) {
  if (selectedLanguage.value === lang) {
    selectedLanguage.value = undefined // Use undefined based on existing filter logic
  } else {
    selectedLanguage.value = lang
  }
}

// --- New: Clear All Filters ---
function clearFilters() {
  selectedLanguage.value = undefined
  selectedTag.value = undefined
  selectedArtist.value = null // Reset NSelect value
  selectedOption.value = undefined // 清除点歌条件筛选
  searchQuery.value = ''
}

// --- Updated Sorting Method ---
function handleSort(key: SortKey) {
  if (sortKey.value === key) {
    // Cycle through asc -> desc -> null (clear sort)
    if (sortOrder.value === 'asc') {
      sortOrder.value = 'desc'
    } else {
      // If already desc, clear the sort
      sortKey.value = null
      // Optional: Reset sortOrder, though it doesn't matter when sortKey is null
      // sortOrder.value = 'asc';
    }
  } else {
    // Set new key and default to ascending order
    sortKey.value = key
    sortOrder.value = 'asc'
  }
}

// --- Updated Helper function for Sort Icons ---
function getSortIcon(key: SortKey) {
  if (sortKey.value !== key) {
    // Show inactive sort icon (down arrow as placeholder)
    return h(NIcon, { component: ArrowSortDown20Filled, style: { opacity: 0.3, marginLeft: '4px', verticalAlign: 'middle' } })
  }
  // Show active sort icon (up or down)
  return h(NIcon, { component: sortOrder.value === 'asc' ? ArrowSortUp20Filled : ArrowSortDown20Filled, style: { marginLeft: '4px', verticalAlign: 'middle' } })
  // Note: We don't need a specific 'clear' icon here, as clicking 'desc' clears the sort and the icon reverts to inactive.
}

// Watcher for artist selection (unchanged, good practice)
watch(allArtists, (newArtists) => {
  if (selectedArtist.value && !newArtists.includes(selectedArtist.value)) {
    selectedArtist.value = null
  }
})

function randomOrder() {
  const songsToChooseFrom = filteredAndSortedSongs.value.length > 0 ? filteredAndSortedSongs.value : props.data ?? []
  if (songsToChooseFrom.length === 0) {
    window.$message?.warning('歌单为空或当前筛选无结果，无法随机点歌')
    return
  }
  const song = songsToChooseFrom[Math.floor(Math.random() * songsToChooseFrom.length)]
  window.$modal.create({
    preset: 'dialog',
    type: 'success',
    title: '随机点歌',
    content: `你抽到的歌曲是: ${song.name}, 来自 ${song.author?.join('/')}`,
    positiveText: '点歌',
    negativeText: '算了',
    onPositiveClick: () => {
      emits('requestSong', song)
    },
  })
}

function onSongClick(song: SongsInfo) {
  const tooltip = getSongRequestTooltip(song, props.liveRequestSettings, requestAuthState.value)
  const confirmText = getSongRequestConfirmText(song)
  window.$modal.create({
    preset: 'dialog',
    title: '点歌',
    content: `${confirmText}${tooltip !== '点歌' ? `\n${tooltip}` : ''}`,
    positiveText: '点歌',
    negativeText: '算了',
    onPositiveClick: () => {
      emits('requestSong', song)
    },
  })
}

// GetPlayButton function remains the same
function GetPlayButton(song: SongsInfo) {
  // ... (GetPlayButton function implementation - unchanged) ...
  switch (song.from) {
    case SongFrom.FiveSing: {
      return h(NTooltip, null, {
        trigger: () =>
          h(
            h(
              NButton,
              {
                size: 'small',
                color: '#00BBB3',
                text: true,
                onClick: (e) => {
                  e.stopPropagation() // Prevent row click
                  window.open(`http://5sing.kugou.com/bz/${song.id}.html`)
                },
              },
              {
                icon: () => h(FiveSingIcon, { class: 'svg-icon fivesing' }),
              },
            ),
          ),
        default: () => '在5sing打开',
      })
    }
    case SongFrom.Netease:
      return h(NTooltip, null, {
        trigger: () =>
          h(
            NButton,
            {
              size: 'small',
              color: '#C20C0C',
              text: true,
              onClick: (e) => {
                e.stopPropagation() // Prevent row click
                window.open(`https://music.163.com/#/song?id=${song.id}`)
              },
            },
            {
              icon: () => h(neteaseMusic, { class: 'svg-icon netease' }),
            },
          ),
        default: () => '在网易云打开',
      })
    case SongFrom.Custom:
      return song.url
        ? h(NTooltip, null, {
            trigger: () =>
              h(
                NButton,
                {
                  size: 'small',
                  color: '#6b95bd',
                  text: true,
                  onClick: (e) => {
                    e.stopPropagation() // Prevent row click
                    window.open(song.url)
                  },
                },
                {
                  icon: () => h(NIcon, { component: SquareArrowForward24Filled }),
                },
              ),
            default: () => '打开链接',
          })
        : null
  }
}

// --- New: Helper function for Song Request Options ---
function getOptionDisplay(options?: SongRequestOption) {
  if (!options) {
    // 直接返回空元素，不显示"无特殊要求"
    return h('span', {})
  }

  const conditions: VNode[] = []

  if (options.needJianzhang) {
    conditions.push(h(NTag, { size: 'small', type: 'info', style: { marginRight: '4px', marginBottom: '2px' } }, () => '舰长'))
  }
  if (options.needTidu) {
    conditions.push(h(NTag, { size: 'small', type: 'warning', style: { marginRight: '4px', marginBottom: '2px' } }, () => '提督'))
  }
  if (options.needZongdu) {
    conditions.push(h(NTag, { size: 'small', type: 'error', style: { marginRight: '4px', marginBottom: '2px' } }, () => '总督'))
  }
  if (options.fanMedalMinLevel && options.fanMedalMinLevel > 0) {
    conditions.push(h(NTag, { size: 'small', type: 'success', style: { marginRight: '4px', marginBottom: '2px' } }, () => `粉丝牌 ${options.fanMedalMinLevel}级`))
  }
  if (options.scMinPrice && options.scMinPrice > 0) {
    conditions.push(h(NTag, { size: 'small', color: { color: '#E85A4F', textColor: '#fff' }, style: { marginRight: '4px', marginBottom: '2px' } }, () => `SC ¥${options.scMinPrice}`))
  }

  if (conditions.length === 0) {
    // 如果没有条件，直接返回空元素，不显示"无特殊要求"
    return h('span', {})
  }

  // Use NFlex for better wrapping
  return h(NFlex, { size: 4, wrap: true, style: { gap: '4px' } }, () => conditions)
}
</script>

<script lang="ts">
// --- Config section remains the same ---
const tempLinks = ref<{ name: string, url: string }>({
  name: '',
  url: '',
})

export type TraditionalConfigType = ExtractConfigData<typeof Config>
export const DefaultConfig = {} as TraditionalConfigType
export const Config = defineTemplateConfig([
  {
    name: '背景',
    type: 'file',
    fileLimit: 1,
    key: 'backgroundFile',
    onUploaded: (file, config) => {
      console.log(file, config)
      config.backgroundFile = file
    },
  },
  {
    name: '固定歌曲列表高度',
    type: 'boolean',
    key: 'fixedHeight',
    default: true,
    description: '如果不勾选，歌曲较多时会整个页面滚动, 否则只会滚动歌单部分',
  },
  {
    name: '标题',
    type: 'string',
    key: 'title',
    default: '我的歌单',
  },
  {
    name: '简介',
    type: 'string',
    key: 'description',
  },
  {
    name: '详情页标题',
    type: 'string',
    key: 'detailTitle',
    placeholder: '链接页里头的',
  },
  {
    name: '详情页介绍',
    type: 'string',
    key: 'longDescription',
    placeholder: '链接页里头的',
    inputType: 'textarea',
  },
  {
    type: 'string',
    name: '网易云链接',
    key: 'neteaseLink',
    placeholder: '可为空, 需要以 http(s):// 开头',
  },
  {
    type: 'string',
    name: 'QQ音乐链接',
    key: 'qqMusicLink',
    placeholder: '可为空, 需要以 http(s):// 开头',
  },
  {
    type: 'string',
    name: '抖音链接',
    key: 'douyinLink',
    placeholder: '可为空, 需要以 http(s):// 开头',
  },
  {
    type: 'render',
    name: '自定义其他链接',
    key: 'links',
    default: [
      {
        name: '📺 哔哩哔哩',
        url: 'https://www.bilibili.com/',
      },
    ],
    render: (config) => {
      return h(
        NFlex,
        {
          justify: 'start',
          align: 'center',
          style: {
            width: '100%',
            padding: '10px 0',
            flexWrap: 'wrap', // Allow wrapping for smaller screens
          },
        },
        () => [
          config.links?.map((link: { name: string, url: string }) => {
            return h(
              NTag,
              {
                style: {
                  margin: '5px 5px 5px 0', // Adjust margin
                  cursor: 'pointer',
                },
                onClick: () => {
                  window.open(link.url, '_blank')
                },
                closable: true,
                onClose: () => {
                  config.links = config.links.filter((l: { name: string, url: string }) => l.name !== link.name)
                },
              },
              () => link.name,
            )
          }),
          h(NFlex, { style: { marginTop: '5px', flexGrow: 1, minWidth: '300px' }, align: 'center' }, () => [ // Wrap inputs and button
            h(NInputGroup, { size: 'small', style: { marginRight: '5px' } }, () => [
              h(NInputGroupLabel, { style: { width: 'auto' } }, () => '名称'), // Auto width
              h(NInput, {
                placeholder: '链接名称',
                value: tempLinks.value.name,
                onUpdateValue: (value) => {
                  tempLinks.value.name = value
                },
              }),
            ]),
            h(NInputGroup, { size: 'small', style: { marginRight: '5px' } }, () => [
              h(NInputGroupLabel, { style: { width: 'auto' } }, () => '地址'), // Auto width
              h(NInput, {
                placeholder: 'http(s)://...',
                value: tempLinks.value.url,
                onUpdateValue: (value) => {
                  tempLinks.value.url = value
                },
              }),
            ]),
            h(NButton, {
              type: 'primary',
              size: 'small',
              onClick: () => {
                if (tempLinks.value.name && tempLinks.value.url) { // Basic validation
                  config.links = config.links || []
                  config.links.push({ ...tempLinks.value }) // Push a copy
                  tempLinks.value = { // Reset
                    name: '',
                    url: '',
                  }
                } else {
                  window.$message?.warning('请输入链接名称和地址')
                }
              },
              disabled: !tempLinks.value.name || !tempLinks.value.url, // Disable if fields are empty
            }, () => '添加'),
          ]),

        ],
      )
    },
    // onUploaded seems irrelevant here, keep if needed elsewhere
    // onUploaded(data, config) {
    //   tempLinks.value = {
    //     name: '',
    //     url: '',
    //   };
    // },
  },
])
</script>

<template>
  <!-- 新增: 外部背景和模糊容器 -->
  <div
    class="song-list-background-wrapper"
    :style="{
      backgroundImage: props.config?.backgroundFile && props.config.backgroundFile.length > 0 ? `url(${props.config.backgroundFile[0].path})` : 'none',
    }"
  >
    <!-- 原始: 滚动和内容容器 -->
    <div class="song-list-template">
      <div class="profile-card-container">
        <!-- Profile Hover Area (unchanged) -->
        <div
          class="profile-hover-area"
          :class="{ 'is-hovering': isHovering }"
          @mouseenter="isHovering = true"
          @mouseleave="isHovering = false"
        >
          <!-- Avatar -->
          <img
            :src="`https://fetch.vtsuru.live/${props.userInfo?.streamerInfo?.faceUrl}@256w_256h`"
            alt="Avatar"
            class="profile-avatar"
            referrerpolicy="no-referrer"
          >

          <!-- Basic Info (Always Visible) -->
          <div class="profile-info">
            <h2 class="profile-name">
              {{ props.config?.title ?? `${props.userInfo?.name} 的歌单` }}
            </h2>
            <p class="profile-description">
              {{ props.config?.description }}
            </p>
            <span class="profile-extra-info">（点击歌名进行点歌）</span>
          </div>

          <!-- Social Links (Visible on Hover) -->
          <div class="social-links">
            <p class="social-links-title">
              关于我
            </p>
            <p class="social-links-subtitle">
              {{ props.config?.longDescription ?? '暂时没有填写介绍' }}
            </p>
            <div class="social-icons-bar">
              <!-- Add actual icons here -->
              <a
                v-if="props.userInfo?.biliId"
                :href="`https://space.bilibili.com/${props.userInfo?.biliId}`"
                class="icon icon-bilibili"
                title="Bilibili 链接"
                target="_blank"
              >
                <bilibili />
              </a>
              <a
                v-if="props.config?.douyinLink"
                :href="props.config?.douyinLink"
                title="抖音链接"
                target="_blank"
                class="icon"
              >
                <douyin />
              </a>
              <a
                v-if="props.config?.neteaseLink"
                :href="props.config?.neteaseLink"
                title="网易云链接"
                target="_blank"
                class="icon"
              >
                <neteaseMusic />
              </a>
              <a
                v-if="props.config?.qqMusicLink"
                :href="props.config?.qqMusicLink"
                title="QQ音乐链接"
                target="_blank"
                class="icon"
              >
                <qqMusic />
              </a>
            </div>
            <div
              v-if="props.config?.links && props.config.links.length > 0"
              class="social-grid"
            >
              <a
                v-for="link in props.config?.links"
                :key="link.name"
                :href="link.url"
                target="_blank"
                class="social-link"
              >
                <span>{{ link.name }}</span>
                <span class="arrow">></span>
              </a>
            </div>
          </div>
        </div>

        <!-- Song List Content Area -->
        <div class="song-list-container">
          <!-- Language Filter Buttons -->
          <div
            v-if="languageButtons.length > 0"
            class="filter-button-group language-filters"
          >
            <span class="filter-label">语言:</span>
            <button
              v-for="lang in languageButtons"
              :key="lang.id"
              :class="{ active: selectedLanguage === lang.name }"
              class="filter-button"
              @click="selectLanguage(lang.name)"
            >
              {{ lang.name }}
            </button>
          </div>

          <!-- Tag Filter Buttons (Replaces original tabs) -->
          <div
            v-if="tagButtons.length > 0"
            class="filter-button-group tag-filters"
          >
            <span class="filter-label">标签:</span>
            <button
              v-for="tag in tagButtons"
              :key="tag.id"
              :class="{ active: selectedTag === tag.name }"
              class="filter-button"
              @click="selectTag(tag.name)"
            >
              {{ tag.name }}
            </button>
          </div>

          <!-- 新增: 点歌条件筛选按钮 -->
          <div
            v-if="optionButtons.length > 0"
            class="filter-button-group option-filters"
          >
            <span class="filter-label">点歌条件:</span>
            <button
              v-for="option in optionButtons"
              :key="option.id"
              :class="{ active: selectedOption === option.name }"
              class="filter-button"
              @click="selectOption(option.name)"
            >
              {{ option.name }}
            </button>
          </div>

          <!-- Divider -->
          <div class="filter-divider" />

          <!-- Filter/Search Bar Row -->
          <NFlex
            class="song-list-filter"
            justify="space-between"
            align="center"
          >
            <!-- Left side filters: Artist, Search, Clear -->
            <NFlex
              align="center"
              :wrap="true"
              style="flex-grow: 1;"
            >
              <!-- Artist Filter Dropdown -->
              <NSelect
                v-model:value="selectedArtist"
                :options="artistOptions"
                placeholder="筛选歌手"
                clearable
                style="max-width: 160px; margin-right: 10px; margin-bottom: 5px;"
                size="small"
              />

              <!-- Search Input -->
              <div
                class="search-wrapper"
                style="margin-right: 10px; margin-bottom: 5px;"
              >
                <span class="search-icon">🔍</span>
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="筛选歌名/歌手/语言/标签/备注"
                  class="filter-input"
                  style="min-width: 220px;"
                >
              </div>

              <!-- Clear Filters Button -->
              <NButton
                size="small"
                class="clear-button"
                ghost
                :disabled="!selectedLanguage && !selectedTag && !selectedArtist && !searchQuery"
                @click="clearFilters"
              >
                <template #icon>
                  <NIcon :component="ArrowCounterclockwise20Filled" />
                </template>
                清空筛选
              </NButton>
            </NFlex>

            <!-- Right side: Random Button -->
            <NButton
              class="refresh-button"
              size="small"
              ghost
              @click="randomOrder"
            >
              随机点歌
            </NButton>
          </NFlex>

          <!-- Song Table -->
          <NScrollbar
            class="song-table-wrapper"
            trigger="none"
            :style="{ height: props.config?.fixedHeight ? '55vh' : 'none' }"
          >
            <table class="song-list-table">
              <thead>
                <tr>
                  <th
                    style="cursor: pointer;"
                    @click="handleSort('name')"
                  >
                    歌名 <component :is="getSortIcon('name')" />
                  </th>
                  <th
                    style="cursor: pointer;"
                    @click="handleSort('author')"
                  >
                    歌手 <component :is="getSortIcon('author')" />
                  </th>
                  <th
                    style="cursor: pointer;"
                    @click="handleSort('language')"
                  >
                    语言 <component :is="getSortIcon('language')" />
                  </th>
                  <th
                    style="cursor: pointer;"
                    @click="handleSort('tags')"
                  >
                    标签 <component :is="getSortIcon('tags')" />
                  </th>
                  <th
                    style="cursor: pointer;"
                    @click="handleSort('options')"
                  >
                    点歌条件 <component :is="getSortIcon('options')" />
                  </th>
                  <th
                    style="cursor: pointer;"
                    @click="handleSort('description')"
                  >
                    备注 <component :is="getSortIcon('description')" />
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!props.data || props.data.length === 0">
                  <td
                    colspan="6"
                    class="no-results"
                  >
                    歌单里还没有歌曲哦~
                  </td>
                </tr>
                <tr v-else-if="filteredAndSortedSongs.length === 0">
                  <td
                    colspan="6"
                    class="no-results"
                  >
                    当前筛选条件下暂无匹配歌曲
                  </td>
                </tr>
                <tr
                  v-for="song in filteredAndSortedSongs"
                  :key="song.key || (`${song.name}-${song.author?.join('/')}`)"
                  :style="{
                    textShadow: isDarkMode ? '0px 1px 2px rgba(0, 0, 0, 0.4)' : '0px 1px 2px rgba(255, 255, 255, 0.4)',
                  }"
                  class="song-row"
                >
                  <td>
                    <span class="song-name">
                      <span
                        v-if="singingSongKeySet.has(song.key)"
                        class="status-badge singing"
                      >演唱中</span>
                      <span
                        v-else-if="queuedSongKeySet.has(song.key)"
                        class="status-badge queued"
                      >排队中</span>
                      <component :is="GetPlayButton(song)" />
                      <NTooltip>
                        <template #trigger>
                          <span
                            style="cursor: pointer;"
                            @click="onSongClick(song)"
                          >
                            {{ song.name }}
                          </span>
                        </template>
                        {{ getSongRequestTooltip(song, props.liveRequestSettings, requestAuthState) }}
                      </NTooltip>
                    </span>
                  </td>
                  <td>
                    <!-- Updated Artist Cell (Clickable) -->
                    <span v-if="song.author && song.author.length > 0">
                      <span
                        v-for="(artist, index) in song.author"
                        :key="artist"
                      >
                        <span
                          class="artist-link"
                          :class="{ 'selected-artist': selectedArtist === artist }"
                          :title="`筛选: ${artist}`"
                          @click.stop="selectArtistFromTable(artist)"
                        >
                          {{ artist }}
                        </span>
                        <!-- Add separator only if not the last artist -->
                        <span v-if="index < song.author.length - 1"> / </span>
                      </span>
                    </span>
                    <span v-else>未知</span>
                  </td>
                  <td>
                    <span v-if="song.language && song.language.length > 0">
                      <span
                        v-for="(lang, index) in song.language"
                        :key="lang"
                      >
                        <span
                          class="language-link"
                          :class="{ 'selected-language': selectedLanguage === lang }"
                          :title="`筛选: ${lang}`"
                          @click.stop="selectLanguageFromTable(lang)"
                        >
                          {{ lang }}
                        </span>
                        <!-- Add separator only if not the last language -->
                        <span v-if="index < song.language.length - 1">, </span>
                      </span>
                    </span>
                    <!-- 移除了 "未知" 占位文本 -->
                  </td>
                  <td>
                    <NFlex
                      v-if="song.tags && song.tags.length > 0"
                      :size="4"
                      :wrap="true"
                      style="gap: 4px;"
                    >
                      <!-- Use NFlex for tag wrapping -->
                      <NTag
                        v-for="tag in song.tags"
                        :key="tag"
                        size="small"
                        checkable
                        :checked="selectedTag === tag"
                        @update:checked="selectTag(tag)"
                      >
                        {{ tag }}
                      </NTag>
                    </NFlex>
                    <!-- 移除了 "无标签" 占位文本 -->
                  </td>
                  <td>
                    <component :is="getOptionDisplay(song.options)" />
                  </td>
                  <td>{{ song.description }}</td>
                </tr>
              </tbody>
            </table>
          </NScrollbar>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Filter Button Groups */
.filter-button-group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.filter-label {
  font-size: 0.9em;
  margin-right: 5px;
  font-weight: 500;
  color: #555555;
  white-space: nowrap;
}

html.dark .filter-label {
  color: var(--text-color-2);
}

.filter-button {
  padding: 4px 12px;
  border: 1px solid transparent;
  border-radius: 15px;
  background-color: rgba(0, 0, 0, 0.04);
  font-size: 0.85em;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
  color: #555555;
  line-height: 1.4;
}

html.dark .filter-button {
  background-color: var(--button-color-2);
  color: var(--text-color-2);
}

.filter-button.active {
  background-color: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
  font-weight: bold;
}

.filter-button:hover:not(.active) {
  background-color: rgba(0, 0, 0, 0.08);
  border-color: rgba(0, 0, 0, 0.1);
}

html.dark .filter-button:hover:not(.active) {
  background-color: var(--item-color-hover);
}

.filter-divider {
  height: 1px;
  background-color: rgba(0, 0, 0, 0.1);
  margin: 10px 0 15px 0;
}

html.dark .filter-divider {
  background-color: var(--border-color);
}

.song-list-filter {
  margin-bottom: 15px;
}

.search-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.9em;
  pointer-events: none;
  color: #aaaaaa;
}

html.dark .search-icon {
  color: var(--text-color-3);
}

.filter-input {
  height: 30px;
  box-sizing: border-box;
  padding: 6px 15px 6px 30px;
  border-radius: 15px;
  font-size: 0.9em;
  line-height: normal;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  border: 1px solid rgba(0, 0, 0, 0.15);
  background-color: rgba(255, 255, 255, 0.8);
  color: #333333;
}

html.dark .filter-input {
  border-color: var(--border-color);
  background-color: var(--input-color);
  color: var(--text-color-1);
}

.filter-input::placeholder {
  color: #aaaaaa;
}

html.dark .filter-input::placeholder {
  color: var(--text-color-3);
}

.filter-input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px var(--primary-color-a3);
}

/* Naive UI Select Styling */
:deep(.song-list-filter .n-select .n-base-selection) {
  --n-height: 30px !important;
  --n-padding-single: 0 26px 0 10px !important;
  border-radius: 15px !important;
}

:deep(.song-list-filter .n-select .n-base-selection .n-base-selection-placeholder),
:deep(.song-list-filter .n-select .n-base-selection .n-base-selection-input) {
  height: 30px !important;
  line-height: 30px !important;
}

.clear-button {
  height: 30px;
  border-radius: 15px;
  font-size: 0.85em;
  line-height: 28px;
}

.refresh-button {
  height: 30px;
  border-radius: 15px;
  font-size: 0.9em;
  line-height: 28px;
  white-space: nowrap;
}

/* Structure Styles */
.song-list-background-wrapper {
  position: relative;
  height: calc(100vh - var(--vtsuru-header-height) - var(--vtsuru-content-padding) - var(--vtsuru-content-padding));
  border-radius: 8px;
  background-size: cover;
  background-position: center center;
  background-attachment: fixed;
  overflow: hidden;
}

.song-list-background-wrapper::before {
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  background-color: rgba(80, 80, 80, 0.1);
  border-radius: inherit;
  z-index: 1;
  pointer-events: none;
}

html.dark .song-list-background-wrapper::before {
  background-color: rgba(255, 255, 255, 0.05);
}

.song-list-template {
  height: 100%;
  overflow-y: auto;
  position: relative;
  z-index: 2;
  background: transparent !important;
  border-radius: inherit;
  min-width: 400px;
  
  &::-webkit-scrollbar { width: 8px; }
  &::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.05); border-radius: 4px; }
  &::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.2); border-radius: 4px; }
  &::-webkit-scrollbar-thumb:hover { background: rgba(0, 0, 0, 0.3); }
}

html.dark .song-list-template {
  &::-webkit-scrollbar-track { background: var(--scrollbar-color); }
  &::-webkit-scrollbar-thumb { background: var(--scrollbar-color-hover); }
  &::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-color-active); }
}

.profile-card-container {
  position: relative;
  padding: 20px;
  font-family: sans-serif;
  color: #333333;
  min-height: 100%;
  box-sizing: border-box;
}

html.dark .profile-card-container {
  color: var(--text-color-1);
}

/* Profile Hover Area */
.profile-hover-area {
  position: relative; display: flex; align-items: flex-start;
  width: fit-content; min-width: 300px; margin: 0 auto 20px auto;
  padding: 15px; border-radius: 15px;
  transition: transform 0.4s ease-in-out; z-index: 100;
  box-shadow: var(--box-shadow-1);
  background-color: rgba(255, 255, 255, 0.65);
  border: 1px solid rgba(0, 0, 0, 0.08);
}

html.dark .profile-hover-area {
  background-color: rgba(40, 40, 40, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.profile-avatar {
  width: 100px; height: 100px; border-radius: 50%;
  border: 3px solid rgba(255, 255, 255, 0.8);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
  margin-right: 20px; position: relative; z-index: 10;
  transition: transform 0.4s ease-in-out; cursor: pointer; flex-shrink: 0;
}

html.dark .profile-avatar {
  border-color: rgba(255, 255, 255, 0.6);
}

.profile-info {
  flex-grow: 1; min-width: 180px; text-align: left;
}

.profile-name {
  margin-top: 5px; margin-bottom: 8px; font-size: 1.8em; font-weight: bold;
  color: #1a1a1a;
}

html.dark .profile-name {
  color: var(--text-color-base);
}

.profile-description {
  margin-bottom: 10px; font-size: 0.95em; line-height: 1.4;
  color: #4d4d4d;
}

html.dark .profile-description {
  color: var(--text-color-2);
}

.profile-extra-info {
  font-size: 0.8em; color: #666666;
}

html.dark .profile-extra-info {
  color: var(--text-color-3);
}

.social-links {
  position: absolute; top: 5px; left: calc(100px + 20px + 10px);
  width: 380px; padding: 15px 20px; border-radius: 10px;
  box-shadow: var(--box-shadow-2); z-index: 20;
  background-color: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(0, 0, 0, 0.1);
  opacity: 0; visibility: hidden; transform: translateX(20px);
  transition: opacity 0.4s ease-in-out, visibility 0.4s ease-in-out, transform 0.4s ease-in-out, left 0.4s ease-in-out;
}

html.dark .social-links {
  background-color: rgba(50, 50, 50, 0.85);
  border-color: rgba(255, 255, 255, 0.15);
}

.social-links-title {
  font-weight: bold;
  color: #4d4d4d;
}

.social-links-subtitle {
  white-space: pre-wrap;
  color: #4d4d4d;
}

html.dark .social-links-title,
html.dark .social-links-subtitle {
  color: var(--text-color-2);
}

.social-icons-bar {
  position: absolute; top: 15px; right: 20px; display: flex; gap: 8px;
}

.social-icons-bar .icon {
  display: inline-block; width: 24px; height: 24px; border-radius: 4px;
  font-size: 1em; cursor: pointer; color: #555555; transition: color 0.2s;
}

html.dark .social-icons-bar .icon {
  color: var(--text-color-2);
}

.social-icons-bar .icon:hover {
  color: var(--primary-color);
}

.social-icons-bar .icon svg {
  display: block;
  width: 100%;
  height: 100%;
  fill: currentColor;
}

.social-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px 15px;
  margin-top: 45px;
}

.social-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 8px;
  border-radius: 5px;
  font-size: 0.85em;
  text-decoration: none;
  color: #0066cc;
  background-color: rgba(0, 102, 204, 0.1);
  transition: background-color 0.2s ease, color 0.2s ease;
}

html.dark .social-link {
  color: var(--primary-color-light);
  background-color: rgba(var(--primary-color-rgb), 0.15);
  border: 1px solid rgba(122, 159, 197, 0.2);
}

.social-link:hover {
  background-color: rgba(0, 102, 204, 0.2);
}

html.dark .social-link:hover {
  background-color: rgba(var(--primary-color-rgb), 0.25);
}

.social-link span:first-child {
  margin-right: 5px;
}

.social-link .arrow {
  font-weight: bold;
  color: #aaaaaa;
}

html.dark .social-link .arrow {
  color: var(--text-color-3);
}

.profile-hover-area.is-hovering .profile-avatar {
  transform: translateX(-60px);
}

.profile-hover-area.is-hovering .social-links {
  opacity: 1;
  visibility: visible;
  transform: translateX(0);
  left: calc(100px - 60px + 15px);
}

/* Song List Container */
.song-list-container {
  padding: 15px 25px;
  border-radius: 15px;
  font-family: sans-serif;
  box-shadow: var(--box-shadow-1);
  background-color: rgba(255, 255, 255, 0.50);
  border: 1px solid rgba(0, 0, 0, 0.08);
}

html.dark .song-list-container {
  background-color: rgba(40, 40, 40, 0.75);
  border-color: rgba(255, 255, 255, 0.1);
}

/* Table Styles */
.song-table-wrapper {
  overflow-y: auto;
  border-radius: 8px;
  scroll-behavior: smooth;
}

.song-list-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9em;
  min-width: 600px;
}

.song-list-table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 10px 12px;
  text-align: left;
  font-weight: 600;
  background-color: rgba(245, 245, 245, 0.8);
  backdrop-filter: blur(2px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  color: #444444;
  user-select: none;
}

html.dark .song-list-table thead th {
  background-color: rgba(55, 55, 55, 0.85);
  border-bottom-color: var(--border-color);
  color: var(--text-color-2);
}

.song-list-table th:nth-child(1) { width: 22%; }
.song-list-table th:nth-child(2) { width: 15%; }
.song-list-table th:nth-child(3) { width: 10%; }
.song-list-table th:nth-child(4) { width: 13%; }
.song-list-table th:nth-child(5) { width: 15%; }
.song-list-table th:nth-child(6) { width: 25%; }

.song-list-table tbody tr {
  transition: background-color 0.15s ease;
}

.song-list-table tbody td {
  padding: 10px 12px;
  vertical-align: middle;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  color: #4d4d4d;
  word-break: break-word;
}

html.dark .song-list-table tbody td {
  border-bottom-color: var(--border-color);
  color: var(--text-color-2);
}

.song-list-table tbody tr:nth-child(even) {
  background-color: rgba(0, 0, 0, 0.02);
}

html.dark .song-list-table tbody tr:nth-child(even) {
  background-color: var(--item-color-striped);
}

.song-list-table tbody tr:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

html.dark .song-list-table tbody tr:hover {
  background-color: var(--item-color-hover);
}

.song-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  text-decoration: none;
  color: #2c2c2c;
}

html.dark .song-name {
  color: var(--text-color-1);
}

.artist-link {
  padding: 1px 0;
  cursor: pointer;
  text-decoration: none;
  color: var(--text-color-2);
  transition: color 0.2s ease, text-decoration 0.2s ease;
}

.artist-link:hover {
  text-decoration: underline;
}

.song-name :deep(.n-button .n-icon),
.song-name :deep(.n-button .svg-icon) {
  color: currentColor !important;
  fill: currentColor !important;
}

.svg-icon {
  display: inline-block;
  width: 1em;
  height: 1em;
  vertical-align: -0.15em;
  fill: currentColor;
  overflow: hidden;
}

.no-results td {
  padding: 30px 12px;
  text-align: center;
  font-style: italic;
  color: #999999;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  margin-right: 6px;
  flex-shrink: 0;
}
.status-badge.singing {
  background: rgba(245, 158, 11, 0.15);
  color: #d97706;
}
.status-badge.queued {
  background: rgba(34, 197, 94, 0.12);
  color: #16a34a;
}

html.dark .no-results td {
  color: var(--text-color-3);
}

.song-list-table td .n-tag {
  margin-bottom: 2px;
  margin-right: 4px;
}

/* Base style for clickable language */
.language-link {
  padding: 1px 0;
  cursor: pointer;
  text-decoration: none;
  color: var(--text-color-2);
  transition: color 0.2s ease, text-decoration 0.2s ease;
}

.language-link:hover {
  text-decoration: underline;
}

/* Selected Artist/Language Highlight */
.artist-link.selected-artist,
.language-link.selected-language {
  background-color: var(--primary-color-a4);
  border: 1px solid var(--primary-color-a6);
  font-weight: bold;
  padding: 1px 3px;
  border-radius: 4px;
  color: var(--primary-color-dark);
}

html.dark .artist-link.selected-artist,
html.dark .language-link.selected-language {
  background-color: var(--primary-color-a6);
  border: 1px solid var(--primary-color-a8);
  color: var(--primary-color-light);
}

</style>
