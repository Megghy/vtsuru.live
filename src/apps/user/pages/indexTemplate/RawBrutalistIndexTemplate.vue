<script lang="ts" setup>
import { ArrowUpRight, Calendar, Palette, Play, Radio } from 'lucide-vue-next'

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

function extractHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'EXT'
  }
}
</script>

<script lang="ts">
export type ConfigType = ExtractConfigData<typeof Config>
export const DefaultConfig = {} as ConfigType
export const Config = defineTemplateConfig([])
</script>

<template>
  <div class="brutal-page">
    <div
      v-if="isLoading"
      class="py-24 flex justify-center"
    >
      <Spin />
    </div>

    <div
      v-else
      class="brutal-container"
    >
      <!-- ==================== 顶部巨幅展演铭牌 ==================== -->
      <header class="brutal-slab brutal-masthead">
        <div class="brutal-masthead__main">
          <div class="brutal-masthead__kicker">
            <span>VTSURU // POSTER_01</span>
            <span v-if="props.userInfo?.streamerInfo?.uId">UID {{ props.userInfo.streamerInfo.uId }}</span>
            <span v-if="props.userInfo?.streamerInfo?.area">{{ props.userInfo.streamerInfo.area }}</span>
          </div>
          <h1 class="brutal-title">{{ streamerName }}</h1>
        </div>

        <!-- 实体拨动开关风格状态牌 -->
        <div
          class="brutal-switch"
          :class="{ 'is-live': isStreaming }"
        >
          <span class="brutal-switch__label">SIGNAL</span>
          <div class="brutal-switch__body">
            <span class="brutal-switch__knob" />
            <span class="brutal-switch__state">
              {{ isStreaming ? 'ON AIR' : liveReserve ? 'NEXT' : 'STANDBY' }}
            </span>
          </div>
        </div>
      </header>

      <!-- ==================== 双栏切块主视觉 ==================== -->
      <section class="brutal-hero-grid">
        <!-- 左：粗框海报图 -->
        <div class="brutal-slab brutal-poster-frame">
          <img
            v-if="headerImage && showHeaderImage"
            :src="headerImage"
            alt=""
            class="brutal-poster-frame__img"
            referrerpolicy="no-referrer"
            @error="showHeaderImage = false"
          />
          <div
            v-else
            class="brutal-poster-frame__fallback"
          >
            <span>{{ streamerName.slice(0, 2).toUpperCase() }}</span>
          </div>
          <div class="brutal-poster-frame__tag">
            <span>FIG.A // COVER</span>
            <span v-if="level">LV.{{ level }}</span>
          </div>
        </div>

        <!-- 右：身份切块 + 统计 + 机械按压按钮 -->
        <div class="brutal-slab brutal-profile-box">
          <div class="brutal-profile-top">
            <div
              v-if="avatar"
              class="brutal-avatar"
            >
              <Avatar class="size-20 rounded-none border-2 border-foreground">
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
                class="brutal-avatar__pendant"
                referrerpolicy="no-referrer"
                @error="showAvatarFrame = false"
              />
            </div>

            <div class="brutal-profile-copy">
              <div class="brutal-mono-tag">@{{ props.userInfo?.name || 'channel' }}</div>
              <p class="brutal-sign">{{ signature }}</p>
              <span
                v-if="honorText || nameplateText"
                class="brutal-honor"
              >
                {{ honorText || nameplateText }}
              </span>
            </div>
          </div>

          <div
            v-if="profileStats.length"
            class="brutal-stats"
          >
            <div
              v-for="stat in profileStats"
              :key="stat.label"
              class="brutal-stats__cell"
            >
              <span class="brutal-stats__en">{{ stat.enLabel }}</span>
              <strong class="brutal-stats__val tabular-nums">{{ stat.text }}</strong>
              <span class="brutal-stats__cn">{{ stat.label }}</span>
            </div>
          </div>

          <div class="brutal-actions">
            <Button
              v-if="liveRoomUrl"
              size="lg"
              class="brutal-btn brutal-btn--primary gap-2"
              @click="navigate(liveRoomUrl)"
            >
              <Radio class="size-4" />
              <span>{{ isStreaming ? '立即进入直播间' : '进入直播间' }}</span>
            </Button>
            <Button
              v-if="biliSpaceUrl"
              variant="outline"
              size="lg"
              class="brutal-btn gap-2"
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
              class="brutal-btn gap-2"
              @click="$router.push({ name: 'manage-userPageBuilder' })"
            >
              <Palette class="size-4" />
              <span>主页装修</span>
            </Button>
          </div>
        </div>
      </section>

      <!-- ==================== 警示封条（预约 & 公告） ==================== -->
      <div
        v-if="(!isStreaming && liveReserve) || indexInfo.notification"
        class="brutal-alerts"
      >
        <a
          v-if="!isStreaming && liveReserve && liveRoomUrl"
          :href="liveRoomUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="brutal-slab brutal-tape brutal-tape--reserve"
        >
          <span class="brutal-tape__badge">
            <Calendar class="size-3.5" />
            NEXT {{ liveReserveTimeText }}
          </span>
          <span class="brutal-tape__text">{{ liveReserveLabel }}</span>
          <ArrowUpRight class="size-4 shrink-0" />
        </a>
        <div
          v-else-if="!isStreaming && liveReserve"
          class="brutal-slab brutal-tape brutal-tape--reserve"
        >
          <span class="brutal-tape__badge">
            <Calendar class="size-3.5" />
            NEXT {{ liveReserveTimeText }}
          </span>
          <span class="brutal-tape__text">{{ liveReserveLabel }}</span>
        </div>

        <div
          v-if="indexInfo.notification"
          class="brutal-slab brutal-tape"
        >
          <span class="brutal-tape__badge">NOTICE</span>
          <span class="brutal-tape__text">{{ indexInfo.notification }}</span>
        </div>
      </div>

      <!-- ==================== 外链索引砖 + 编号展品视频区 ==================== -->
      <main
        v-if="orderedLinks.length || indexInfo.videos?.length"
        class="brutal-main"
      >
        <section
          v-if="orderedLinks.length"
          class="brutal-section"
        >
          <div class="brutal-section__head">
            <h2>01 / EXTERNAL LINKS</h2>
            <span>{{ String(orderedLinks.length).padStart(2, '0') }} BLOCKS</span>
          </div>
          <div class="brutal-bricks">
            <a
              v-for="(link, idx) in orderedLinks"
              :key="link[0]"
              :href="link[1]"
              target="_blank"
              rel="noopener noreferrer"
              class="brutal-slab brutal-brick"
            >
              <div class="brutal-brick__top">
                <span class="brutal-brick__num">LINK #{{ String(idx + 1).padStart(2, '0') }}</span>
                <ArrowUpRight class="size-4" />
              </div>
              <div class="brutal-brick__title">{{ link[0] }}</div>
              <div class="brutal-brick__host">{{ extractHost(link[1]) }}</div>
            </a>
          </div>
        </section>

        <section
          v-if="indexInfo.videos?.length"
          class="brutal-section"
        >
          <div class="brutal-section__head">
            <h2>02 / EXHIBITION CLIPS</h2>
            <span>{{ String(indexInfo.videos.length).padStart(2, '0') }} EXHIBITS</span>
          </div>
          <div class="brutal-exhibits">
            <article
              v-for="(video, idx) in indexInfo.videos"
              :key="video.id"
              class="brutal-slab brutal-exhibit"
            >
              <div class="brutal-exhibit__head">
                <span>CLIP #{{ String(idx + 1).padStart(2, '0') }}</span>
                <Play class="size-3.5" />
              </div>
              <div class="brutal-exhibit__media">
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
        class="brutal-slab py-14"
      >
        <Empty description="展板暂无外链或精选展品" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.brutal-page {
  width: 100%;
  min-width: 0;
  color: var(--foreground);
  font-family: var(--vtsuru-page-font-family, 'Space Grotesk', system-ui, sans-serif);
}

.brutal-container {
  max-width: min(1320px, var(--vtsuru-page-max-width, 1320px));
  margin: 0 auto;
  padding: 20px 20px 72px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  container-type: inline-size;
}

.brutal-slab {
  min-width: 0;
  background: var(--card);
  border: 2px solid color-mix(in oklch, var(--foreground) 92%, transparent);
  box-shadow: 5px 5px 0 color-mix(in oklch, var(--foreground) 92%, transparent);
}

/* 顶部巨幅铭牌 */
.brutal-masthead {
  padding: 20px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
}

.brutal-masthead__main {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.brutal-masthead__kicker {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-family: var(--site-font-mono, ui-monospace, monospace);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--muted-foreground);
  text-transform: uppercase;
}

.brutal-title {
  margin: 0;
  font-family: var(--site-font-display, system-ui, sans-serif);
  font-size: clamp(2.1rem, 5.2vw, 4.4rem);
  font-weight: 900;
  line-height: 0.98;
  letter-spacing: -0.03em;
  word-break: break-word;
}

/* 拨动开关状态牌 */
.brutal-switch {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-shrink: 0;
}

.brutal-switch__label {
  font-family: var(--site-font-mono, monospace);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.14em;
  color: var(--muted-foreground);
}

.brutal-switch__body {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border: 2px solid color-mix(in oklch, var(--foreground) 92%, transparent);
  background: var(--background);
  font-family: var(--site-font-mono, monospace);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.brutal-switch.is-live .brutal-switch__body {
  background: var(--primary);
  color: var(--primary-foreground);
}

.brutal-switch__knob {
  width: 12px;
  height: 12px;
  border: 2px solid currentColor;
  background: var(--primary);
}

.brutal-switch.is-live .brutal-switch__knob {
  background: var(--primary-foreground);
}

/* 双栏主视觉 */
.brutal-hero-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
  gap: 20px;
  align-items: stretch;
}

.brutal-poster-frame {
  position: relative;
  min-height: 280px;
  max-height: 400px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.brutal-poster-frame__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  flex: 1;
}

.brutal-poster-frame__fallback {
  flex: 1;
  min-height: 260px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary);
  color: var(--primary-foreground);
  font-family: var(--site-font-display, sans-serif);
  font-size: 6rem;
  font-weight: 900;
}

.brutal-poster-frame__tag {
  position: absolute;
  left: 12px;
  bottom: 12px;
  display: inline-flex;
  gap: 10px;
  padding: 4px 10px;
  background: var(--background);
  color: var(--foreground);
  border: 2px solid color-mix(in oklch, var(--foreground) 92%, transparent);
  font-family: var(--site-font-mono, monospace);
  font-size: 10.5px;
  font-weight: 800;
}

.brutal-profile-box {
  padding: 20px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 18px;
}

.brutal-profile-top {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.brutal-avatar {
  position: relative;
  flex-shrink: 0;
}

.brutal-avatar__pendant {
  position: absolute;
  inset: -16%;
  width: 132%;
  height: 132%;
  object-fit: contain;
  pointer-events: none;
}

.brutal-profile-copy {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.brutal-mono-tag {
  font-family: var(--site-font-mono, monospace);
  font-size: 11px;
  font-weight: 700;
  color: var(--primary);
}

.brutal-sign {
  margin: 0;
  font-size: 14px;
  line-height: 1.65;
  color: var(--foreground);
}

.brutal-honor {
  display: inline-block;
  width: fit-content;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 800;
  background: var(--primary);
  color: var(--primary-foreground);
}

.brutal-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
  border: 2px solid color-mix(in oklch, var(--foreground) 92%, transparent);
}

.brutal-stats__cell {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-right: 2px solid color-mix(in oklch, var(--foreground) 92%, transparent);
  background: var(--background);
}

.brutal-stats__cell:last-child {
  border-right: 0;
}

.brutal-stats__en {
  font-family: var(--site-font-mono, monospace);
  font-size: 9.5px;
  font-weight: 700;
  color: var(--muted-foreground);
}

.brutal-stats__val {
  font-size: 24px;
  font-weight: 900;
  line-height: 1.1;
}

.brutal-stats__cn {
  font-size: 11px;
  color: var(--muted-foreground);
}

.brutal-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.brutal-btn {
  border-radius: 0;
  border: 2px solid color-mix(in oklch, var(--foreground) 92%, transparent);
  font-weight: 800;
  box-shadow: 4px 4px 0 color-mix(in oklch, var(--foreground) 92%, transparent);
  transition: transform 140ms ease, box-shadow 140ms ease;
}

.brutal-btn:hover {
  transform: translate(3px, 3px);
  box-shadow: 1px 1px 0 color-mix(in oklch, var(--foreground) 92%, transparent);
}

.brutal-btn:active {
  transform: translate(4px, 4px);
  box-shadow: 0 0 0 transparent;
}

/* 警示封条 */
.brutal-alerts {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.brutal-tape {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  text-decoration: none;
  color: var(--foreground);
  background-image: repeating-linear-gradient(
    -45deg,
    color-mix(in oklch, var(--primary) 8%, transparent) 0 10px,
    transparent 10px 20px
  );
}

.brutal-tape--reserve {
  transition: transform 140ms ease, box-shadow 140ms ease;
}

.brutal-tape--reserve:hover {
  transform: translate(2px, 2px);
  box-shadow: 3px 3px 0 color-mix(in oklch, var(--foreground) 92%, transparent);
}

.brutal-tape__badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  font-family: var(--site-font-mono, monospace);
  font-size: 11px;
  font-weight: 800;
  background: var(--primary);
  color: var(--primary-foreground);
  flex-shrink: 0;
}

.brutal-tape__text {
  flex: 1;
  min-width: 0;
  font-size: 13.5px;
  font-weight: 600;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

/* 主体板块 */
.brutal-main {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.brutal-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.brutal-section__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 8px;
  border-bottom: 3px solid color-mix(in oklch, var(--foreground) 92%, transparent);
  font-family: var(--site-font-mono, monospace);
}

.brutal-section__head h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 900;
  letter-spacing: 0.04em;
}

.brutal-section__head span {
  font-size: 11px;
  font-weight: 700;
  color: var(--primary);
}

/* 机械按压外链砖 */
.brutal-bricks {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px;
}

.brutal-brick {
  padding: 16px;
  text-decoration: none;
  color: var(--foreground);
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: transform 140ms ease, box-shadow 140ms ease, background-color 140ms ease;
}

.brutal-brick:hover {
  transform: translate(3px, 3px);
  box-shadow: 2px 2px 0 color-mix(in oklch, var(--foreground) 92%, transparent);
  background: color-mix(in oklch, var(--primary) 12%, var(--card));
}

.brutal-brick__top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: var(--site-font-mono, monospace);
  font-size: 10.5px;
  font-weight: 800;
  color: var(--primary);
}

.brutal-brick__title {
  font-size: 16px;
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.brutal-brick__host {
  font-family: var(--site-font-mono, monospace);
  font-size: 11px;
  color: var(--muted-foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 编号展品视频区 */
.brutal-exhibits {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

.brutal-exhibit {
  display: flex;
  flex-direction: column;
}

.brutal-exhibit__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  border-bottom: 2px solid color-mix(in oklch, var(--foreground) 92%, transparent);
  background: var(--primary);
  color: var(--primary-foreground);
  font-family: var(--site-font-mono, monospace);
  font-size: 11px;
  font-weight: 800;
}

.brutal-exhibit__media {
  padding: 10px;
  filter: saturate(0.25) contrast(1.08);
  transition: filter 180ms ease;
}

.brutal-exhibit:hover .brutal-exhibit__media {
  filter: saturate(1) contrast(1);
}

@container (max-width: 860px) {
  .brutal-hero-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .brutal-container {
    padding: 14px 12px 56px;
    gap: 14px;
  }

  .brutal-masthead {
    padding: 16px;
  }

  .brutal-profile-top {
    flex-direction: column;
  }

  .brutal-stats__cell {
    border-right: 0;
    border-bottom: 2px solid color-mix(in oklch, var(--foreground) 92%, transparent);
  }

  .brutal-stats__cell:last-child {
    border-bottom: 0;
  }

  .brutal-actions > * {
    flex: 1 1 auto;
  }
}
</style>
