<script setup lang="ts">
import ArrowNext20Filled from '@vicons/fluent/es/ArrowNext20Filled'
import ArrowPrevious20Filled from '@vicons/fluent/es/ArrowPrevious20Filled'
import ChevronDown24Regular from '@vicons/fluent/es/ChevronDown24Regular'
import ChevronUp24Regular from '@vicons/fluent/es/ChevronUp24Regular'
import Delete24Regular from '@vicons/fluent/es/Delete24Regular'
import DesktopSpeaker24Filled from '@vicons/fluent/es/DesktopSpeaker24Filled'
import MusicNote224Filled from '@vicons/fluent/es/MusicNote224Filled'
import Play24Filled from '@vicons/fluent/es/Play24Filled'
import { useElementSize } from '@vueuse/core'
import { Pause } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
// @ts-ignore
import APlayer from 'vue3-aplayer'

import { usePersistedStorage } from '@/shared/storage/persist'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Slider } from '@/shared/ui/slider'
import { useMusicRequestProvider } from '@/store/useMusicRequest'

const emit = defineEmits<{
  (e: 'heightChange', height: number): void
}>()

const musicRquestStore = useMusicRequestProvider()

const musicPlayerCardRef = ref<HTMLElement | null>(null)
const { height: musicPlayerCardHeight } = useElementSize(musicPlayerCardRef)

const isPlayerVisible = computed(
  () => musicRquestStore.originMusics.length > 0 || musicRquestStore.waitingMusics.length > 0,
)

const isPlayerMinimized = usePersistedStorage('Settings.MusicPlayer.Minimized', false)

const playerVolume = computed({
  get: () => musicRquestStore.settings.volume,
  set: (value) => (musicRquestStore.settings.volume = value),
})

const aplayer = ref<any>()

const sliderVolume = computed({
  get: () => [playerVolume.value * 100],
  set: (val) => {
    if (val && val.length > 0) playerVolume.value = val[0] / 100
  },
})
watch(aplayer, () => {
  musicRquestStore.aplayerRef = aplayer.value
})

const currentPlayingInfo = computed(() => {
  if (musicRquestStore.currentOriginMusic && musicRquestStore.isPlayingOrderMusic) {
    return {
      type: 'request',
      info: `正在播放 ${musicRquestStore.currentOriginMusic.from.name} 点的歌`,
    } as const
  } else if (musicRquestStore.currentMusic && musicRquestStore.currentMusic.title) {
    return {
      type: 'normal',
      info: '正在播放背景音乐',
    } as const
  }
  return null
})

const footerHeight = computed(() => {
  if (!isPlayerVisible.value) return 0
  return musicPlayerCardHeight.value + 16
})

watch(footerHeight, (val) => emit('heightChange', val), { immediate: true })

function onNextMusic() {
  musicRquestStore.nextMusic()
}

function togglePlay() {
  if (!aplayer.value) return
  const audio = aplayer.value.audio
  if (audio.paused) aplayer.value.play()
  else aplayer.value.pause()
}

function onPreviousMusic() {
  if (!aplayer.value) return
  if (aplayer.value.audio.currentTime > 3) {
    aplayer.value.audio.currentTime = 0
    return
  }
  const currentIndex = musicRquestStore.aplayerMusics.findIndex(
    (music) => music.id === musicRquestStore.currentMusic.id,
  )
  if (currentIndex > 0) {
    musicRquestStore.currentMusic = musicRquestStore.aplayerMusics[currentIndex - 1]
    aplayer.value.thenPlay()
  }
}

function clearWaitingQueue() {
  musicRquestStore.clearWaitingWithUndo()
}

function togglePlayerMinimize() {
  isPlayerMinimized.value = !isPlayerMinimized.value
}
</script>

<template>
  <footer
    v-if="isPlayerVisible"
    class="shrink-0 z-20 bg-background/90 backdrop-blur-md border-t border-border px-3 py-2 transition-all duration-200"
  >
    <div
      ref="musicPlayerCardRef"
      class="rounded-lg border border-border bg-card shadow-sm p-2.5 max-w-7xl mx-auto"
    >
      <!-- 顶部状态栏 -->
      <div class="flex-between gap-2 pb-1.5 border-b border-border/50 text-xs">
        <div class="flex items-center gap-2 min-w-0">
          <MusicNote224Filled class="size-4 text-primary shrink-0" />
          <span class="font-semibold text-foreground shrink-0">音乐播放器</span>

          <Badge
            v-if="currentPlayingInfo && !isPlayerMinimized"
            :variant="currentPlayingInfo.type === 'request' ? 'default' : 'secondary'"
            size="sm"
            class="truncate"
          >
            {{ currentPlayingInfo.info }}
          </Badge>

          <template v-if="isPlayerMinimized">
            <span
              v-if="musicRquestStore.currentMusic.title"
              class="text-xs text-muted-foreground truncate max-w-xs"
            >
              {{ musicRquestStore.currentMusic.title }} - {{ musicRquestStore.currentMusic.artist }}
            </span>
            <span
              v-else
              class="text-xs text-muted-foreground/60"
            >
              暂无播放
            </span>
          </template>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <template v-if="isPlayerMinimized">
            <Badge
              v-if="musicRquestStore.waitingMusics.length > 0"
              variant="destructive"
              size="xs"
            >
              {{ musicRquestStore.waitingMusics.length }}
            </Badge>

            <Button
              size="icon-xs"
              variant="ghost"
              :disabled="musicRquestStore.aplayerMusics.length === 0"
              @click.stop="togglePlay"
            >
              <Pause
                v-if="aplayer?.audio?.paused === false"
                class="size-3.5"
              />
              <Play24Filled
                v-else
                class="size-3.5"
              />
            </Button>

            <Button
              size="icon-xs"
              variant="ghost"
              :disabled="musicRquestStore.waitingMusics.length === 0 && musicRquestStore.aplayerMusics.length <= 1"
              @click.stop="onNextMusic"
            >
              <ArrowNext20Filled class="size-3.5" />
            </Button>
          </template>

          <Button
            size="icon-xs"
            variant="ghost"
            :aria-label="isPlayerMinimized ? '展开播放器' : '收起播放器'"
            @click="togglePlayerMinimize"
          >
            <ChevronUp24Regular
              v-if="isPlayerMinimized"
              class="size-4"
            />
            <ChevronDown24Regular
              v-else
              class="size-4"
            />
          </Button>
        </div>
      </div>

      <!-- 主体展开区 -->
      <div
        v-show="!isPlayerMinimized"
        class="pt-2 flex items-center gap-4 flex-wrap md:flex-nowrap"
      >
        <div class="flex-1 min-w-[280px]">
          <APlayer
            ref="aplayer"
            v-model:music="musicRquestStore.currentMusic"
            v-model:volume="playerVolume"
            v-model:shuffle="musicRquestStore.settings.shuffle"
            v-model:repeat="musicRquestStore.settings.repeat"
            :list="musicRquestStore.aplayerMusics"
            list-max-height="200"
            mutex
            list-folded
            @ended="musicRquestStore.onMusicEnd"
            @play="musicRquestStore.onMusicPlay"
          />
        </div>

        <div class="music-control-panel flex items-center gap-6 shrink-0 flex-wrap">
          <!-- 播放控制 -->
          <div class="flex flex-col items-center gap-1.5">
            <span class="text-xs font-medium text-muted-foreground">播放控制</span>
            <div class="flex items-center gap-1">
              <Button
                size="icon-sm"
                variant="outline"
                aria-label="上一首 / 重播"
                :disabled="musicRquestStore.aplayerMusics.length === 0"
                @click="onPreviousMusic"
              >
                <ArrowPrevious20Filled class="size-3.5" />
              </Button>

              <Button
                size="icon-sm"
                variant="default"
                :aria-label="aplayer?.audio?.paused !== false ? '播放' : '暂停'"
                :disabled="musicRquestStore.aplayerMusics.length === 0"
                @click="togglePlay"
              >
                <Pause
                  v-if="aplayer?.audio?.paused === false"
                  class="size-3.5"
                />
                <Play24Filled
                  v-else
                  class="size-3.5"
                />
              </Button>

              <Button
                size="icon-sm"
                variant="outline"
                aria-label="下一首"
                :disabled="musicRquestStore.waitingMusics.length === 0 && musicRquestStore.aplayerMusics.length <= 1"
                @click="onNextMusic"
              >
                <ArrowNext20Filled class="size-3.5" />
              </Button>
            </div>
          </div>

          <!-- 队列管理 -->
          <div class="flex flex-col items-center gap-1">
            <span class="text-xs font-medium text-muted-foreground">队列管理</span>
            <div class="flex items-center gap-1.5">
              <Badge
                variant="secondary"
                size="sm"
              >
                等待: {{ musicRquestStore.waitingMusics.length }}
              </Badge>
              <Badge
                variant="outline"
                size="sm"
              >
                歌单: {{ musicRquestStore.originMusics.length }}
              </Badge>
              <Button
                v-if="musicRquestStore.waitingMusics.length > 0"
                size="xs"
                variant="destructive"
                title="清空所有等待中的点歌"
                @click="clearWaitingQueue"
              >
                <Delete24Regular class="size-3 mr-0.5" />
                清空
              </Button>
            </div>
          </div>

          <!-- 音量控制 -->
          <div class="flex flex-col items-center gap-1.5 min-w-[90px]">
            <div class="flex items-center gap-1 text-xs text-muted-foreground">
              <DesktopSpeaker24Filled class="size-3.5" />
              <span>音量 {{ Math.round(playerVolume * 100) }}%</span>
            </div>
            <Slider
              v-model="sliderVolume"
              :max="100"
              :step="1"
              class="w-20"
            />
          </div>
        </div>
      </div>
    </div>
  </footer>
</template>

<style scoped>
/* 深度暗色模式与风格适配 APlayer */
:deep(.aplayer) {
  background: var(--card) !important;
  color: var(--card-foreground) !important;
  box-shadow: none !important;
  border: 1px solid var(--border) !important;
  border-radius: var(--radius) !important;
  margin: 0 !important;
}

:deep(.aplayer .aplayer-body) {
  background: transparent !important;
}

:deep(.aplayer .aplayer-info) {
  border-top: none !important;
  padding: 8px 12px !important;
}

:deep(.aplayer .aplayer-info .aplayer-music .aplayer-title) {
  color: var(--foreground) !important;
  font-size: 13px !important;
  font-weight: 600 !important;
}

:deep(.aplayer .aplayer-info .aplayer-music .aplayer-author) {
  color: var(--muted-foreground) !important;
  font-size: 11px !important;
}

:deep(.aplayer .aplayer-info .aplayer-controller .aplayer-time) {
  color: var(--muted-foreground) !important;
  font-size: 11px !important;
}

:deep(.aplayer .aplayer-info .aplayer-controller .aplayer-time .aplayer-icon) {
  color: var(--muted-foreground) !important;
}

:deep(.aplayer .aplayer-info .aplayer-controller .aplayer-time .aplayer-icon:hover) {
  color: var(--foreground) !important;
}

:deep(.aplayer .aplayer-list) {
  background: var(--card) !important;
}

:deep(.aplayer .aplayer-list ol li) {
  border-top-color: var(--border) !important;
  color: var(--muted-foreground) !important;
}

:deep(.aplayer .aplayer-list ol li:hover) {
  background: color-mix(in srgb, var(--muted) 50%, transparent) !important;
}

:deep(.aplayer .aplayer-list ol li.aplayer-list-light) {
  background: var(--muted) !important;
  color: var(--foreground) !important;
}

:deep(.aplayer .aplayer-list ol li .aplayer-list-title) {
  font-size: 12px !important;
}

:deep(.aplayer .aplayer-list ol li .aplayer-list-author) {
  font-size: 11px !important;
  color: var(--muted-foreground) !important;
}
</style>
