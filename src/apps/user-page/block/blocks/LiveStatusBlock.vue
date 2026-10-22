<script setup lang="ts">
import { CalendarOutline, GameControllerOutline, HomeOutline, PlayCircleOutline, TvOutline } from '@vicons/ionicons5'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import type { UserInfo } from '@/api/api-models'
import { formatBiliLiveReserveTime } from '@/shared/utils/formatBiliLiveReserve'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'
import { Button } from '@/shared/ui/button'

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
      <AlertDescription>
        直播信息暂不可用
      </AlertDescription>
    </Alert>

    <article
      v-else
      class="live-card"
      :class="{ compact: cfg.variant === 'compact', immersive: hasCover }"
    >
      <img
        v-if="hasCover"
        class="cover"
        :src="model.coverUrl"
        alt=""
        loading="lazy"
        decoding="async"
        referrerpolicy="no-referrer"
        @error="coverFailed = true"
      />
      <div
        v-if="hasCover"
        class="cover-shade"
      />

      <div class="content">
        <header class="header">
          <div class="identity">
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
            <div class="identity-text">
              <strong class="name">{{ model.displayName }}</strong>
              <span class="platform">哔哩哔哩直播</span>
            </div>
          </div>

          <div
            class="status"
            :class="{ online: model.isStreaming, reserve: !model.isStreaming && model.liveReserve }"
            aria-live="polite"
            aria-atomic="true"
          >
            <span class="status-dot" />
            {{ model.isStreaming ? '直播中' : model.liveReserve ? '预告' : '未开播' }}
          </div>
        </header>

        <div class="body">
          <strong
            v-if="cfg.showTitle && model.title"
            class="title"
            >{{ model.title }}</strong
          >
          <div
            v-if="cfg.showArea && model.area"
            class="meta"
          >
            <component :is="GameControllerOutline" class="size-4 shrink-0" />
            <span>{{ model.area }}</span>
          </div>
          <div
            v-if="durationText"
            class="meta"
            aria-live="polite"
          >
            <component :is="PlayCircleOutline" class="size-4 shrink-0" />
            <span>{{ durationText }}</span>
          </div>
          <a
            v-else-if="!model.isStreaming && model.liveReserve && model.liveRoomUrl"
            class="meta meta-link"
            :href="model.liveRoomUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            <component :is="CalendarOutline" class="size-4 shrink-0" />
            <span>下次直播 {{ formatBiliLiveReserveTime(model.liveReserve.planStart) }} · {{ model.liveReserve.title }}</span>
          </a>
          <div
            v-else-if="!model.isStreaming && model.liveReserve"
            class="meta"
          >
            <component :is="CalendarOutline" class="size-4 shrink-0" />
            <span>下次直播 {{ formatBiliLiveReserveTime(model.liveReserve.planStart) }} · {{ model.liveReserve.title }}</span>
          </div>
          <div
            v-else-if="model.lastStreamAt"
            class="meta"
          >
            <component :is="CalendarOutline" class="size-4 shrink-0" />
            <span>上次直播：{{ formatTime(model.lastStreamAt) }}</span>
          </div>
        </div>

        <div
          v-if="cfg.showButtons && (model.spaceUrl || model.liveRoomUrl)"
          class="actions"
        >
          <Button v-if="model.spaceUrl" as="a" variant="outline" class="font-medium" :class="{ 'bg-white/10 text-white border-white/20 hover:bg-white/20': hasCover }" target="_blank" rel="noopener noreferrer" :href="model.spaceUrl" aria-label="打开主播主页（新窗口打开）">
            <component :is="HomeOutline" class="size-3.5 mr-1.5" />
            主页
          </Button>
          <Button v-if="model.liveRoomUrl" as="a" :variant="model.isStreaming ? 'default' : 'outline'" class="font-medium" :class="{ 'bg-white/10 text-white border-white/20 hover:bg-white/20': hasCover && !model.isStreaming }" target="_blank" rel="noopener noreferrer" :href="model.liveRoomUrl" aria-label="打开直播间（新窗口打开）">
            <component :is="TvOutline" class="size-3.5 mr-1.5" />
            直播间
          </Button>
        </div>
      </div>
    </article>
  </BlockCard>
</template>

<style scoped>
:scope {
  --livestatus-brand-color: #fb7299;
  --livestatus-status-online-light: #ff8a9c;
  --livestatus-status-reserve-light: #ffb1c7;
  --livestatus-immersive-bg: #111111;
  --livestatus-immersive-fg: #ffffff;
  --livestatus-immersive-fg-muted: rgba(255, 255, 255, 0.78);
  --livestatus-immersive-status-fg: rgba(255, 255, 255, 0.82);
  --livestatus-immersive-status-border: rgba(255, 255, 255, 0.28);
  --livestatus-immersive-status-bg: rgba(0, 0, 0, 0.42);
}

.live-card {
  container-type: inline-size;
  position: relative;
  overflow: hidden;
  border-radius: var(--vtsuru-page-radius);
  color: var(--vtsuru-block-fg);
  background: transparent;
}
.cover,
.cover-shade {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.cover {
  object-fit: cover;
}
.cover-shade {
  background: rgba(0, 0, 0, 0.68);
}
.content {
  position: relative;
  display: grid;
  gap: 16px;
  padding: 16px;
}
.header,
.identity,
.status,
.meta,
.actions {
  display: flex;
  align-items: center;
}
.header {
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}
.identity {
  gap: 10px;
  min-width: 0;
}
.identity-text {
  min-width: 0;
}
.name,
.platform {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.name {
  font-size: 15px;
  line-height: 1.3;
}
.platform {
  margin-top: 2px;
  color: var(--vtsuru-block-fg-muted);
  font-size: 12px;
}
.status {
  flex: none;
  gap: 6px;
  padding: 4px 9px;
  border: var(--vtsuru-page-border-width) var(--vtsuru-page-border-style) var(--vtsuru-block-border);
  border-radius: 999px;
  color: var(--vtsuru-block-fg-muted);
  background: var(--vtsuru-block-bg-muted);
  font-size: 12px;
  font-weight: 600;
}
.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentcolor;
}
.status.online {
  color: var(--vtsuru-page-primary-readable, var(--vtsuru-page-primary, var(--brand)));
}
.status.reserve {
  color: var(--livestatus-brand-color);
}
.body {
  display: grid;
  gap: 8px;
  min-width: 0;
}
.title {
  font-size: 16px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}
.meta {
  gap: 7px;
  color: var(--vtsuru-block-fg-muted);
  font-size: 13px;
  line-height: 1.4;
}
.meta-link {
  color: inherit;
  text-decoration: none;
}
.meta-link:hover {
  color: var(--livestatus-brand-color);
}
.actions {
  gap: 10px;
}
.actions > * {
  flex: 1;
}

.immersive {
  min-height: 220px;
  color: var(--livestatus-immersive-fg);
  background: var(--livestatus-immersive-bg);
}
.immersive .content {
  min-height: 220px;
  align-content: space-between;
}
.immersive .platform,
.immersive .meta {
  color: var(--livestatus-immersive-fg-muted);
}
.immersive .status {
  color: var(--livestatus-immersive-status-fg);
  border-color: var(--livestatus-immersive-status-border);
  background: var(--livestatus-immersive-status-bg);
}
.immersive .status.online {
  color: var(--livestatus-status-online-light);
}
.immersive .status.reserve {
  color: var(--livestatus-status-reserve-light);
}

.compact .content {
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px 12px;
}
.compact .header {
  grid-column: 1 / -1;
}
.compact .body {
  align-self: center;
}
.compact .actions {
  justify-content: flex-end;
}
.compact .actions > * {
  flex: none;
}
.compact.immersive {
  min-height: 156px;
}
.compact.immersive .content {
  min-height: 156px;
}

@container (max-width: 520px) {
  .content,
  .compact .content {
    grid-template-columns: 1fr;
    padding: 14px;
  }
  .compact .header,
  .compact .body,
  .compact .actions {
    grid-column: 1;
  }
  .header {
    align-items: flex-start;
  }
  .actions,
  .compact .actions {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  }
  .actions > *,
  .compact .actions > * {
    width: 100%;
  }
}
</style>
