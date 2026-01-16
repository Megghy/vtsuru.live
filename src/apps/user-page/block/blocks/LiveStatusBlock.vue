<script setup lang="ts">
import type { UserInfo } from '@/api/api-models'
import { NAvatar, NButton, NFlex, NIcon, NText } from 'naive-ui'
import { computed } from 'vue'
import {
  HomeOutline,
  PlayCircleOutline,
  TvOutline,
  GameControllerOutline,
  CalendarOutline
} from '@vicons/ionicons5'
import BlockCard from '../BlockCard.vue'

interface BlockConfig {
  variant?: 'card' | 'compact'
  showTitle?: boolean
  showArea?: boolean
  showCover?: boolean
  showButtons?: boolean
  framed?: boolean
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
    framed: typeof o.framed === 'boolean' ? o.framed : true,
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
  <BlockCard :framed="cfg.framed" :content-style="{ padding: 0 }">
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
                <NText strong class="live-name">
                  {{ model.displayName || '主播' }}
                </NText>
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
                  <NIcon><TvOutline /></NIcon>
                </template>
                直播间
              </NButton>
            </NFlex>
          </NFlex>

          <NFlex v-if="model.isStreaming && liveDurationText" align="center" size="small" style="margin-top: 10px; gap: 6px">
            <NIcon depth="3" size="14">
              <img src="@/svgs/bilibili.svg" style="width:100%;height:100%">
            </NIcon>
            <NText depth="3" style="font-size: 12px">
              {{ liveDurationText }}
            </NText>
          </NFlex>
          <NFlex v-else-if="!model.isStreaming && model.lastStreamAt" align="center" size="small" style="margin-top: 10px; gap: 6px">
            <NIcon depth="3" size="14">
              <CalendarOutline />
            </NIcon>
            <NText depth="3" style="font-size: 12px">
              上次直播：{{ formatTime(model.lastStreamAt) }}
            </NText>
          </NFlex>
        </div>
      </template>

      <template v-else>
        <!-- Immersive Cover Background Mode -->
        <div
          v-if="cfg.showCover && model.coverUrl"
          class="live-immersive"
        >
          <!-- Background Layer -->
          <div class="live-bg">
            <img :src="model.coverUrl" alt="">
            <div class="live-bg-overlay" />
          </div>

          <!-- Content Layer -->
          <div class="live-content-layer">
            <div class="live-header immersive">
              <NFlex align="center" style="gap: 12px; min-width: 0">
                <NAvatar
                  v-if="model.avatarUrl"
                  :src="model.avatarUrl"
                  round
                  :size="40"
                  style="border: 2px solid rgba(255,255,255,0.2)"
                  :img-props="{ referrerpolicy: 'no-referrer' }"
                />
                <div class="live-header-text">
                  <NText strong class="live-name text-white">
                    {{ model.displayName || '主播' }}
                  </NText>
                  <div class="live-sub text-white-70">
                    <NIcon style="vertical-align: -2px; margin-right: 2px" size="12">
                      <TvOutline />
                    </NIcon>
                    Bilibili
                    <template v-if="props.userInfo?.biliRoomId">
                      · 房间 {{ props.userInfo.biliRoomId }}
                    </template>
                  </div>
                </div>
              </NFlex>

              <div class="live-status immersive">
                <span class="dot" :class="{ on: model.isStreaming }" />
                <span class="status-text">
                  {{ model.isStreaming ? '直播中' : '离线' }}
                </span>
              </div>
            </div>

            <div class="live-body immersive">
              <div v-if="cfg.showArea && (model.parentArea || model.area)" class="pill-area">
                <NIcon style="vertical-align: -1px; margin-right: 4px">
                  <GameControllerOutline />
                </NIcon>
                <span>{{ model.parentArea }}{{ model.parentArea && model.area ? ' / ' : '' }}{{ model.area }}</span>
              </div>

              <NText v-if="cfg.showTitle && model.title" class="live-title text-white">
                {{ model.title }}
              </NText>
              <NText v-else class="live-title muted text-white">
                {{ model.isStreaming ? '正在直播' : '暂未开播' }}
              </NText>

              <div v-if="model.isStreaming && liveDurationText" class="live-kicker text-white-90">
                <NIcon style="vertical-align: -2px; margin-right: 4px">
                  <PlayCircleOutline />
                </NIcon>
                {{ liveDurationText }}
              </div>
              <div v-else-if="!model.isStreaming && model.lastStreamAt" class="live-kicker text-white-90">
                <NIcon style="vertical-align: -2px; margin-right: 4px">
                  <CalendarOutline />
                </NIcon>
                上次直播：{{ formatTime(model.lastStreamAt) }}
              </div>
            </div>

            <div v-if="cfg.showButtons" class="live-actions immersive">
              <NButton
                v-if="model.spaceUrl"
                class="action immersive-btn"
                ghost
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
                class="action immersive-btn"
                :type="model.isStreaming ? 'primary' : 'default'"
                :ghost="!model.isStreaming"
                tag="a"
                target="_blank"
                rel="noopener noreferrer"
                :href="model.liveRoomUrl"
              >
                <template #icon>
                  <NIcon><TvOutline /></NIcon>
                </template>
                直播间
              </NButton>
            </div>
          </div>
        </div>

        <!-- Classic Mode (No Cover or Cover Hidden) -->
        <div v-else>
          <div class="live-header">
            <NFlex align="center" style="gap: 10px; min-width: 0">
              <NAvatar
                v-if="model.avatarUrl"
                :src="model.avatarUrl"
                round
                :size="34"
                :img-props="{ referrerpolicy: 'no-referrer' }"
                style="border: 1px solid var(--n-divider-color)"
              />
              <div class="live-header-text">
                <NText strong class="live-name">
                  {{ model.displayName || '主播' }}
                </NText>
                <NText depth="3" class="live-sub">
                  <NIcon style="vertical-align: -2px; margin-right: 2px" size="12">
                    <TvOutline />
                  </NIcon>
                  Bilibili
                  <template v-if="props.userInfo?.biliRoomId">
                    · 房间 {{ props.userInfo.biliRoomId }}
                  </template>
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

          <div class="live-body">
            <NText v-if="cfg.showTitle && model.title" strong style="display:block; white-space: pre-wrap; font-size: 15px; line-height: 1.4">
              {{ model.title }}
            </NText>
            <NFlex v-if="cfg.showArea && (model.parentArea || model.area)" align="center" class="meta-row">
              <NIcon size="14">
                <GameControllerOutline />
              </NIcon>
              <NText depth="3">
                {{ model.parentArea }}{{ model.parentArea && model.area ? ' / ' : '' }}{{ model.area }}
              </NText>
            </NFlex>
            <NFlex v-if="model.isStreaming && liveDurationText" align="center" class="meta-row">
              <NIcon size="14">
                <PlayCircleOutline />
              </NIcon>
              <NText depth="3">
                {{ liveDurationText }}
              </NText>
            </NFlex>
            <NFlex v-else-if="!model.isStreaming && model.lastStreamAt" align="center" class="meta-row">
              <NIcon size="14">
                <CalendarOutline />
              </NIcon>
              <NText depth="3">
                上次直播：{{ formatTime(model.lastStreamAt) }}
              </NText>
            </NFlex>
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
                <NIcon><TvOutline /></NIcon>
              </template>
              直播间
            </NButton>
          </div>
        </div>
      </template>
    </div>
  </BlockCard>
</template>

<style scoped>
.live-card {
  border-radius: var(--vtsuru-page-radius);
  overflow: hidden;
}

.live-header {
  padding: 16px;
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
  font-size: 15px;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.live-sub {
  display: block;
  font-size: 13px;
  line-height: 1.25;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.live-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--n-divider-color);
  background: var(--n-card-color);
}
.live-status.compact {
  padding: 4px 8px;
  font-size: 12px;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--n-text-color-3);
}

.dot.on {
  background: var(--n-error-color);
  box-shadow: 0 0 0 2px var(--n-error-color-suppl);
}

.live-cover {
  position: relative;
  aspect-ratio: 16 / 9;
  height: auto;
  border-top: 1px solid var(--n-divider-color);
  border-bottom: 1px solid var(--n-divider-color);
  background: #000;
}

.live-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.9;
}

.live-cover-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 60%);
  pointer-events: none;
}

.live-cover-content {
  position: absolute;
  inset: 0;
  padding: 16px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 4px;
  color: #fff;
}

.live-cover-top {
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.pill-muted {
  font-size: 12px;
  color: #fff;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  padding: 2px 8px;
  border-radius: 6px;
  font-weight: 500;
}

.live-title {
  font-size: 16px;
  font-weight: 700;
  line-height: 1.4;
  white-space: pre-wrap;
  text-shadow: 0 2px 4px rgba(0,0,0,0.5);
}

.live-title.muted {
  opacity: 0.8;
}

.live-kicker {
  font-size: 12px;
  font-weight: 500;
  opacity: 0.9;
  margin-top: 2px;
}

.live-body {
  padding: 16px;
}

.live-actions {
  padding: 16px;
  display: grid;
  gap: 12px;
  grid-template-columns: 1fr 1fr;
}

.action {
  border-radius: var(--vtsuru-page-radius);
  font-weight: 600;
}
.action.compact {
  padding-left: 12px;
  padding-right: 12px;
}

.live-compact {
  padding: 16px;
}

.meta-row {
  margin-top: 8px;
  gap: 8px;
}
.meta-row .n-icon {
  opacity: 0.7;
}

.live-immersive {
  position: relative;
  overflow: hidden;
  border-radius: var(--vtsuru-page-radius);
  /* Ensure it fills the card if needed, or just flows */
  display: flex;
  flex-direction: column;
}

.live-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  overflow: hidden;
}

.live-bg img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(20px) brightness(0.6);
  transform: scale(1.1); /* Prevent blur edges from showing white */
}

.live-bg-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 100%);
}

.live-content-layer {
  position: relative;
  z-index: 1;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 200px; /* Give it some height for the cover to shine */
  justify-content: space-between;
}

.live-header.immersive {
  padding: 0;
  border-bottom: none;
}

.live-status.immersive {
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  padding: 4px 10px;
  border-radius: 99px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.live-status.immersive .status-text {
  color: #fff;
  font-weight: 600;
  font-size: 13px;
}

.live-body.immersive {
  padding: 0;
  color: white;
}

.text-white { color: #fff; }
.text-white-90 { color: rgba(255, 255, 255, 0.9); }
.text-white-70 { color: rgba(255, 255, 255, 0.7); }

.pill-area {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(4px);
  padding: 2px 8px;
  border-radius: 4px;
  margin-bottom: 8px;
  color: rgba(255, 255, 255, 0.9);
}

.live-title.muted {
  font-style: italic;
  opacity: 0.8;
}

.live-actions.immersive {
  padding: 0;
  border-top: none;
  background: transparent;
  gap: 12px;
}

.immersive-btn {
  background: rgba(255, 255, 255, 0.1) !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
  color: white !important;
  backdrop-filter: blur(4px);
}
.immersive-btn:hover {
  background: rgba(255, 255, 255, 0.2) !important;
}

</style>
