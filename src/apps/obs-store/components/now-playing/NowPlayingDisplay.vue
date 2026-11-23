<script setup lang="ts">
import { Disc3, Music2, Pause, Radio, User } from 'lucide-vue-next'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import type { WaitingMusicModel } from '@/api/generated/model'
import { getApiMusicRequestGetWaiting } from '@/api/generated/music-request/music-request'
import { resolveObsSyncChannel, useObsBridge } from '@/apps/obs-store/sync'
import { useObsRealtimeSync } from '@/apps/obs/composables/useObsRealtimeSync'
import { resolveFontFamilyCss, useGoogleFont } from '@/apps/user-page/googleFonts'
import { AVATAR_URL } from '@/shared/config'

import {
  computeElapsedSec,
  DEFAULT_NOW_PLAYING_STATE,
  formatTrackTime,
  parseLyrics,
  resolveActiveLyricIndex,
} from './types'
import type { NowPlayingAction, NowPlayingState } from './types'

const props = defineProps<{
  channelId?: string
  userId?: number
  inlineMode?: boolean
  noShadow?: boolean
}>()

const route = useRoute()
const targetChannel = computed(() => resolveObsSyncChannel(props.channelId ?? route.query.channel))

const { state, userId: resolvedUserId } = useObsBridge<NowPlayingState, NowPlayingAction>({
  componentId: 'now-playing',
  channelId: targetChannel,
  userId: () => props.userId,
  defaultState: DEFAULT_NOW_PLAYING_STATE,
  role: 'viewer',
})

useGoogleFont(computed(() => state.value.fontFamily || undefined))
const customFontCss = computed(() => resolveFontFamilyCss(state.value.fontFamily))

// 点歌机实时数据监听
const requestPlaying = ref<WaitingMusicModel | null>(null)
let requestSeq = 0

function applyMusicRequestSnapshot(snapshot: { playing?: WaitingMusicModel | null }) {
  requestPlaying.value = snapshot?.playing ?? null
}

async function fetchMusicRequestPlaying() {
  if (state.value.source !== 'music_request') return
  const uid = resolvedUserId.value
  if (!uid) return
  const seq = ++requestSeq
  try {
    const res = await getApiMusicRequestGetWaiting({ id: uid })
    if (seq !== requestSeq) return
    if (res.code === 200) {
      applyMusicRequestSnapshot(res.data)
    }
  } catch {
    // 网络抖动时保留上一帧状态，由实时重连与兜底轮询恢复
  }
}

const { on: onMusicRequestEvent } = useObsRealtimeSync({
  topic: () =>
    state.value.source === 'music_request' && resolvedUserId.value
      ? `obs:display:music-request:${resolvedUserId.value}`
      : '',
  active: () => state.value.source === 'music_request',
  onSync: fetchMusicRequestPlaying,
})

onMusicRequestEvent<{ playing?: WaitingMusicModel | null }>('Snapshot', (payload) => {
  if (payload) {
    applyMusicRequestSnapshot(payload)
  }
})

watch(
  () => [state.value.source, resolvedUserId.value] as const,
  ([src]) => {
    if (src === 'music_request') {
      void fetchMusicRequestPlaying()
    }
  },
)

// 播放进度时钟
const nowMs = ref(Date.now())
const timer = window.setInterval(() => {
  if (state.value.isPlaying) {
    nowMs.value = Date.now()
  }
}, 250)

onUnmounted(() => {
  window.clearInterval(timer)
})

const isRequestMode = computed(() => state.value.source === 'music_request')

const activeTrack = computed(() => {
  if (isRequestMode.value) {
    const item = requestPlaying.value
    if (!item?.music) {
      return {
        hasTrack: false,
        title: '等待点歌中…',
        artist: '点歌机已就绪',
        coverUrl: '',
        requester: '',
      }
    }
    const fallbackAvatar = item.from?.uid ? `${AVATAR_URL}${item.from.uid}` : ''
    return {
      hasTrack: true,
      title: item.music.name || '未命名曲目',
      artist: item.music.author?.length ? item.music.author.join(' / ') : '未知歌手',
      coverUrl: item.music.cover || fallbackAvatar,
      requester: item.from?.name || '主播添加',
    }
  }

  return {
    hasTrack: Boolean(state.value.title.trim()),
    title: state.value.title.trim() || '未设置曲目',
    artist: state.value.artist.trim() || '未知歌手',
    coverUrl: state.value.coverUrl.trim(),
    requester: state.value.requester.trim(),
  }
})

const isAnimating = computed(() => state.value.isPlaying && activeTrack.value.hasTrack)

const currentSec = computed(() => computeElapsedSec(state.value, nowMs.value))
const progressRatio = computed(() => {
  const duration = Math.max(1, state.value.durationSec || 1)
  return Math.min(1, Math.max(0, currentSec.value / duration))
})

const parsedLyrics = computed(() => parseLyrics(state.value.lyricsText, state.value.durationSec))
const activeLyricIndex = computed(() => resolveActiveLyricIndex(parsedLyrics.value, currentSec.value))

const currentLyricLine = computed(() => {
  if (activeLyricIndex.value < 0) return ''
  return parsedLyrics.value[activeLyricIndex.value]?.text ?? ''
})

const prevLyricLine = computed(() => {
  if (activeLyricIndex.value <= 0) return ''
  return parsedLyrics.value[activeLyricIndex.value - 1]?.text ?? ''
})

const nextLyricLine = computed(() => {
  if (activeLyricIndex.value < 0) return ''
  return parsedLyrics.value[activeLyricIndex.value + 1]?.text ?? ''
})
</script>

<template>
  <div
    class="np-root"
    :class="[
      `theme-${state.theme}`,
      `layout-${state.layout}`,
      { 'is-inline': props.inlineMode, 'is-no-shadow': props.noShadow, 'is-paused': !isAnimating },
    ]"
    :style="{ '--np-accent': state.accentColor, fontFamily: customFontCss }"
  >
    <!-- 布局 1：旋转黑胶唱片 (vinyl) -->
    <div
      v-if="state.layout === 'vinyl'"
      class="np-card np-vinyl-card"
    >
      <div class="np-vinyl-wrap">
        <div
          class="np-vinyl-disc"
          :class="{ 'is-spinning': isAnimating }"
        >
          <div class="np-vinyl-grooves" />
          <div class="np-vinyl-label">
            <img
              v-if="activeTrack.coverUrl"
              :src="activeTrack.coverUrl"
              :alt="activeTrack.title"
              class="np-cover-img"
            />
            <Disc3
              v-else
              class="np-cover-fallback"
            />
          </div>
          <div class="np-vinyl-spindle" />
        </div>
        <div
          v-if="!isAnimating"
          class="np-paused-badge"
        >
          <Pause class="size-3" />
        </div>
      </div>

      <div class="np-vinyl-body">
        <div class="np-top-row">
          <div class="np-title-group">
            <div class="np-title">{{ activeTrack.title }}</div>
            <div class="np-artist">{{ activeTrack.artist }}</div>
          </div>

          <div
            v-if="state.showVisualizer"
            class="np-eq"
            :class="{ 'is-active': isAnimating }"
            aria-hidden="true"
          >
            <span class="np-eq-bar np-eq-1" />
            <span class="np-eq-bar np-eq-2" />
            <span class="np-eq-bar np-eq-3" />
            <span class="np-eq-bar np-eq-4" />
          </div>
        </div>

        <div class="np-meta-row">
          <span
            v-if="state.showRequester && activeTrack.requester"
            class="np-pill"
          >
            <User class="size-2.5 shrink-0" />
            <span class="truncate">{{ activeTrack.requester }}</span>
          </span>
          <span
            v-if="isRequestMode"
            class="np-pill np-pill-live"
          >
            <Radio class="size-2.5 shrink-0" />
            <span>点歌机</span>
          </span>
          <span
            v-if="!isRequestMode && state.showProgress"
            class="np-time tabular-nums"
          >
            {{ formatTrackTime(currentSec) }} / {{ formatTrackTime(state.durationSec) }}
          </span>
        </div>

        <div
          v-if="currentLyricLine && !isRequestMode"
          class="np-lyric-ticker"
        >
          <Transition
            name="np-fade"
            mode="out-in"
          >
            <span
              :key="activeLyricIndex"
              class="np-lyric-inline"
            >
              {{ currentLyricLine }}
            </span>
          </Transition>
        </div>
      </div>

      <div
        v-if="state.showProgress && !isRequestMode"
        class="np-progress-track"
      >
        <div
          class="np-progress-fill"
          :style="{ transform: `scaleX(${progressRatio})` }"
        />
      </div>
    </div>

    <!-- 布局 2：紧凑胶囊横条 (bar) -->
    <div
      v-else-if="state.layout === 'bar'"
      class="np-card np-bar-card"
    >
      <div
        class="np-bar-cover"
        :class="{ 'is-spinning': isAnimating }"
      >
        <img
          v-if="activeTrack.coverUrl"
          :src="activeTrack.coverUrl"
          :alt="activeTrack.title"
          class="np-cover-img"
        />
        <Music2
          v-else
          class="size-4 text-white/90"
        />
      </div>

      <div class="np-bar-info">
        <div class="np-bar-primary">
          <span class="np-title">{{ activeTrack.title }}</span>
          <span class="np-bar-sep">·</span>
          <span class="np-artist">{{ activeTrack.artist }}</span>
        </div>
        <div
          v-if="currentLyricLine && !isRequestMode"
          class="np-bar-sub"
        >
          {{ currentLyricLine }}
        </div>
      </div>

      <div class="np-bar-right">
        <span
          v-if="state.showRequester && activeTrack.requester"
          class="np-pill"
        >
          <User class="size-2.5 shrink-0" />
          <span class="truncate max-w-[72px]">{{ activeTrack.requester }}</span>
        </span>
        <div
          v-if="state.showVisualizer"
          class="np-eq"
          :class="{ 'is-active': isAnimating }"
          aria-hidden="true"
        >
          <span class="np-eq-bar np-eq-1" />
          <span class="np-eq-bar np-eq-2" />
          <span class="np-eq-bar np-eq-3" />
        </div>
      </div>

      <div
        v-if="state.showProgress && !isRequestMode"
        class="np-progress-track np-bar-progress"
      >
        <div
          class="np-progress-fill"
          :style="{ transform: `scaleX(${progressRatio})` }"
        />
      </div>
    </div>

    <!-- 布局 3：大字滚动歌词卡 (lyric) -->
    <div
      v-else
      class="np-card np-lyric-card"
    >
      <div class="np-lyric-header">
        <div class="np-lyric-status">
          <span
            class="np-status-dot"
            :class="{ 'is-live': isAnimating }"
          />
          <span class="np-status-text">{{ isAnimating ? 'NOW PLAYING' : 'PAUSED' }}</span>
        </div>

        <div class="np-lyric-song-badge">
          <Music2 class="size-3 shrink-0" />
          <span class="truncate">{{ activeTrack.title }}</span>
          <span
            v-if="activeTrack.artist"
            class="np-lyric-artist"
          >
            - {{ activeTrack.artist }}
          </span>
        </div>
      </div>

      <div class="np-lyric-stage">
        <template v-if="parsedLyrics.length && !isRequestMode">
          <div class="np-lyric-line np-lyric-muted">{{ prevLyricLine || '\u00A0' }}</div>
          <Transition
            name="np-fade"
            mode="out-in"
          >
            <div
              :key="activeLyricIndex"
              class="np-lyric-line np-lyric-current"
            >
              {{ currentLyricLine }}
            </div>
          </Transition>
          <div class="np-lyric-line np-lyric-muted">{{ nextLyricLine || '\u00A0' }}</div>
        </template>
        <template v-else>
          <div class="np-lyric-line np-lyric-current">{{ activeTrack.title }}</div>
          <div class="np-lyric-line np-lyric-muted">
            {{ activeTrack.artist }}
            <template v-if="state.showRequester && activeTrack.requester">
              · 点歌：{{ activeTrack.requester }}</template
            >
          </div>
        </template>
      </div>

      <div
        v-if="state.showProgress && !isRequestMode"
        class="np-progress-track"
      >
        <div
          class="np-progress-fill"
          :style="{ transform: `scaleX(${progressRatio})` }"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.np-root {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  user-select: none;
}

.np-card {
  position: relative;
  width: 100%;
  max-width: 420px;
  overflow: hidden;
  transition:
    background-color 180ms ease,
    border-color 180ms ease,
    color 180ms ease;
}

/* 4 套视觉主题 */
.theme-card .np-card {
  background: rgba(16, 18, 24, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(12px);
  border-radius: 16px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.42);
  color: #f8fafc;
}

.theme-minimal .np-card {
  background: transparent;
  border: 1px solid transparent;
  border-radius: 14px;
  color: #ffffff;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.9);
}

.theme-neon .np-card {
  background: rgba(9, 10, 18, 0.94);
  border: 1px solid var(--np-accent);
  border-radius: 14px;
  box-shadow:
    0 0 18px color-mix(in srgb, var(--np-accent) 42%, transparent),
    inset 0 0 12px color-mix(in srgb, var(--np-accent) 12%, transparent);
  color: #ffffff;
}

.theme-glass .np-card {
  background: rgba(255, 255, 255, 0.13);
  border: 1px solid rgba(255, 255, 255, 0.28);
  backdrop-filter: blur(18px);
  border-radius: 18px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  color: #ffffff;
}

.is-no-shadow .np-card {
  box-shadow: none !important;
}

/* 布局 1：黑胶唱片 */
.np-vinyl-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px 14px;
}

.np-vinyl-wrap {
  position: relative;
  width: 72px;
  height: 72px;
  flex-shrink: 0;
}

.np-vinyl-disc {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: radial-gradient(circle at center, #262933 0%, #101218 44%, #1e222d 62%, #0c0e13 100%);
  border: 2px solid rgba(255, 255, 255, 0.14);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  animation: np-spin 9s linear infinite;
  animation-play-state: paused;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45);
}

.np-vinyl-disc.is-spinning {
  animation-play-state: running;
}

.np-vinyl-grooves {
  position: absolute;
  inset: 5px;
  border-radius: 50%;
  background: repeating-radial-gradient(circle at center, rgba(255, 255, 255, 0.05) 0 1px, transparent 1px 4px);
  pointer-events: none;
}

.np-vinyl-label {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  background: linear-gradient(135deg, var(--np-accent), #1e293b);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid rgba(255, 255, 255, 0.22);
}

.np-vinyl-spindle {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #0f172a;
  border: 1.5px solid rgba(255, 255, 255, 0.45);
}

.np-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.np-cover-fallback {
  width: 20px;
  height: 20px;
  color: rgba(255, 255, 255, 0.9);
}

.np-paused-badge {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(15, 23, 42, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.24);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.np-vinyl-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.np-top-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.np-title-group {
  min-width: 0;
  flex: 1;
}

.np-title {
  font-size: 16px;
  font-weight: 700;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.np-artist {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.72);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.np-meta-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.np-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: 9999px;
  font-size: 10px;
  font-weight: 600;
  background: color-mix(in srgb, var(--np-accent) 20%, rgba(255, 255, 255, 0.08));
  border: 1px solid color-mix(in srgb, var(--np-accent) 42%, transparent);
  color: #f8fafc;
  max-width: 140px;
}

.np-pill-live {
  background: rgba(16, 185, 129, 0.2);
  border-color: rgba(16, 185, 129, 0.45);
}

.np-time {
  margin-left: auto;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.65);
}

.np-lyric-ticker {
  min-height: 18px;
  overflow: hidden;
}

.np-lyric-inline {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--np-accent);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 音律跳动条 (纯 GPU scaleY) */
.np-eq {
  display: inline-flex;
  align-items: flex-end;
  gap: 3px;
  height: 18px;
  flex-shrink: 0;
  padding-top: 2px;
}

.np-eq-bar {
  width: 3px;
  height: 100%;
  border-radius: 9999px;
  background: var(--np-accent);
  transform-origin: bottom;
  transform: scaleY(0.28);
}

.np-eq.is-active .np-eq-1 {
  animation: np-eq-bounce 0.72s ease-in-out infinite alternate;
}

.np-eq.is-active .np-eq-2 {
  animation: np-eq-bounce 0.54s ease-in-out 0.14s infinite alternate;
}

.np-eq.is-active .np-eq-3 {
  animation: np-eq-bounce 0.82s ease-in-out 0.26s infinite alternate;
}

.np-eq.is-active .np-eq-4 {
  animation: np-eq-bounce 0.62s ease-in-out 0.08s infinite alternate;
}

/* 布局 2：紧凑胶囊横条 */
.np-bar-card {
  border-radius: 9999px !important;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px 10px 10px;
}

.np-bar-cover {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--np-accent), #1e293b);
  border: 1.5px solid rgba(255, 255, 255, 0.25);
  animation: np-spin 10s linear infinite;
  animation-play-state: paused;
}

.np-bar-cover.is-spinning {
  animation-play-state: running;
}

.np-bar-info {
  flex: 1;
  min-width: 0;
}

.np-bar-primary {
  display: flex;
  align-items: baseline;
  gap: 5px;
  min-width: 0;
}

.np-bar-card .np-title {
  font-size: 14px;
}

.np-bar-sep {
  opacity: 0.45;
  flex-shrink: 0;
}

.np-bar-sub {
  font-size: 11px;
  color: var(--np-accent);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 1px;
}

.np-bar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.np-bar-progress {
  left: 22px !important;
  right: 22px !important;
  width: auto !important;
}

/* 布局 3：大字歌词卡 */
.np-lyric-card {
  padding: 12px 16px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.np-lyric-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.np-lyric-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.7);
}

.np-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.4);
}

.np-status-dot.is-live {
  background: var(--np-accent);
  box-shadow: 0 0 8px var(--np-accent);
}

.np-lyric-song-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 240px;
  padding: 2px 9px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.16);
  color: #f8fafc;
}

.np-lyric-artist {
  opacity: 0.7;
  font-weight: 500;
  flex-shrink: 0;
}

.np-lyric-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 3px;
  padding: 2px 4px;
}

.np-lyric-line {
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.np-lyric-current {
  font-size: 18px;
  font-weight: 800;
  line-height: 1.35;
  color: #ffffff;
  text-shadow: 0 0 16px color-mix(in srgb, var(--np-accent) 45%, transparent);
}

.np-lyric-muted {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.3;
}

/* 底部细进度条 */
.np-progress-track {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 3px;
  background: rgba(255, 255, 255, 0.14);
  overflow: hidden;
}

.np-progress-fill {
  width: 100%;
  height: 100%;
  background: var(--np-accent);
  transform-origin: left;
  transition: transform 200ms linear;
}

@keyframes np-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes np-eq-bounce {
  0% {
    transform: scaleY(0.24);
  }
  100% {
    transform: scaleY(1);
  }
}

.np-fade-enter-active,
.np-fade-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.np-fade-enter-from {
  opacity: 0;
  transform: translateY(5px);
}

.np-fade-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}
</style>
