<script setup lang="ts">
import { Disc3, Music2, Pin, Sparkles } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { getApiSongListGet } from '@/api/generated/song-list/song-list'
import { resolveObsSyncChannel, useObsBridge } from '@/apps/obs-store/sync'
import { resolveFontFamilyCss, useGoogleFont } from '@/apps/user-page/googleFonts'

import { DEFAULT_SONG_PICKER_STATE, DEMO_SONGS, filterPickerSongs, normalizeSongModel } from './types'
import type { PickerSongItem, SongDrawRecord, SongPickerAction, SongPickerState } from './types'

const props = defineProps<{
  channelId?: string
  userId?: number
  inlineMode?: boolean
  noShadow?: boolean
}>()

const route = useRoute()
const targetChannel = computed(() => resolveObsSyncChannel(props.channelId ?? route.query.channel))

const {
  state,
  onAction,
  userId: resolvedUserId,
} = useObsBridge<SongPickerState, SongPickerAction>({
  componentId: 'song-picker',
  channelId: targetChannel,
  userId: () => props.userId,
  defaultState: DEFAULT_SONG_PICKER_STATE,
  role: 'viewer',
})

useGoogleFont(computed(() => state.value.fontFamily || undefined))
const customFontCss = computed(() => resolveFontFamilyCss(state.value.fontFamily))

// 曲库数据加载
const remoteSongs = ref<PickerSongItem[]>([])
const isLoadingSongs = ref(false)
let loadSeq = 0

async function loadSongList() {
  const uid = resolvedUserId.value
  if (!uid) return
  const seq = ++loadSeq
  isLoadingSongs.value = true
  try {
    const res = await getApiSongListGet({ id: String(uid) })
    if (seq !== loadSeq) return
    if (res.code === 200 && Array.isArray(res.data)) {
      remoteSongs.value = res.data.map(normalizeSongModel)
    }
  } catch {
    // 静默保留已有曲库
  } finally {
    if (seq === loadSeq) isLoadingSongs.value = false
  }
}

watch(
  resolvedUserId,
  (uid) => {
    if (uid) void loadSongList()
  },
  { immediate: true },
)

const sourceSongs = computed<PickerSongItem[]>(() => {
  if (state.value.useDemoSongs) return DEMO_SONGS
  return remoteSongs.value
})

const filteredSongs = computed<PickerSongItem[]>(() =>
  filterPickerSongs(sourceSongs.value, {
    selectedLanguage: state.value.selectedLanguage,
    selectedTag: state.value.selectedTag,
    skipDisabled: state.value.skipDisabled,
  }),
)

const MAX_MARQUEE_SONGS = 120
const marqueeSongs = computed(() => filteredSongs.value.slice(0, MAX_MARQUEE_SONGS))
const shouldScrollMarquee = computed(() => marqueeSongs.value.length > 5)
const marqueeDurationSec = computed(() => {
  const count = Math.max(6, marqueeSongs.value.length)
  const speed = Math.min(3, Math.max(0.5, state.value.scrollSpeed || 1))
  return Number(((count * 2.4) / speed).toFixed(2))
})

const activeFilterLabel = computed(() => {
  const parts: string[] = []
  if (state.value.selectedLanguage) parts.push(state.value.selectedLanguage)
  if (state.value.selectedTag) parts.push(`#${state.value.selectedTag}`)
  return parts.join(' · ')
})

// 盲抽翻牌状态机
type GachaPhase = 'idle' | 'rolling' | 'revealed'

const gachaPhase = ref<GachaPhase>('idle')
const rollingPreview = ref<PickerSongItem | null>(null)
const revealedSong = ref<PickerSongItem | null>(null)
const burstTick = ref(0)

let lastPlayedDrawId = ''
let rollTimeout: ReturnType<typeof setTimeout> | undefined

function clearRollTimers() {
  if (rollTimeout !== undefined) {
    clearTimeout(rollTimeout)
    rollTimeout = undefined
  }
}

function playDrawAnimation(record: SongDrawRecord, immediate = false) {
  if (!record?.drawId || !record.song) return
  if (record.drawId === lastPlayedDrawId) return
  lastPlayedDrawId = record.drawId
  clearRollTimers()

  if (immediate) {
    rollingPreview.value = record.song
    revealedSong.value = record.song
    gachaPhase.value = 'revealed'
    return
  }

  const pool = record.candidates.length > 0 ? record.candidates : [record.song]
  gachaPhase.value = 'rolling'
  revealedSong.value = null

  const totalSteps = 14
  let step = 0

  function tick() {
    if (step < totalSteps) {
      rollingPreview.value = pool[step % pool.length]
      step++
      // 渐进减速的滚动槽节奏：55ms -> 200ms
      const delay = Math.round(55 + Math.pow(step / totalSteps, 2) * 150)
      rollTimeout = setTimeout(tick, delay)
      return
    }
    rollingPreview.value = record.song
    revealedSong.value = record.song
    gachaPhase.value = 'revealed'
    burstTick.value++
  }

  tick()
}

function resetGachaCard() {
  clearRollTimers()
  gachaPhase.value = 'idle'
  rollingPreview.value = null
  revealedSong.value = null
  lastPlayedDrawId = ''
}

onMounted(() => {
  onAction((action) => {
    if (action.type === 'DRAW_SONG') {
      playDrawAnimation(action, false)
    } else if (action.type === 'CLEAR_DRAW') {
      resetGachaCard()
    }
  })
})

watch(
  () => state.value.lastDraw,
  (draw) => {
    if (!draw) {
      if (gachaPhase.value !== 'idle') resetGachaCard()
      return
    }
    if (draw.drawId === lastPlayedDrawId) return
    // 刚抽出的结果（5 秒内）播放完整滚动+翻牌动效，历史快照直接展示结果面
    const isFresh = Date.now() - draw.drawnAt < 5000
    playDrawAnimation(draw, !isFresh)
  },
  { immediate: true },
)

onUnmounted(() => {
  clearRollTimers()
})

function songBadges(song: PickerSongItem): string[] {
  return [...song.language.slice(0, 1), ...song.tags.slice(0, 2)]
}
</script>

<template>
  <div
    class="sp-root"
    :class="[`theme-${state.theme}`, { 'is-inline': props.inlineMode, 'is-no-shadow': props.noShadow }]"
    :style="{ '--sp-accent': state.accentColor, fontFamily: customFontCss }"
  >
    <!-- 模式 1：歌单滚动展示 (marquee) -->
    <div
      v-if="state.mode === 'marquee'"
      class="sp-card sp-marquee-card"
    >
      <div class="sp-header">
        <div class="sp-header-left">
          <Music2 class="sp-header-icon" />
          <span class="sp-title">{{ state.title || '歌单曲库' }}</span>
          <span
            v-if="activeFilterLabel"
            class="sp-filter-pill"
          >
            {{ activeFilterLabel }}
          </span>
        </div>
        <span class="sp-count tabular-nums">{{ filteredSongs.length }} 首</span>
      </div>

      <div
        v-if="filteredSongs.length > 0"
        class="sp-marquee-viewport"
      >
        <div
          class="sp-marquee-track"
          :class="{ 'is-scrolling': shouldScrollMarquee }"
          :style="shouldScrollMarquee ? { animationDuration: `${marqueeDurationSec}s` } : undefined"
        >
          <div class="sp-marquee-group">
            <div
              v-for="song in marqueeSongs"
              :key="`a-${song.key}`"
              class="sp-song-row"
            >
              <div class="sp-song-main">
                <Pin
                  v-if="song.isPinned"
                  class="sp-pin-icon"
                />
                <span class="sp-song-name">{{ song.name }}</span>
                <span
                  v-if="song.author.length"
                  class="sp-song-author"
                >
                  {{ song.author.join(' / ') }}
                </span>
              </div>
              <div
                v-if="songBadges(song).length"
                class="sp-song-tags"
              >
                <span
                  v-for="badge in songBadges(song)"
                  :key="badge"
                  class="sp-tag-pill"
                >
                  {{ badge }}
                </span>
              </div>
            </div>
          </div>

          <div
            v-if="shouldScrollMarquee"
            class="sp-marquee-group"
            aria-hidden="true"
          >
            <div
              v-for="song in marqueeSongs"
              :key="`b-${song.key}`"
              class="sp-song-row"
            >
              <div class="sp-song-main">
                <Pin
                  v-if="song.isPinned"
                  class="sp-pin-icon"
                />
                <span class="sp-song-name">{{ song.name }}</span>
                <span
                  v-if="song.author.length"
                  class="sp-song-author"
                >
                  {{ song.author.join(' / ') }}
                </span>
              </div>
              <div
                v-if="songBadges(song).length"
                class="sp-song-tags"
              >
                <span
                  v-for="badge in songBadges(song)"
                  :key="badge"
                  class="sp-tag-pill"
                >
                  {{ badge }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        v-else
        class="sp-empty"
      >
        {{ isLoadingSongs ? '正在读取歌单…' : '当前筛选池暂无歌曲' }}
      </div>
    </div>

    <!-- 模式 2：盲抽 3D 翻牌 (gacha) -->
    <div
      v-else
      class="sp-gacha-stage"
    >
      <div
        class="sp-flip-card"
        :class="{ 'is-flipped': gachaPhase === 'revealed', 'is-rolling': gachaPhase === 'rolling' }"
      >
        <!-- 卡背 / 滚动揭晓面 -->
        <div class="sp-card sp-flip-face sp-face-front">
          <div class="sp-gacha-glow" />
          <div class="sp-gacha-top">
            <span class="sp-gacha-kicker">
              <Sparkles class="size-3" />
              {{ state.title || '盲抽点歌台' }}
            </span>
            <span class="sp-count tabular-nums">{{ filteredSongs.length }} 首池</span>
          </div>

          <div
            v-if="gachaPhase === 'rolling' && rollingPreview"
            class="sp-roll-window"
          >
            <div class="sp-roll-label">正在抽取下一首…</div>
            <div class="sp-roll-title">{{ rollingPreview.name }}</div>
            <div class="sp-roll-artist">{{ rollingPreview.author.join(' / ') || '未知歌手' }}</div>
          </div>

          <div
            v-else
            class="sp-idle-center"
          >
            <div class="sp-mystery-emblem">
              <Disc3 class="size-9" />
            </div>
            <div class="sp-idle-title">等待盲抽翻牌</div>
            <div class="sp-idle-sub">
              {{ activeFilterLabel ? `当前池：${activeFilterLabel}` : '点击控制台「随机盲抽一首」揭晓曲目' }}
            </div>
          </div>
        </div>

        <!-- 揭晓正面 -->
        <div class="sp-card sp-flip-face sp-face-back">
          <div
            :key="burstTick"
            class="sp-reveal-ring"
          />
          <div class="sp-gacha-top">
            <span class="sp-gacha-kicker sp-winner-badge">
              <Sparkles class="size-3" />
              盲抽揭晓
            </span>
            <span
              v-if="activeFilterLabel"
              class="sp-filter-pill"
            >
              {{ activeFilterLabel }}
            </span>
          </div>

          <div
            v-if="revealedSong"
            class="sp-winner-body"
          >
            <div class="sp-winner-cover">
              <img
                v-if="revealedSong.cover"
                :src="revealedSong.cover"
                :alt="revealedSong.name"
                class="sp-cover-img"
              />
              <Disc3
                v-else
                class="size-8 sp-winner-disc"
              />
            </div>

            <div class="sp-winner-name">{{ revealedSong.name }}</div>
            <div class="sp-winner-author">{{ revealedSong.author.join(' / ') || '未知歌手' }}</div>

            <div
              v-if="songBadges(revealedSong).length"
              class="sp-winner-tags"
            >
              <span
                v-for="badge in songBadges(revealedSong)"
                :key="badge"
                class="sp-tag-pill sp-tag-accent"
              >
                {{ badge }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sp-root {
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

.sp-card {
  box-sizing: border-box;
  transition:
    background-color 180ms ease,
    border-color 180ms ease;
}

/* 4 套视觉主题 */
.theme-card .sp-card {
  background: rgba(16, 18, 24, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(12px);
  border-radius: 16px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.42);
  color: #f8fafc;
}

.theme-minimal .sp-card {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 14px;
  color: #ffffff;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.92);
}

.theme-neon .sp-card {
  background: rgba(9, 10, 18, 0.95);
  border: 1px solid var(--sp-accent);
  border-radius: 14px;
  box-shadow:
    0 0 18px color-mix(in srgb, var(--sp-accent) 44%, transparent),
    inset 0 0 12px color-mix(in srgb, var(--sp-accent) 14%, transparent);
  color: #ffffff;
}

.theme-glass .sp-card {
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.28);
  backdrop-filter: blur(18px);
  border-radius: 18px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  color: #ffffff;
}

.is-no-shadow .sp-card {
  box-shadow: none !important;
}

/* Marquee 卡片 */
.sp-marquee-card {
  width: 100%;
  max-width: 420px;
  height: 316px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: hidden;
}

.sp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-shrink: 0;
}

.sp-header-left {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.sp-header-icon {
  width: 16px;
  height: 16px;
  color: var(--sp-accent);
  flex-shrink: 0;
}

.sp-title {
  font-size: 15px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sp-filter-pill {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 9999px;
  background: color-mix(in srgb, var(--sp-accent) 22%, rgba(255, 255, 255, 0.08));
  border: 1px solid color-mix(in srgb, var(--sp-accent) 45%, transparent);
  color: #f8fafc;
  white-space: nowrap;
}

.sp-count {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.85);
  flex-shrink: 0;
}

.sp-marquee-viewport {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  position: relative;
  mask-image: linear-gradient(to bottom, transparent 0%, #000 8%, #000 92%, transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, #000 8%, #000 92%, transparent 100%);
}

.sp-marquee-track {
  display: flex;
  flex-direction: column;
}

.sp-marquee-track.is-scrolling {
  animation: sp-marquee-scroll 20s linear infinite;
  will-change: transform;
}

.sp-marquee-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-bottom: 6px;
}

.sp-song-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.07);
}

.theme-minimal .sp-song-row {
  background: rgba(0, 0, 0, 0.3);
}

.sp-song-main {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.sp-pin-icon {
  width: 12px;
  height: 12px;
  color: var(--sp-accent);
  flex-shrink: 0;
  align-self: center;
}

.sp-song-name {
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sp-song-author {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.62);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sp-song-tags {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.sp-tag-pill {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.85);
}

.sp-tag-accent {
  background: color-mix(in srgb, var(--sp-accent) 24%, rgba(255, 255, 255, 0.08));
  border: 1px solid color-mix(in srgb, var(--sp-accent) 45%, transparent);
  color: #ffffff;
}

.sp-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.62);
}

/* Gacha 3D 翻牌舞台 */
.sp-gacha-stage {
  width: 100%;
  max-width: 390px;
  height: 292px;
  perspective: 1100px;
}

.sp-flip-card {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 620ms cubic-bezier(0.22, 1, 0.36, 1);
}

.sp-flip-card.is-rolling {
  animation: sp-roll-pulse 260ms ease-in-out infinite alternate;
}

.sp-flip-card.is-flipped {
  transform: rotateY(180deg);
}

.sp-flip-face {
  position: absolute;
  inset: 0;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  overflow: hidden;
}

.sp-face-back {
  transform: rotateY(180deg);
}

.sp-gacha-glow {
  position: absolute;
  inset: -40%;
  background: radial-gradient(circle at center, color-mix(in srgb, var(--sp-accent) 22%, transparent), transparent 60%);
  pointer-events: none;
}

.sp-gacha-top {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.sp-gacha-kicker {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--sp-accent);
}

.sp-winner-badge {
  padding: 2px 9px;
  border-radius: 9999px;
  background: color-mix(in srgb, var(--sp-accent) 24%, transparent);
  border: 1px solid color-mix(in srgb, var(--sp-accent) 50%, transparent);
  color: #ffffff;
}

.sp-idle-center,
.sp-roll-window,
.sp-winner-body {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 8px;
}

.sp-mystery-emblem {
  width: 68px;
  height: 68px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--sp-accent);
  background: color-mix(in srgb, var(--sp-accent) 16%, rgba(255, 255, 255, 0.06));
  border: 1.5px solid color-mix(in srgb, var(--sp-accent) 45%, transparent);
}

.sp-idle-title {
  font-size: 17px;
  font-weight: 700;
}

.sp-idle-sub {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.68);
  max-width: 280px;
}

.sp-roll-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--sp-accent);
  letter-spacing: 0.08em;
}

.sp-roll-title {
  font-size: 22px;
  font-weight: 800;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sp-roll-artist {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.72);
}

.sp-winner-cover {
  width: 68px;
  height: 68px;
  border-radius: 14px;
  overflow: hidden;
  background: linear-gradient(135deg, var(--sp-accent), #1e293b);
  border: 2px solid color-mix(in srgb, var(--sp-accent) 65%, #ffffff);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 20px color-mix(in srgb, var(--sp-accent) 36%, transparent);
}

.sp-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sp-winner-disc {
  color: #ffffff;
}

.sp-winner-name {
  font-size: 22px;
  font-weight: 800;
  line-height: 1.25;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.sp-winner-author {
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.78);
}

.sp-winner-tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 5px;
  margin-top: 2px;
}

.sp-reveal-ring {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 120px;
  height: 120px;
  margin-left: -60px;
  margin-top: -60px;
  border-radius: 50%;
  border: 2px solid var(--sp-accent);
  pointer-events: none;
  opacity: 0;
  animation: sp-ring-burst 680ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

@keyframes sp-marquee-scroll {
  0% {
    transform: translate3d(0, 0, 0);
  }
  100% {
    transform: translate3d(0, -50%, 0);
  }
}

@keyframes sp-roll-pulse {
  from {
    transform: scale(0.985);
  }
  to {
    transform: scale(1.015);
  }
}

@keyframes sp-ring-burst {
  0% {
    opacity: 0.85;
    transform: scale(0.5);
  }
  100% {
    opacity: 0;
    transform: scale(2.8);
  }
}
</style>
