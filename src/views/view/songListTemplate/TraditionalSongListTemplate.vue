<script setup lang="ts">
import { computed, h, ref, watch } from 'vue';
import { getUserAvatarUrl, isDarkMode } from '@/Utils';
import { SongListConfigTypeWithConfig } from '@/data/TemplateTypes';
import { defineTemplateConfig, ExtractConfigData } from '@/data/VTsuruTypes';
import { FILE_BASE_URL } from '@/data/constants';
import { NButton, NFlex, NIcon, NInput, NInputGroup, NInputGroupLabel, NTag, NTooltip, NSelect } from 'naive-ui';
import bilibili from '@/svgs/bilibili.svg';
import neteaseMusic from '@/svgs/neteaseMusic.svg';
import qqMusic from '@/svgs/qqMusic.svg';
import douyin from '@/svgs/douyin.svg';
import { SongFrom, SongsInfo } from '@/api/api-models';
import FiveSingIcon from '@/svgs/fivesing.svg';
import { SquareArrowForward24Filled, ArrowCounterclockwise20Filled } from '@vicons/fluent'; // Import clear icon

// Interface Tab - can be reused for both language and tag buttons
interface FilterButton {
  id: number;
  name: string;
}

const props = defineProps<SongListConfigTypeWithConfig<TraditionalConfigType>>();
defineExpose({ Config, DefaultConfig });
const emits = defineEmits(['requestSong']);

const isHovering = ref(false);

// --- State for Filters ---
const selectedLanguage = ref<string | undefined>();
const selectedTag = ref<string | undefined>(); // Renamed from activeTab for clarity
const searchQuery = ref<string>('');
const selectedArtist = ref<string | null>(null);

// --- Computed Properties for Filter Buttons ---

// Extract unique languages
const allUniqueLanguages = computed<string[]>(() => {
  const languages = new Set<string>();
  props.data?.forEach(song => {
    song.language?.forEach(lang => {
      if (lang?.trim()) {
        languages.add(lang.trim());
      }
    });
  });
  return Array.from(languages).sort();
});

// Create structure for language buttons
const languageButtons = computed<FilterButton[]>(() =>
  allUniqueLanguages.value.map((lang, index) => ({ id: index, name: lang }))
);

// Extract unique tags (similar to original 'tabs' logic)
const allUniqueTags = computed<string[]>(() => {
  const tags = new Set<string>();
  props.data?.forEach(song => {
    song.tags?.forEach(tag => {
      if (tag?.trim()) {
        tags.add(tag.trim());
      }
    });
  });
  return Array.from(tags).sort();
});

// Create structure for tag buttons (reuse FilterButton interface)
const tagButtons = computed<FilterButton[]>(() =>
  allUniqueTags.value.map((tag, index) => ({ id: index, name: tag }))
);


// --- Computed Properties for Data ---

// Get unique artists for the dropdown (unchanged)
const allArtists = computed(() => {
  const artists = new Set<string>();
  props.data?.forEach(song => {
    song.author?.forEach(author => {
      if (author?.trim()) {
        artists.add(author.trim());
      }
    });
  });
  return Array.from(artists).sort();
});

// Format artists for NSelect options (unchanged)
const artistOptions = computed(() => {
  return allArtists.value.map(artist => ({ label: artist, value: artist }));
});

// --- Updated Filtered Songs Logic ---
const filteredSongs = computed(() => {
  let songs = props.data!;
  if (!songs) return [];

  // 1. Filter by Selected Language
  if (selectedLanguage.value) {
    songs = songs.filter(song => song.language?.includes(selectedLanguage.value!));
  }

  // 2. Filter by Selected Tag
  if (selectedTag.value) {
    songs = songs.filter(song => song.tags?.includes(selectedTag.value!));
  }

  // 3. Filter by Selected Artist
  if (selectedArtist.value) {
    songs = songs.filter(song => song.author?.includes(selectedArtist.value!));
  }

  // 4. Filter by Search Query (case-insensitive, including tags)
  if (searchQuery.value.trim()) {
    const lowerSearch = searchQuery.value.toLowerCase().trim();
    songs = songs.filter(song =>
      song.name.toLowerCase().includes(lowerSearch) ||
      song.author?.some(artist => artist.toLowerCase().includes(lowerSearch)) ||
      song.language?.some(lang => lang.toLowerCase().includes(lowerSearch)) ||
      song.tags?.some(tag => tag.toLowerCase().includes(lowerSearch)) || // Added tags to search
      song.description?.toLowerCase().includes(lowerSearch)
    );
  }

  return songs;
});

// --- Methods ---

// Select/Deselect Language
const selectLanguage = (langName: string) => {
  if (langName === selectedLanguage.value) {
    selectedLanguage.value = undefined; // Clear filter if clicking the active one
  } else {
    selectedLanguage.value = langName;
  }
};

// Select/Deselect Tag
const selectTag = (tagName: string) => {
  if (tagName === selectedTag.value) {
    selectedTag.value = undefined; // Clear filter if clicking the active one
  } else {
    selectedTag.value = tagName;
  }
};

// Select Artist (from table click, unchanged)
const selectArtistFromTable = (artist: string) => {
  selectedArtist.value = artist;
};

// --- New: Clear All Filters ---
const clearFilters = () => {
  selectedLanguage.value = undefined;
  selectedTag.value = undefined;
  selectedArtist.value = null; // Reset NSelect value
  searchQuery.value = '';
};


// Watcher for artist selection (unchanged, good practice)
watch(allArtists, (newArtists) => {
  if (selectedArtist.value && !newArtists.includes(selectedArtist.value)) {
    selectedArtist.value = null;
  }
});


const randomOrder = () => {
  const songsToChooseFrom = filteredSongs.value.length > 0 ? filteredSongs.value : props.data ?? [];
  if (songsToChooseFrom.length === 0) {
    window.$message?.warning('歌单为空或当前筛选无结果，无法随机点歌');
    return;
  }
  const song = songsToChooseFrom[Math.floor(Math.random() * songsToChooseFrom.length)];
  window.$modal.create({
    preset: 'dialog',
    type: 'success',
    title: '随机点歌',
    content: `你抽到的歌曲是: ${song.name}, 来自 ${song.author?.join('/')}`,
    positiveText: '点歌',
    negativeText: '算了',
    onPositiveClick: () => {
      emits('requestSong', song);
    },
  });
};

function onSongClick(song: SongsInfo) {
  window.$modal.create({
    preset: 'dialog',
    title: '点歌',
    content: `确定要点 ${song.name} 么`,
    positiveText: '点歌',
    negativeText: '算了',
    onPositiveClick: () => {
      emits('requestSong', song);
    },
  });
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
                    e.stopPropagation(); // Prevent row click
                    window.open(`http://5sing.kugou.com/bz/${song.id}.html`);
                  },
                },
                {
                  icon: () => h(FiveSingIcon, { class: 'svg-icon fivesing' }),
                },
              ),
            ),
          default: () => '在5sing打开',
        });
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
                  e.stopPropagation(); // Prevent row click
                  window.open(`https://music.163.com/#/song?id=${song.id}`);
                },
              },
              {
                icon: () => h(neteaseMusic, { class: 'svg-icon netease' }),
              },
            ),
          default: () => '在网易云打开',
        });
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
                    e.stopPropagation(); // Prevent row click
                    window.open(song.url);
                  },
                },
                {
                  icon: () => h(NIcon, { component: SquareArrowForward24Filled }),
                },
              ),
            default: () => '打开链接',
          })
          : null;
    }
}

</script>

<script lang="ts">
// --- Config section remains the same ---
const tempLinks = ref<{ name: string, url: string; }>({
  name: '',
  url: ''
});

export type TraditionalConfigType = ExtractConfigData<typeof Config>;
export const DefaultConfig = {} as TraditionalConfigType;
export const Config = defineTemplateConfig([
  {
    name: '背景',
    type: 'image',
    imageLimit: 1,
    key: 'background',
    onUploaded: (url, config) => {
      config.background = url;
    },
  },
  {
    name: '标题',
    type: 'string',
    key: 'title',
    default: '我的歌单'
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
    inputType: 'textarea'
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
      }
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
          config.links?.map((link: { name: string; url: string; }) => {
            return h(
              NTag,
              {
                style: {
                  margin: '5px 5px 5px 0', // Adjust margin
                  cursor: 'pointer',
                },
                onClick: () => {
                  window.open(link.url, '_blank');
                },
                closable: true,
                onClose: () => {
                  config.links = config.links.filter((l: { name: string; url: string; }) => l.name !== link.name);
                },
              },
              () => link.name
            );
          }),
          h(NFlex, { style: { marginTop: '5px', flexGrow: 1, minWidth: '300px' }, align:'center' }, () => [ // Wrap inputs and button
              h(NInputGroup, { size: 'small', style:{ marginRight: '5px'} }, () => [
                h(NInputGroupLabel, { style: { width: 'auto' } }, () => '名称'), // Auto width
                h(NInput, {
                  placeholder: '链接名称',
                  value: tempLinks.value.name,
                  onUpdateValue: (value) => {
                    tempLinks.value.name = value;
                  },
                }),
              ]),
              h(NInputGroup, { size: 'small', style:{ marginRight: '5px'} }, () => [
                h(NInputGroupLabel, { style: { width: 'auto' } }, () => '地址'), // Auto width
                h(NInput, {
                  placeholder: 'http(s)://...',
                  value: tempLinks.value.url,
                  onUpdateValue: (value) => {
                    tempLinks.value.url = value;
                  },
                }),
              ]),
              h(NButton, {
                type: 'primary',
                size: 'small',
                onClick: () => {
                  if (tempLinks.value.name && tempLinks.value.url) { // Basic validation
                    config.links = config.links || [];
                    config.links.push({ ...tempLinks.value }); // Push a copy
                    tempLinks.value = { // Reset
                      name: '',
                      url: '',
                    };
                  } else {
                    window.$message?.warning("请输入链接名称和地址");
                  }
                },
                disabled: !tempLinks.value.name || !tempLinks.value.url // Disable if fields are empty
              }, () => '添加'),
          ])

        ]
      );
    },
    // onUploaded seems irrelevant here, keep if needed elsewhere
    // onUploaded(data, config) {
    //   tempLinks.value = {
    //     name: '',
    //     url: '',
    //   };
    // },
  }
])
</script>

<template>
  <!-- 新增: 外部背景和模糊容器 -->
  <div
    class="song-list-background-wrapper"
    :style="{
      backgroundImage: props.config?.background ? `url(${FILE_BASE_URL + props.config.background})` : 'none',
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
            :src="'https://fetch.vtsuru.live/' + props.userInfo?.streamerInfo?.faceUrl + '@256w_256h'"
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
              关于
            </p>
            <p class="social-links-subtitle">
              {{ props.config?.longDescription }}
            </p>
            <div class="social-icons-bar">
              <!-- Add actual icons here -->
              <a
                v-if="props.userInfo?.biliId"
                :href="'https://space.bilibili.com/' + props.userInfo?.biliId"
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

          <!-- Divider -->
          <div class="filter-divider" />

          <!-- Filter/Search Bar Row -->
          <n-flex
            class="song-list-filter"
            justify="space-between"
            align="center"
          >
            <!-- Left side filters: Artist, Search, Clear -->
            <n-flex
              align="center"
              :wrap="true"
              style="flex-grow: 1;"
            >
              <!-- Artist Filter Dropdown -->
              <n-select
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
              <n-button
                size="small"
                class="clear-button"
                ghost
                :disabled="!selectedLanguage && !selectedTag && !selectedArtist && !searchQuery"
                @click="clearFilters"
              >
                <template #icon>
                  <n-icon :component="ArrowCounterclockwise20Filled" />
                </template>
                清空筛选
              </n-button>
            </n-flex>

            <!-- Right side: Random Button -->
            <n-button
              class="refresh-button"
              size="small"
              @click="randomOrder"
              ghost
            >
              随机点歌
            </n-button>
          </n-flex>

          <!-- Song Table -->
          <div class="song-table-wrapper">
            <table class="song-list-table">
              <thead>
                <tr>
                  <th>歌名</th>
                  <th>歌手</th>
                  <th>语言</th>
                  <th>标签</th>
                  <th>备注</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!props.data || props.data.length === 0">
                  <td
                    colspan="5"
                    class="no-results"
                  >
                    歌单里还没有歌曲哦~
                  </td>
                </tr>
                <tr v-else-if="filteredSongs.length === 0">
                  <td
                    colspan="5"
                    class="no-results"
                  >
                    当前筛选条件下暂无匹配歌曲
                  </td>
                </tr>
                <tr
                  v-for="song in filteredSongs"
                  :key="song.id || (song.name + '-' + song.author?.join('/'))"
                  :style="{
                    textShadow: isDarkMode ? '0px 1px 2px rgba(0, 0, 0, 0.4)' : '0px 1px 2px rgba(255, 255, 255, 0.4)',
                  }"
                  class="song-row"
                >
                  <td>
                    <span class="song-name">
                      <component :is="GetPlayButton(song)" />
                      <span
                        style="cursor: pointer;"
                        @click="onSongClick(song)"
                      >
                        {{ song.name }}
                      </span>
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
                  <td>{{ song.language?.join(', ') ?? '未知' }}</td>
                  <td>
                    <n-flex
                      :size="4"
                      :wrap="true"
                      style="gap: 4px;"
                    >
                      <!-- Use NFlex for tag wrapping -->
                      <n-tag
                        v-for="tag in song.tags"
                        :key="tag"
                        size="small"
                        checkable
                        :checked="selectedTag === tag"
                        @checked-change="selectTag(tag)"
                      >
                        {{ tag }}
                      </n-tag>
                      <span v-if="!song.tags || song.tags.length === 0">无标签</span>
                    </n-flex>
                  </td>
                  <td>{{ song.description }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Reuse existing styles where possible */

/* --- Styles for Filter Button Groups --- */
.filter-button-group {
  display: flex;
  align-items: center;
  flex-wrap: wrap; /* Allow buttons to wrap */
  gap: 8px; /* Spacing between buttons */
  margin-bottom: 10px; /* Spacing below the group */
}

.filter-label {
  font-size: 0.9em;
  margin-right: 5px;
  font-weight: 500;
  color: #555555;
  white-space: nowrap; /* Prevent label from wrapping */
}

html.dark .filter-label {
  color: var(--text-color-2);
}

/* Style for individual language/tag buttons */
.filter-button {
  padding: 4px 12px; /* Smaller padding */
  border: 1px solid transparent; /* Start transparent */
  border-radius: 15px;
  background-color: rgba(0, 0, 0, 0.04); /* Subtle background */
  font-size: 0.85em; /* Slightly smaller font */
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
  color: #555555;
  line-height: 1.4; /* Adjust line height */
}

html.dark .filter-button {
  background-color: var(--button-color-2);
  color: var(--text-color-2);
}

.filter-button.active {
  background-color: var(--primary-color);
  color: white;
  border-color: var(--primary-color); /* Add border for active */
  font-weight: bold;
}

.filter-button:hover:not(.active) {
  background-color: rgba(0, 0, 0, 0.08);
  border-color: rgba(0, 0, 0, 0.1); /* Subtle border on hover */
}

html.dark .filter-button:hover:not(.active) {
  background-color: var(--item-color-hover);
   border-color: var(--border-color-hover);
}

/* Divider between filters and search bar */
.filter-divider {
  height: 1px;
  background-color: rgba(0, 0, 0, 0.1);
  margin: 10px 0 15px 0; /* Add margin */
}
html.dark .filter-divider {
    background-color: var(--border-color);
}

/* --- Adjustments for Filter/Search Bar --- */
.song-list-filter {
  /* NFlex handles alignment, wrap defaults */
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
  padding: 6px 15px 6px 30px; /* Left padding for icon */
  border-radius: 15px;
  /* width: 250px; */ /* Let flexbox handle width or use min-width */
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

/* --- Naive UI Select Styling (Keep existing) --- */
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

/* --- Clear Button Styling --- */
.clear-button {
  height: 30px; /* Match input height */
  /* padding: 0 10px; */ /* NButton handles padding well */
  border-radius: 15px; /* Match input style */
  font-size: 0.85em; /* Slightly smaller */
  line-height: 28px; /* Adjust if needed */
}


/* --- Random Button Styling (Keep Existing) --- */
.refresh-button {
  height: 30px;
  /* padding: 0 15px; Use NButton padding */
  border-radius: 15px;
  font-size: 0.9em;
  line-height: 28px;
  white-space: nowrap;
}

/* --- MODIFIED: Structure Styles --- */

/* --- NEW: Outer Background & Blur Wrapper --- */
.song-list-background-wrapper {
  position: relative; /* Anchor for ::before */
  height: calc(100vh - var(--vtsuru-header-height) - var(--vtsuru-content-padding) - var(--vtsuru-content-padding));
  border-radius: 8px; /* Apply rounding here */
  background-size: cover;
  background-position: center center;
  background-attachment: fixed; /* Keep background fixed */
  overflow: hidden; /* Clip the ::before pseudo-element */
}

/* Blur effect on the wrapper's ::before */
.song-list-background-wrapper::before {
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  background-color: rgba(0, 0, 0, 0.1); /* Optional overlay */
  border-radius: inherit; /* Inherit rounding */
  z-index: 1; /* Below content */
  pointer-events: none;
}

html.dark .song-list-background-wrapper::before {
  background-color: rgba(255, 255, 255, 0.05); /* Dark mode overlay */
}

/* --- MODIFIED: Inner Scrolling Container --- */
.song-list-template {
  height: 100%; /* Fill the wrapper */
  overflow-y: auto; /* Enable vertical scrolling for content */
  position: relative; /* Needed for z-index */
  z-index: 2; /* Place above the ::before blur layer */
  background: transparent !important; /* Ensure no background color obscures the wrapper */
  border-radius: inherit; /* Inherit rounding for scrollbar area */

  /* Keep scrollbar styles */
  &::-webkit-scrollbar { width: 8px; }
  &::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.05); border-radius: 4px; }
  &::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.2); border-radius: 4px; }
  &::-webkit-scrollbar-thumb:hover { background: rgba(0, 0, 0, 0.3); }
}

/* Dark mode scrollbar styles for the scrolling container */
html.dark .song-list-template {
  &::-webkit-scrollbar-track { background: var(--scrollbar-color); }
  &::-webkit-scrollbar-thumb { background: var(--scrollbar-color-hover); }
  &::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-color-active); }
}


/* --- MODIFIED: Main Content Container --- */
.profile-card-container {
  position: relative; /* Keep for potential absolute children if any */
  /* z-index: 2; */ /* Removed: Handled by .song-list-template */
  padding: 20px;
  font-family: sans-serif;
  color: #333333;
  /* height: 100%; */ /* Removed: Let content define height */
  min-height: 100%; /* Ensure it tries to fill the scroll container */
  box-sizing: border-box; /* Include padding in height calculation */
}

html.dark .profile-card-container {
  color: var(--text-color-1);
}

/* --- Profile Hover Area Styles (Unchanged) --- */
.profile-hover-area {
  position: relative; display: flex; align-items: flex-start;
  width: fit-content; min-width: 300px; margin: 0 auto 20px auto;
  padding: 15px; border-radius: 15px;
  transition: transform 0.4s ease-in-out; z-index: 100; /* High z-index for hover effect */
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
  box-shadow: var(--box-shadow-2); z-index: 20; /* High z-index within hover area */
  background-color: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(0, 0, 0, 0.1);
  opacity: 0; visibility: hidden; transform: translateX(20px);
  transition: opacity 0.4s ease-in-out, visibility 0.4s ease-in-out, transform 0.4s ease-in-out, left 0.4s ease-in-out;
}

html.dark .social-links {
  background-color: rgba(50, 50, 50, 0.85);
  border-color: rgba(255, 255, 255, 0.15);
}
.social-links-title{ font-weight: bold; color: #4d4d4d;}
.social-links-subtitle{ white-space: pre-wrap; color: #4d4d4d;}

html.dark .social-links-title, html.dark .social-links-subtitle { color: var(--text-color-2); }

.social-icons-bar {
  position: absolute; top: 15px; right: 20px; display: flex; gap: 8px;
}

.social-icons-bar .icon {
  display: inline-block; width: 24px; height: 24px; border-radius: 4px;
  font-size: 1em; cursor: pointer; color: #555555; transition: color 0.2s;
}

html.dark .social-icons-bar .icon { color: var(--text-color-2); }
.social-icons-bar .icon:hover { color: var(--primary-color); }
.social-icons-bar .icon svg { display: block; width: 100%; height: 100%; fill: currentColor; }

.social-grid {
  display: grid; grid-template-columns: repeat(2, 1fr);
  gap: 8px 15px; margin-top: 45px;
}

.social-link {
  display: flex; align-items: center; justify-content: space-between;
  padding: 5px 8px; border-radius: 5px; font-size: 0.85em; text-decoration: none;
  color: #0066cc; background-color: rgba(0, 102, 204, 0.1);
  transition: background-color 0.2s ease, color 0.2s ease;
}

html.dark .social-link {
  color: var(--primary-color-light);
  background-color: rgba(var(--primary-color-rgb), 0.15);
  border: 1px solid rgba(122, 159, 197, 0.2);
}
.social-link:hover { background-color: rgba(0, 102, 204, 0.2); }
html.dark .social-link:hover { background-color: rgba(var(--primary-color-rgb), 0.25); }
.social-link span:first-child { margin-right: 5px; }
.social-link .arrow { font-weight: bold; color: #aaaaaa; }
html.dark .social-link .arrow { color: var(--text-color-3); }

.profile-hover-area.is-hovering .profile-avatar { transform: translateX(-60px); }
.profile-hover-area.is-hovering .social-links {
  opacity: 1; visibility: visible; transform: translateX(0);
  left: calc(100px - 60px + 15px);
}

/* --- Song List Container Styles (Unchanged except background/border) --- */
.song-list-container {
  padding: 15px 25px; border-radius: 15px; font-family: sans-serif;
  box-shadow: var(--box-shadow-1);
  background-color: rgba(255, 255, 255, 0.50); /* Matched profile */
  border: 1px solid rgba(0, 0, 0, 0.08);
}

html.dark .song-list-container {
  background-color: rgba(40, 40, 40, 0.75);
  border-color: rgba(255, 255, 255, 0.1);
}

/* --- Table Styles (Unchanged) --- */
.song-table-wrapper {
  overflow-y: auto; /* This overflow handles table content, not main scroll */
  /* min-height: 200px; */ /* Might not be needed if max-height is set */
  border-radius: 8px;
  /* Scrollbar styling specific to this inner table scroll if needed */
  /* ... */
}

.song-list-table {
  width: 100%; border-collapse: collapse; font-size: 0.9em;
}

.song-list-table thead th {
  position: sticky; top: 0; z-index: 1; /* Sticky within .song-table-wrapper */
  padding: 10px 12px; text-align: left; font-weight: 600;
  background-color: rgba(245, 245, 245, 0.8); /* Slightly less transparent */
  backdrop-filter: blur(2px); /* Blur header slightly */
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  color: #444444;
}

html.dark .song-list-table thead th {
  background-color: rgba(55, 55, 55, 0.85); /* Dark mode header bg */
  border-bottom-color: var(--border-color);
  color: var(--text-color-2);
}

.song-list-table th:nth-child(1) { width: 25%; } /* Song Name */
.song-list-table th:nth-child(2) { width: 18%; } /* Artist */
.song-list-table th:nth-child(3) { width: 12%; } /* Language */
.song-list-table th:nth-child(4) { width: 15%; } /* Tags */
.song-list-table th:nth-child(5) { width: 30%; } /* Remarks */


.song-list-table tbody tr { transition: background-color 0.15s ease; }

.song-list-table tbody td {
  padding: 10px 12px; vertical-align: middle;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  color: #4d4d4d;
  word-break: break-word; /* Prevent long text overflow */
}

html.dark .song-list-table tbody td {
  border-bottom-color: var(--border-color);
  color: var(--text-color-2);
}

.song-list-table tbody tr:nth-child(even) { background-color: rgba(0, 0, 0, 0.02); }
html.dark .song-list-table tbody tr:nth-child(even) { background-color: var(--item-color-striped); }
.song-list-table tbody tr:hover { background-color: rgba(0, 0, 0, 0.05); }
html.dark .song-list-table tbody tr:hover { background-color: var(--item-color-hover); }

.song-name {
  display: flex; align-items: center; gap: 8px; font-weight: 600;
  text-decoration: none; color: #2c2c2c;
}

html.dark .song-name { color: var(--text-color-1); }

.artist-link {
  padding: 1px 0; cursor: pointer; text-decoration: none;
  color: var(--text-color-2); /* Use theme primary for links */
  transition: color 0.2s ease, text-decoration 0.2s ease;
}
.artist-link:hover { text-decoration: underline; }

.song-name :deep(.n-button .n-icon),
.song-name :deep(.n-button .svg-icon) {
  color: currentColor !important; fill: currentColor !important;
}

.svg-icon {
  display: inline-block; width: 1em; height: 1em; vertical-align: -0.15em;
  fill: currentColor; overflow: hidden;
}

.no-results td {
  padding: 30px 12px; text-align: center; font-style: italic; color: #999999;
}

html.dark .no-results td { color: var(--text-color-3); }

/* Ensure NTag in table wraps properly */
.song-list-table td .n-tag {
    margin-bottom: 2px; /* Add slight spacing if tags wrap */
    margin-right: 4px;
}

</style>