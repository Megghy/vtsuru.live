<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'
import { ChevronLeft, ChevronRight, ExternalLink, Info, Radio, RefreshCw } from 'lucide-vue-next'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useRouter } from 'vue-router'

import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'
import { formatBiliLiveReserveTime } from '@/shared/utils/formatBiliLiveReserve'

import type { IndexStreamerModel } from './indexData'
import { lerp, useElementScrollProgress } from './useIndexMotion'

const props = defineProps<{
  streamers: IndexStreamerModel[]
  isLoading: boolean
  isRefreshing: boolean
  hasError: boolean
  isDesktop: boolean
  isReduced: boolean
}>()

const emit = defineEmits<{
  refresh: []
}>()

const router = useRouter()
const sectionEl = useTemplateRef<HTMLElement>('sectionEl')
const roomsScroller = useTemplateRef<HTMLElement>('roomsScroller')
const scrollState = useElementScrollProgress(sectionEl, {
  enterStartRatio: 0.98,
  enterEndRatio: 0.5,
})

const containerStyle = computed(() => {
  if (props.isReduced) return undefined
  const t = scrollState.easedEnter
  return {
    transform: `translate3d(0, ${lerp(24, 0, t).toFixed(1)}px, 0) scale(${lerp(0.97, 1, t).toFixed(3)})`,
    opacity: lerp(0.18, 1, t).toFixed(3),
  }
})

/** 滚过主播广场时给外层轨道轻微水平牵引视差（不干扰用户手动 scrollLeft） */
const trackParallaxStyle = computed(() => {
  if (props.isReduced || !props.isDesktop) return undefined
  const x = scrollState.center * -26
  return {
    transform: `translate3d(${x.toFixed(1)}px, 0, 0)`,
  }
})

const canScrollLeft = ref(false)
const canScrollRight = ref(false)

const liveCount = computed(() => props.streamers.filter((r) => r.isStreaming).length)
const reserveCount = computed(() => props.streamers.filter((r) => hasReserve(r)).length)

function formatDurationSeconds(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds))
  const hh = Math.floor(s / 3600)
  const mm = Math.floor((s % 3600) / 60)
  const ss = s % 60
  if (hh > 0) return `${hh}:${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`
  return `${mm}:${ss.toString().padStart(2, '0')}`
}

function hasReserve(room: IndexStreamerModel) {
  return !room.isStreaming && !!room.reserveAt
}

function getRoomStatus(room: IndexStreamerModel) {
  if (room.isStreaming) return 'LIVE'
  if (hasReserve(room)) return '预告'
  return 'OFFLINE'
}

function getRoomTitle(room: IndexStreamerModel) {
  if (hasReserve(room) && room.reserveTitle) return room.reserveTitle
  return room.title || '（暂无标题）'
}

function getRoomSubline(room: IndexStreamerModel) {
  const area = [room.parentArea, room.area].filter(Boolean).join(' · ')
  if (room.isStreaming && room.liveStartedAt) {
    const duration = formatDurationSeconds(Date.now() / 1000 - room.liveStartedAt)
    return area ? `${area} · ${duration}` : duration
  }
  if (hasReserve(room)) {
    const when = formatBiliLiveReserveTime(room.reserveAt!)
    return area ? `${area} · ${when}` : when
  }
  return area
}

function getRoomCoverSrc(room: IndexStreamerModel) {
  return room.cover || room.avatar || ''
}

function updateScrollState() {
  const scroller = roomsScroller.value
  if (!scroller) return
  canScrollLeft.value = scroller.scrollLeft > 2
  canScrollRight.value = scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 2
}

function scrollRooms(direction: -1 | 1) {
  const scroller = roomsScroller.value
  if (!scroller) return
  scroller.scrollBy({
    left: direction * Math.max(300, scroller.clientWidth * 0.78),
    behavior: props.isReduced ? 'auto' : 'smooth',
  })
}

useResizeObserver(roomsScroller, updateScrollState)

watch(
  () => props.streamers,
  async () => {
    await nextTick()
    roomsScroller.value?.scrollTo({ left: 0, behavior: props.isReduced ? 'auto' : 'smooth' })
    updateScrollState()
  },
)
</script>

<template>
  <section
    id="streamers"
    ref="sectionEl"
    class="overflow-x-clip border-t border-border/60 bg-inset/25 backdrop-blur-[2px] py-16 sm:py-22"
  >
    <div
      class="mx-auto w-full max-w-[1320px] px-4 sm:px-6 lg:px-8 will-change-transform"
      :style="containerStyle"
    >
      <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              正在使用本站的主播们
            </h2>

            <Tooltip>
              <TooltipTrigger as-child>
                <button
                  type="button"
                  class="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="展示规则说明"
                >
                  <Info class="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent class="max-w-xs">
                随机展示不分先后，仅收录粉丝数大于 500 且开启公开展示的主播，实时同步其直播间与预告状态。
              </TooltipContent>
            </Tooltip>

            <span
              v-if="liveCount > 0"
              class="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/12 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums"
            >
              <span class="size-1.5 rounded-full bg-emerald-500" />
              {{ liveCount }} 位开播中
            </span>
            <span
              v-if="reserveCount > 0"
              class="inline-flex items-center rounded-full bg-pink-500/12 px-2.5 py-0.5 text-xs font-semibold text-pink-600 dark:text-pink-400 tabular-nums"
            >
              {{ reserveCount }} 场预告
            </span>
          </div>
          <p class="mt-2 text-sm text-muted-foreground">
            点击任意主播卡片访问对方搭建的公开主页，或点击右上角直达 B 站直播间。
          </p>
        </div>

        <div class="flex items-center gap-1.5 self-start sm:self-auto">
          <Button
            variant="outline"
            class="gap-1.5"
            @click="router.push({ name: 'live-directory' })"
          >
            <Radio class="size-3.5 text-emerald-500" />
            直播与关注
          </Button>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="outline"
                size="icon-sm"
                class="rounded-full"
                aria-label="向左滚动"
                :disabled="!canScrollLeft"
                @click="scrollRooms(-1)"
              >
                <ChevronLeft class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>向左滚动</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="outline"
                size="icon-sm"
                class="rounded-full"
                aria-label="向右滚动"
                :disabled="!canScrollRight"
                @click="scrollRooms(1)"
              >
                <ChevronRight class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>向右滚动</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="outline"
                size="icon-sm"
                class="rounded-full"
                aria-label="刷新主播列表"
                :disabled="isRefreshing"
                @click="emit('refresh')"
              >
                <RefreshCw
                  class="size-3.5"
                  :class="{ 'animate-spin': isRefreshing }"
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>刷新主播列表</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <!-- 加载骨架屏 -->
      <div
        v-if="isLoading && !streamers.length"
        class="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div
          v-for="idx in 4"
          :key="idx"
          class="h-[132px] rounded-xl border border-border bg-card p-3.5 flex flex-col justify-between"
        >
          <div class="flex items-center gap-2.5">
            <Skeleton class="size-10 rounded-full" />
            <div class="space-y-1.5 flex-1">
              <Skeleton class="h-3.5 w-24" />
              <Skeleton class="h-3 w-12" />
            </div>
          </div>
          <div class="space-y-1.5">
            <Skeleton class="h-3.5 w-4/5" />
            <Skeleton class="h-3 w-1/2" />
          </div>
        </div>
      </div>

      <!-- 加载失败提示 -->
      <div
        v-else-if="hasError && !streamers.length"
        class="mt-6 flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card/80 py-10 text-center"
      >
        <p class="text-sm text-muted-foreground">暂时无法拉取主播实时列表，请稍后重试。</p>
        <Button
          variant="outline"
          @click="emit('refresh')"
        >
          重新加载
        </Button>
      </div>

      <!-- 主播卡片横向滚栏 -->
      <div
        v-else-if="streamers.length"
        class="mt-6"
      >
        <div
          class="will-change-transform"
          :style="trackParallaxStyle"
        >
          <div
            ref="roomsScroller"
            class="rooms-scroller no-scrollbar flex gap-3 overflow-x-auto py-2 px-0.5"
          :class="{
            'mask-left': canScrollLeft && !canScrollRight,
            'mask-right': !canScrollLeft && canScrollRight,
            'mask-both': canScrollLeft && canScrollRight,
          }"
          @scroll="updateScrollState"
        >
          <div
            v-for="room in streamers"
            :key="room.roomId"
            role="link"
            tabindex="0"
            class="streamer-card group relative h-[136px] w-[268px] shrink-0 cursor-pointer overflow-hidden rounded-xl border transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            :class="
              room.isStreaming
                ? 'border-emerald-400/70 shadow-sm shadow-emerald-500/15'
                : hasReserve(room)
                  ? 'border-pink-400/55 shadow-sm shadow-pink-500/10'
                  : 'border-border/90 hover:border-brand/50'
            "
            @click="router.push(`/@${room.name}`)"
            @keydown.enter="router.push(`/@${room.name}`)"
          >
            <img
              v-if="getRoomCoverSrc(room)"
              class="absolute inset-0 size-full scale-105 object-cover blur-[5px] brightness-[0.68] transition-transform duration-300 group-hover:scale-110"
              :src="getRoomCoverSrc(room)"
              referrerpolicy="no-referrer"
              loading="lazy"
              alt=""
            />
            <div class="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-950/35 to-slate-950/82" />

            <div class="relative z-10 flex h-full flex-col justify-between p-3.5 text-white">
              <div class="flex items-start justify-between gap-2">
                <div class="flex min-w-0 items-center gap-2.5">
                  <img
                    class="size-10 shrink-0 rounded-full object-cover ring-2"
                    :class="
                      room.isStreaming
                        ? 'ring-emerald-400'
                        : hasReserve(room)
                          ? 'ring-pink-400'
                          : 'ring-white/40'
                    "
                    :src="`${room.avatar}@96w`"
                    referrerpolicy="no-referrer"
                    loading="lazy"
                    :alt="`${room.uname || room.name} 头像`"
                  />
                  <div class="min-w-0">
                    <div
                      class="truncate text-sm font-bold leading-tight text-white"
                      :title="room.uname || room.name"
                    >
                      {{ room.uname || room.name }}
                    </div>
                    <div class="mt-1">
                      <span
                        class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        :class="
                          room.isStreaming
                            ? 'bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-400/50'
                            : hasReserve(room)
                              ? 'bg-pink-500/25 text-pink-100 ring-1 ring-pink-400/50'
                              : 'bg-white/15 text-white/80'
                        "
                      >
                        <span
                          v-if="room.isStreaming"
                          class="size-1.5 rounded-full bg-emerald-400"
                          :class="{ 'animate-pulse': !isReduced }"
                        />
                        {{ getRoomStatus(room) }}
                      </span>
                    </div>
                  </div>
                </div>

                <a
                  class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white/90 backdrop-blur-sm transition-colors hover:bg-white/25 hover:text-white"
                  :href="`https://live.bilibili.com/${room.roomId}`"
                  target="_blank"
                  rel="noreferrer"
                  :aria-label="hasReserve(room) ? '打开直播间预告' : '打开 B 站直播间'"
                  :title="hasReserve(room) ? '打开直播间预告' : '打开 B 站直播间'"
                  @click.stop
                >
                  <ExternalLink class="size-3.5" />
                </a>
              </div>

              <div class="min-w-0">
                <div
                  class="truncate text-xs font-semibold text-white"
                  :title="getRoomTitle(room)"
                >
                  {{ getRoomTitle(room) }}
                </div>
                <div
                  v-if="getRoomSubline(room)"
                  class="mt-0.5 truncate text-[11px] text-white/75 tabular-nums"
                  :title="getRoomSubline(room)"
                >
                  {{ getRoomSubline(room) }}
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>

        <div class="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Info class="size-3.5 shrink-0" />
          <span>
            不想展示在首页？可前往
            <Button
              variant="link"
              size="xs"
              class="h-auto p-0 inline font-normal text-xs"
              @click="router.push({ name: 'manage-userPageBuilder', query: { mode: 'legacy' } })"
            >
              主页设置（允许展示在主页）
            </Button>
            随时关闭。
          </span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.rooms-scroller.mask-left {
  mask-image: linear-gradient(to right, transparent 0, #000 32px, #000 100%);
}

.rooms-scroller.mask-right {
  mask-image: linear-gradient(to right, #000 0, #000 calc(100% - 32px), transparent 100%);
}

.rooms-scroller.mask-both {
  mask-image: linear-gradient(to right, transparent 0, #000 32px, #000 calc(100% - 32px), transparent 100%);
}
</style>
