<script lang="ts" setup>
import { ArrowUpRight, Calendar, Palette, Radio, Sparkles } from 'lucide-vue-next'
import { computed, ref } from 'vue'

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

// 3D 全息典藏卡指针追踪（仅驱动 CSS 变量，离开平滑回弹）
const tiltX = ref(0)
const tiltY = ref(0)
const pointerX = ref(50)
const pointerY = ref(30)
const isHoveringCard = ref(false)

function handleCardPointerMove(event: PointerEvent) {
  if (event.pointerType === 'touch') return
  const target = event.currentTarget as HTMLElement | null
  if (!target) return
  const rect = target.getBoundingClientRect()
  const px = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  const py = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))
  pointerX.value = Math.round(px * 100)
  pointerY.value = Math.round(py * 100)
  tiltX.value = Number(((0.5 - py) * 11).toFixed(2))
  tiltY.value = Number(((px - 0.5) * 12).toFixed(2))
  isHoveringCard.value = true
}

function handleCardPointerLeave() {
  tiltX.value = 0
  tiltY.value = 0
  pointerX.value = 50
  pointerY.value = 30
  isHoveringCard.value = false
}

const holoCardStyle = computed(() => ({
  '--rx': `${tiltX.value}deg`,
  '--ry': `${tiltY.value}deg`,
  '--mx': `${pointerX.value}%`,
  '--my': `${pointerY.value}%`,
}))

function extractHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'PORTAL'
  }
}
</script>

<script lang="ts">
export type ConfigType = ExtractConfigData<typeof Config>
export const DefaultConfig = {} as ConfigType
export const Config = defineTemplateConfig([])
</script>

<template>
  <div class="prism-page">
    <div
      v-if="isLoading"
      class="py-24 flex justify-center"
    >
      <Spin />
    </div>

    <div
      v-else
      class="prism-container"
    >
      <!-- ==================== 首屏舞台：3D 全息典藏卡 + 液态玻璃中控 ==================== -->
      <section class="prism-stage">
        <!-- 3D 指针追踪全息典藏卡 -->
        <div class="prism-card-scene">
          <div
            class="prism-holo-card"
            :class="{ 'is-hovering': isHoveringCard, 'is-live': isStreaming }"
            :style="holoCardStyle"
            @pointermove="handleCardPointerMove"
            @pointerleave="handleCardPointerLeave"
          >
            <!-- SVG 液态折射边缘光环（仅作用于装饰边层，正文无畸变） -->
            <div
              class="prism-holo-card__refract-ring"
              aria-hidden="true"
            />
            <!-- 全息彩虹扫光层 -->
            <div
              class="prism-holo-card__foil"
              aria-hidden="true"
            />

            <div class="prism-holo-card__inner">
              <!-- 卡面顶部横幅 -->
              <div class="prism-holo-card__banner">
                <img
                  v-if="headerImage && showHeaderImage"
                  :src="headerImage"
                  alt=""
                  class="prism-holo-card__banner-img"
                  referrerpolicy="no-referrer"
                  @error="showHeaderImage = false"
                />
                <div
                  v-else
                  class="prism-holo-card__banner-aura"
                />
                <div class="prism-holo-card__badges">
                  <span
                    v-if="isStreaming"
                    class="prism-badge prism-badge--live"
                  >
                    <Radio class="size-3" />
                    LIVE ON AIR
                  </span>
                  <span
                    v-else-if="liveReserve"
                    class="prism-badge prism-badge--reserve"
                  >
                    <Calendar class="size-3" />
                    {{ liveReserveTimeText }}
                  </span>
                  <span
                    v-else
                    class="prism-badge"
                  >
                    PRISM EDITION
                  </span>
                  <span
                    v-if="level"
                    class="prism-badge"
                  >
                    LV.{{ level }}
                  </span>
                </div>
              </div>

              <!-- 卡面身份核心 -->
              <div class="prism-holo-card__body">
                <div
                  v-if="avatar"
                  class="prism-avatar-orb"
                >
                  <Avatar class="size-24 border-2 border-white/40 shadow-lg">
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
                    class="prism-avatar-orb__pendant"
                    referrerpolicy="no-referrer"
                    @error="showAvatarFrame = false"
                  />
                </div>

                <div class="prism-card-id">
                  <span class="prism-handle">@{{ props.userInfo?.name || 'channel' }}</span>
                  <h1 class="prism-name">{{ streamerName }}</h1>
                  <p class="prism-card-meta">
                    <span v-if="props.userInfo?.streamerInfo?.area">{{ props.userInfo.streamerInfo.area }}</span>
                    <span v-if="props.userInfo?.streamerInfo?.uId">UID {{ props.userInfo.streamerInfo.uId }}</span>
                    <span v-if="honorText || nameplateText">{{ honorText || nameplateText }}</span>
                  </p>
                </div>

                <!-- 典藏卡底栏数字铭牌 -->
                <div
                  v-if="profileStats.length"
                  class="prism-card-stats"
                >
                  <div
                    v-for="stat in profileStats"
                    :key="stat.label"
                    class="prism-card-stats__item"
                  >
                    <strong class="tabular-nums">{{ stat.text }}</strong>
                    <span>{{ stat.label }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧液态玻璃交互面板 -->
        <div class="prism-side">
          <div class="prism-glass-panel prism-intro-panel">
            <span class="prism-kicker">CHANNEL PROFILE</span>
            <p class="prism-signature">{{ signature }}</p>

            <div class="prism-actions">
              <Button
                v-if="liveRoomUrl"
                size="lg"
                class="prism-btn-primary rounded-full gap-2"
                @click="navigate(liveRoomUrl)"
              >
                <Radio class="size-4" />
                <span>{{ isStreaming ? '立即进入直播间' : '前往直播间' }}</span>
              </Button>
              <Button
                v-if="biliSpaceUrl"
                variant="outline"
                size="lg"
                class="prism-btn-glass rounded-full gap-2"
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
                class="prism-btn-glass rounded-full gap-2"
                @click="$router.push({ name: 'manage-userPageBuilder' })"
              >
                <Palette class="size-4" />
                <span>主页装修</span>
              </Button>
            </div>
          </div>

          <!-- 预约胶囊 -->
          <a
            v-if="!isStreaming && liveReserve && liveRoomUrl"
            :href="liveRoomUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="prism-glass-panel prism-reserve-pill"
          >
            <span class="prism-icon-badge">
              <Calendar class="size-4" />
            </span>
            <div class="min-w-0 flex-1">
              <div class="prism-kicker">NEXT LIVE</div>
              <div class="prism-reserve-pill__text">{{ liveReserveLabel }}</div>
            </div>
            <ArrowUpRight class="size-4 text-primary shrink-0" />
          </a>
          <div
            v-else-if="!isStreaming && liveReserve"
            class="prism-glass-panel prism-reserve-pill"
          >
            <span class="prism-icon-badge">
              <Calendar class="size-4" />
            </span>
            <div class="min-w-0 flex-1">
              <div class="prism-kicker">NEXT LIVE</div>
              <div class="prism-reserve-pill__text">{{ liveReserveLabel }}</div>
            </div>
          </div>

          <!-- 公告玻璃卡 -->
          <div
            v-if="indexInfo.notification"
            class="prism-glass-panel prism-notice-card"
          >
            <div class="prism-notice-card__head">
              <Sparkles class="size-3.5 text-primary" />
              <span class="prism-kicker">ANNOUNCEMENT</span>
            </div>
            <p class="prism-notice-card__text">{{ indexInfo.notification }}</p>
          </div>
        </div>
      </section>

      <!-- ==================== 外链液态胶囊群 & 视频晶莹展柜 ==================== -->
      <main
        v-if="orderedLinks.length || indexInfo.videos?.length"
        class="prism-content"
      >
        <section
          v-if="orderedLinks.length"
          class="prism-section"
        >
          <div class="prism-section__head">
            <h2>传送门</h2>
            <span class="prism-kicker">PORTALS · {{ String(orderedLinks.length).padStart(2, '0') }}</span>
          </div>
          <div class="prism-links-grid">
            <a
              v-for="link in orderedLinks"
              :key="link[0]"
              :href="link[1]"
              target="_blank"
              rel="noopener noreferrer"
              class="prism-glass-panel prism-link-capsule"
            >
              <div class="min-w-0 flex-1">
                <div class="prism-link-capsule__label">{{ link[0] }}</div>
                <div class="prism-link-capsule__host">{{ extractHost(link[1]) }}</div>
              </div>
              <span class="prism-link-capsule__orb">
                <ArrowUpRight class="size-4" />
              </span>
            </a>
          </div>
        </section>

        <section
          v-if="indexInfo.videos?.length"
          class="prism-section"
        >
          <div class="prism-section__head">
            <h2>精选展柜</h2>
            <span class="prism-kicker">SHOWCASE · {{ String(indexInfo.videos.length).padStart(2, '0') }}</span>
          </div>
          <div class="prism-video-grid">
            <article
              v-for="video in indexInfo.videos"
              :key="video.id"
              class="prism-glass-panel prism-video-card"
            >
              <div class="prism-video-card__media">
                <SimpleVideoCard
                  :video="video"
                  full-width
                />
              </div>
            </article>
          </div>
        </section>
      </main>

      <div
        v-else
        class="prism-glass-panel py-14"
      >
        <Empty description="展柜内容正在准备中" />
      </div>
    </div>
  </div>
</template>

<style scoped>
@property --prism-angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

.prism-page {
  width: 100%;
  min-width: 0;
  color: var(--foreground);
  font-family: var(--vtsuru-page-font-family, 'Plus Jakarta Sans', system-ui, sans-serif);
}

.prism-container {
  max-width: min(1240px, var(--vtsuru-page-max-width, 1240px));
  margin: 0 auto;
  padding: 20px 20px 72px;
  display: flex;
  flex-direction: column;
  gap: 32px;
  container-type: inline-size;
}

/* 通用液态玻璃面板 */
.prism-glass-panel {
  position: relative;
  min-width: 0;
  border-radius: var(--radius, 20px);
  background: color-mix(in oklch, var(--card) 72%, transparent);
  border: 1px solid color-mix(in oklch, var(--foreground) 15%, transparent);
  backdrop-filter: blur(22px) saturate(175%);
  -webkit-backdrop-filter: blur(22px) saturate(175%);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 34%, transparent),
    0 18px 40px -22px color-mix(in oklch, var(--primary) 34%, rgba(0, 0, 0, 0.45));
}

/* 首屏舞台 */
.prism-stage {
  display: grid;
  grid-template-columns: minmax(0, 420px) minmax(0, 1fr);
  gap: 28px;
  align-items: center;
}

/* 3D 典藏卡 */
.prism-card-scene {
  perspective: 1100px;
  width: 100%;
  min-width: 0;
}

.prism-holo-card {
  --rx: 0deg;
  --ry: 0deg;
  --mx: 50%;
  --my: 30%;
  --prism-angle: 0deg;
  position: relative;
  border-radius: calc(var(--radius, 20px) + 4px);
  padding: 2px;
  transform: rotateX(var(--rx)) rotateY(var(--ry));
  transform-style: preserve-3d;
  transition: transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
  background: conic-gradient(
    from var(--prism-angle),
    color-mix(in oklch, var(--primary) 85%, white),
    color-mix(in oklch, var(--primary) 45%, #38bdf8),
    color-mix(in oklch, var(--primary) 45%, #f472b6),
    color-mix(in oklch, var(--primary) 85%, white)
  );
  animation: prismSpin 9s linear infinite;
  box-shadow:
    0 24px 54px -20px color-mix(in oklch, var(--primary) 45%, rgba(0, 0, 0, 0.55));
}

.prism-holo-card.is-hovering {
  transition: transform 80ms linear;
}

@keyframes prismSpin {
  to { --prism-angle: 360deg; }
}

/* SVG 液态折射装饰光环层 */
.prism-holo-card__refract-ring {
  position: absolute;
  inset: -6px;
  border-radius: inherit;
  background: radial-gradient(
    circle at var(--mx) var(--my),
    color-mix(in oklch, var(--primary) 38%, transparent),
    transparent 62%
  );
  filter: url(#vtsuru-liquid-refract);
  opacity: 0.55;
  z-index: -1;
  pointer-events: none;
}

.prism-holo-card__foil {
  position: absolute;
  inset: 2px;
  border-radius: calc(var(--radius, 20px) + 2px);
  pointer-events: none;
  z-index: 3;
  opacity: 0.32;
  mix-blend-mode: overlay;
  background:
    radial-gradient(circle at var(--mx) var(--my), rgba(255, 255, 255, 0.85), transparent 46%),
    linear-gradient(
      125deg,
      transparent 20%,
      color-mix(in oklch, var(--primary) 65%, #38bdf8) 45%,
      color-mix(in oklch, var(--primary) 65%, #f472b6) 55%,
      transparent 80%
    );
  transition: opacity 180ms ease;
}

.prism-holo-card.is-hovering .prism-holo-card__foil {
  opacity: 0.58;
}

.prism-holo-card__inner {
  position: relative;
  z-index: 2;
  border-radius: calc(var(--radius, 20px) + 2px);
  overflow: hidden;
  background: color-mix(in oklch, var(--card) 86%, var(--background));
  backdrop-filter: blur(22px) saturate(180%);
  -webkit-backdrop-filter: blur(22px) saturate(180%);
}

.prism-holo-card__banner {
  position: relative;
  height: 158px;
  overflow: hidden;
}

.prism-holo-card__banner-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.prism-holo-card__banner-aura {
  width: 100%;
  height: 100%;
  background:
    radial-gradient(circle at 25% 25%, color-mix(in oklch, var(--primary) 55%, transparent), transparent 60%),
    radial-gradient(circle at 80% 70%, color-mix(in oklch, #38bdf8 40%, var(--primary)), transparent 65%),
    var(--background);
}

.prism-holo-card__badges {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.prism-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: #fff;
  background: rgba(15, 23, 42, 0.58);
  border: 1px solid rgba(255, 255, 255, 0.28);
  backdrop-filter: blur(10px);
}

.prism-badge--live {
  background: color-mix(in oklch, #e11d48 86%, var(--primary));
}

.prism-badge--reserve {
  background: color-mix(in oklch, var(--primary) 82%, #0f172a);
}

.prism-holo-card__body {
  position: relative;
  padding: 0 20px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
}

.prism-avatar-orb {
  position: relative;
  margin-top: -48px;
  padding: 3px;
  border-radius: 999px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.7), color-mix(in oklch, var(--primary) 70%, transparent));
}

.prism-avatar-orb__pendant {
  position: absolute;
  inset: -16%;
  width: 132%;
  height: 132%;
  object-fit: contain;
  pointer-events: none;
}

.prism-card-id {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  width: 100%;
}

.prism-handle {
  font-size: 11px;
  letter-spacing: 0.12em;
  color: var(--primary);
  font-weight: 600;
}

.prism-name {
  margin: 0;
  font-family: var(--site-font-display, system-ui, sans-serif);
  font-size: clamp(1.5rem, 2.8vw, 2.1rem);
  font-weight: 800;
  line-height: 1.12;
  color: var(--foreground);
  word-break: break-word;
}

.prism-card-meta {
  margin: 2px 0 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px 10px;
  font-size: 11.5px;
  color: var(--muted-foreground);
}

.prism-card-stats {
  width: 100%;
  margin-top: 4px;
  padding-top: 14px;
  border-top: 1px solid color-mix(in oklch, var(--foreground) 12%, transparent);
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(76px, 1fr));
  gap: 8px;
}

.prism-card-stats__item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.prism-card-stats__item strong {
  font-size: 18px;
  font-weight: 800;
  color: var(--foreground);
}

.prism-card-stats__item span {
  font-size: 11px;
  color: var(--muted-foreground);
}

/* 右侧玻璃中控 */
.prism-side {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.prism-intro-panel {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.prism-kicker {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: var(--primary);
  text-transform: uppercase;
}

.prism-signature {
  margin: 0;
  font-size: 15px;
  line-height: 1.75;
  color: var(--foreground);
}

.prism-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.prism-btn-primary {
  box-shadow: 0 10px 26px -10px color-mix(in oklch, var(--primary) 80%, transparent);
}

.prism-btn-glass {
  background: color-mix(in oklch, var(--card) 58%, transparent);
  border-color: color-mix(in oklch, var(--foreground) 18%, transparent);
}

.prism-reserve-pill {
  padding: 14px 18px;
  display: flex;
  align-items: center;
  gap: 14px;
  text-decoration: none;
  color: var(--foreground);
  transition: transform 160ms ease, border-color 160ms ease;
}

.prism-reserve-pill:hover {
  transform: translateY(-2px);
  border-color: color-mix(in oklch, var(--primary) 55%, transparent);
}

.prism-icon-badge {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--primary);
  background: color-mix(in oklch, var(--primary) 16%, transparent);
  flex-shrink: 0;
}

.prism-reserve-pill__text {
  font-size: 13.5px;
  font-weight: 600;
  line-height: 1.45;
  margin-top: 2px;
}

.prism-notice-card {
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.prism-notice-card__head {
  display: flex;
  align-items: center;
  gap: 6px;
}

.prism-notice-card__text {
  margin: 0;
  font-size: 13.5px;
  line-height: 1.65;
  color: var(--foreground);
  white-space: pre-wrap;
  word-break: break-word;
}

/* 下方内容区 */
.prism-content {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.prism-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.prism-section__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 0 4px;
}

.prism-section__head h2 {
  margin: 0;
  font-family: var(--site-font-display, system-ui, sans-serif);
  font-size: 20px;
  font-weight: 800;
}

.prism-links-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.prism-link-capsule {
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  color: var(--foreground);
  transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
}

.prism-link-capsule:hover {
  transform: translateY(-2px);
  border-color: color-mix(in oklch, var(--primary) 52%, transparent);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 46%, transparent),
    0 18px 34px -18px color-mix(in oklch, var(--primary) 55%, rgba(0, 0, 0, 0.4));
}

.prism-link-capsule__label {
  font-size: 14px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.prism-link-capsule__host {
  font-size: 11px;
  color: var(--muted-foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.prism-link-capsule__orb {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in oklch, var(--primary) 16%, transparent);
  color: var(--primary);
  flex-shrink: 0;
  transition: transform 180ms ease, background-color 180ms ease, color 180ms ease;
}

.prism-link-capsule:hover .prism-link-capsule__orb {
  background: var(--primary);
  color: var(--primary-foreground);
  transform: rotate(10deg) scale(1.06);
}

.prism-video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

.prism-video-card {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: transform 180ms ease, border-color 180ms ease;
}

.prism-video-card:hover {
  transform: translateY(-3px);
  border-color: color-mix(in oklch, var(--primary) 45%, transparent);
}

.prism-video-card__media {
  border-radius: calc(var(--radius, 20px) - 8px);
  overflow: hidden;
}

.prism-video-card__title {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 0 4px 4px;
  font-size: 13px;
  line-height: 1.45;
  color: var(--foreground);
}

@container (max-width: 860px) {
  .prism-stage {
    grid-template-columns: 1fr;
    gap: 20px;
  }

  .prism-card-scene {
    max-width: 440px;
    margin: 0 auto;
  }
}

@media (max-width: 640px) {
  .prism-container {
    padding: 12px 12px 64px;
    gap: 24px;
  }

  .prism-intro-panel {
    padding: 18px;
  }

  .prism-actions > * {
    flex: 1 1 auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .prism-holo-card {
    animation: none;
    transform: none;
  }
}

@media (prefers-reduced-transparency: reduce) {
  .prism-glass-panel,
  .prism-holo-card__inner {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    background: var(--card);
  }
}
</style>
