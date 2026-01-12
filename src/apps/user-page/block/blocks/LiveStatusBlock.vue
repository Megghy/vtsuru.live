<script setup lang="ts">
import type { UserInfo } from '@/api/api-models'
import { NAvatar, NButton, NCard, NFlex, NIcon, NTag, NText } from 'naive-ui'
import { computed } from 'vue'
import { HomeOutline, PlayCircleOutline } from '@vicons/ionicons5'

interface BlockConfig {
  variant?: 'card' | 'compact'
  showTitle?: boolean
  showArea?: boolean
  showCover?: boolean
  showButtons?: boolean
}

const props = defineProps<{
  blockProps: unknown
  userInfo?: UserInfo | undefined
  biliInfo?: unknown
}>()

const cfg = computed<BlockConfig>(() => {
  const o = (props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps))
    ? (props.blockProps as any)
    : {}
  const variant = (o.variant === 'compact' || o.variant === 'card') ? o.variant : 'card'
  return {
    variant,
    showTitle: typeof o.showTitle === 'boolean' ? o.showTitle : true,
    showArea: typeof o.showArea === 'boolean' ? o.showArea : true,
    showCover: typeof o.showCover === 'boolean' ? o.showCover : false,
    showButtons: typeof o.showButtons === 'boolean' ? o.showButtons : true,
  }
})

const model = computed(() => {
  const s = props.userInfo?.streamerInfo
  const isStreaming = !!s?.isStreaming
  const title = typeof s?.title === 'string' ? s.title : ''
  const coverUrl = typeof s?.coverUrl === 'string' ? s.coverUrl : ''
  const area = typeof s?.area === 'string' ? s.area : ''
  const parentArea = typeof s?.parentArea === 'string' ? s.parentArea : ''
  const avatarUrl = typeof s?.faceUrl === 'string' ? s.faceUrl : ''
  const displayName = typeof s?.name === 'string' && s.name.trim().length ? s.name : (props.userInfo?.name ?? '')
  const roomId = typeof s?.roomId === 'number' ? s.roomId : props.userInfo?.biliRoomId
  const liveRoomUrl = roomId ? `https://live.bilibili.com/${roomId}` : ''
  const spaceUrl = props.userInfo?.biliId ? `https://space.bilibili.com/${props.userInfo.biliId}` : ''
  const lastStreamAt = typeof s?.lastStreamAt === 'number' ? s.lastStreamAt : 0
  return { isStreaming, title, coverUrl, area, parentArea, avatarUrl, displayName, liveRoomUrl, spaceUrl, lastStreamAt }
})

function formatTime(ts: number) {
  if (!Number.isFinite(ts) || ts <= 0) return ''
  const d = new Date(ts)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

function formatDuration(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return ''
  const totalMin = Math.floor(ms / 60000)
  const hours = Math.floor(totalMin / 60)
  const minutes = totalMin % 60
  if (hours <= 0) return `已播 ${minutes} 分钟`
  return `已播 ${hours} 小时 ${minutes} 分钟`
}

const liveDurationText = computed(() => {
  if (!model.value.isStreaming) return ''
  if (!model.value.lastStreamAt) return ''
  const ms = Date.now() - model.value.lastStreamAt
  if (!Number.isFinite(ms) || ms <= 0) return ''
  return formatDuration(ms)
})
</script>

<template>
  <NCard size="small" content-style="padding: 0">
    <div class="live-card">
      <template v-if="cfg.variant === 'compact'">
        <div class="live-compact">
          <NFlex align="center" justify="space-between" style="gap: 12px">
            <NFlex align="center" style="gap: 10px; min-width: 0">
              <NAvatar
                v-if="model.avatarUrl"
                :src="model.avatarUrl"
                round
                :size="32"
                :img-props="{ referrerpolicy: 'no-referrer' }"
              />
              <div class="live-header-text">
                <NText strong class="live-name">{{ model.displayName || '主播' }}</NText>
                <NText v-if="cfg.showTitle && model.title" depth="3" class="live-sub">
                  {{ model.title }}
                </NText>
                <NText v-else depth="3" class="live-sub">
                  Bilibili
                  <template v-if="cfg.showArea && (model.parentArea || model.area)">
                    · {{ model.parentArea }}{{ model.parentArea && model.area ? ' / ' : '' }}{{ model.area }}
                  </template>
                </NText>
              </div>
            </NFlex>

            <NFlex align="center" style="gap: 10px; flex-shrink: 0">
              <div class="live-status compact">
                <span class="dot" :class="{ on: model.isStreaming }" />
                <NText depth="2" style="font-weight: 700">
                  {{ model.isStreaming ? '直播中' : '离线' }}
                </NText>
              </div>
              <NButton
                v-if="cfg.showButtons && model.liveRoomUrl"
                size="tiny"
                class="action compact"
                :type="model.isStreaming ? 'primary' : 'default'"
                secondary
                tag="a"
                target="_blank"
                rel="noopener noreferrer"
                :href="model.liveRoomUrl"
              >
                <template #icon>
                  <NIcon><PlayCircleOutline /></NIcon>
                </template>
                直播间
              </NButton>
            </NFlex>
          </NFlex>

          <NText v-if="model.isStreaming && liveDurationText" depth="3" style="display:block; margin-top: 10px">
            {{ liveDurationText }}
          </NText>
          <NText v-else-if="!model.isStreaming && model.lastStreamAt" depth="3" style="display:block; margin-top: 10px">
            上次直播：{{ formatTime(model.lastStreamAt) }}
          </NText>
        </div>
      </template>

      <template v-else>
      <div class="live-header">
        <NFlex align="center" style="gap: 10px; min-width: 0">
          <NAvatar
            v-if="model.avatarUrl"
            :src="model.avatarUrl"
            round
            :size="34"
            :img-props="{ referrerpolicy: 'no-referrer' }"
          />
          <div class="live-header-text">
            <NText strong class="live-name">{{ model.displayName || '主播' }}</NText>
            <NText depth="3" class="live-sub">
              Bilibili
              <template v-if="props.userInfo?.biliRoomId"> · 房间 {{ props.userInfo.biliRoomId }}</template>
            </NText>
          </div>
        </NFlex>

        <div class="live-status">
          <span class="dot" :class="{ on: model.isStreaming }" />
          <NText depth="2" style="font-weight: 700">
            {{ model.isStreaming ? '直播中' : '离线' }}
          </NText>
        </div>
      </div>

      <div v-if="cfg.showCover && model.coverUrl" class="live-cover">
        <img
          :src="model.coverUrl"
          alt=""
          referrerpolicy="no-referrer"
          loading="lazy"
          decoding="async"
        >
        <div class="live-cover-overlay" />
        <div class="live-cover-content">
          <div class="live-cover-top">
            <NTag
              :type="model.isStreaming ? 'success' : 'default'"
              size="small"
              :bordered="false"
              class="pill"
            >
              {{ model.isStreaming ? 'LIVE' : 'OFFLINE' }}
            </NTag>
            <NText v-if="cfg.showArea && (model.parentArea || model.area)" class="pill-muted">
              {{ model.parentArea }}{{ model.parentArea && model.area ? ' / ' : '' }}{{ model.area }}
            </NText>
          </div>

          <NText v-if="cfg.showTitle && model.title" class="live-title">
            {{ model.title }}
          </NText>
          <NText v-else class="live-title muted">
            {{ model.isStreaming ? '正在直播' : '暂未开播' }}
          </NText>

          <NText v-if="model.isStreaming && liveDurationText" class="live-kicker">
            {{ liveDurationText }}
          </NText>
          <NText v-else-if="!model.isStreaming && model.lastStreamAt" class="live-kicker">
            上次直播：{{ formatTime(model.lastStreamAt) }}
          </NText>
        </div>
      </div>

      <div v-else class="live-body">
        <NText v-if="cfg.showTitle && model.title" strong style="display:block; white-space: pre-wrap">
          {{ model.title }}
        </NText>
        <NText v-if="cfg.showArea && (model.parentArea || model.area)" depth="3" style="display:block; margin-top: 6px">
          分区：{{ model.parentArea }}{{ model.parentArea && model.area ? ' / ' : '' }}{{ model.area }}
        </NText>
        <NText v-if="model.isStreaming && liveDurationText" depth="3" style="display:block; margin-top: 6px">
          {{ liveDurationText }}
        </NText>
        <NText v-else-if="!model.isStreaming && model.lastStreamAt" depth="3" style="display:block; margin-top: 6px">
          上次直播：{{ formatTime(model.lastStreamAt) }}
        </NText>
      </div>

      <div v-if="cfg.showButtons" class="live-actions">
        <NButton
          v-if="model.spaceUrl"
          class="action"
          secondary
          tag="a"
          target="_blank"
          rel="noopener noreferrer"
          :href="model.spaceUrl"
        >
          <template #icon>
            <NIcon><HomeOutline /></NIcon>
          </template>
          主页
        </NButton>
        <NButton
          v-if="model.liveRoomUrl"
          class="action"
          :type="model.isStreaming ? 'primary' : 'default'"
          secondary
          tag="a"
          target="_blank"
          rel="noopener noreferrer"
          :href="model.liveRoomUrl"
        >
          <template #icon>
            <NIcon><PlayCircleOutline /></NIcon>
          </template>
          直播间
        </NButton>
      </div>
      </template>
    </div>
  </NCard>
</template>

<style scoped>
.live-card {
  border-radius: var(--vtsuru-page-radius);
  overflow: hidden;
}

.live-header {
  padding: 12px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.live-header-text {
  min-width: 0;
}

.live-name {
  display: block;
  font-size: 14px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.live-sub {
  display: block;
  font-size: 12px;
  line-height: 1.2;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.live-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--n-border-color);
  background: rgba(0, 0, 0, 0.03);
}
.live-status.compact {
  padding: 5px 10px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.25);
  box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.06);
}

.dot.on {
  background: var(--n-success-color, #18a058);
  box-shadow: 0 0 0 3px rgba(24, 160, 88, 0.18);
}

.live-cover {
  position: relative;
  height: 160px;
  border-top: 1px solid var(--n-border-color);
  border-bottom: 1px solid var(--n-border-color);
}

.live-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale(1.02);
}

.live-cover-overlay {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(0, 0, 0, 0.10) 0%, rgba(0, 0, 0, 0.05) 35%, rgba(0, 0, 0, 0.62) 100%);
  pointer-events: none;
}

.live-cover-content {
  position: absolute;
  inset: 0;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 6px;
  color: #fff;
}

.live-cover-top {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.pill {
  font-weight: 800;
  letter-spacing: 0.06em;
}

.pill-muted {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.88);
  background: rgba(0, 0, 0, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.16);
  padding: 3px 8px;
  border-radius: 999px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.live-title {
  font-size: 14px;
  font-weight: 800;
  line-height: 1.35;
  white-space: pre-wrap;
  text-shadow: 0 6px 22px rgba(0, 0, 0, 0.35);
}

.live-title.muted {
  opacity: 0.92;
}

.live-kicker {
  font-size: 12px;
  font-weight: 650;
  letter-spacing: 0.02em;
  color: rgba(255, 255, 255, 0.92);
}

.live-body {
  padding: 12px 14px;
}

.live-actions {
  padding: 12px 14px 14px;
  display: grid;
  gap: 10px;
  grid-template-columns: 1fr 1fr;
}

.action {
  border-radius: 999px;
  font-weight: 750;
}
.action.compact {
  padding-left: 10px;
  padding-right: 10px;
}

.live-compact {
  padding: 12px 14px 14px;
}
</style>
