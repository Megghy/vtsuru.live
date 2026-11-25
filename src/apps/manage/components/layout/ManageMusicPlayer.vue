<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import {
  Ban,
  ChevronDown,
  ChevronUp,
  ListMusic,
  Loader2,
  Music2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import { usePersistedStorage } from '@/shared/storage/persist'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Empty } from '@/shared/ui/empty'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Slider } from '@/shared/ui/slider'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { formatAudioTime } from '@/store/musicRequestHelpers'
import { useMusicRequestProvider } from '@/store/useMusicRequest'

const emit = defineEmits<{
  (e: 'heightChange', height: number): void
}>()

const musicRequestStore = useMusicRequestProvider()

const audioRef = ref<HTMLAudioElement | null>(null)
const playerCardRef = ref<HTMLElement | null>(null)
const { height: playerCardHeight } = useElementSize(playerCardRef)

const isPlayerMinimized = usePersistedStorage('Settings.MusicPlayer.Minimized', false)
const lastNonZeroVolume = ref(0.5)
const isSeeking = ref(false)
const seekPreviewTime = ref(0)

const isPlayerVisible = computed(
  () =>
    !musicRequestStore.isPlayerDismissed &&
    (musicRequestStore.originMusics.length > 0 ||
      musicRequestStore.waitingMusics.length > 0 ||
      Boolean(musicRequestStore.currentOriginMusic) ||
      Boolean(musicRequestStore.currentMusic.src) ||
      musicRequestStore.isPlayingOrderMusic),
)

const hasTrack = computed(() => Boolean(musicRequestStore.currentMusic.src))

const canGoNext = computed(
  () =>
    musicRequestStore.isPlayingOrderMusic ||
    musicRequestStore.waitingMusics.length > 0 ||
    musicRequestStore.originMusics.length > 0,
)

const displayTime = computed(() => (isSeeking.value ? seekPreviewTime.value : musicRequestStore.currentTime))

const progressValue = computed({
  get: () => [displayTime.value],
  set: (val: number[]) => {
    if (!val?.length) return
    isSeeking.value = true
    seekPreviewTime.value = val[0]
  },
})

function commitSeek(val: number[]) {
  isSeeking.value = false
  if (val?.length) {
    musicRequestStore.seekTo(val[0])
  }
}

const volumePercent = computed(() => Math.round((musicRequestStore.settings.volume ?? 0.5) * 100))

const sliderVolume = computed({
  get: () => [volumePercent.value],
  set: (val: number[]) => {
    if (!val?.length) return
    const nextVol = Math.min(1, Math.max(0, val[0] / 100))
    if (nextVol > 0) lastNonZeroVolume.value = nextVol
    musicRequestStore.updatePlaybackPreference({ volume: nextVol })
  },
})

function toggleMute() {
  const current = musicRequestStore.settings.volume ?? 0.5
  if (current > 0) {
    lastNonZeroVolume.value = current
    musicRequestStore.updatePlaybackPreference({ volume: 0 })
  } else {
    musicRequestStore.updatePlaybackPreference({ volume: lastNonZeroVolume.value || 0.5 })
  }
}

function toggleShuffle() {
  musicRequestStore.updatePlaybackPreference({ shuffle: !musicRequestStore.settings.shuffle })
}

function cycleRepeat() {
  const order: Array<'repeat-all' | 'repeat-one' | 'no-repeat'> = ['repeat-all', 'repeat-one', 'no-repeat']
  const idx = order.indexOf(musicRequestStore.settings.repeat)
  const next = order[(idx + 1) % order.length]
  musicRequestStore.updatePlaybackPreference({ repeat: next })
}

const repeatTooltip = computed(() => {
  switch (musicRequestStore.settings.repeat) {
    case 'repeat-one':
      return '循环模式：单曲循环'
    case 'no-repeat':
      return '循环模式：顺序播完停止'
    default:
      return '循环模式：列表循环'
  }
})

const currentSourceBadge = computed(() => {
  if (musicRequestStore.currentOriginMusic && musicRequestStore.isPlayingOrderMusic) {
    return {
      variant: 'brand' as const,
      label: `点歌 · ${musicRequestStore.currentOriginMusic.from?.name || '观众'}`,
    }
  }
  if (musicRequestStore.currentMusic.title) {
    return {
      variant: 'secondary' as const,
      label: '背景轮播',
    }
  }
  return null
})

const footerHeight = computed(() => {
  if (!isPlayerVisible.value) return 0
  return playerCardHeight.value + 12
})

watch(footerHeight, (val) => emit('heightChange', val), { immediate: true })

watch(
  () => musicRequestStore.settings.volume,
  (vol) => {
    if (audioRef.value) {
      audioRef.value.volume = Math.min(1, Math.max(0, vol ?? 0.5))
    }
  },
)

onMounted(() => {
  musicRequestStore.attachAudioElement(audioRef.value)
})

onUnmounted(() => {
  if (musicRequestStore.audioEl === audioRef.value) {
    musicRequestStore.attachAudioElement(null)
  }
})

function handleTimeUpdate() {
  if (!audioRef.value || isSeeking.value) return
  musicRequestStore.onTimeUpdate(audioRef.value.currentTime, audioRef.value.duration)
}

function handleLoadedMetadata() {
  if (!audioRef.value) return
  musicRequestStore.onTimeUpdate(audioRef.value.currentTime, audioRef.value.duration)
}
</script>

<template>
  <!-- 原生隐藏 audio 引擎，跨折叠态与页面切换持续保活 -->
  <audio
    ref="audioRef"
    preload="auto"
    class="hidden"
    @play="musicRequestStore.onMusicPlay()"
    @pause="musicRequestStore.onMusicPause()"
    @ended="musicRequestStore.onMusicEnd()"
    @error="musicRequestStore.onMusicError()"
    @waiting="musicRequestStore.isBuffering = true"
    @canplay="musicRequestStore.isBuffering = false"
    @timeupdate="handleTimeUpdate"
    @loadedmetadata="handleLoadedMetadata"
  />

  <footer
    v-if="isPlayerVisible"
    class="shrink-0 z-20 bg-background/95 backdrop-blur-md border-t border-border px-3 py-1.5"
  >
    <TooltipProvider :delay-duration="250">
      <div
        ref="playerCardRef"
        class="max-w-7xl mx-auto rounded-lg border border-border bg-card shadow-xs"
        :class="isPlayerMinimized ? 'px-3 py-1.5' : 'px-3 py-2'"
      >
        <!-- 收起态：极简单行 -->
        <div
          v-if="isPlayerMinimized"
          class="flex-between gap-2 text-xs"
        >
          <div class="flex items-center gap-2 min-w-0">
            <span
              class="size-2 rounded-full shrink-0"
              :class="musicRequestStore.isPlaying ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/40'"
            />
            <span class="font-medium text-foreground truncate">
              {{ musicRequestStore.currentMusic.title || '点歌机待机中' }}
            </span>
            <span
              v-if="musicRequestStore.currentMusic.artist"
              class="text-muted-foreground truncate hidden sm:inline"
            >
              - {{ musicRequestStore.currentMusic.artist }}
            </span>
            <Badge
              v-if="currentSourceBadge"
              :variant="currentSourceBadge.variant"
              size="xs"
              class="shrink-0 hidden md:inline-flex"
            >
              {{ currentSourceBadge.label }}
            </Badge>
          </div>

          <div class="flex items-center gap-1 shrink-0">
            <Badge
              v-if="musicRequestStore.waitingMusics.length > 0"
              variant="brand"
              size="xs"
              class="tabular-nums mr-1"
            >
              待播 {{ musicRequestStore.waitingMusics.length }}
            </Badge>
            <Button
              size="icon-xs"
              variant="ghost"
              :aria-label="musicRequestStore.isPlaying ? '暂停' : '播放'"
              @click="musicRequestStore.togglePlay()"
            >
              <Pause
                v-if="musicRequestStore.isPlaying"
                class="size-3.5"
              />
              <Play
                v-else
                class="size-3.5"
              />
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              :disabled="!canGoNext"
              aria-label="下一首"
              @click="musicRequestStore.nextMusic()"
            >
              <SkipForward class="size-3.5" />
            </Button>
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label="展开播放器"
                  @click="isPlayerMinimized = false"
                >
                  <ChevronUp class="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>展开播放器</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label="关闭播放器"
                  @click="musicRequestStore.closePlayer()"
                >
                  <X class="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>关闭播放器</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <!-- 展开态：单行三段式现代播放条 -->
        <div
          v-else
          class="flex items-center gap-3 flex-wrap md:flex-nowrap"
        >
          <!-- 左：封面 + 曲目信息 -->
          <div class="flex items-center gap-2.5 min-w-0 w-full md:w-64 lg:w-72 shrink-0">
            <div class="relative size-9 rounded-md border border-border bg-muted flex-center overflow-hidden shrink-0">
              <img
                v-if="musicRequestStore.currentMusic.pic"
                :src="musicRequestStore.currentMusic.pic"
                :alt="musicRequestStore.currentMusic.title"
                class="size-full object-cover"
                referrerpolicy="no-referrer"
              />
              <Music2
                v-else
                class="size-4 text-muted-foreground"
              />
              <span
                v-if="musicRequestStore.isPlaying"
                class="absolute bottom-0.5 right-0.5 size-2 rounded-full bg-emerald-500 ring-2 ring-card"
              />
            </div>

            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 min-w-0">
                <span
                  class="font-medium text-xs text-foreground truncate"
                  :title="musicRequestStore.currentMusic.title"
                >
                  {{ musicRequestStore.currentMusic.title || '点歌机待机中' }}
                </span>
                <Badge
                  v-if="currentSourceBadge"
                  :variant="currentSourceBadge.variant"
                  size="xs"
                  class="shrink-0"
                >
                  {{ currentSourceBadge.label }}
                </Badge>
              </div>
              <div class="text-[11px] text-muted-foreground truncate">
                {{
                  musicRequestStore.currentMusic.artist ||
                  (musicRequestStore.originMusics.length > 0
                    ? `闲置曲库 ${musicRequestStore.originMusics.length} 首就绪`
                    : '等待观众点歌')
                }}
              </div>
            </div>
          </div>

          <!-- 中：核心播控 + 进度条 -->
          <div class="flex-1 min-w-[220px] flex flex-col gap-1">
            <div class="flex items-center justify-center gap-1">
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    :disabled="!hasTrack && musicRequestStore.originMusics.length === 0"
                    aria-label="上一首 / 重播"
                    @click="musicRequestStore.playPrevious()"
                  >
                    <SkipBack class="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>上一首 / 从头重播</TooltipContent>
              </Tooltip>

              <Button
                size="icon-xs"
                variant="default"
                class="rounded-full"
                :aria-label="musicRequestStore.isPlaying ? '暂停' : '播放'"
                @click="musicRequestStore.togglePlay()"
              >
                <Loader2
                  v-if="musicRequestStore.isBuffering"
                  class="size-3.5 animate-spin"
                />
                <Pause
                  v-else-if="musicRequestStore.isPlaying"
                  class="size-3.5"
                />
                <Play
                  v-else
                  class="size-3.5"
                />
              </Button>

              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    :disabled="!canGoNext"
                    aria-label="下一首"
                    @click="musicRequestStore.nextMusic()"
                  >
                    <SkipForward class="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>切下一首</TooltipContent>
              </Tooltip>

              <Tooltip v-if="hasTrack">
                <TooltipTrigger as-child>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    class="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    aria-label="拉黑当前歌曲并切歌"
                    @click="musicRequestStore.blockCurrentSongAndSkip()"
                  >
                    <Ban class="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>拉黑当前歌名关键词并切下一首</TooltipContent>
              </Tooltip>
            </div>

            <div class="flex items-center gap-2">
              <span class="text-[11px] font-mono tabular-nums text-muted-foreground w-9 text-right shrink-0">
                {{ formatAudioTime(displayTime) }}
              </span>
              <Slider
                v-model="progressValue"
                :max="musicRequestStore.duration > 0 ? musicRequestStore.duration : 100"
                :step="0.5"
                :disabled="!hasTrack || musicRequestStore.duration <= 0"
                class="flex-1"
                @value-commit="commitSeek"
              />
              <span class="text-[11px] font-mono tabular-nums text-muted-foreground w-9 shrink-0">
                {{ formatAudioTime(musicRequestStore.duration) }}
              </span>
            </div>
          </div>

          <!-- 右：模式 + 音量 + 待播弹窗 + 收起 -->
          <div class="flex items-center gap-1.5 shrink-0 ml-auto">
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  size="icon-xs"
                  :variant="musicRequestStore.settings.shuffle ? 'secondary' : 'ghost'"
                  :class="musicRequestStore.settings.shuffle ? 'text-primary' : 'text-muted-foreground'"
                  aria-label="随机播放"
                  @click="toggleShuffle"
                >
                  <Shuffle class="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>随机播放：{{ musicRequestStore.settings.shuffle ? '已开启' : '已关闭' }}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  size="icon-xs"
                  :variant="musicRequestStore.settings.repeat !== 'no-repeat' ? 'secondary' : 'ghost'"
                  :class="musicRequestStore.settings.repeat !== 'no-repeat' ? 'text-primary' : 'text-muted-foreground'"
                  :aria-label="repeatTooltip"
                  @click="cycleRepeat"
                >
                  <Repeat1
                    v-if="musicRequestStore.settings.repeat === 'repeat-one'"
                    class="size-3.5"
                  />
                  <Repeat
                    v-else
                    class="size-3.5"
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{{ repeatTooltip }}</TooltipContent>
            </Tooltip>

            <div class="flex items-center gap-1.5 px-1">
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label="静音/取消静音"
                @click="toggleMute"
              >
                <VolumeX
                  v-if="volumePercent === 0"
                  class="size-3.5 text-muted-foreground"
                />
                <Volume2
                  v-else
                  class="size-3.5 text-muted-foreground"
                />
              </Button>
              <Slider
                v-model="sliderVolume"
                :max="100"
                :step="1"
                class="w-18"
              />
              <span class="text-[11px] font-mono tabular-nums text-muted-foreground w-7 text-right">
                {{ volumePercent }}%
              </span>
            </div>

            <Popover>
              <PopoverTrigger as-child>
                <Button
                  size="xs"
                  variant="outline"
                  class="gap-1 tabular-nums"
                >
                  <ListMusic class="size-3.5" />
                  <span>{{ musicRequestStore.waitingMusics.length }}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="end"
                class="w-80 p-3 space-y-2.5"
              >
                <div class="flex-between gap-2">
                  <div class="flex items-center gap-1.5">
                    <span class="text-xs font-semibold text-foreground">待播点歌队列</span>
                    <Badge
                      variant="secondary"
                      size="xs"
                      class="tabular-nums"
                    >
                      {{ musicRequestStore.waitingMusics.length }}
                    </Badge>
                  </div>
                  <Button
                    v-if="musicRequestStore.waitingMusics.length > 0"
                    size="xs"
                    variant="ghost"
                    class="text-destructive hover:bg-destructive/10 gap-1"
                    @click="musicRequestStore.clearWaitingWithUndo()"
                  >
                    <Trash2 class="size-3" />
                    清空
                  </Button>
                </div>

                <ScrollArea
                  v-if="musicRequestStore.waitingMusics.length > 0"
                  class="h-56 [&_[data-reka-scroll-area-viewport]>div]:!block"
                >
                  <div class="space-y-1">
                    <div
                      v-for="(item, idx) in musicRequestStore.waitingMusics"
                      :key="item.requestId || `${item.music.id}-${idx}`"
                      class="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 text-xs"
                    >
                      <div class="min-w-0 flex-1">
                        <div class="font-medium text-foreground truncate">{{ idx + 1 }}. {{ item.music.name }}</div>
                        <div class="text-[11px] text-muted-foreground truncate">
                          {{ item.from?.name || '主播添加' }}
                          <span v-if="item.music.author?.length"> · {{ item.music.author.join('/') }}</span>
                        </div>
                      </div>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        aria-label="立即切播"
                        @click="musicRequestStore.playWaitingItemNow(item)"
                      >
                        <Play class="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </ScrollArea>
                <Empty
                  v-else
                  size="small"
                  description="当前暂无待播观众点歌"
                  class="py-4"
                />
              </PopoverContent>
            </Popover>

            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label="收起播放器"
                  @click="isPlayerMinimized = true"
                >
                  <ChevronDown class="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>收起到底部迷你条</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label="关闭播放器"
                  @click="musicRequestStore.closePlayer()"
                >
                  <X class="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>关闭播放器</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </TooltipProvider>
  </footer>
</template>
