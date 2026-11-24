<script lang="ts" setup>
import { ArrowUpRight, Calendar, ChevronLeft, ChevronRight, Palette, Radio, Sparkles } from 'lucide-vue-next'
import { ref } from 'vue'

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

const reelRef = ref<HTMLElement | null>(null)

function scrollReel(direction: -1 | 1) {
  const el = reelRef.value
  if (!el) return
  el.scrollBy({ left: direction * Math.max(280, Math.floor(el.clientWidth * 0.7)), behavior: 'smooth' })
}

function extractHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'LINK'
  }
}
</script>

<script lang="ts">
export type ConfigType = ExtractConfigData<typeof Config>
export const DefaultConfig = {} as ConfigType
export const Config = defineTemplateConfig([])
</script>

<template>
  <div class="stage-page">
    <div
      v-if="isLoading"
      class="py-24 flex justify-center"
    >
      <Spin />
    </div>

    <div
      v-else
      class="stage-wrap"
    >
      <!-- ==================== 首屏宽银幕剧场海报 ==================== -->
      <header class="stage-hero">
        <div class="stage-hero__cinema">
          <img
            v-if="headerImage && showHeaderImage"
            :src="headerImage"
            alt=""
            class="stage-hero__backdrop"
            referrerpolicy="no-referrer"
            @error="showHeaderImage = false"
          />
          <div
            v-else
            class="stage-hero__fallback"
          />
          <!-- 影院暗角与聚光梯度（保证前景文字 100% 高对比） -->
          <div
            class="stage-hero__vignette"
            aria-hidden="true"
          />

          <div class="stage-hero__content">
            <div class="stage-hero__top-meta">
              <span
                v-if="isStreaming"
                class="stage-pill stage-pill--live"
              >
                <Radio class="size-3.5" />
                ON STAGE · LIVE
              </span>
              <span
                v-else-if="liveReserve"
                class="stage-pill stage-pill--accent"
              >
                <Calendar class="size-3.5" />
                NEXT SHOW · {{ liveReserveTimeText }}
              </span>
              <span
                v-else
                class="stage-pill"
              >
                FEATURE STAGE · @{{ props.userInfo?.name || 'CHANNEL' }}
              </span>

              <div class="stage-hero__subtags">
                <span v-if="props.userInfo?.streamerInfo?.area">{{ props.userInfo.streamerInfo.area }}</span>
                <span v-if="level">LV.{{ level }}</span>
                <span v-if="props.userInfo?.streamerInfo?.uId">UID {{ props.userInfo.streamerInfo.uId }}</span>
              </div>
            </div>

            <div class="stage-hero__bottom">
              <div class="stage-hero__identity">
                <div
                  v-if="avatar"
                  class="stage-avatar"
                >
                  <Avatar class="size-20 border-2 border-white/40 shadow-xl">
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
                    class="stage-avatar__pendant"
                    referrerpolicy="no-referrer"
                    @error="showAvatarFrame = false"
                  />
                </div>

                <div class="stage-hero__titles">
                  <span
                    v-if="honorText || nameplateText"
                    class="stage-honor"
                  >
                    {{ honorText || nameplateText }}
                  </span>
                  <h1 class="stage-title">{{ streamerName }}</h1>
                  <p class="stage-sign">{{ signature }}</p>
                </div>
              </div>

              <div class="stage-actions">
                <Button
                  v-if="liveRoomUrl"
                  size="lg"
                  class="stage-btn-primary rounded-full gap-2"
                  @click="navigate(liveRoomUrl)"
                >
                  <Radio class="size-4" />
                  <span>{{ isStreaming ? '进入演出现场' : '前往直播间' }}</span>
                </Button>
                <Button
                  v-if="biliSpaceUrl"
                  variant="outline"
                  size="lg"
                  class="stage-btn-cinema rounded-full gap-2"
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
                  class="stage-btn-cinema rounded-full gap-2"
                  @click="$router.push({ name: 'manage-userPageBuilder' })"
                >
                  <Palette class="size-4" />
                  <span>主页装修</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <!-- ==================== 数据与字幕公告带 ==================== -->
      <div class="stage-container">
        <section
          v-if="profileStats.length"
          class="stage-stats-strip"
        >
          <div
            v-for="stat in profileStats"
            :key="stat.label"
            class="stage-stats-strip__item"
          >
            <span class="stage-kicker">{{ stat.enLabel }}</span>
            <strong class="stage-stats-strip__num tabular-nums">{{ stat.text }}</strong>
            <span class="stage-stats-strip__cn">{{ stat.label }}</span>
          </div>
        </section>

        <!-- 电影字幕条式预约与公告 -->
        <div
          v-if="(!isStreaming && liveReserve) || indexInfo.notification"
          class="stage-subtitles"
        >
          <a
            v-if="!isStreaming && liveReserve && liveRoomUrl"
            :href="liveRoomUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="stage-banner-row stage-banner-row--reserve"
          >
            <span class="stage-banner-row__tag">
              <Calendar class="size-3.5" />
              PREMIERE
            </span>
            <span class="stage-banner-row__text">{{ liveReserveLabel }}</span>
            <ArrowUpRight class="size-4 text-primary shrink-0" />
          </a>
          <div
            v-else-if="!isStreaming && liveReserve"
            class="stage-banner-row stage-banner-row--reserve"
          >
            <span class="stage-banner-row__tag">
              <Calendar class="size-3.5" />
              PREMIERE
            </span>
            <span class="stage-banner-row__text">{{ liveReserveLabel }}</span>
          </div>

          <div
            v-if="indexInfo.notification"
            class="stage-banner-row"
          >
            <span class="stage-banner-row__tag">
              <Sparkles class="size-3.5" />
              PROGRAM NOTE
            </span>
            <span class="stage-banner-row__text">{{ indexInfo.notification }}</span>
          </div>
        </div>

        <!-- ==================== 外链通道 + 横向剧场胶片带 ==================== -->
        <main
          v-if="orderedLinks.length || indexInfo.videos?.length"
          class="stage-sections"
        >
          <section
            v-if="orderedLinks.length"
            class="stage-section"
          >
            <div class="stage-section__head">
              <div>
                <span class="stage-kicker">ACT 01 // CHANNELS</span>
                <h2>官方通道</h2>
              </div>
              <span class="stage-kicker">{{ String(orderedLinks.length).padStart(2, '0') }} LINKS</span>
            </div>
            <div class="stage-links">
              <a
                v-for="(link, idx) in orderedLinks"
                :key="link[0]"
                :href="link[1]"
                target="_blank"
                rel="noopener noreferrer"
                class="stage-link-card"
              >
                <span class="stage-link-card__num tabular-nums">{{ String(idx + 1).padStart(2, '0') }}</span>
                <div class="min-w-0 flex-1">
                  <div class="stage-link-card__label">{{ link[0] }}</div>
                  <div class="stage-link-card__host">{{ extractHost(link[1]) }}</div>
                </div>
                <ArrowUpRight class="stage-link-card__arrow size-4" />
              </a>
            </div>
          </section>

          <section
            v-if="indexInfo.videos?.length"
            class="stage-section"
          >
            <div class="stage-section__head">
              <div>
                <span class="stage-kicker">ACT 02 // FILM REEL</span>
                <h2>精选映像</h2>
              </div>
              <div class="stage-reel-controls">
                <Button
                  size="icon-xs"
                  variant="outline"
                  class="rounded-full"
                  aria-label="向左滚动映像"
                  @click="scrollReel(-1)"
                >
                  <ChevronLeft class="size-4" />
                </Button>
                <Button
                  size="icon-xs"
                  variant="outline"
                  class="rounded-full"
                  aria-label="向右滚动映像"
                  @click="scrollReel(1)"
                >
                  <ChevronRight class="size-4" />
                </Button>
              </div>
            </div>

            <!-- 横向剧场胶片带 -->
            <div
              ref="reelRef"
              class="stage-reel no-scrollbar"
            >
              <article
                v-for="(video, idx) in indexInfo.videos"
                :key="video.id"
                class="stage-frame"
              >
                <div class="stage-frame__sprockets">
                  <span class="stage-kicker">SCENE {{ String(idx + 1).padStart(2, '0') }}</span>
                  <span class="stage-kicker">24FPS</span>
                </div>
                <SimpleVideoCard
                  :video="video"
                  full-width
                />
              </article>
            </div>
          </section>
        </main>

        <div
          v-else
          class="stage-empty"
        >
          <Empty description="舞台节目单暂未编排外链与精选映像" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stage-page {
  width: 100%;
  min-width: 0;
  color: var(--foreground);
  font-family: var(--vtsuru-page-font-family, 'Plus Jakarta Sans', system-ui, sans-serif);
}

.stage-wrap {
  display: flex;
  flex-direction: column;
  gap: 28px;
  padding-bottom: 92px;
}

/* 首屏宽银幕剧场海报 */
.stage-hero {
  max-width: min(1400px, var(--vtsuru-page-max-width, 1400px));
  width: 100%;
  margin: 0 auto;
  padding: 8px 20px 0;
}

.stage-hero__cinema {
  position: relative;
  min-height: clamp(360px, 60svh, 540px);
  border-radius: var(--radius, 12px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border: 1px solid color-mix(in oklch, var(--primary) 26%, var(--border));
  box-shadow: 0 28px 64px -26px rgba(0, 0, 0, 0.7);
  background: #09090b;
}

.stage-hero__backdrop {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.stage-hero__fallback {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 30% 24%, color-mix(in oklch, var(--primary) 42%, transparent), transparent 55%),
    radial-gradient(circle at 80% 72%, color-mix(in oklch, var(--primary) 22%, #1e1b4b), transparent 62%),
    #09090b;
}

.stage-hero__vignette {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(to bottom, rgba(9, 9, 11, 0.56) 0%, rgba(9, 9, 11, 0.18) 38%, rgba(9, 9, 11, 0.92) 100%),
    radial-gradient(circle at center, transparent 42%, rgba(9, 9, 11, 0.55) 100%);
  pointer-events: none;
}

@supports (animation-timeline: view()) {
  .stage-hero__backdrop {
    animation: stageBackdropZoom linear both;
    animation-timeline: view();
    animation-range: entry 0% exit 100%;
  }
}

@keyframes stageBackdropZoom {
  from { transform: scale(1); }
  to { transform: scale(1.1); }
}

@media (prefers-reduced-motion: reduce) {
  .stage-hero__backdrop {
    animation: none;
  }
}

.stage-hero__content {
  position: relative;
  z-index: 2;
  flex: 1;
  padding: 24px 28px 28px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 28px;
  color: #fafafa;
}

.stage-hero__top-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.stage-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.14em;
  background: rgba(9, 9, 11, 0.62);
  border: 1px solid rgba(255, 255, 255, 0.22);
  backdrop-filter: blur(10px);
  color: #fafafa;
}

.stage-pill--live {
  background: #e11d48;
  border-color: #fb7185;
}

.stage-pill--accent {
  background: var(--primary);
  color: var(--primary-foreground);
  border-color: transparent;
}

.stage-hero__subtags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 11px;
  letter-spacing: 0.1em;
  color: rgba(250, 250, 250, 0.78);
}

.stage-hero__bottom {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
}

.stage-hero__identity {
  display: flex;
  align-items: flex-end;
  gap: 18px;
  min-width: 240px;
  flex: 1 1 280px;
}

.stage-avatar {
  position: relative;
  flex-shrink: 0;
}

.stage-avatar__pendant {
  position: absolute;
  inset: -16%;
  width: 132%;
  height: 132%;
  object-fit: contain;
  pointer-events: none;
}

.stage-hero__titles {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stage-honor {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--primary);
  text-transform: uppercase;
}

.stage-title {
  margin: 0;
  font-family: var(--site-font-display, system-ui, sans-serif);
  font-size: clamp(2rem, 5vw, 4.2rem);
  font-weight: 800;
  line-height: 1.02;
  letter-spacing: -0.02em;
  color: #ffffff;
  word-break: break-word;
}

.stage-sign {
  margin: 0;
  max-width: 62ch;
  font-size: 14px;
  line-height: 1.65;
  color: rgba(250, 250, 250, 0.82);
}

.stage-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  flex-shrink: 0;
}

.stage-btn-primary {
  box-shadow: 0 12px 30px -10px color-mix(in oklch, var(--primary) 80%, transparent);
}

.stage-btn-cinema {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.28);
  color: #ffffff;
  backdrop-filter: blur(10px);
}

.stage-btn-cinema:hover {
  background: rgba(255, 255, 255, 0.18);
  color: #ffffff;
}

/* 下方剧场内容容器 */
.stage-container {
  max-width: min(1240px, var(--vtsuru-page-max-width, 1240px));
  width: 100%;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.stage-kicker {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: var(--primary);
  text-transform: uppercase;
}

.stage-stats-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}

.stage-stats-strip__item {
  padding: 16px 20px;
  border-radius: var(--radius, 12px);
  background: color-mix(in oklch, var(--card) 82%, transparent);
  border: 1px solid color-mix(in oklch, var(--foreground) 12%, transparent);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stage-stats-strip__num {
  font-family: var(--site-font-display, system-ui, sans-serif);
  font-size: 28px;
  font-weight: 800;
  line-height: 1.1;
}

.stage-stats-strip__cn {
  font-size: 12px;
  color: var(--muted-foreground);
}

/* 字幕条式公告 */
.stage-subtitles {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.stage-banner-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  border-radius: var(--radius, 12px);
  background: color-mix(in oklch, var(--card) 84%, transparent);
  border: 1px solid color-mix(in oklch, var(--foreground) 12%, transparent);
  border-left: 3px solid var(--primary);
  text-decoration: none;
  color: var(--foreground);
}

.stage-banner-row--reserve {
  transition: border-color 160ms ease, transform 160ms ease;
}

.stage-banner-row--reserve:hover {
  border-color: var(--primary);
  transform: translateY(-1px);
}

.stage-banner-row__tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--primary);
  flex-shrink: 0;
}

.stage-banner-row__text {
  flex: 1;
  min-width: 0;
  font-size: 13.5px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

/* 板块 */
.stage-sections {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.stage-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.stage-section__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.stage-section__head h2 {
  margin: 4px 0 0;
  font-family: var(--site-font-display, system-ui, sans-serif);
  font-size: 22px;
  font-weight: 800;
}

.stage-links {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}

.stage-link-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: var(--radius, 12px);
  text-decoration: none;
  color: var(--foreground);
  background: color-mix(in oklch, var(--card) 82%, transparent);
  border: 1px solid color-mix(in oklch, var(--foreground) 12%, transparent);
  transition: border-color 160ms ease, transform 160ms ease;
}

.stage-link-card:hover {
  border-color: var(--primary);
  transform: translateY(-2px);
}

.stage-link-card__num {
  font-family: var(--site-font-display, system-ui, sans-serif);
  font-size: 14px;
  font-weight: 800;
  color: var(--primary);
}

.stage-link-card__label {
  font-size: 14px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stage-link-card__host {
  font-size: 11px;
  color: var(--muted-foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stage-link-card__arrow {
  color: var(--muted-foreground);
  flex-shrink: 0;
  transition: transform 160ms ease, color 160ms ease;
}

.stage-link-card:hover .stage-link-card__arrow {
  color: var(--primary);
  transform: translate(2px, -2px);
}

/* 横向剧场胶片带 */
.stage-reel-controls {
  display: flex;
  align-items: center;
  gap: 6px;
}

.stage-reel {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  padding: 4px 2px 10px;
}

.stage-frame {
  flex: 0 0 min(320px, 82vw);
  scroll-snap-align: start;
  padding: 10px;
  border-radius: var(--radius, 12px);
  background: color-mix(in oklch, var(--card) 84%, transparent);
  border: 1px solid color-mix(in oklch, var(--foreground) 14%, transparent);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stage-frame__sprockets {
  display: flex;
  justify-content: space-between;
  padding-bottom: 6px;
  border-bottom: 1px dashed color-mix(in oklch, var(--foreground) 18%, transparent);
}

.stage-empty {
  padding: 48px 16px;
  border-radius: var(--radius, 12px);
  border: 1px solid color-mix(in oklch, var(--foreground) 12%, transparent);
  background: color-mix(in oklch, var(--card) 75%, transparent);
}

@media (max-width: 960px) {
  .stage-hero__bottom {
    flex-direction: column;
    align-items: flex-start;
    gap: 18px;
  }

  .stage-hero__identity {
    width: 100%;
    min-width: 0;
    flex: none;
  }
}

@media (max-width: 640px) {
  .stage-hero {
    padding: 4px 12px 0;
  }

  .stage-hero__cinema {
    min-height: 400px;
  }

  .stage-hero__content {
    padding: 16px;
    gap: 20px;
  }

  .stage-hero__identity {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .stage-actions {
    width: 100%;
  }

  .stage-actions > * {
    flex: 1 1 auto;
  }

  .stage-container {
    padding: 0 12px;
  }

  .stage-banner-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    padding: 12px 14px;
  }
}
</style>
