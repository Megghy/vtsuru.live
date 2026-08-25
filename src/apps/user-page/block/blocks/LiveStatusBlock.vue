<script setup lang="ts">
import { CalendarOutline, GameControllerOutline, HomeOutline, PlayCircleOutline, TvOutline } from '@vicons/ionicons5'
import { NAlert, NAvatar, NButton, NIcon } from 'naive-ui'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import type { UserInfo } from '@/api/api-models'
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
const actionButtonProps = computed(() =>
  hasCover.value ? { color: 'rgba(255, 255, 255, 0.16)', textColor: '#ffffff' } : { secondary: true },
)
</script>

<template>
  <BlockCard
    :framed="cfg.framed"
    :backgrounded="cfg.backgrounded"
    :content-style="{ padding: 0 }"
  >
    <NAlert
      v-if="!model.available"
      type="info"
      :show-icon="false"
    >
      直播信息暂不可用
    </NAlert>

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
            <NAvatar
              v-if="model.avatarUrl"
              :src="model.avatarUrl"
              round
              :size="cfg.variant === 'compact' ? 34 : 42"
              :img-props="{ referrerpolicy: 'no-referrer', loading: 'lazy', alt: model.displayName }"
            />
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
            <NIcon><GameControllerOutline /></NIcon>
            <span>{{ model.area }}</span>
          </div>
          <div
            v-if="durationText"
            class="meta"
            aria-live="polite"
          >
            <NIcon><PlayCircleOutline /></NIcon>
            <span>{{ durationText }}</span>
          </div>
          <a
            v-else-if="!model.isStreaming && model.liveReserve && model.liveRoomUrl"
            class="meta meta-link"
            :href="model.liveRoomUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            <NIcon><CalendarOutline /></NIcon>
            <span>下次直播 {{ formatBiliLiveReserveTime(model.liveReserve.planStart) }} · {{ model.liveReserve.title }}</span>
          </a>
          <div
            v-else-if="!model.isStreaming && model.liveReserve"
            class="meta"
          >
            <NIcon><CalendarOutline /></NIcon>
            <span>下次直播 {{ formatBiliLiveReserveTime(model.liveReserve.planStart) }} · {{ model.liveReserve.title }}</span>
          </div>
          <div
            v-else-if="model.lastStreamAt"
            class="meta"
          >
            <NIcon><CalendarOutline /></NIcon>
            <span>上次直播：{{ formatTime(model.lastStreamAt) }}</span>
          </div>
        </div>

        <div
          v-if="cfg.showButtons && (model.spaceUrl || model.liveRoomUrl)"
          class="actions"
        >
          <NButton
            v-if="model.spaceUrl"
            v-bind="actionButtonProps"
            tag="a"
            target="_blank"
            rel="noopener noreferrer"
            :href="model.spaceUrl"
            aria-label="打开主播主页（新窗口打开）"
          >
            <template #icon>
              <NIcon><HomeOutline /></NIcon>
            </template>
            主页
          </NButton>
          <NButton
            v-if="model.liveRoomUrl"
            :type="model.isStreaming ? 'primary' : 'default'"
            v-bind="actionButtonProps"
            tag="a"
            target="_blank"
            rel="noopener noreferrer"
            :href="model.liveRoomUrl"
            aria-label="打开直播间（新窗口打开）"
          >
            <template #icon>
              <NIcon><TvOutline /></NIcon>
            </template>
            直播间
          </NButton>
        </div>
      </div>
    </article>
  </BlockCard>
</template>

<style scoped>
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
  color: var(--vtsuru-page-primary-readable, var(--vtsuru-page-primary, var(--vtsuru-brand)));
}
.status.reserve {
  color: #fb7299;
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
.meta .n-icon {
  flex: none;
}
.meta-link {
  color: inherit;
  text-decoration: none;
}
.meta-link:hover {
  color: #fb7299;
}
.actions {
  gap: 10px;
}
.actions > * {
  flex: 1;
}

.immersive {
  min-height: 220px;
  color: #ffffff;
  background: #111111;
}
.immersive .content {
  min-height: 220px;
  align-content: space-between;
}
.immersive .platform,
.immersive .meta {
  color: rgba(255, 255, 255, 0.78);
}
.immersive .status {
  color: rgba(255, 255, 255, 0.82);
  border-color: rgba(255, 255, 255, 0.28);
  background: rgba(0, 0, 0, 0.42);
}
.immersive .status.online {
  color: #ff8a9c;
}
.immersive .status.reserve {
  color: #ffb1c7;
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
