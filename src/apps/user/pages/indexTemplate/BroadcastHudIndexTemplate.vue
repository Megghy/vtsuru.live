<script lang="ts" setup>
import { useIntervalFn, useNow } from '@vueuse/core'
import { ArrowUpRight, Calendar, Palette, Radio, Terminal } from 'lucide-vue-next'
import { computed } from 'vue'

import type { ResponseUserInfo } from '@/api/generated/model'
import type { BiliProfile } from '@/apps/user-page/types'
import SimpleVideoCard from '@/components/SimpleVideoCard.vue'
import type { ExtractConfigData } from '@/shared/types/VTsuruConfigTypes'
import { defineTemplateConfig } from '@/shared/types/VTsuruConfigTypes'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'
import { Button } from '@/shared/ui/button'
import { Empty } from '@/shared/ui/empty'
import { Spin } from '@/shared/ui/spin'
import BilibiliIcon from '@/svgs/social/bilibili.svg?component'

import { useIndexTemplateData } from './useIndexTemplateData'

const props = defineProps<{
  userInfo: ResponseUserInfo | undefined
  biliInfo: BiliProfile | undefined
}>()
defineExpose({ Config, DefaultConfig })

const {
  isLoading,
  showHeaderImage,
  showAvatarFrame,
  indexInfo,
  avatar,
  headerImage,
  avatarFrame,
  nameplateText,
  honorText,
  level,
  streamerName,
  signature,
  isOwner,
  isStreaming,
  liveReserve,
  liveReserveTimeText,
  liveReserveLabel,
  profileStats,
  orderedLinks,
  biliSpaceUrl,
  liveRoomUrl,
  navigate,
} = useIndexTemplateData(props)

const now = useNow({ scheduler: (cb) => useIntervalFn(cb, 1000) })
const clockText = computed(() => {
  const d = now.value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
})

const signalState = computed(() => {
  if (isStreaming.value) return { code: 'ON_AIR', label: '正在直播', tone: 'live' as const }
  if (liveReserve.value) return { code: 'SCHEDULED', label: `预告 ${liveReserveTimeText.value}`, tone: 'reserve' as const }
  return { code: 'STANDBY', label: '频道待机', tone: 'idle' as const }
})

const marqueeSegments = computed(() => {
  const items = [
    `CH // @${props.userInfo?.name || 'CHANNEL'}`,
    `SIGNAL: ${signalState.value.code}`,
    props.userInfo?.streamerInfo?.uId ? `UID ${props.userInfo.streamerInfo.uId}` : '',
    props.userInfo?.streamerInfo?.area ? `SECTOR // ${props.userInfo.streamerInfo.area}` : '',
    honorText.value || nameplateText.value,
    `LOCAL ${clockText.value}`,
  ].filter(Boolean)
  return items
})

function extractHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'EXTERNAL'
  }
}
</script>

<script lang="ts">
export type ConfigType = ExtractConfigData<typeof Config>
export const DefaultConfig = {} as ConfigType
export const Config = defineTemplateConfig([])
</script>

<template>
  <div class="hud-page">
    <!-- 顶部滚动进度刻尺（原生 CSS Scroll-Driven Animation） -->
    <div
      class="hud-scroll-meter"
      aria-hidden="true"
    />

    <!-- 顶部机能状态跑马灯 -->
    <div class="hud-ticker">
      <div class="hud-ticker__track">
        <div
          v-for="loop in 2"
          :key="loop"
          class="hud-ticker__group"
          :aria-hidden="loop === 2"
        >
          <span
            v-for="(seg, idx) in marqueeSegments"
            :key="`${loop}-${idx}`"
            class="hud-ticker__item"
          >
            <span class="hud-ticker__dot" />
            {{ seg }}
          </span>
        </div>
      </div>
    </div>

    <div
      v-if="isLoading"
      class="py-24 flex justify-center"
    >
      <Spin />
    </div>

    <div
      v-else
      class="hud-container"
    >
      <!-- ==================== 首屏：非对称战术 Bento 监视台 ==================== -->
      <section class="hud-hero-grid">
        <!-- 主监视核心（左 7 列） -->
        <article class="hud-panel hud-monitor">
          <div class="hud-panel__bar">
            <span class="hud-code">[SYS.01 // BROADCAST_MONITOR]</span>
            <div class="hud-panel__bar-right">
              <span class="hud-clock tabular-nums">{{ clockText }}</span>
              <span
                class="hud-status-badge"
                :class="`is-${signalState.tone}`"
              >
                <span class="hud-status-badge__dot" />
                {{ signalState.code }}
              </span>
            </div>
          </div>

          <!-- 视窗画幅（头图 + 扫描线 + 准星角标） -->
          <div class="hud-viewport">
            <img
              v-if="headerImage && showHeaderImage"
              :src="headerImage"
              alt=""
              class="hud-viewport__img"
              referrerpolicy="no-referrer"
              @error="showHeaderImage = false"
            />
            <div
              v-else
              class="hud-viewport__fallback"
            >
              <div class="hud-radar-ring" />
              <span class="hud-code">NO_SIGNAL_BANNER // {{ props.userInfo?.name?.toUpperCase() || 'LIVE' }}</span>
            </div>
            <div
              class="hud-scanlines"
              aria-hidden="true"
            />
            <span
              class="hud-corner hud-corner--tl"
              aria-hidden="true"
            />
            <span
              class="hud-corner hud-corner--tr"
              aria-hidden="true"
            />
            <span
              class="hud-corner hud-corner--bl"
              aria-hidden="true"
            />
            <span
              class="hud-corner hud-corner--br"
              aria-hidden="true"
            />

            <div class="hud-viewport__overlay-tags">
              <span
                v-if="props.userInfo?.streamerInfo?.area"
                class="hud-chip"
              >
                {{ props.userInfo.streamerInfo.area }}
              </span>
              <span
                v-if="level"
                class="hud-chip"
              >
                LV.{{ level }}
              </span>
            </div>
          </div>

          <!-- 监视器底部身份带 -->
          <div class="hud-identity">
            <div class="hud-identity__main">
              <div
                v-if="avatar"
                class="hud-avatar-box"
              >
                <Avatar class="size-20 rounded-[4px] border border-border">
                  <AvatarImage
                    :src="avatar"
                    referrerpolicy="no-referrer"
                  />
                  <AvatarFallback>{{ streamerName.charAt(0) }}</AvatarFallback>
                </Avatar>
                <img
                  v-if="avatarFrame && showAvatarFrame"
                  :src="avatarFrame"
                  alt=""
                  class="hud-avatar-box__pendant"
                  referrerpolicy="no-referrer"
                  @error="showAvatarFrame = false"
                />
              </div>

              <div class="hud-identity__copy">
                <div class="hud-identity__meta-row">
                  <span class="hud-code">OPERATOR // {{ props.userInfo?.name || 'CHANNEL' }}</span>
                  <span
                    v-if="props.userInfo?.streamerInfo?.uId"
                    class="hud-code"
                  >
                    UID {{ props.userInfo.streamerInfo.uId }}
                  </span>
                </div>
                <h1 class="hud-title">{{ streamerName }}</h1>
                <p class="hud-sign">{{ signature }}</p>
                <div
                  v-if="honorText || nameplateText"
                  class="hud-honor-line"
                >
                  <span class="hud-honor-pill">{{ honorText || nameplateText }}</span>
                </div>
              </div>
            </div>

            <div class="hud-actions">
              <Button
                v-if="liveRoomUrl"
                size="lg"
                class="hud-btn-primary gap-2"
                @click="navigate(liveRoomUrl)"
              >
                <Radio class="size-4" />
                <span>{{ isStreaming ? '接入直播信号' : '进入直播间' }}</span>
              </Button>
              <Button
                v-if="biliSpaceUrl"
                variant="outline"
                size="lg"
                class="hud-btn-ghost gap-2"
                @click="navigate(biliSpaceUrl)"
              >
                <component
                  :is="BilibiliIcon"
                  class="size-4 fill-current"
                />
                <span>B 站空间</span>
              </Button>
              <Button
                v-if="isOwner"
                variant="outline"
                size="lg"
                class="hud-btn-ghost gap-2"
                @click="$router.push({ name: 'manage-userPageBuilder' })"
              >
                <Palette class="size-4" />
                <span>主页装修</span>
              </Button>
            </div>
          </div>
        </article>

        <!-- 右侧遥测与广播栏（右 5 列） -->
        <div class="hud-side-stack">
          <!-- 遥测指标卡 -->
          <section class="hud-panel hud-telemetry">
            <div class="hud-panel__bar">
              <span class="hud-code">[SYS.02 // TELEMETRY]</span>
              <span class="hud-code">{{ signalState.label }}</span>
            </div>
            <div
              v-if="profileStats.length"
              class="hud-stat-grid"
            >
              <div
                v-for="(stat, idx) in profileStats"
                :key="stat.label"
                class="hud-stat-cell"
              >
                <span class="hud-stat-cell__en">{{ String(idx + 1).padStart(2, '0') }} / {{ stat.enLabel }}</span>
                <strong class="hud-stat-cell__val tabular-nums">{{ stat.text }}</strong>
                <span class="hud-stat-cell__cn">{{ stat.label }}</span>
                <span class="hud-stat-cell__bar" />
              </div>
            </div>
            <div
              v-else
              class="hud-stat-empty"
            >
              <span class="hud-code">TELEMETRY_CHANNEL // ACTIVE</span>
              <p class="text-xs text-muted-foreground m-0">频道在线档案已同步</p>
            </div>
          </section>

          <!-- 直播预约信号卡 -->
          <a
            v-if="!isStreaming && liveReserve && liveRoomUrl"
            :href="liveRoomUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="hud-panel hud-reserve-card"
          >
            <div class="hud-panel__bar">
              <span class="hud-code">[NEXT_TRANSMISSION]</span>
              <ArrowUpRight class="size-3.5 text-primary" />
            </div>
            <div class="hud-reserve-card__body">
              <Calendar class="size-4 text-primary shrink-0 mt-0.5" />
              <div class="min-w-0">
                <div class="hud-reserve-card__time">{{ liveReserveTimeText }}</div>
                <div class="hud-reserve-card__title">{{ liveReserve.title }}</div>
              </div>
            </div>
          </a>
          <section
            v-else-if="!isStreaming && liveReserve"
            class="hud-panel hud-reserve-card"
          >
            <div class="hud-panel__bar">
              <span class="hud-code">[NEXT_TRANSMISSION]</span>
            </div>
            <div class="hud-reserve-card__body">
              <Calendar class="size-4 text-primary shrink-0 mt-0.5" />
              <div class="min-w-0">
                <div class="hud-reserve-card__time">{{ liveReserveTimeText }}</div>
                <div class="hud-reserve-card__title">{{ liveReserve.title }}</div>
              </div>
            </div>
          </section>

          <!-- 终端报文公告卡 -->
          <section
            v-if="indexInfo.notification"
            class="hud-panel hud-dispatch"
          >
            <div class="hud-panel__bar">
              <span class="hud-code">[SYS.03 // DISPATCH_LOG]</span>
              <Terminal class="size-3.5 text-primary" />
            </div>
            <div class="hud-dispatch__body">
              <span class="hud-dispatch__prompt">&gt;_</span>
              <p class="hud-dispatch__text">{{ indexInfo.notification }}</p>
            </div>
          </section>

          <!-- 无公告无预约时的精简频道频谱卡 -->
          <section
            v-if="!indexInfo.notification && (isStreaming || !liveReserve)"
            class="hud-panel hud-dispatch"
          >
            <div class="hud-panel__bar">
              <span class="hud-code">[SYS.03 // CHANNEL_NOTE]</span>
              <Terminal class="size-3.5 text-primary" />
            </div>
            <div class="hud-dispatch__body">
              <span class="hud-dispatch__prompt">&gt;_</span>
              <p class="hud-dispatch__text">{{ liveReserveLabel || signature }}</p>
            </div>
          </section>
        </div>
      </section>

      <!-- ==================== 下方主体：指令外链 + 录像切片 ==================== -->
      <div
        v-if="orderedLinks.length || indexInfo.videos?.length"
        class="hud-modules"
      >
        <!-- 外链指令台 -->
        <section
          v-if="orderedLinks.length"
          class="hud-panel hud-section"
        >
          <div class="hud-panel__bar">
            <span class="hud-code">[MOD.01 // EXTERNAL_NODES]</span>
            <span class="hud-code">COUNT {{ String(orderedLinks.length).padStart(2, '0') }}</span>
          </div>
          <div class="hud-links-grid">
            <a
              v-for="(link, idx) in orderedLinks"
              :key="link[0]"
              :href="link[1]"
              target="_blank"
              rel="noopener noreferrer"
              class="hud-link-node"
            >
              <div class="hud-link-node__top">
                <span class="hud-code">NODE_{{ String(idx + 1).padStart(2, '0') }}</span>
                <ArrowUpRight class="hud-link-node__arrow size-4" />
              </div>
              <div class="hud-link-node__label">{{ link[0] }}</div>
              <div class="hud-link-node__host">{{ extractHost(link[1]) }}</div>
            </a>
          </div>
        </section>

        <!-- 精选录像切片 -->
        <section
          v-if="indexInfo.videos?.length"
          class="hud-panel hud-section"
        >
          <div class="hud-panel__bar">
            <span class="hud-code">[MOD.02 // ARCHIVE_CLIPS]</span>
            <span class="hud-code">TAPES {{ String(indexInfo.videos.length).padStart(2, '0') }}</span>
          </div>
          <div class="hud-video-grid">
            <article
              v-for="(video, idx) in indexInfo.videos"
              :key="video.id"
              class="hud-video-card"
            >
              <div class="hud-video-card__meta">
                <span class="hud-code">CLIP_{{ String(idx + 1).padStart(2, '0') }}</span>
                <span class="hud-code">REC</span>
              </div>
              <SimpleVideoCard
                :video="video"
                full-width
              />
            </article>
          </div>
        </section>
      </div>

      <section
        v-else
        class="hud-panel py-14"
      >
        <Empty description="频道模块尚未配置外链或精选片段" />
      </section>
    </div>
  </div>
</template>

<style scoped>
.hud-page {
  position: relative;
  width: 100%;
  min-width: 0;
  color: var(--foreground);
  font-family: var(--vtsuru-page-font-family, system-ui, sans-serif);
}

/* 原生 CSS Scroll-Driven 进度条（不支持时静态隐藏，零副作用） */
.hud-scroll-meter {
  position: sticky;
  top: 0;
  z-index: 40;
  height: 2px;
  width: 100%;
  background: var(--primary);
  transform-origin: left center;
  transform: scaleX(0);
}

@supports (animation-timeline: scroll()) {
  .hud-scroll-meter {
    animation: hudScrollScale linear both;
    animation-timeline: scroll(nearest);
  }
}

@keyframes hudScrollScale {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}

/* 顶部机能跑马灯 */
.hud-ticker {
  overflow: hidden;
  border-bottom: 1px solid color-mix(in oklch, var(--primary) 26%, var(--border));
  background: color-mix(in oklch, var(--card) 75%, transparent);
  padding: 6px 0;
}

.hud-ticker__track {
  display: flex;
  width: max-content;
  animation: hudMarquee 32s linear infinite;
}

.hud-ticker:hover .hud-ticker__track {
  animation-play-state: paused;
}

.hud-ticker__group {
  display: flex;
  align-items: center;
  gap: 28px;
  padding-right: 28px;
}

.hud-ticker__item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--site-font-mono, ui-monospace, monospace);
  font-size: 10.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted-foreground);
  white-space: nowrap;
}

.hud-ticker__dot {
  width: 5px;
  height: 5px;
  background: var(--primary);
  transform: rotate(45deg);
}

@keyframes hudMarquee {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

@media (prefers-reduced-motion: reduce) {
  .hud-ticker__track {
    animation: none;
  }
}

/* 主容器 */
.hud-container {
  max-width: min(1320px, var(--vtsuru-page-max-width, 1320px));
  margin: 0 auto;
  padding: 20px 20px 64px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  container-type: inline-size;
}

/* 通用机能面板 */
.hud-panel {
  position: relative;
  min-width: 0;
  background: color-mix(in oklch, var(--card) 86%, transparent);
  border: 1px solid color-mix(in oklch, var(--primary) 28%, var(--border));
  border-radius: var(--radius, 4px);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  overflow: hidden;
}

.hud-panel__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 14px;
  border-bottom: 1px solid color-mix(in oklch, var(--primary) 20%, var(--border));
  background: color-mix(in oklch, var(--primary) 7%, transparent);
}

.hud-panel__bar-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.hud-code {
  font-family: var(--site-font-mono, ui-monospace, monospace);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.1em;
  color: var(--muted-foreground);
  text-transform: uppercase;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hud-clock {
  font-family: var(--site-font-mono, ui-monospace, monospace);
  font-size: 11px;
  color: var(--primary);
}

.hud-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  font-family: var(--site-font-mono, ui-monospace, monospace);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  border: 1px solid color-mix(in oklch, var(--border) 90%, transparent);
  color: var(--muted-foreground);
}

.hud-status-badge__dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: currentColor;
}

.hud-status-badge.is-live {
  color: #fff;
  background: #e11d48;
  border-color: #fb7185;
}

.hud-status-badge.is-live .hud-status-badge__dot {
  animation: hudBlink 1.2s ease-in-out infinite;
}

.hud-status-badge.is-reserve {
  color: var(--primary);
  border-color: color-mix(in oklch, var(--primary) 55%, transparent);
  background: color-mix(in oklch, var(--primary) 12%, transparent);
}

@keyframes hudBlink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.25; }
}

/* 非对称首屏 Bento */
.hud-hero-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr);
  gap: 18px;
  align-items: stretch;
}

.hud-monitor {
  display: flex;
  flex-direction: column;
}

.hud-viewport {
  position: relative;
  height: 230px;
  overflow: hidden;
  background: color-mix(in oklch, var(--background) 80%, var(--primary) 12%);
  border-bottom: 1px solid color-mix(in oklch, var(--primary) 22%, var(--border));
}

.hud-viewport__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.hud-viewport__fallback {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background-image:
    radial-gradient(circle at center, color-mix(in oklch, var(--primary) 20%, transparent), transparent 62%),
    linear-gradient(to right, color-mix(in oklch, var(--primary) 14%, transparent) 1px, transparent 1px),
    linear-gradient(to bottom, color-mix(in oklch, var(--primary) 14%, transparent) 1px, transparent 1px);
  background-size: auto, 24px 24px, 24px 24px;
}

.hud-radar-ring {
  width: 64px;
  height: 64px;
  border-radius: 999px;
  border: 1px dashed color-mix(in oklch, var(--primary) 55%, transparent);
}

.hud-scanlines {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    to bottom,
    transparent 0 2px,
    rgba(0, 0, 0, 0.14) 2px 3px
  );
}

.hud-corner {
  position: absolute;
  width: 12px;
  height: 12px;
  border-color: var(--primary);
  border-style: solid;
  pointer-events: none;
}

.hud-corner--tl { top: 10px; left: 10px; border-width: 2px 0 0 2px; }
.hud-corner--tr { top: 10px; right: 10px; border-width: 2px 2px 0 0; }
.hud-corner--bl { bottom: 10px; left: 10px; border-width: 0 0 2px 2px; }
.hud-corner--br { bottom: 10px; right: 10px; border-width: 0 2px 2px 0; }

.hud-viewport__overlay-tags {
  position: absolute;
  right: 12px;
  bottom: 10px;
  display: flex;
  gap: 6px;
}

.hud-chip {
  padding: 2px 8px;
  font-family: var(--site-font-mono, ui-monospace, monospace);
  font-size: 10px;
  font-weight: 600;
  background: color-mix(in oklch, var(--background) 82%, transparent);
  color: var(--foreground);
  border: 1px solid color-mix(in oklch, var(--primary) 35%, var(--border));
  backdrop-filter: blur(8px);
}

.hud-identity {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
  justify-content: space-between;
}

.hud-identity__main {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  min-width: 0;
}

.hud-avatar-box {
  position: relative;
  flex-shrink: 0;
}

.hud-avatar-box__pendant {
  position: absolute;
  inset: -16%;
  width: 132%;
  height: 132%;
  object-fit: contain;
  pointer-events: none;
}

.hud-identity__copy {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.hud-identity__meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.hud-title {
  margin: 0;
  font-family: var(--site-font-display, system-ui, sans-serif);
  font-size: clamp(1.6rem, 3.2vw, 2.5rem);
  font-weight: 800;
  line-height: 1.08;
  letter-spacing: -0.02em;
  color: var(--foreground);
  word-break: break-word;
}

.hud-sign {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: var(--muted-foreground);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.hud-honor-line {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 2px;
}

.hud-honor-pill {
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--primary);
  background: color-mix(in oklch, var(--primary) 12%, transparent);
  border-left: 2px solid var(--primary);
}

.hud-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.hud-btn-primary {
  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px));
  font-weight: 700;
}

.hud-btn-ghost {
  border-color: color-mix(in oklch, var(--primary) 34%, var(--border));
}

/* 右侧遥测堆栈 */
.hud-side-stack {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
}

.hud-stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 1px;
  background: color-mix(in oklch, var(--primary) 18%, var(--border));
}

.hud-stat-cell {
  background: color-mix(in oklch, var(--card) 92%, var(--background));
  padding: 16px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.hud-stat-cell__en {
  font-family: var(--site-font-mono, ui-monospace, monospace);
  font-size: 9.5px;
  letter-spacing: 0.1em;
  color: var(--muted-foreground);
}

.hud-stat-cell__val {
  font-family: var(--site-font-mono, ui-monospace, monospace);
  font-size: 24px;
  font-weight: 800;
  line-height: 1.15;
  color: var(--foreground);
}

.hud-stat-cell__cn {
  font-size: 11px;
  color: var(--muted-foreground);
}

.hud-stat-cell__bar {
  margin-top: 6px;
  height: 2px;
  width: 36%;
  background: var(--primary);
}

.hud-stat-empty {
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.hud-reserve-card {
  text-decoration: none;
  color: inherit;
  transition: border-color 160ms ease, transform 160ms ease;
}

.hud-reserve-card:hover {
  border-color: var(--primary);
  transform: translateY(-1px);
}

.hud-reserve-card__body {
  padding: 14px;
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.hud-reserve-card__time {
  font-family: var(--site-font-mono, ui-monospace, monospace);
  font-size: 12px;
  font-weight: 700;
  color: var(--primary);
}

.hud-reserve-card__title {
  margin-top: 3px;
  font-size: 13px;
  font-weight: 600;
  color: var(--foreground);
  line-height: 1.45;
}

.hud-dispatch {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.hud-dispatch__body {
  padding: 16px 14px;
  display: flex;
  gap: 10px;
  align-items: flex-start;
  flex: 1;
}

.hud-dispatch__prompt {
  font-family: var(--site-font-mono, ui-monospace, monospace);
  font-weight: 700;
  color: var(--primary);
  flex-shrink: 0;
}

.hud-dispatch__text {
  margin: 0;
  font-size: 13px;
  line-height: 1.65;
  color: var(--foreground);
  white-space: pre-wrap;
  word-break: break-word;
}

/* 下方模块区 */
.hud-modules {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.hud-links-grid {
  padding: 14px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 10px;
}

.hud-link-node {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  text-decoration: none;
  color: var(--foreground);
  background: color-mix(in oklch, var(--background) 65%, transparent);
  border: 1px solid color-mix(in oklch, var(--primary) 22%, var(--border));
  border-left: 3px solid color-mix(in oklch, var(--primary) 60%, var(--border));
  transition: transform 160ms ease, border-color 160ms ease, background-color 160ms ease;
}

.hud-link-node:hover {
  transform: translateY(-2px);
  border-color: var(--primary);
  background: color-mix(in oklch, var(--primary) 10%, var(--background));
}

.hud-link-node__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.hud-link-node__arrow {
  color: var(--primary);
  transition: transform 160ms ease;
}

.hud-link-node:hover .hud-link-node__arrow {
  transform: translate(2px, -2px);
}

.hud-link-node__label {
  font-size: 14px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hud-link-node__host {
  font-family: var(--site-font-mono, ui-monospace, monospace);
  font-size: 10.5px;
  color: var(--muted-foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hud-video-grid {
  padding: 14px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 14px;
}

.hud-video-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  background: color-mix(in oklch, var(--background) 60%, transparent);
  border: 1px solid color-mix(in oklch, var(--primary) 18%, var(--border));
}

.hud-video-card__meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.hud-video-card__title {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--foreground);
}

@container (max-width: 860px) {
  .hud-hero-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .hud-container {
    padding: 14px 12px 48px;
    gap: 14px;
  }

  .hud-viewport {
    height: 170px;
  }

  .hud-identity {
    padding: 14px;
  }

  .hud-identity__main {
    flex-direction: column;
    gap: 12px;
  }

  .hud-actions > * {
    flex: 1 1 auto;
  }
}
</style>
