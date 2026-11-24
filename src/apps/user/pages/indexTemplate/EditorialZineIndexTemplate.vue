<script lang="ts" setup>
import { ArrowUpRight, Calendar, Palette, Radio } from 'lucide-vue-next'
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

const editionYear = new Date().getFullYear()
const verticalMetaText = computed(() => {
  const parts = [
    isStreaming.value ? '配信中' : liveReserve.value ? `次回 ${liveReserveTimeText.value}` : 'チャンネル案内',
    props.userInfo?.streamerInfo?.area || '',
    honorText.value || nameplateText.value,
  ].filter(Boolean)
  return parts.join('　／　')
})

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
  <div class="zine-page">
    <div
      v-if="isLoading"
      class="py-24 flex justify-center"
    >
      <Spin />
    </div>

    <div
      v-else
      class="zine-container"
    >
      <!-- 报刊头栏标尺 -->
      <div class="zine-masthead">
        <span>ISSUE NO.01 — {{ editionYear }}</span>
        <span class="zine-masthead__center">VTSURU SPECIAL FEATURE // @{{ props.userInfo?.name || 'CREATOR' }}</span>
        <span :class="{ 'text-primary font-semibold': isStreaming }">
          {{ isStreaming ? '● ON AIR NOW' : props.userInfo?.streamerInfo?.uId ? `UID ${props.userInfo.streamerInfo.uId}` : 'PROFILE' }}
        </span>
      </div>

      <!-- ==================== 首屏不对称杂志跨页 ==================== -->
      <header class="zine-spread">
        <!-- 左侧主画幅 + 巨型叠压标题 -->
        <div class="zine-visual-col">
          <div class="zine-figure">
            <img
              v-if="headerImage && showHeaderImage"
              :src="headerImage"
              alt=""
              class="zine-figure__img"
              referrerpolicy="no-referrer"
              @error="showHeaderImage = false"
            />
            <div
              v-else
              class="zine-figure__fallback"
            >
              <span class="zine-figure__monogram">{{ streamerName.slice(0, 1) }}</span>
            </div>

            <!-- 纸感胶片颗粒叠层（引用内联 SVG 滤镜） -->
            <div
              class="zine-figure__grain"
              aria-hidden="true"
            />

            <!-- 角标印签 -->
            <div class="zine-stamp">
              <span v-if="isStreaming">LIVE</span>
              <span v-else-if="liveReserve">NEXT</span>
              <span v-else>ARCH</span>
            </div>
          </div>

          <!-- 超大动能标题（叠压画幅底缘，支持 Scroll-Driven 视差） -->
          <div class="zine-headline-wrap">
            <h1 class="zine-headline">{{ streamerName }}</h1>
          </div>
        </div>

        <!-- 右侧编辑栏 + 日系竖排信息带 -->
        <div class="zine-editorial-col">
          <div class="zine-editorial-top">
            <div
              v-if="avatar"
              class="zine-portrait"
            >
              <Avatar class="size-24 rounded-none border border-foreground/30">
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
                class="zine-portrait__frame"
                referrerpolicy="no-referrer"
                @error="showAvatarFrame = false"
              />
            </div>

            <!-- 日系竖排标注 -->
            <aside
              v-if="verticalMetaText"
              class="zine-vertical-rail"
              aria-label="频道注记"
            >
              {{ verticalMetaText }}
            </aside>
          </div>

          <!-- 编者按（个人签名） -->
          <div class="zine-lead">
            <span class="zine-kicker">EDITOR&apos;S NOTE</span>
            <p class="zine-sign">{{ signature }}</p>
            <div class="zine-tags">
              <span
                v-if="level"
                class="zine-tag"
              >
                LV.{{ level }}
              </span>
              <span
                v-if="props.userInfo?.streamerInfo?.area"
                class="zine-tag"
              >
                {{ props.userInfo.streamerInfo.area }}
              </span>
              <span
                v-if="honorText || nameplateText"
                class="zine-tag zine-tag--accent"
              >
                {{ honorText || nameplateText }}
              </span>
            </div>
          </div>

          <!-- 细线统计表 -->
          <dl
            v-if="profileStats.length"
            class="zine-stats"
          >
            <div
              v-for="stat in profileStats"
              :key="stat.label"
              class="zine-stats__cell"
            >
              <dt>{{ stat.label }}</dt>
              <dd class="tabular-nums">{{ stat.text }}</dd>
            </div>
          </dl>

          <!-- 编辑风操作按钮组 -->
          <div class="zine-actions">
            <Button
              v-if="liveRoomUrl"
              size="lg"
              class="zine-btn-solid gap-2"
              @click="navigate(liveRoomUrl)"
            >
              <Radio class="size-4" />
              <span>{{ isStreaming ? '前往直播现场' : '进入直播间' }}</span>
            </Button>
            <Button
              v-if="biliSpaceUrl"
              variant="outline"
              size="lg"
              class="zine-btn-line gap-2"
              @click="navigate(biliSpaceUrl)"
            >
              <component
                :is="BilibiliIcon"
                class="size-4 fill-current"
              />
              <span>B 站主页</span>
            </Button>
            <Button
              v-if="isOwner"
              variant="outline"
              size="lg"
              class="zine-btn-line gap-2"
              @click="$router.push({ name: 'manage-userPageBuilder' })"
            >
              <Palette class="size-4" />
              <span>主页装修</span>
            </Button>
          </div>
        </div>
      </header>

      <!-- ==================== 编者批注条（预约 & 公告） ==================== -->
      <div
        v-if="(!isStreaming && liveReserve) || indexInfo.notification"
        class="zine-notes-band"
      >
        <a
          v-if="!isStreaming && liveReserve && liveRoomUrl"
          :href="liveRoomUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="zine-note zine-note--reserve"
        >
          <span class="zine-note__label">
            <Calendar class="size-3.5" />
            NEXT LIVE
          </span>
          <span class="zine-note__body">{{ liveReserveLabel }}</span>
          <ArrowUpRight class="size-4 shrink-0" />
        </a>
        <div
          v-else-if="!isStreaming && liveReserve"
          class="zine-note zine-note--reserve"
        >
          <span class="zine-note__label">
            <Calendar class="size-3.5" />
            NEXT LIVE
          </span>
          <span class="zine-note__body">{{ liveReserveLabel }}</span>
        </div>

        <div
          v-if="indexInfo.notification"
          class="zine-note"
        >
          <span class="zine-note__label">NOTICE</span>
          <span class="zine-note__body">{{ indexInfo.notification }}</span>
        </div>
      </div>

      <!-- ==================== 正文：目录索引外链 + 画册映像 ==================== -->
      <main
        v-if="orderedLinks.length || indexInfo.videos?.length"
        class="zine-body"
      >
        <!-- 目录索引外链 -->
        <section
          v-if="orderedLinks.length"
          class="zine-section"
        >
          <div class="zine-section__head">
            <div class="zine-section__title-group">
              <span class="zine-section__num">01</span>
              <h2>INDEX / 频道目录</h2>
            </div>
            <span class="zine-section__meta">{{ String(orderedLinks.length).padStart(2, '0') }} ENTRIES</span>
          </div>

          <div class="zine-index-list">
            <a
              v-for="(link, idx) in orderedLinks"
              :key="link[0]"
              :href="link[1]"
              target="_blank"
              rel="noopener noreferrer"
              class="zine-index-row"
            >
              <span class="zine-index-row__num tabular-nums">{{ String(idx + 1).padStart(2, '0') }}</span>
              <span class="zine-index-row__title">{{ link[0] }}</span>
              <span class="zine-index-row__host">{{ extractHost(link[1]) }}</span>
              <ArrowUpRight class="zine-index-row__arrow size-4" />
            </a>
          </div>
        </section>

        <!-- 画册映像区 -->
        <section
          v-if="indexInfo.videos?.length"
          class="zine-section"
        >
          <div class="zine-section__head">
            <div class="zine-section__title-group">
              <span class="zine-section__num">02</span>
              <h2>PLATES / 精选映像</h2>
            </div>
            <span class="zine-section__meta">{{ String(indexInfo.videos.length).padStart(2, '0') }} PLATES</span>
          </div>

          <div class="zine-plates">
            <figure
              v-for="(video, idx) in indexInfo.videos"
              :key="video.id"
              class="zine-plate"
              :class="{ 'zine-plate--featured': idx === 0 && indexInfo.videos.length >= 3 }"
            >
              <div class="zine-plate__frame">
                <SimpleVideoCard
                  :video="video"
                  full-width
                />
              </div>
              <figcaption class="zine-plate__caption">
                <span class="zine-plate__fig tabular-nums">FIG.{{ String(idx + 1).padStart(2, '0') }}</span>
                <span class="zine-plate__text tabular-nums">{{ video.id }}</span>
              </figcaption>
            </figure>
          </div>
        </section>
      </main>

      <div
        v-else
        class="py-16 border-t border-border"
      >
        <Empty description="本期特设画报暂未编排外链与精选映像" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.zine-page {
  width: 100%;
  min-width: 0;
  color: var(--foreground);
  font-family: var(--vtsuru-page-font-family, 'Noto Serif SC', Georgia, serif);
}

.zine-container {
  max-width: min(1320px, var(--vtsuru-page-max-width, 1320px));
  margin: 0 auto;
  padding: 20px 24px 72px;
  display: flex;
  flex-direction: column;
  gap: 32px;
  container-type: inline-size;
}

/* 顶部刊号标尺 */
.zine-masthead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 10px;
  border-bottom: 1.5px solid color-mix(in oklch, var(--foreground) 72%, transparent);
  font-size: 10.5px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--muted-foreground);
}

.zine-masthead__center {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 首屏不对称跨页 */
.zine-spread {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 0.95fr);
  gap: 32px;
  align-items: stretch;
}

.zine-visual-col {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.zine-figure {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 10;
  overflow: hidden;
  border: 1px solid color-mix(in oklch, var(--foreground) 24%, transparent);
  background: color-mix(in oklch, var(--primary) 12%, var(--card));
}

.zine-figure__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.zine-figure__fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at 22% 28%, color-mix(in oklch, var(--primary) 26%, transparent), transparent 58%),
    color-mix(in oklch, var(--card) 92%, var(--foreground) 5%);
}

.zine-figure__monogram {
  font-family: var(--site-font-display, Georgia, serif);
  font-size: clamp(5rem, 12vw, 9rem);
  font-weight: 800;
  color: color-mix(in oklch, var(--foreground) 16%, transparent);
  user-select: none;
}

.zine-figure__grain {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.12;
  filter: url(#vtsuru-paper-grain);
  mix-blend-mode: overlay;
}

.zine-stamp {
  position: absolute;
  top: 14px;
  left: 14px;
  padding: 4px 10px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.2em;
  background: var(--primary);
  color: var(--primary-foreground);
}

.zine-headline-wrap {
  position: relative;
  margin-top: -32px;
  padding-right: 16px;
  z-index: 2;
}

.zine-headline {
  margin: 0;
  display: inline-block;
  max-width: 100%;
  padding: 6px 20px 2px 0;
  background: var(--zine-paper, var(--background));
  font-family: var(--site-font-display, 'Noto Serif SC', Georgia, serif);
  font-size: clamp(2.4rem, 5.4vw, 4.9rem);
  font-weight: 800;
  line-height: 1.02;
  letter-spacing: -0.03em;
  color: var(--foreground);
  word-break: break-word;
}

@supports (animation-timeline: view()) {
  .zine-headline {
    animation: zineHeadlineDrift linear both;
    animation-timeline: view();
    animation-range: entry 0% exit 100%;
  }

  .zine-figure__img {
    animation: zineImageScale linear both;
    animation-timeline: view();
    animation-range: entry 0% exit 100%;
  }
}

@keyframes zineHeadlineDrift {
  from { transform: translateX(0); }
  to { transform: translateX(18px); }
}

@keyframes zineImageScale {
  from { transform: scale(1); }
  to { transform: scale(1.07); }
}

@media (prefers-reduced-motion: reduce) {
  .zine-headline,
  .zine-figure__img {
    animation: none;
  }
}

/* 右侧编辑栏 */
.zine-editorial-col {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 20px;
  padding-left: 24px;
  border-left: 1px solid color-mix(in oklch, var(--foreground) 18%, transparent);
  min-width: 0;
}

.zine-editorial-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.zine-portrait {
  position: relative;
  flex-shrink: 0;
}

.zine-portrait__frame {
  position: absolute;
  inset: -16%;
  width: 132%;
  height: 132%;
  object-fit: contain;
  pointer-events: none;
}

/* 日系竖排信息带 */
.zine-vertical-rail {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  max-height: 260px;
  white-space: nowrap;
  font-family: var(--site-font-serif, 'Noto Serif SC', serif);
  font-size: 11px;
  letter-spacing: 0.14em;
  color: var(--muted-foreground);
  border-right: 1px solid color-mix(in oklch, var(--primary) 50%, transparent);
  padding-right: 8px;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
}

.zine-lead {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.zine-kicker {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.22em;
  color: var(--primary);
}

.zine-sign {
  margin: 0;
  font-size: 14px;
  line-height: 1.75;
  color: var(--foreground);
}

.zine-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 2px;
}

.zine-tag {
  padding: 2px 8px;
  font-size: 11px;
  border: 1px solid color-mix(in oklch, var(--foreground) 22%, transparent);
  color: var(--muted-foreground);
}

.zine-tag--accent {
  border-color: var(--primary);
  color: var(--primary);
}

/* 细线统计表 */
.zine-stats {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(84px, 1fr));
  border-top: 1px solid color-mix(in oklch, var(--foreground) 22%, transparent);
  border-bottom: 1px solid color-mix(in oklch, var(--foreground) 22%, transparent);
}

.zine-stats__cell {
  padding: 12px 10px 12px 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.zine-stats__cell dt {
  font-size: 10.5px;
  color: var(--muted-foreground);
  letter-spacing: 0.08em;
}

.zine-stats__cell dd {
  margin: 0;
  font-family: var(--site-font-display, Georgia, serif);
  font-size: 22px;
  font-weight: 700;
  color: var(--foreground);
}

.zine-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.zine-btn-solid,
.zine-btn-line {
  border-radius: 0;
}

.zine-btn-line {
  border-color: color-mix(in oklch, var(--foreground) 34%, transparent);
}

/* 编者批注带 */
.zine-notes-band {
  display: flex;
  flex-direction: column;
  border-top: 1.5px solid color-mix(in oklch, var(--foreground) 70%, transparent);
  border-bottom: 1px solid color-mix(in oklch, var(--foreground) 22%, transparent);
}

.zine-note {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 4px;
  color: var(--foreground);
  text-decoration: none;
  border-bottom: 1px solid color-mix(in oklch, var(--foreground) 12%, transparent);
  transition: background-color 160ms ease;
}

.zine-note:last-child {
  border-bottom: 0;
}

.zine-note--reserve:hover {
  background: color-mix(in oklch, var(--primary) 8%, transparent);
}

.zine-note__label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.16em;
  background: var(--primary);
  color: var(--primary-foreground);
  flex-shrink: 0;
}

.zine-note__body {
  flex: 1;
  min-width: 0;
  font-size: 13.5px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

/* 正文板块 */
.zine-body {
  display: flex;
  flex-direction: column;
  gap: 40px;
}

.zine-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.zine-section__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 10px;
  border-bottom: 1.5px solid color-mix(in oklch, var(--foreground) 72%, transparent);
}

.zine-section__title-group {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.zine-section__num {
  font-family: var(--site-font-display, Georgia, serif);
  font-size: 26px;
  font-weight: 800;
  color: var(--primary);
  line-height: 1;
}

.zine-section__head h2 {
  margin: 0;
  font-family: var(--site-font-display, Georgia, serif);
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.zine-section__meta {
  font-size: 10.5px;
  letter-spacing: 0.16em;
  color: var(--muted-foreground);
}

/* 杂志目录外链 */
.zine-index-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 28px;
}

.zine-index-row {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 12px;
  padding: 14px 6px;
  text-decoration: none;
  color: var(--foreground);
  border-bottom: 1px solid color-mix(in oklch, var(--foreground) 18%, transparent);
  transition: background-color 160ms ease, padding-left 160ms ease;
}

.zine-index-row:hover {
  background: color-mix(in oklch, var(--primary) 8%, transparent);
}

.zine-index-row__num {
  font-family: var(--site-font-display, Georgia, serif);
  font-size: 14px;
  font-weight: 700;
  color: var(--primary);
}

.zine-index-row__title {
  font-size: 15px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.zine-index-row__host {
  font-size: 11px;
  letter-spacing: 0.06em;
  color: var(--muted-foreground);
  max-width: 130px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.zine-index-row__arrow {
  color: var(--muted-foreground);
  transition: transform 160ms ease, color 160ms ease;
}

.zine-index-row:hover .zine-index-row__arrow {
  color: var(--primary);
  transform: translate(3px, -3px);
}

/* 画册错落映像 */
.zine-plates {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 22px;
  align-items: start;
}

.zine-plate {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.zine-plate--featured {
  grid-column: span 2;
}

.zine-plate__frame {
  padding: 8px;
  border: 1px solid color-mix(in oklch, var(--foreground) 20%, transparent);
  background: color-mix(in oklch, var(--card) 75%, transparent);
}

.zine-plate__caption {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--foreground);
}

.zine-plate__fig {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--primary);
  flex-shrink: 0;
}

.zine-plate__text {
  min-width: 0;
}

@container (max-width: 860px) {
  .zine-spread {
    grid-template-columns: 1fr;
    gap: 20px;
  }

  .zine-editorial-col {
    padding-left: 0;
    padding-top: 18px;
    border-left: 0;
    border-top: 1px solid color-mix(in oklch, var(--foreground) 18%, transparent);
  }

  .zine-index-list {
    grid-template-columns: 1fr;
  }

  .zine-plate--featured {
    grid-column: span 1;
  }
}

@media (max-width: 640px) {
  .zine-container {
    padding: 14px 14px 56px;
    gap: 24px;
  }

  .zine-masthead__center {
    display: none;
  }

  .zine-headline-wrap {
    margin-top: -16px;
  }

  .zine-vertical-rail {
    writing-mode: horizontal-tb;
    border-right: 0;
    border-top: 1px solid color-mix(in oklch, var(--primary) 50%, transparent);
    padding-right: 0;
    padding-top: 6px;
    max-height: none;
  }

  .zine-editorial-top {
    flex-direction: column;
  }

  .zine-index-row__host {
    display: none;
  }
}
</style>
