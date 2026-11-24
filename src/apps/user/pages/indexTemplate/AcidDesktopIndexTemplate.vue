<script lang="ts" setup>
import {
  ArrowUpRight,
  Calendar,
  FolderOpen,
  Minus,
  Palette,
  Play,
  Radio,
  RotateCcw,
  Terminal,
  User,
} from 'lucide-vue-next'
import { reactive, ref } from 'vue'

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

type WindowId = 'profile' | 'notice' | 'links' | 'videos'

interface WindowState {
  z: number
  dx: number
  dy: number
  collapsed: boolean
}

let topZ = 10
const windows = reactive<Record<WindowId, WindowState>>({
  profile: { z: 4, dx: 0, dy: 0, collapsed: false },
  notice: { z: 3, dx: 0, dy: 0, collapsed: false },
  links: { z: 2, dx: 0, dy: 0, collapsed: false },
  videos: { z: 1, dx: 0, dy: 0, collapsed: false },
})
const hasMovedAny = ref(false)

function focusWindow(id: WindowId) {
  windows[id].z = ++topZ
}

function toggleCollapse(id: WindowId) {
  focusWindow(id)
  windows[id].collapsed = !windows[id].collapsed
}

function resetWindows() {
  for (const key of Object.keys(windows) as WindowId[]) {
    windows[key].dx = 0
    windows[key].dy = 0
    windows[key].collapsed = false
  }
  hasMovedAny.value = false
}

function startDrag(id: WindowId, event: PointerEvent) {
  if (event.pointerType === 'touch' || window.innerWidth < 860) return
  if ((event.target as HTMLElement | null)?.closest('button')) return
  focusWindow(id)
  const startX = event.clientX
  const startY = event.clientY
  const baseDx = windows[id].dx
  const baseDy = windows[id].dy

  const onMove = (moveEvent: PointerEvent) => {
    const nextDx = Math.max(-180, Math.min(180, baseDx + (moveEvent.clientX - startX)))
    const nextDy = Math.max(-90, Math.min(140, baseDy + (moveEvent.clientY - startY)))
    windows[id].dx = Math.round(nextDx)
    windows[id].dy = Math.round(nextDy)
    hasMovedAny.value = true
  }
  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

function windowStyle(id: WindowId) {
  const w = windows[id]
  return {
    zIndex: w.z,
    transform: w.dx || w.dy ? `translate3d(${w.dx}px, ${w.dy}px, 0)` : undefined,
  }
}

function extractHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'LINK.URL'
  }
}
</script>

<script lang="ts">
export type ConfigType = ExtractConfigData<typeof Config>
export const DefaultConfig = {} as ConfigType
export const Config = defineTemplateConfig([])
</script>

<template>
  <div class="acid-page">
    <div
      v-if="isLoading"
      class="py-24 flex justify-center"
    >
      <Spin />
    </div>

    <div
      v-else
      class="acid-desktop"
    >
      <!-- 桌面快捷信息条 -->
      <div class="acid-desk-strip">
        <div class="acid-desk-strip__path">
          <span>C:\VTSURU\USERS\{{ (props.userInfo?.name || 'CHANNEL').toUpperCase() }}</span>
          <span
            v-if="props.userInfo?.streamerInfo?.uId"
            class="text-primary"
          >
            [UID:{{ props.userInfo.streamerInfo.uId }}]
          </span>
        </div>
        <div class="acid-desk-strip__tools">
          <span class="hidden min-[860px]:inline text-[10.5px] text-muted-foreground">拖曳标题栏可调整窗口位置</span>
          <Button
            v-if="hasMovedAny"
            size="xs"
            variant="outline"
            class="gap-1 rounded-[2px]"
            @click="resetWindows"
          >
            <RotateCcw class="size-3" />
            重置排布
          </Button>
        </div>
      </div>

      <!-- ==================== 上层窗口网格：PROFILE.EXE + NOTICE.TXT ==================== -->
      <div class="acid-grid">
        <!-- 主窗口：PROFILE.EXE -->
        <section
          class="acid-win acid-win--profile"
          :style="windowStyle('profile')"
          @pointerdown="focusWindow('profile')"
        >
          <header
            class="acid-win__bar"
            @pointerdown="startDrag('profile', $event)"
          >
            <div class="acid-win__title">
              <User class="size-3.5 shrink-0" />
              <span>PROFILE.EXE — {{ streamerName }}</span>
            </div>
            <div class="acid-win__controls">
              <span
                class="acid-win__tag"
                :class="{ 'is-live': isStreaming }"
              >
                {{ isStreaming ? 'LIVE' : 'IDLE' }}
              </span>
              <button
                type="button"
                class="acid-win__btn"
                aria-label="折叠或展开窗口"
                @click.stop="toggleCollapse('profile')"
              >
                <Minus class="size-3" />
              </button>
            </div>
          </header>

          <div
            v-show="!windows.profile.collapsed"
            class="acid-win__body"
          >
            <div class="acid-banner">
              <img
                v-if="headerImage && showHeaderImage"
                :src="headerImage"
                alt=""
                class="acid-banner__img"
                referrerpolicy="no-referrer"
                @error="showHeaderImage = false"
              />
              <div
                v-else
                class="acid-banner__fallback"
              >
                <span>ACID_OS // 2000</span>
              </div>
              <div class="acid-banner__chips">
                <span
                  v-if="props.userInfo?.streamerInfo?.area"
                  class="acid-chip"
                >
                  {{ props.userInfo.streamerInfo.area }}
                </span>
                <span
                  v-if="level"
                  class="acid-chip"
                >
                  LV.{{ level }}
                </span>
              </div>
            </div>

            <div class="acid-profile-main">
              <div
                v-if="avatar"
                class="acid-avatar"
              >
                <Avatar class="size-20 rounded-[2px] border-2 border-foreground/70">
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
                  class="acid-avatar__pendant"
                  referrerpolicy="no-referrer"
                  @error="showAvatarFrame = false"
                />
              </div>

              <div class="acid-profile-copy">
                <h1 class="acid-name">{{ streamerName }}</h1>
                <p class="acid-sign">{{ signature }}</p>
                <div
                  v-if="honorText || nameplateText"
                  class="acid-honor"
                >
                  {{ honorText || nameplateText }}
                </div>
              </div>
            </div>

            <div
              v-if="profileStats.length"
              class="acid-stats"
            >
              <div
                v-for="stat in profileStats"
                :key="stat.label"
                class="acid-stats__cell"
              >
                <span class="acid-stats__k">{{ stat.enLabel }}</span>
                <strong class="acid-stats__v tabular-nums">{{ stat.text }}</strong>
                <span class="acid-stats__l">{{ stat.label }}</span>
              </div>
            </div>

            <div class="acid-actions">
              <Button
                v-if="liveRoomUrl"
                size="lg"
                class="acid-btn-primary gap-2"
                @click="navigate(liveRoomUrl)"
              >
                <Radio class="size-4" />
                <span>{{ isStreaming ? 'LAUNCH_LIVE.EXE' : '进入直播间' }}</span>
              </Button>
              <Button
                v-if="biliSpaceUrl"
                variant="outline"
                size="lg"
                class="acid-btn-line gap-2"
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
                class="acid-btn-line gap-2"
                @click="$router.push({ name: 'manage-userPageBuilder' })"
              >
                <Palette class="size-4" />
                <span>主页装修</span>
              </Button>
            </div>
          </div>
        </section>

        <!-- 侧窗口：NOTICE.TXT（预约 & 终端公告） -->
        <section
          class="acid-win acid-win--notice"
          :style="windowStyle('notice')"
          @pointerdown="focusWindow('notice')"
        >
          <header
            class="acid-win__bar"
            @pointerdown="startDrag('notice', $event)"
          >
            <div class="acid-win__title">
              <Terminal class="size-3.5 shrink-0" />
              <span>DISPATCH.TXT</span>
            </div>
            <div class="acid-win__controls">
              <button
                type="button"
                class="acid-win__btn"
                aria-label="折叠或展开公告窗口"
                @click.stop="toggleCollapse('notice')"
              >
                <Minus class="size-3" />
              </button>
            </div>
          </header>

          <div
            v-show="!windows.notice.collapsed"
            class="acid-win__body acid-notice-body"
          >
            <a
              v-if="!isStreaming && liveReserve && liveRoomUrl"
              :href="liveRoomUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="acid-reserve-box"
            >
              <div class="acid-reserve-box__head">
                <span class="inline-flex items-center gap-1.5">
                  <Calendar class="size-3.5" />
                  NEXT_STREAM.ICS
                </span>
                <ArrowUpRight class="size-3.5" />
              </div>
              <div class="acid-reserve-box__time">{{ liveReserveTimeText }}</div>
              <div class="acid-reserve-box__title">{{ liveReserve.title }}</div>
            </a>
            <div
              v-else-if="!isStreaming && liveReserve"
              class="acid-reserve-box"
            >
              <div class="acid-reserve-box__head">
                <span class="inline-flex items-center gap-1.5">
                  <Calendar class="size-3.5" />
                  NEXT_STREAM.ICS
                </span>
              </div>
              <div class="acid-reserve-box__time">{{ liveReserveTimeText }}</div>
              <div class="acid-reserve-box__title">{{ liveReserve.title }}</div>
            </div>

            <div class="acid-terminal-log">
              <div class="acid-terminal-log__line">
                <span class="text-primary">$</span> cat ./notice.txt
              </div>
              <p class="acid-terminal-log__text">
                {{ indexInfo.notification || liveReserveLabel || signature }}
              </p>
              <div class="acid-terminal-log__cursor">
                <span class="text-primary">&gt;</span> READY<span class="acid-cursor-block" />
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- ==================== 下层窗口：PORTALS.DIR & PLAYER.MOV ==================== -->
      <div
        v-if="orderedLinks.length || indexInfo.videos?.length"
        class="acid-lower-stack"
      >
        <section
          v-if="orderedLinks.length"
          class="acid-win"
          :style="windowStyle('links')"
          @pointerdown="focusWindow('links')"
        >
          <header
            class="acid-win__bar"
            @pointerdown="startDrag('links', $event)"
          >
            <div class="acid-win__title">
              <FolderOpen class="size-3.5 shrink-0" />
              <span>PORTALS.DIR ({{ orderedLinks.length }} ITEMS)</span>
            </div>
            <div class="acid-win__controls">
              <button
                type="button"
                class="acid-win__btn"
                aria-label="折叠或展开外链窗口"
                @click.stop="toggleCollapse('links')"
              >
                <Minus class="size-3" />
              </button>
            </div>
          </header>

          <div
            v-show="!windows.links.collapsed"
            class="acid-win__body"
          >
            <div class="acid-links-grid">
              <a
                v-for="(link, idx) in orderedLinks"
                :key="link[0]"
                :href="link[1]"
                target="_blank"
                rel="noopener noreferrer"
                class="acid-shortcut"
              >
                <div class="acid-shortcut__top">
                  <span class="acid-shortcut__idx">#{{ String(idx + 1).padStart(2, '0') }}</span>
                  <ArrowUpRight class="size-3.5 text-primary" />
                </div>
                <div class="acid-shortcut__name">{{ link[0] }}</div>
                <div class="acid-shortcut__host">{{ extractHost(link[1]) }}</div>
              </a>
            </div>
          </div>
        </section>

        <section
          v-if="indexInfo.videos?.length"
          class="acid-win"
          :style="windowStyle('videos')"
          @pointerdown="focusWindow('videos')"
        >
          <header
            class="acid-win__bar"
            @pointerdown="startDrag('videos', $event)"
          >
            <div class="acid-win__title">
              <Play class="size-3.5 shrink-0" />
              <span>PLAYER.MOV — PLAYLIST ({{ indexInfo.videos.length }})</span>
            </div>
            <div class="acid-win__controls">
              <button
                type="button"
                class="acid-win__btn"
                aria-label="折叠或展开视频窗口"
                @click.stop="toggleCollapse('videos')"
              >
                <Minus class="size-3" />
              </button>
            </div>
          </header>

          <div
            v-show="!windows.videos.collapsed"
            class="acid-win__body"
          >
            <div class="acid-video-grid">
              <article
                v-for="(video, idx) in indexInfo.videos"
                :key="video.id"
                class="acid-video-item"
              >
                <div class="acid-video-item__head">
                  <span>TRACK_{{ String(idx + 1).padStart(2, '0') }}.MP4</span>
                  <span class="text-primary">PLAY</span>
                </div>
                <SimpleVideoCard
                  :video="video"
                  full-width
                />
              </article>
            </div>
          </div>
        </section>
      </div>

      <section
        v-else
        class="acid-win"
      >
        <header class="acid-win__bar">
          <div class="acid-win__title">
            <FolderOpen class="size-3.5 shrink-0" />
            <span>EMPTY_WORKSPACE.DIR</span>
          </div>
        </header>
        <div class="acid-win__body py-10">
          <Empty description="桌面文件夹暂无外链或精选视频" />
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.acid-page {
  width: 100%;
  min-width: 0;
  color: var(--foreground);
  font-family: var(--vtsuru-page-font-family, 'JetBrains Mono', ui-monospace, monospace);
}

.acid-desktop {
  max-width: min(1320px, var(--vtsuru-page-max-width, 1320px));
  margin: 0 auto;
  padding: 16px 20px 80px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  container-type: inline-size;
}

.acid-desk-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 12px;
  font-family: var(--site-font-mono, ui-monospace, monospace);
  font-size: 11px;
  background: var(--card);
  border: 1.5px solid color-mix(in oklch, var(--primary) 45%, var(--border));
}

.acid-desk-strip__path {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.acid-desk-strip__tools {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.acid-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(0, 0.95fr);
  gap: 18px;
  align-items: start;
}

.acid-lower-stack {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* 复古窗口通用框架 */
.acid-win {
  position: relative;
  min-width: 0;
  background: var(--card);
  border: 2px solid color-mix(in oklch, var(--primary) 64%, var(--foreground));
  border-radius: 2px;
  box-shadow: 5px 5px 0 color-mix(in oklch, var(--primary) 55%, rgba(0, 0, 0, 0.85));
}

.acid-win__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 10px;
  background: var(--primary);
  color: var(--primary-foreground);
  border-bottom: 2px solid color-mix(in oklch, var(--primary) 64%, var(--foreground));
  user-select: none;
  cursor: grab;
}

.acid-win__bar:active {
  cursor: grabbing;
}

.acid-win__title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--site-font-pixel, var(--site-font-mono, monospace));
  font-size: 11px;
  font-weight: 700;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.acid-win__controls {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.acid-win__tag {
  padding: 1px 6px;
  font-family: var(--site-font-mono, monospace);
  font-size: 10px;
  font-weight: 800;
  background: color-mix(in oklch, var(--background) 85%, transparent);
  color: var(--foreground);
}

.acid-win__tag.is-live {
  background: #e11d48;
  color: #fff;
}

.acid-win__btn {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--background);
  color: var(--foreground);
  border: 1.5px solid color-mix(in oklch, var(--foreground) 70%, transparent);
  cursor: pointer;
}

.acid-win__body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 主窗口内容 */
.acid-banner {
  position: relative;
  height: 196px;
  border: 1.5px solid color-mix(in oklch, var(--foreground) 35%, transparent);
  overflow: hidden;
  background: var(--background);
}

.acid-banner__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.acid-banner__fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--site-font-pixel, monospace);
  font-size: 16px;
  color: var(--primary);
  background-image: repeating-linear-gradient(
    -45deg,
    color-mix(in oklch, var(--primary) 12%, transparent) 0 8px,
    transparent 8px 16px
  );
}

.acid-banner__chips {
  position: absolute;
  right: 8px;
  bottom: 8px;
  display: flex;
  gap: 6px;
}

.acid-chip {
  padding: 2px 7px;
  font-family: var(--site-font-mono, monospace);
  font-size: 10px;
  font-weight: 700;
  background: var(--background);
  color: var(--primary);
  border: 1px solid var(--primary);
}

.acid-profile-main {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  min-width: 0;
}

.acid-avatar {
  position: relative;
  flex-shrink: 0;
}

.acid-avatar__pendant {
  position: absolute;
  inset: -16%;
  width: 132%;
  height: 132%;
  object-fit: contain;
  pointer-events: none;
}

.acid-profile-copy {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.acid-name {
  margin: 0;
  font-size: clamp(1.5rem, 3vw, 2.3rem);
  font-weight: 800;
  line-height: 1.1;
  word-break: break-word;
}

.acid-sign {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--muted-foreground);
}

.acid-honor {
  display: inline-block;
  width: fit-content;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 700;
  color: var(--primary);
  border: 1px dashed var(--primary);
}

.acid-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 8px;
}

.acid-stats__cell {
  padding: 10px;
  border: 1.5px solid color-mix(in oklch, var(--foreground) 24%, transparent);
  background: var(--background);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.acid-stats__k {
  font-size: 9.5px;
  color: var(--primary);
  letter-spacing: 0.08em;
}

.acid-stats__v {
  font-size: 20px;
  font-weight: 800;
  line-height: 1.15;
}

.acid-stats__l {
  font-size: 11px;
  color: var(--muted-foreground);
}

.acid-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.acid-btn-primary,
.acid-btn-line {
  border-radius: 2px;
  border-width: 1.5px;
  box-shadow: 3px 3px 0 color-mix(in oklch, var(--foreground) 70%, transparent);
  transition: transform 140ms ease, box-shadow 140ms ease;
}

.acid-btn-primary:hover,
.acid-btn-line:hover {
  transform: translate(2px, 2px);
  box-shadow: 1px 1px 0 color-mix(in oklch, var(--foreground) 70%, transparent);
}

/* 公告终端窗口 */
.acid-notice-body {
  gap: 12px;
}

.acid-reserve-box {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  text-decoration: none;
  color: var(--foreground);
  background: color-mix(in oklch, var(--primary) 14%, var(--background));
  border: 1.5px solid var(--primary);
}

.acid-reserve-box__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 10.5px;
  font-weight: 700;
  color: var(--primary);
}

.acid-reserve-box__time {
  font-size: 12px;
  font-weight: 700;
}

.acid-reserve-box__title {
  font-size: 13px;
  line-height: 1.45;
}

.acid-terminal-log {
  padding: 12px;
  background: var(--background);
  border: 1.5px solid color-mix(in oklch, var(--foreground) 25%, transparent);
  font-family: var(--site-font-mono, monospace);
  font-size: 12.5px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.acid-terminal-log__line {
  color: var(--muted-foreground);
  font-size: 11px;
}

.acid-terminal-log__text {
  margin: 0;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
}

.acid-terminal-log__cursor {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--muted-foreground);
}

.acid-cursor-block {
  width: 7px;
  height: 13px;
  background: var(--primary);
  display: inline-block;
  animation: acidBlink 1s steps(2) infinite;
}

@keyframes acidBlink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* 外链与视频 */
.acid-links-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
}

.acid-shortcut {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 12px;
  text-decoration: none;
  color: var(--foreground);
  background: var(--background);
  border: 1.5px solid color-mix(in oklch, var(--foreground) 34%, transparent);
  box-shadow: 3px 3px 0 color-mix(in oklch, var(--primary) 50%, rgba(0, 0, 0, 0.75));
  transition: transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease;
}

.acid-shortcut:hover {
  border-color: var(--primary);
  transform: translate(2px, 2px);
  box-shadow: 1px 1px 0 color-mix(in oklch, var(--primary) 50%, rgba(0, 0, 0, 0.75));
}

.acid-shortcut__top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.acid-shortcut__idx {
  font-size: 10px;
  color: var(--primary);
  font-weight: 700;
}

.acid-shortcut__name {
  font-size: 14px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.acid-shortcut__host {
  font-size: 10.5px;
  color: var(--muted-foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.acid-video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 14px;
}

.acid-video-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  background: var(--background);
  border: 1.5px solid color-mix(in oklch, var(--foreground) 28%, transparent);
}

.acid-video-item__head {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  font-weight: 700;
  color: var(--muted-foreground);
}

@container (max-width: 860px) {
  .acid-grid {
    grid-template-columns: 1fr;
  }

  .acid-win__bar {
    cursor: default;
  }
}

@media (max-width: 640px) {
  .acid-desktop {
    padding: 12px 12px 72px;
    gap: 14px;
  }

  .acid-banner {
    height: 156px;
  }

  .acid-profile-main {
    flex-direction: column;
    gap: 12px;
  }

  .acid-actions > * {
    flex: 1 1 auto;
  }
}
</style>
