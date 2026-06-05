<script setup lang="ts">
import type { SongsInfo } from '@/api/api-models'
import type { SongListConfigType } from '@/shared/types/TemplateTypes'
import { CloudAdd20Filled, MusicNote224Filled, Search24Regular } from '@vicons/fluent'
import { useVirtualList } from '@vueuse/core'
import { NButton, NEmpty, NIcon, NInput, NTag, NTooltip } from 'naive-ui'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useAccount } from '@/api/account'
import SongPlayer from '@/components/SongPlayer.vue'
import { useBiliAuth } from '@/store/useBiliAuth'
import { GetGuardColor } from '@/shared/utils'
import { useScopedGlobalStyle } from '@/composables/useScopedGlobalStyle'
import { getSongRequestButtonType, getSongRequestTooltip } from './utils/songRequestUtils'
import { useLiveRequestStatus } from './utils/useLiveRequestStatus'

const props = defineProps<SongListConfigType>()
const emits = defineEmits(['requestSong'])

const accountInfo = useAccount()
const biliAuth = useBiliAuth()

// 沉浸式: 注入临时全局样式, 让站点侧栏与右侧内容融合, 并铺设贯穿整个内容区的模糊封面背景
useScopedGlobalStyle(`
html.vtsuru-immersive-songlist .main-layout-body { position: relative; }
html.vtsuru-immersive-songlist .main-layout-body::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: var(--immersive-cover, none);
  background-size: cover;
  background-position: center;
  filter: blur(80px) saturate(1.35);
  transform: scale(1.15);
  opacity: 0.42;
  pointer-events: none;
  z-index: 0;
  transition: opacity 0.4s ease;
}
html.vtsuru-immersive-songlist .user-sider,
html.vtsuru-immersive-songlist .content-layout-container {
  position: relative;
  z-index: 1;
  background: transparent !important;
}
html.vtsuru-immersive-songlist .user-sider { border-right: none !important; }
html.vtsuru-immersive-songlist .viewer-page-content {
  background: transparent !important;
  padding-top: 8px !important;
}
`, 'vtsuru-immersive-songlist')

const searchKeyword = ref('')
const selectedSong = ref<SongsInfo>()
const isLrcLoading = ref('')
const requestingKey = ref('')

// 当前封面写入全局 CSS 变量, 供注入的背景层引用
watch(selectedSong, (song) => {
  const root = document.documentElement
  if (song?.cover) root.style.setProperty('--immersive-cover', `url(${song.cover})`)
  else root.style.removeProperty('--immersive-cover')
})
onBeforeUnmount(() => {
  document.documentElement.style.removeProperty('--immersive-cover')
})

const requestAuthState = computed(() => ({
  isLoggedIn: !!accountInfo.value.id,
  isBiliAuthed: biliAuth.isAuthed,
}))

const isSelf = computed(() => !!props.userInfo?.id && accountInfo.value?.id === props.userInfo.id)

const { singing: singingSongKeySet, queued: queuedSongKeySet } = useLiveRequestStatus(() => props.liveRequestActive)

const filteredSongs = computed<SongsInfo[]>(() => {
  const data = props.data
  if (!data) return []
  const keyword = searchKeyword.value.trim().toLowerCase()
  if (!keyword) return data
  return data.filter((song) => {
    const haystack = [
      song.name,
      song.translateName ?? '',
      song.author?.join(' ') ?? '',
      song.tags?.join(' ') ?? '',
    ].join(' ').toLowerCase()
    return haystack.includes(keyword)
  })
})

const { list, containerProps, wrapperProps } = useVirtualList(filteredSongs, {
  itemHeight: 52,
  overscan: 10,
})

// 默认选中第一首
watch(filteredSongs, (songs) => {
  if (!selectedSong.value && songs.length) selectedSong.value = songs[0]
}, { immediate: true })

function selectSong(song: SongsInfo) {
  selectedSong.value = song
}

function requestSong(song: SongsInfo) {
  if (isSelf.value) return
  requestingKey.value = song.key
  emits('requestSong', song)
  window.setTimeout(() => { requestingKey.value = '' }, 2000)
}
</script>

<template>
  <div class="immersive-template">
    <!-- 左侧常驻播放面板 -->
    <aside class="stage">
      <div
        class="stage-cover"
        :class="{ 'is-empty': !selectedSong?.cover }"
      >
        <img
          v-if="selectedSong?.cover"
          :src="selectedSong.cover"
          :alt="selectedSong.name"
          referrerpolicy="no-referrer"
        >
        <NIcon
          v-else
          :component="MusicNote224Filled"
          class="stage-cover-icon"
        />
      </div>

      <template v-if="selectedSong">
        <div class="stage-title">
          {{ selectedSong.name }}
        </div>
        <div
          v-if="selectedSong.translateName"
          class="stage-subtitle"
        >
          {{ selectedSong.translateName }}
        </div>
        <div
          v-if="selectedSong.author?.length"
          class="stage-author"
        >
          {{ selectedSong.author.join(' / ') }}
        </div>

        <div
          v-if="selectedSong.language?.length || selectedSong.tags?.length"
          class="stage-tags"
        >
          <NTag
            v-for="lang in selectedSong.language ?? []"
            :key="`l-${lang}`"
            size="small"
            :bordered="false"
            type="info"
          >
            {{ lang }}
          </NTag>
          <NTag
            v-for="tag in (selectedSong.tags ?? []).slice(0, 4)"
            :key="`t-${tag}`"
            size="small"
            :bordered="false"
          >
            {{ tag }}
          </NTag>
        </div>

        <div
          v-if="selectedSong.options"
          class="stage-tags"
        >
          <NTag
            v-if="selectedSong.options.scMinPrice"
            size="small"
            :bordered="false"
            type="error"
          >
            SC ¥{{ selectedSong.options.scMinPrice }}
          </NTag>
          <NTag
            v-if="selectedSong.options.fanMedalMinLevel"
            size="small"
            :bordered="false"
            type="warning"
          >
            粉丝牌 {{ selectedSong.options.fanMedalMinLevel }}
          </NTag>
          <NTag
            v-if="selectedSong.options.needZongdu"
            size="small"
            :bordered="false"
            :color="{ color: GetGuardColor(1) }"
          >
            总督
          </NTag>
          <NTag
            v-if="selectedSong.options.needTidu"
            size="small"
            :bordered="false"
            :color="{ color: GetGuardColor(2) }"
          >
            提督
          </NTag>
          <NTag
            v-if="selectedSong.options.needJianzhang"
            size="small"
            :bordered="false"
            :color="{ color: GetGuardColor(3) }"
          >
            舰长
          </NTag>
        </div>

        <NButton
          v-if="!isSelf"
          class="stage-request"
          :type="getSongRequestButtonType(selectedSong, liveRequestSettings, requestAuthState)"
          :loading="requestingKey === selectedSong.key"
          @click="requestSong(selectedSong)"
        >
          <template #icon>
            <NIcon :component="CloudAdd20Filled" />
          </template>
          {{ getSongRequestTooltip(selectedSong, liveRequestSettings, requestAuthState) }}
        </NButton>

        <SongPlayer
          v-if="selectedSong.url"
          v-model:is-lrc-loading="isLrcLoading"
          :song="selectedSong"
          class="stage-player"
        />
      </template>
    </aside>

    <!-- 右侧曲库列表 -->
    <section class="library">
      <NInput
        v-model:value="searchKeyword"
        class="library-search"
        clearable
        placeholder="搜索曲库…"
      >
        <template #prefix>
          <NIcon :component="Search24Regular" />
        </template>
      </NInput>

      <NEmpty
        v-if="filteredSongs.length === 0"
        description="暂无曲目"
        style="margin-top: 48px"
      />

      <div
        v-else
        v-bind="containerProps"
        class="library-list"
      >
        <div v-bind="wrapperProps">
          <button
            v-for="{ data: song } in list"
            :key="song.key"
            type="button"
            class="lib-row"
            :class="{
              active: selectedSong?.key === song.key,
              'is-singing': singingSongKeySet.has(song.key),
              'is-queued': queuedSongKeySet.has(song.key),
            }"
            @click="selectSong(song)"
          >
            <div class="lib-cover">
              <img
                v-if="song.cover"
                :src="song.cover"
                :alt="song.name"
                loading="lazy"
                referrerpolicy="no-referrer"
              >
              <span v-else>{{ song.name.charAt(0) }}</span>
            </div>
            <div class="lib-main">
              <span
                class="lib-name"
                :title="song.name"
              >{{ song.name }}</span>
              <span
                v-if="song.author?.length"
                class="lib-author"
              >{{ song.author.join(' / ') }}</span>
            </div>
            <span
              v-if="singingSongKeySet.has(song.key)"
              class="lib-flag singing"
            >演唱中</span>
            <span
              v-else-if="queuedSongKeySet.has(song.key)"
              class="lib-flag queued"
            >排队</span>
            <NTooltip v-if="!isSelf">
              <template #trigger>
                <NButton
                  size="tiny"
                  circle
                  :type="getSongRequestButtonType(song, liveRequestSettings, requestAuthState)"
                  :loading="requestingKey === song.key"
                  @click.stop="requestSong(song)"
                >
                  <template #icon>
                    <NIcon :component="CloudAdd20Filled" />
                  </template>
                </NButton>
              </template>
              {{ getSongRequestTooltip(song, liveRequestSettings, requestAuthState) }}
            </NTooltip>
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.immersive-template {
  display: flex;
  gap: 24px;
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  height: calc(100vh - 130px);
  min-height: 480px;
}

/* 左侧舞台 */
.stage {
  flex: 0 0 340px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 4px;
  overflow-y: auto;
}

.stage-cover {
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 16px 40px -16px rgb(0 0 0 / 0.5);
  background: var(--n-action-color);
  display: flex;
  align-items: center;
  justify-content: center;
}

.stage-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.stage-cover.is-empty {
  background: linear-gradient(135deg, var(--n-action-color), var(--n-border-color));
}

.stage-cover-icon {
  font-size: 80px;
  color: var(--n-text-color-3);
  opacity: 0.5;
}

.stage-title {
  margin-top: 18px;
  font-size: 20px;
  font-weight: 750;
  line-height: 1.25;
  color: var(--n-text-color);
}

.stage-subtitle {
  margin-top: 4px;
  font-size: 13px;
  color: var(--n-text-color-3);
}

.stage-author {
  margin-top: 6px;
  font-size: 14px;
  color: var(--n-text-color-2);
}

.stage-tags {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
}

.stage-request {
  margin-top: 18px;
  width: 100%;
  max-width: 240px;
}

.stage-player {
  margin-top: 16px;
  width: 100%;
}

/* 右侧曲库 */
.library {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;

  --lib-panel-bg: rgba(255, 255, 255, 0.58);
  --lib-border: rgba(15, 23, 42, 0.08);
  --lib-divider: rgba(15, 23, 42, 0.06);
  --lib-hover: rgba(15, 23, 42, 0.05);
  --lib-active: rgba(99, 102, 241, 0.12);
  --lib-accent: #6366f1;
  --lib-cover-bg: rgba(15, 23, 42, 0.06);
}

:global(html.dark) .library {
  --lib-panel-bg: rgba(24, 24, 27, 0.42);
  --lib-border: rgba(255, 255, 255, 0.1);
  --lib-divider: rgba(255, 255, 255, 0.07);
  --lib-hover: rgba(255, 255, 255, 0.07);
  --lib-active: rgba(129, 140, 248, 0.18);
  --lib-accent: #818cf8;
  --lib-cover-bg: rgba(255, 255, 255, 0.08);
}

.library-search {
  margin-bottom: 12px;
  flex: 0 0 auto;
}

.library-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border: 1px solid var(--lib-border);
  border-radius: 14px;
  background: var(--lib-panel-bg);
  backdrop-filter: blur(16px) saturate(1.4);
  -webkit-backdrop-filter: blur(16px) saturate(1.4);
  box-shadow: 0 8px 30px -18px rgba(0, 0, 0, 0.5);
}

.lib-row {
  width: 100%;
  height: 52px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  box-sizing: border-box;
  border: none;
  border-bottom: 1px solid var(--lib-divider);
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background-color 0.12s ease;
}

.lib-row:last-child {
  border-bottom: none;
}

.lib-row:hover {
  background: var(--lib-hover);
}

.lib-row.active {
  background: var(--lib-active);
  box-shadow: inset 3px 0 0 0 var(--lib-accent);
}

.lib-row.is-singing:not(.active) {
  box-shadow: inset 3px 0 0 0 #f0a040;
}

.lib-row.is-queued:not(.active) {
  box-shadow: inset 3px 0 0 0 #52c41a;
}

.lib-cover {
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  border-radius: 8px;
  overflow: hidden;
  background: var(--lib-cover-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
  color: var(--n-text-color-3);
}

.lib-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.lib-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.lib-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--n-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lib-author {
  font-size: 12px;
  color: var(--n-text-color-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lib-flag {
  flex: 0 0 auto;
  font-size: 11px;
  font-weight: 700;
}

.lib-flag.singing {
  color: #f0a040;
}

.lib-flag.queued {
  color: #52c41a;
}

@media (max-width: 860px) {
  .immersive-template {
    flex-direction: column;
    height: auto;
  }

  .stage {
    flex: 0 0 auto;
    overflow: visible;
  }

  .stage-cover {
    max-width: 260px;
  }

  .library-list {
    height: 60vh;
  }
}
</style>
