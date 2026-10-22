<script setup lang="ts">
import { CalendarOutline, GameControllerOutline, HomeOutline, PlayCircleOutline, TvOutline } from '@vicons/ionicons5'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import type { UserInfo } from '@/api/api-models'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'
import { Button } from '@/shared/ui/button'
import { formatBiliLiveReserveTime } from '@/shared/utils/formatBiliLiveReserve'

import BlockCard from '../BlockCard.vue'
import { isBlockPropertyAvailable } from '../propertyCapabilities'

interface BlockConfig {
  variant: 'card' | 'compact'
  showTitle: boolean
  showArea: boolean
  showCover: boolean
  showButtons: boolean
  framed: boolean
  backgrounded: boolean
}

const props = defineProps<{
  blockProps: unknown
  userInfo?: UserInfo
  biliInfo?: unknown
}>()

const cfg = computed<BlockConfig>(() => {
  const o =
    props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps)
      ? (props.blockProps as Record<string, unknown>)
      : {}
  return {
    variant: o.variant === 'compact' ? 'compact' : 'card',
    showTitle: typeof o.showTitle === 'boolean' ? o.showTitle : true,
    showArea: typeof o.showArea === 'boolean' ? o.showArea : true,
    showCover: typeof o.showCover === 'boolean' ? o.showCover : true,
    showButtons: typeof o.showButtons === 'boolean' ? o.showButtons : true,
    framed: typeof o.framed === 'boolean' ? o.framed : true,
    backgrounded: typeof o.backgrounded === 'boolean' ? o.backgrounded : true,
  }
})

const model = computed(() => {
  const stream = props.userInfo?.streamerInfo
  const roomId = typeof stream?.roomId === 'number' ? stream.roomId : props.userInfo?.biliRoomId
  return {
    available: Boolean(props.userInfo),
    isStreaming: Boolean(stream?.isStreaming),
    title: typeof stream?.title === 'string' ? stream.title : '',
    coverUrl:
      typeof stream?.coverUrl === 'string' && stream.coverUrl
        ? stream.coverUrl
        : typeof stream?.frameUrl === 'string'
          ? stream.frameUrl
          : '',
    area: [stream?.parentArea, stream?.area].filter(Boolean).join(' / '),
    avatarUrl: typeof stream?.faceUrl === 'string' ? stream.faceUrl : '',
    displayName: typeof stream?.name === 'string' && stream.name.trim() ? stream.name : props.userInfo?.name || '主播',
    lastStreamAt: typeof stream?.lastStreamAt === 'number' ? stream.lastStreamAt : 0,
    liveRoomUrl: roomId ? `https://live.bilibili.com/${roomId}` : '',
    spaceUrl: props.userInfo?.biliId ? `https://space.bilibili.com/${props.userInfo.biliId}` : '',
    liveReserve: props.userInfo?.liveReserve,
  }
})

const now = ref(Date.now())
const coverFailed = ref(false)
let durationTimer: number | undefined

function stopDurationTimer() {
  if (durationTimer !== undefined) window.clearInterval(durationTimer)
  durationTimer = undefined
}

watch(
  () => [model.value.isStreaming, model.value.lastStreamAt] as const,
  ([isStreaming, startedAt]) => {
    stopDurationTimer()
    now.value = Date.now()
    if (isStreaming && startedAt > 0) {
      durationTimer = window.setInterval(() => {
        now.value = Date.now()
      }, 60_000)
    }
  },
  { immediate: true },
)

watch(
  () => model.value.coverUrl,
  () => {
    coverFailed.value = false
  },
)
onBeforeUnmount(stopDurationTimer)

function formatTime(timestamp: number) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(timestamp)
}

function formatDuration(milliseconds: number) {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return ''
  const totalMinutes = Math.floor(milliseconds / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours ? `已直播 ${hours} 小时 ${minutes} 分钟` : `已直播 ${minutes} 分钟`
}

const durationText = computed(() =>
  model.value.isStreaming && model.value.lastStreamAt ? formatDuration(now.value - model.value.lastStreamAt) : '',
)
const hasCover = computed(
  () =>
    isBlockPropertyAvailable('liveStatus', cfg.value, 'showCover') &&
    cfg.value.showCover &&
    model.value.coverUrl &&
    !coverFailed.value,
)
</script>

<template>
  <BlockCard
    :framed="cfg.framed"
    :backgrounded="cfg.backgrounded"
    :content-style="{ padding: 0 }"
  >
    <Alert
      v-if="!model.available"
      class="text-xs py-2 m-2"
    >
      <AlertDescription> 直播信息暂不可用 </AlertDescription>
    </Alert>

    <article
      v-else
      class="@container relative overflow-hidden rounded-[var(--radius)] text-foreground bg-transparent"
      :class="[
        hasCover ? 'bg-[#111] text-white min-h-[220px]' : '',
        hasCover && cfg.variant === 'compact' ? '!min-h-[156px]' : '',
      ]"
    >
      <img
        v-if="hasCover"
        class="absolute inset-0 size-full object-cover"
        :src="model.coverUrl"
        alt=""
        loading="lazy"
        decoding="async"
        referrerpolicy="no-referrer"
        @error="coverFailed = true"
      />
      <div
        v-if="hasCover"
        class="absolute inset-0 size-full bg-black/68"
      />

      <div
        class="relative grid gap-4 p-4 @max-[520px]:p-3.5 @max-[520px]:!grid-cols-1"
        :class="[
          hasCover ? 'min-h-[220px] content-between' : '',
          cfg.variant === 'compact' ? 'grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2.5' : '',
          hasCover && cfg.variant === 'compact' ? '!min-h-[156px]' : '',
        ]"
      >
        <header
          class="flex items-center justify-between gap-3 min-w-0 @max-[520px]:items-start"
          :class="cfg.variant === 'compact' ? 'col-span-full @max-[520px]:col-span-1' : ''"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <Avatar
              v-if="model.avatarUrl"
              class="border border-border shrink-0"
              :class="cfg.variant === 'compact' ? 'size-8.5' : 'size-10.5'"
            >
              <AvatarImage
                :src="model.avatarUrl"
                :alt="model.displayName"
                referrerpolicy="no-referrer"
                loading="lazy"
              />
              <AvatarFallback>{{ model.displayName.slice(0, 1) }}</AvatarFallback>
            </Avatar>
            <div class="min-w-0">
              <strong class="block truncate text-[15px] leading-snug font-semibold">{{ model.displayName }}</strong>
              <span
                class="block truncate text-xs mt-0.5"
                :class="hasCover ? 'text-white/80' : 'text-muted-foreground'"
              >哔哩哔哩直播</span>
            </div>
          </div>

          <div
            class="flex-none inline-flex items-center gap-1.5 px-2.25 py-1 rounded-full text-xs font-semibold border transition-colors"
            :class="[
              hasCover
                ? 'bg-black/42 text-white/85 border-white/28'
                : 'bg-secondary text-muted-foreground border-border',
              model.isStreaming
                ? hasCover
                  ? '!text-[#ff8a9c] !border-[#ff8a9c]/40'
                  : '!text-primary !border-primary/30'
                : !model.isStreaming && model.liveReserve
                  ? '!text-[#fb7299] !border-[#fb7299]/30'
                  : '',
            ]"
            aria-live="polite"
            aria-atomic="true"
          >
            <span class="size-1.75 rounded-full bg-current" />
            {{ model.isStreaming ? '直播中' : model.liveReserve ? '预告' : '未开播' }}
          </div>
        </header>

        <div
          class="grid gap-2 min-w-0"
          :class="cfg.variant === 'compact' ? 'self-center @max-[520px]:col-span-1' : ''"
        >
          <strong
            v-if="cfg.showTitle && model.title"
            class="text-base leading-snug font-bold break-words"
          >{{ model.title }}</strong>
          <div
            v-if="cfg.showArea && model.area"
            class="flex items-center gap-1.75 text-[13px] leading-relaxed"
            :class="hasCover ? 'text-white/80' : 'text-muted-foreground'"
          >
            <component
              :is="GameControllerOutline"
              class="size-4 shrink-0"
            />
            <span>{{ model.area }}</span>
          </div>
          <div
            v-if="durationText"
            class="flex items-center gap-1.75 text-[13px] leading-relaxed"
            :class="hasCover ? 'text-white/80' : 'text-muted-foreground'"
            aria-live="polite"
          >
            <component
              :is="PlayCircleOutline"
              class="size-4 shrink-0"
            />
            <span>{{ durationText }}</span>
          </div>
          <a
            v-else-if="!model.isStreaming && model.liveReserve && model.liveRoomUrl"
            class="flex items-center gap-1.75 text-[13px] leading-relaxed transition-colors hover:text-[#fb7299]"
            :class="hasCover ? 'text-white/80' : 'text-muted-foreground'"
            :href="model.liveRoomUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            <component
              :is="CalendarOutline"
              class="size-4 shrink-0"
            />
            <span
              >下次直播 {{ formatBiliLiveReserveTime(model.liveReserve.planStart) }} ·
              {{ model.liveReserve.title }}</span
            >
          </a>
          <div
            v-else-if="!model.isStreaming && model.liveReserve"
            class="flex items-center gap-1.75 text-[13px] leading-relaxed"
            :class="hasCover ? 'text-white/80' : 'text-muted-foreground'"
          >
            <component
              :is="CalendarOutline"
              class="size-4 shrink-0"
            />
            <span
              >下次直播 {{ formatBiliLiveReserveTime(model.liveReserve.planStart) }} ·
              {{ model.liveReserve.title }}</span
            >
          </div>
          <div
            v-else-if="model.lastStreamAt"
            class="flex items-center gap-1.75 text-[13px] leading-relaxed"
            :class="hasCover ? 'text-white/80' : 'text-muted-foreground'"
          >
            <component
              :is="CalendarOutline"
              class="size-4 shrink-0"
            />
            <span>上次直播：{{ formatTime(model.lastStreamAt) }}</span>
          </div>
        </div>

        <div
          v-if="cfg.showButtons && (model.spaceUrl || model.liveRoomUrl)"
          class="flex items-center gap-2.5 @max-[520px]:grid @max-[520px]:grid-cols-[repeat(auto-fit,minmax(120px,1fr))] @max-[520px]:col-span-1"
          :class="cfg.variant === 'compact' ? 'justify-end [&>*]:flex-none @max-[520px]:[&>*]:w-full' : '[&>*]:flex-1'"
        >
          <Button
            v-if="model.spaceUrl"
            as="a"
            variant="outline"
            class="font-medium"
            :class="{ 'bg-white/10 text-white border-white/20 hover:bg-white/20': hasCover }"
            target="_blank"
            rel="noopener noreferrer"
            :href="model.spaceUrl"
            aria-label="打开主播主页（新窗口打开）"
          >
            <component
              :is="HomeOutline"
              class="size-3.5 mr-1.5"
            />
            主页
          </Button>
          <Button
            v-if="model.liveRoomUrl"
            as="a"
            :variant="model.isStreaming ? 'default' : 'outline'"
            class="font-medium"
            :class="{ 'bg-white/10 text-white border-white/20 hover:bg-white/20': hasCover && !model.isStreaming }"
            target="_blank"
            rel="noopener noreferrer"
            :href="model.liveRoomUrl"
            aria-label="打开直播间（新窗口打开）"
          >
            <component
              :is="TvOutline"
              class="size-3.5 mr-1.5"
            />
            直播间
          </Button>
        </div>
      </div>
    </article>
  </BlockCard>
</template>
