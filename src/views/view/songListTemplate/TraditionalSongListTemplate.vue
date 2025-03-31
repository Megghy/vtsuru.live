<script setup lang="ts">
  import { computed, h, ref, watch } from 'vue'; // Import computed and watch
  import { getUserAvatarUrl, isDarkMode } from '@/Utils';
  import { SongListConfigTypeWithConfig } from '@/data/TemplateTypes';
  import { defineTemplateConfig, ExtractConfigData } from '@/data/VTsuruTypes';
  import { FILE_BASE_URL } from '@/data/constants';
  import { NButton, NFlex, NIcon, NInput, NInputGroup, NInputGroupLabel, NTag, NTooltip, NSelect } from 'naive-ui'; // Import NSelect
  import bilibili from '@/svgs/bilibili.svg';
  import neteaseMusic from '@/svgs/neteaseMusic.svg';
  import qqMusic from '@/svgs/qqMusic.svg';
  import douyin from '@/svgs/douyin.svg';
  import { SongFrom, SongsInfo } from '@/api/api-models';
  import FiveSingIcon from '@/svgs/fivesing.svg';
  import { SquareArrowForward24Filled } from '@vicons/fluent';

  interface Tab {
    id: number;
    name: string;
  }

  const props = defineProps<SongListConfigTypeWithConfig<TraditionalConfigType>>();
  defineExpose({ Config, DefaultConfig });
  const emits = defineEmits(['requestSong']);

  const isHovering = ref(false);

  const tabs: Tab[] = props.data?.map(s => s.tags) // Assuming 'tags' is meant to be 'language'? If not, adjust accordingly.
    .flat()
    .filter(t => t !== '' && t !== undefined && t !== null)
    .map(t => t!.trim())
    .filter((tag, index, self) => self.indexOf(tag) === index)
    .map((tag, index) => ({ id: index, name: tag! })) || [];

  const activeTab = ref<string>();
  const searchQuery = ref<string>('');
  const selectedArtist = ref<string | null>(null); // --- New state for selected artist ---

  // --- Computed Properties ---

  // --- New: Get unique artists for the dropdown ---
  const allArtists = computed(() => {
    const artists = new Set<string>();
    props.data?.forEach(song => {
      song.author.forEach(author => {
        if (author?.trim()) { // Ensure author is not empty/whitespace
          artists.add(author.trim());
        }
      });
    });
    return Array.from(artists).sort(); // Sort alphabetically
  });

  // --- New: Format artists for NSelect options ---
  const artistOptions = computed(() => {
    return allArtists.value.map(artist => ({ label: artist, value: artist }));
  });

  const filteredSongs = computed(() => {
    let songs = props.data!;
    if (!songs) return []; // Handle case where data might be initially null/undefined

    // 1. Filter by Active Tab
    if (activeTab.value) {
      // Assuming filter should be by language as in original code
      songs = songs.filter(song => song.language?.some(lang => lang === activeTab.value));
    }

    // --- New: 2. Filter by Selected Artist ---
    if (selectedArtist.value) {
      songs = songs.filter(song => song.author?.includes(selectedArtist.value!));
    }

    // 3. Filter by Search Query (case-insensitive)
    if (searchQuery.value.trim()) {
      const lowerSearch = searchQuery.value.toLowerCase().trim();
      songs = songs.filter(song =>
        song.name.toLowerCase().includes(lowerSearch) ||
        song.author?.some(artist => artist.toLowerCase().includes(lowerSearch)) || // Check individual artists
        song.language?.some(lang => lang.toLowerCase().includes(lowerSearch)) || // Check individual languages
        song.description?.toLowerCase().includes(lowerSearch)
      );
    }

    return songs;
  });

  // --- Methods ---
  const setActiveTab = (tabName: string) => {
    if (tabName === activeTab.value) {
      activeTab.value = undefined; // Clear filter if clicking the active tab again
    } else {
      activeTab.value = tabName;
    }
  };

  // --- New: Method to select artist (used by clicking in the table) ---
  const selectArtist = (artist: string) => {
    selectedArtist.value = artist;
  };

  // --- New: Watcher to clear artist selection if the selected artist is no longer valid ---
  // (e.g., if the underlying data changes and the artist disappears)
  // This is optional but good practice.
  watch(allArtists, (newArtists) => {
    if (selectedArtist.value && !newArtists.includes(selectedArtist.value)) {
      selectedArtist.value = null;
    }
  });


  const randomOrder = () => {
    const song = props.data![Math.floor(Math.random() * props.data!.length)];
    window.$modal.create({
      preset:'dialog',
      title: '随机点歌',
      content: `你选择的歌曲是: ${song.name}, 由 ${song.author.join(', ')} 演唱`,
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

  function GetPlayButton(song: SongsInfo) {
    // ... (GetPlayButton function remains the same)
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
            },
          },
          () => [
            config.links?.map((link: { name: string; url: string; }) => {
              return h(
                NTag,
                {
                  style: {
                    margin: '5px 0',
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
            h(NInputGroup, { size: 'small' }, () => [
              h(NInputGroupLabel, { style: { width: '100px' } }, () => '链接名称'), // Corrected label
              h(NInput, {
                placeholder: '名称',
                value: tempLinks.value.name,
                onUpdateValue: (value) => {
                  tempLinks.value.name = value;
                },
              }),
            ]),
            h(NInputGroup, { size: 'small' }, () => [
              h(NInputGroupLabel, { style: { width: '100px' } }, () => '链接地址'), // Corrected label
              h(NInput, {
                placeholder: '链接',
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
                  // Optional: Add user feedback (e.g., message)
                  console.warn("Please enter both name and URL for the link.");
                }
              },
              disabled: !tempLinks.value.name || !tempLinks.value.url // Disable if fields are empty
            }, () => '添加'),
          ]
        );
      },
      onUploaded(data, config) { // This seems unused for 'render' type, maybe remove?
        tempLinks.value = {
          name: '',
          url: '',
        };
      },
    }
  ])

</script>

<template>
  <div
    class="song-list-template"
    :style="{
      backgroundImage: `url(${FILE_BASE_URL + props.config?.background})`,
      backgroundSize: 'cover', height: '100%', backdropFilter: 'blur(5px)'
    }"
  >
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
            {{ props.userInfo?.name }}的链接
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

      <div class="song-list-container">
        <!-- Tabs -->
        <div class="song-list-tabs">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            :class="{ active: activeTab === tab.name }"
            @click="setActiveTab(tab.name)"
          >
            {{ tab.name }}
          </button>
          <!-- Placeholder for the divider '.' seen in the image -->
          <span
            v-if="tabs.length > 0"
            class="tab-divider"
          />
        </div>

        <!-- Filter/Search Bar -->
        <!-- Use NFlex for better alignment -->
        <n-flex
          class="song-list-filter"
          justify="space-between"
          align="center"
        >
          <n-flex
            align="center"
            :wrap="false"
          >
            <!-- Wrap inner filters if needed on small screens -->
            <!-- New: Artist Filter Dropdown -->
            <n-select
              v-model:value="selectedArtist"
              :options="artistOptions"
              placeholder="筛选歌手"
              clearable
              style="width: 180px; margin-right: 10px;"
              size="small"
            />

            <!-- Search Input -->
            <div class="search-wrapper">
              <span class="search-icon">🔍</span>
              <input
                v-model="searchQuery"
                type="text"
                placeholder="筛选歌名/歌手/语言/备注"
                class="filter-input"
              >
            </div>
          </n-flex>

          <button
            class="refresh-button"
            @click="randomOrder"
          >
            随机点歌
          </button>
        </n-flex>

        <!-- Song Table -->
        <div class="song-table-wrapper">
          <table class="song-list-table">
            <thead>
              <tr>
                <th>歌名</th>
                <th>歌手</th>
                <th>语言</th>
                <th>备注</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="filteredSongs.length === 0">
                <td
                  colspan="4"
                  class="no-results"
                >
                  暂无匹配歌曲
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
                  <!-- --- Updated Artist Cell --- -->
                  <span v-if="song.author && song.author.length > 0">
                    <span
                      v-for="(artist, index) in song.author"
                      :key="artist"
                    >
                      <span
                        class="artist-link"
                        :title="`筛选: ${artist}`"
                        @click.stop="selectArtist(artist)"
                      >
                        {{ artist }}
                      </span>
                      <!-- Add separator only if not the last artist -->
                      <span v-if="index < song.author.length - 1"> / </span>
                    </span>
                  </span>
                  <span v-else>未知</span> <!-- Handle case with no authors -->
                </td>
                <td>{{ song.language?.join(', ') ?? '未知' }}</td> <!-- Handle potential undefined -->
                <td>{{ song.description }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
  /* ==========================================================================
   Main Template Layout & Background
   ========================================================================== */

  .song-list-template {
    height: calc(100vh - var(--vtsuru-header-height) - var(--vtsuru-content-padding) - var(--vtsuru-content-padding));
    overflow-y: auto;
    border-radius: 8px;
    background-size: cover;
    background-position: center center;
    position: relative;
    /* Needed for pseudo-element */
  }

  /* --- The Blurred Background Layer (using backdrop-filter) --- */
  .song-list-template::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    /* Apply blur effect to the content *behind* this pseudo-element */
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
    /* Safari */
    /* Subtle overlay helps contrast, adjust as needed */
    background-color: rgba(0, 0, 0, 0.1);
    /* Dark overlay for light bg images */
    border-radius: inherit;
    /* Match parent */
    z-index: 1;
    pointer-events: none;
  }

  html.dark .song-list-template::before {
    background-color: rgba(255, 255, 255, 0.05);
    /* Light overlay for dark bg images */
  }


  .profile-card-container {
    position: relative;
    /* Sits above ::before */
    z-index: 2;
    padding: 20px;
    font-family: sans-serif;
    /* --- Default text color for light mode (ergonomic dark gray) --- */
    color: #333333;
  }

  /* --- In dark mode, use the theme's primary light text color --- */
  html.dark .profile-card-container {
    color: var(--text-color-1);
  }


  /* ==========================================================================
   Profile Card Section
   ========================================================================== */

  .profile-hover-area {
    position: relative;
    display: flex;
    align-items: flex-start;
    width: fit-content;
    min-width: 300px;
    margin: 0 auto 20px auto;
    /* Added bottom margin */
    padding: 15px;
    border-radius: 15px;
    transition: transform 0.4s ease-in-out;
    z-index: 100;
    box-shadow: var(--box-shadow-1);

    /* --- Adaptive Semi-transparent background --- */
    background-color: rgba(255, 255, 255, 0.65);
    /* 更改透明度从0.75到0.65 */
    border: 1px solid rgba(0, 0, 0, 0.08);
    /* Light mode border */
  }

  html.dark .profile-hover-area {
    background-color: rgba(40, 40, 40, 0.75);
    /* Dark mode background */
    border: 1px solid rgba(255, 255, 255, 0.1);
    /* Dark mode border */
  }

  .profile-avatar {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    /* --- Border color adapts slightly --- */
    border: 3px solid rgba(255, 255, 255, 0.8);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
    margin-right: 20px;
    position: relative;
    z-index: 10;
    transition: transform 0.4s ease-in-out;
    cursor: pointer;
    flex-shrink: 0;
  }

  html.dark .profile-avatar {
    border-color: rgba(255, 255, 255, 0.6);
    /* Slightly less prominent border in dark */
  }

  .profile-info {
    flex-grow: 1;
    min-width: 180px;
    text-align: left;
    /* Inherits color from profile-card-container */
  }

  .profile-name {
    margin-top: 5px;
    margin-bottom: 8px;
    font-size: 1.8em;
    font-weight: bold;
    /* --- Specific Text Color Adaptation --- */
    color: #1a1a1a;
    /* Slightly darker for title in light mode */
  }

  html.dark .profile-name {
    color: var(--text-color-base);
    /* Use theme base/brightest in dark */
  }


  .profile-description {
    margin-bottom: 10px;
    font-size: 0.95em;
    line-height: 1.4;
    /* --- Specific Text Color Adaptation --- */
    color: #4d4d4d;
    /* Softer gray for description in light mode */
  }

  html.dark .profile-description {
    color: var(--text-color-2);
    /* Use theme secondary in dark */
  }

  .profile-extra-info {
    font-size: 0.8em;
    /* --- Specific Text Color Adaptation --- */
    color: #666666;
    /* Lighter gray for extra info in light */
  }

  html.dark .profile-extra-info {
    color: var(--text-color-3);
    /* Use theme tertiary in dark */
  }

  /* --- Social Links Popup (within Profile Card) --- */

  .social-links {
    position: absolute;
    top: 5px;
    left: calc(100px + 20px + 10px);
    /* Initial position */
    width: 380px;
    padding: 15px 20px;
    border-radius: 10px;
    box-shadow: var(--box-shadow-2);
    z-index: 20;

    /* --- Adaptive Background (more opaque) --- */
    background-color: rgba(255, 255, 255, 0.85);
    border: 1px solid rgba(0, 0, 0, 0.1);
    /* Text color will inherit from profile-card-container by default */

    /* Hover Transition */
    opacity: 0;
    visibility: hidden;
    transform: translateX(20px);
    transition: opacity 0.4s ease-in-out, visibility 0.4s ease-in-out, transform 0.4s ease-in-out, left 0.4s ease-in-out;
  }

  html.dark .social-links {
    background-color: rgba(50, 50, 50, 0.85);
    border-color: rgba(255, 255, 255, 0.15);
    /* Text color inherits from html.dark .profile-card-container */
  }

  /* --- Text inside social links needs adaptation too --- */
  .social-links-title,
  .social-links-subtitle {
    color: #4d4d4d;
    /* Match description color in light mode */
  }

  html.dark .social-links-title,
  html.dark .social-links-subtitle {
    color: var(--text-color-2);
    /* Use theme secondary in dark mode */
  }

  .social-icons-bar {
    position: absolute;
    top: 15px;
    right: 20px;
    display: flex;
    gap: 8px;
  }

  .social-icons-bar .icon {
    display: inline-block;
    width: 24px;
    height: 24px;
    border-radius: 4px;
    font-size: 1em;
    cursor: pointer;
    /* --- Adaptive Icon Color --- */
    color: #555555;
    transition: color 0.2s;
  }

  html.dark .social-icons-bar .icon {
    color: var(--text-color-2);
    /* Use theme secondary in dark */
  }

  .social-icons-bar .icon:hover {
    /* Use theme primary color for hover in both modes */
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
    /* --- Adaptive Link Style --- */
    color: #0066cc;
    /* Standard link blue for light mode */
    background-color: rgba(0, 102, 204, 0.1);
    /* Light blue background */
    transition: background-color 0.2s ease, color 0.2s ease;
  }

  html.dark .social-link {
    color: var(--primary-color-light);
    /* Lighter primary for dark */
    background-color: rgba(var(--primary-color-rgb), 0.15);
    /* Use theme primary transparent */
    border: 1px solid rgba(122, 159, 197, 0.2);
    /* Light blue border */
  }

  .social-link:hover {
    /* --- Adaptive Link Hover --- */
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
    /* --- Adaptive Arrow Color --- */
    color: #aaaaaa;
  }

  html.dark .social-link .arrow {
    color: var(--text-color-3);
  }


  /* Hover State Activation */
  .profile-hover-area.is-hovering .profile-avatar {
    transform: translateX(-60px);
  }

  .profile-hover-area.is-hovering .social-links {
    opacity: 1;
    visibility: visible;
    transform: translateX(0);
    left: calc(100px - 60px + 15px);
  }


  /* ==========================================================================
   Song List Section
   ========================================================================== */

  .song-list-container {
    /* margin-top: 20px; */
    /* Now handled by profile-hover-area margin */
    padding: 15px 25px;
    border-radius: 15px;
    font-family: sans-serif;
    box-shadow: var(--box-shadow-1);

    /* --- Adaptive Semi-transparent background (match profile card) --- */
    background-color: rgba(255, 255, 255, 0.50);
    /* 更改透明度从0.75到0.65 */
    border: 1px solid rgba(0, 0, 0, 0.08);
    /* Inherits base text color from profile-card-container */
  }

  html.dark .song-list-container {
    background-color: rgba(40, 40, 40, 0.75);
    border-color: rgba(255, 255, 255, 0.1);
    /* Inherits base text color from html.dark .profile-card-container */
  }


  /* --- Tabs --- */
  .song-list-tabs {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-bottom: 15px;
    padding-bottom: 10px;
    /* --- Adaptive Border --- */
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  }

  html.dark .song-list-tabs {
    border-bottom-color: var(--border-color);
  }


  .song-list-tabs button {
    padding: 8px 15px;
    border: none;
    border-radius: 15px;
    background-color: transparent;
    font-size: 0.9em;
    cursor: pointer;
    transition: background-color 0.2s ease, color 0.2s ease;
    /* --- Adaptive Text Color --- */
    color: #555555;
  }

  html.dark .song-list-tabs button {
    color: var(--text-color-2);
  }

  .song-list-tabs button.active {
    background-color: var(--primary-color);
    /* Use theme primary */
    color: white;
    /* White text on primary bg */
    font-weight: bold;
  }

  .song-list-tabs button:hover:not(.active) {
    /* --- Adaptive Hover Background --- */
    background-color: rgba(0, 0, 0, 0.05);
  }

  html.dark .song-list-tabs button:hover:not(.active) {
    background-color: var(--item-color-hover);
  }

  .tab-divider {
    margin: 0 10px;
    color: #cccccc;
    /* Lighter gray divider */
  }

  html.dark .tab-divider {
    color: var(--text-color-3);
  }


  /* --- Filter/Search Bar --- */
  .song-list-filter {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
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
    /* --- Adaptive Icon Color --- */
    color: #aaaaaa;
  }

  html.dark .search-icon {
    color: var(--text-color-3);
  }

  .filter-input {
    height: 30px;
    box-sizing: border-box;
    padding: 6px 15px 6px 30px;
    /* Left padding for icon */
    border-radius: 15px;
    width: 250px;
    font-size: 0.9em;
    line-height: normal;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
    /* --- Adaptive Input Styling --- */
    border: 1px solid rgba(0, 0, 0, 0.15);
    background-color: rgba(255, 255, 255, 0.8);
    /* Slightly opaque white */
    color: #333333;
    /* Dark text */
  }

  html.dark .filter-input {
    border-color: var(--border-color);
    background-color: var(--input-color);
    /* Use theme input color */
    color: var(--text-color-1);
    /* Light text */
  }

  .filter-input::placeholder {
    color: #aaaaaa;
    /* Light mode placeholder */
  }

  html.dark .filter-input::placeholder {
    color: var(--text-color-3);
    /* Dark mode placeholder */
  }

  .filter-input:focus {
    outline: none;
    border-color: var(--primary-color);
    /* Use theme primary for focus */
    box-shadow: 0 0 0 2px var(--primary-color-a3);
  }

  /* --- Styling Naive UI Select (assuming it adapts via its own props/theme) --- */
  :deep(.song-list-filter .n-select .n-base-selection) {
    --n-height: 30px !important;
    --n-padding-single: 0 26px 0 10px !important;
    border-radius: 15px !important;
    /* Match input style */
  }

  :deep(.song-list-filter .n-select .n-base-selection .n-base-selection-placeholder),
  :deep(.song-list-filter .n-select .n-base-selection .n-base-selection-input) {
    height: 30px !important;
    line-height: 30px !important;
  }

  /* Note: NSelect text/bg color should ideally follow the NaiveUI theme */

  .refresh-button {
    height: 30px;
    padding: 0 15px;
    border-radius: 15px;
    font-size: 0.9em;
    line-height: 28px;
    white-space: nowrap;
    cursor: pointer;
    transition: background-color 0.2s ease, border-color 0.2s ease;
    /* --- Adaptive Button Styling --- */
    border: 1px solid rgba(0, 0, 0, 0.1);
    background-color: rgba(0, 0, 0, 0.03);
    /* Very subtle bg */
    color: #555555;
  }

  html.dark .refresh-button {
    border-color: var(--border-color);
    background-color: var(--button-color-2);
    /* Use theme secondary button */
    color: var(--text-color-2);
  }

  .refresh-button:hover {
    background-color: rgba(0, 0, 0, 0.06);
    /* Light mode hover */
    border-color: rgba(0, 0, 0, 0.15);
  }

  html.dark .refresh-button:hover {
    background-color: var(--button-color-2-hover);
    /* Dark mode hover */
    border-color: var(--border-color-hover);
  }


  /* ==========================================================================
   Song Table
   ========================================================================== */

  .song-table-wrapper {
    overflow-y: auto;
    max-height: calc(100vh - 450px);
    /* Adjust this value */
    min-height: 200px;
    border-radius: 8px;

    /* Custom Scrollbar */
    &::-webkit-scrollbar {
      width: 8px;
    }

    &::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.05);
      border-radius: 4px;
    }

    &::-webkit-scrollbar-thumb {
      background: rgba(0, 0, 0, 0.2);
      border-radius: 4px;
    }

    &::-webkit-scrollbar-thumb:hover {
      background: rgba(0, 0, 0, 0.3);
    }
  }

  html.dark .song-table-wrapper {

    /* Dark mode scrollbar */
    &::-webkit-scrollbar-track {
      background: var(--scrollbar-color);
    }

    &::-webkit-scrollbar-thumb {
      background: var(--scrollbar-color-hover);
    }

    &::-webkit-scrollbar-thumb:hover {
      background: var(--scrollbar-color-active);
    }
  }

  .song-list-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9em;
  }

  /* Table Header */
  .song-list-table thead th {
    position: sticky;
    top: 0;
    z-index: 1;
    padding: 10px 12px;
    text-align: left;
    font-weight: 600;
    /* --- Adaptive Header --- */
    background-color: rgba(0, 0, 0, 0.1);
    /* Subtle bg for light */
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    color: #444444;
    /* Darker gray header text */
  }

  html.dark .song-list-table thead th {
    background-color: var(--table-header-color);
    border-bottom-color: var(--border-color);
    color: var(--text-color-2);
  }

  /* Header Column Widths */
  .song-list-table th:nth-child(1) {
    width: 25%;
  }

  /* Song Name */
  .song-list-table th:nth-child(2) {
    width: 15%;
  }

  /* Artist */
  .song-list-table th:nth-child(3) {
    width: 15%;
  }

  /* Language */
  .song-list-table th:nth-child(4) {
    width: 45%;
  }

  /* Remarks */

  /* Table Body */
  .song-list-table tbody tr {
    transition: background-color 0.15s ease;
  }

  .song-list-table tbody td {
    padding: 10px 12px;
    vertical-align: middle;
    /* --- Adaptive Cell --- */
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    /* Lighter border */
    color: #4d4d4d;
    /* Inherit default soft gray */
  }

  html.dark .song-list-table tbody td {
    border-bottom-color: rgb(114, 114, 114);
    color: var(--text-color-2);
    /* Use theme secondary text */
  }

  /* Zebra Striping */
  .song-list-table tbody tr:nth-child(even) {
    background-color: rgba(0, 0, 0, 0.02);
    /* Very subtle stripe */
  }

  html.dark .song-list-table tbody tr:nth-child(even) {
    background-color: var(--item-color-striped);
  }

  /* Hover Effect */
  .song-list-table tbody tr:hover {
    background-color: rgba(0, 0, 0, 0.05);
    /* Light hover */
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
    /* --- Adaptive Song Name Color --- */
    color: #2c2c2c;
    /* Slightly darker main text */
  }

  html.dark .song-name {
    color: var(--text-color-1);
    /* Use theme primary text */
  }

  .artist-link {
    padding: 1px 0;
    cursor: pointer;
    text-decoration: none;
    transition: color 0.2s ease, text-decoration 0.2s ease;
    /* --- Use theme primary color for links in both modes --- */
  }

  .artist-link:hover {
    text-decoration: underline;
  }

  /* Play Buttons / Icons */
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
    padding: 30px;
    text-align: center;
    font-style: italic;
    /* --- Adaptive Text Color --- */
    color: #999999;
  }

  html.dark .no-results td {
    color: var(--text-color-3);
  }

</style>