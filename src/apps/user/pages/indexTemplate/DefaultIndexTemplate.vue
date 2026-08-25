<script lang="ts" setup>
import {
  ArrowUpOutline,
  CalendarOutline,
  PlayOutline,
  RadioOutline,
  SettingsOutline,
  SparklesOutline,
} from '@vicons/ionicons5'
import { NAvatar, NButton, NEmpty, NIcon, NSpin, useMessage } from 'naive-ui'
import { computed, ref } from 'vue'

import { useAccount } from '@/api/account'
import type { ResponseUserIndexModel, UserInfo } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import SimpleVideoCard from '@/components/SimpleVideoCard.vue'
import { USER_INDEX_API_URL } from '@/shared/config'
import { formatBiliLiveReserveTime } from '@/shared/utils/formatBiliLiveReserve'
import type { ExtractConfigData } from '@/shared/types/VTsuruConfigTypes'
import { defineTemplateConfig } from '@/shared/types/VTsuruConfigTypes'
import BilibiliIcon from '@/svgs/social/bilibili.svg?component'

import type { BiliProfile } from '@/apps/user-page/types'

const props = defineProps<{
  userInfo: UserInfo | undefined
  biliInfo: BiliProfile | undefined
}>()
defineExpose({ Config, DefaultConfig })

const accountInfo = useAccount()
const message = useMessage()
const isLoading = ref(true)
const showHeaderImage = ref(true)
const showAvatarFrame = ref(true)
const indexInfo = ref<ResponseUserIndexModel>({ links: {}, videos: [], notification: '' })

// 未绑定 B 站时不展示头像（避免占位空头像）
const hasBiliBinding = computed(() => !!props.userInfo?.biliId)
const avatar = computed(() => {
  if (!hasBiliBinding.value) return ''
  return props.userInfo?.streamerInfo?.faceUrl || props.userInfo?.faceUrl || props.biliInfo?.face || ''
})
const headerImage = computed(
  () => props.biliInfo?.top_photo || props.biliInfo?.top_photo_v2 || props.userInfo?.streamerInfo?.coverUrl || '',
)
const avatarFrame = computed(() => {
  if (!hasBiliBinding.value) return ''
  return (
    props.biliInfo?.pendant?.image_enhance_frame ||
    props.biliInfo?.pendant?.image_enhance ||
    props.biliInfo?.pendant?.image ||
    ''
  )
})
const nameplateText = computed(() => props.biliInfo?.nameplate?.name || '')
const honorText = computed(
  () =>
    props.biliInfo?.Official?.title ||
    props.biliInfo?.Official?.desc ||
    props.biliInfo?.official?.title ||
    props.biliInfo?.official?.desc ||
    props.biliInfo?.official_verify?.desc ||
    props.biliInfo?.vip?.label?.text ||
    '',
)
const level = computed(() => props.biliInfo?.level_info?.current_level ?? props.biliInfo?.level ?? '')
const streamerName = computed(
  () => props.userInfo?.streamerInfo?.name || props.biliInfo?.name || props.userInfo?.name || '未命名主播',
)
const signature = computed(
  () => props.biliInfo?.sign || props.userInfo?.streamerInfo?.title || '在自己的频道里，认真生活，尽兴直播。',
)
const nameSizeClass = computed(() => {
  const width = Array.from(String(streamerName.value)).reduce(
    (total, char) => total + ((char.codePointAt(0) ?? 0) <= 0xff ? 1 : 2),
    0,
  )
  if (width > 24) return 'is-long'
  if (width > 14) return 'is-medium'
  return ''
})
const isOwner = computed(() => props.userInfo?.id === accountInfo.value?.id)
const isStreaming = computed(() => props.userInfo?.streamerInfo?.isStreaming === true)
const liveReserve = computed(() => props.userInfo?.liveReserve)
const liveReserveLabel = computed(() => {
  if (!liveReserve.value) return ''
  return `${formatBiliLiveReserveTime(liveReserve.value.planStart)} · ${liveReserve.value.title}`
})

function formatCount(value: number) {
  return value >= 10000 ? `${(value / 10000).toFixed(1)}万` : value.toLocaleString()
}

const profileStats = computed(() => {
  const values = [
    { label: '关注者', value: props.biliInfo?.fans ?? props.biliInfo?.follower ?? props.biliInfo?.follower_count },
    { label: '投稿', value: props.biliInfo?.archive_count ?? props.biliInfo?.video },
    { label: '获赞', value: props.biliInfo?.likes ?? props.biliInfo?.like_num },
  ]
  return values
    .filter((item): item is { label: string; value: number } => typeof item.value === 'number' && item.value > 0)
    .map((item) => ({ ...item, text: formatCount(item.value) }))
})

const orderedLinks = computed(() => {
  const entries = Object.entries(indexInfo.value.links || {})
  const order = accountInfo.value?.settings?.index?.linkOrder || indexInfo.value.linkOrder
  if (!order?.length) return entries
  const map = new Map(entries)
  return order.filter((key) => map.has(key)).map((key) => [key, map.get(key)!]) as [string, string][]
})

async function loadIndexInfo() {
  try {
    const data = await QueryGetAPI<ResponseUserIndexModel>(`${USER_INDEX_API_URL}get`, { id: props.userInfo?.name })
    if (data.code === 200) indexInfo.value = data.data
    else if (data.code !== 404) message.error(`无法获取主页数据: ${data.message}`)
  } catch (error) {
    message.error(`无法获取主页数据: ${error}`)
  } finally {
    isLoading.value = false
  }
}

function navigate(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

void loadIndexInfo()
</script>

<script lang="ts">
export type ConfigType = ExtractConfigData<typeof Config>
export const DefaultConfig = {} as ConfigType
export const Config = defineTemplateConfig([])
</script>

<template>
  <div class="index-template">
    <NSpin :show="isLoading">
      <header class="profile-header">
        <div class="profile-banner">
          <img
            v-if="headerImage && showHeaderImage"
            :src="headerImage"
            alt=""
            class="profile-banner__image"
            referrerpolicy="no-referrer"
            @error="showHeaderImage = false"
          />
        </div>

        <div class="profile-summary">
          <div
            class="profile-hub"
            :class="{ 'profile-hub--no-avatar': !avatar }"
          >
            <div
              v-if="avatar"
              class="portrait-frame"
            >
              <NAvatar
                :src="avatar"
                :size="156"
                round
                :img-props="{ referrerpolicy: 'no-referrer' }"
              />
              <img
                v-if="avatarFrame && showAvatarFrame"
                :src="avatarFrame"
                alt=""
                class="portrait-frame__overlay"
                referrerpolicy="no-referrer"
                @error="showAvatarFrame = false"
              />
              <span
                v-if="isStreaming"
                class="live-mark"
                ><NIcon :component="RadioOutline" /> LIVE</span
              >
              <span
                v-else-if="liveReserve"
                class="live-mark live-mark--reserve"
                ><NIcon :component="CalendarOutline" /> 预告</span
              >
            </div>

            <div class="profile-actions">
              <NButton
                v-if="isOwner"
                quaternary
                size="large"
                @click="$router.push({ name: 'manage-userPageBuilder' })"
              >
                <template #icon><NIcon :component="SettingsOutline" /></template>
                编辑主页
              </NButton>
              <NButton
                v-if="props.userInfo?.biliId"
                size="large"
                secondary
                class="profile-action profile-action--secondary"
                @click="navigate(`https://space.bilibili.com/${props.userInfo.biliId}`)"
              >
                <span class="bili-action__label">B 站主页</span>
                <template #icon><NIcon :component="BilibiliIcon" /></template>
              </NButton>
              <NButton
                v-if="props.userInfo?.biliRoomId"
                type="primary"
                size="large"
                class="profile-action profile-action--primary"
                @click="navigate(`https://live.bilibili.com/${props.userInfo.biliRoomId}`)"
              >
                <template #icon><NIcon :component="RadioOutline" /></template>
                进入直播间
              </NButton>
            </div>
          </div>

          <div class="identity">
            <p class="identity__kicker">VTsuru / {{ props.userInfo?.name || 'CHANNEL' }}</p>
            <h1 :class="nameSizeClass">{{ streamerName }}</h1>
            <div class="identity__meta">
              <span
                v-if="props.userInfo?.streamerInfo?.uId"
                class="meta-tag"
              >
                UID {{ props.userInfo.streamerInfo.uId }}
              </span>
              <span
                v-if="props.userInfo?.streamerInfo?.area"
                class="meta-tag"
              >
                {{ props.userInfo.streamerInfo.area }}
              </span>
              <span
                v-if="isStreaming"
                class="meta-tag meta-live"
                >正在直播</span
              >
              <span
                v-else-if="liveReserve"
                class="meta-tag meta-reserve"
                >下次 {{ formatBiliLiveReserveTime(liveReserve.planStart) }}</span
              >
              <span
                v-if="level"
                class="meta-tag"
                >LV{{ level }}</span
              >
              <span
                v-if="honorText || nameplateText"
                class="meta-tag meta-honor"
              >
                {{ honorText || nameplateText }}
              </span>
            </div>
            <p class="identity__sign">{{ signature }}</p>

            <div
              v-if="profileStats.length"
              class="profile-stats"
            >
              <div
                v-for="item in profileStats"
                :key="item.label"
              >
                <strong>{{ item.text }}</strong
                ><span>{{ item.label }}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <a
        v-if="!isStreaming && liveReserve && props.userInfo?.biliRoomId"
        class="notice-strip notice-strip--reserve"
        :href="`https://live.bilibili.com/${props.userInfo.biliRoomId}`"
        target="_blank"
        rel="noopener noreferrer"
      >
        <NIcon :component="CalendarOutline" />
        <span>下次直播 {{ liveReserveLabel }}</span>
        <em>打开直播间</em>
      </a>
      <section
        v-else-if="!isStreaming && liveReserve"
        class="notice-strip notice-strip--reserve"
      >
        <NIcon :component="CalendarOutline" />
        <span>下次直播 {{ liveReserveLabel }}</span>
      </section>
      <section
        v-if="indexInfo.notification"
        class="notice-strip"
      >
        <NIcon :component="SparklesOutline" />
        <span>{{ indexInfo.notification }}</span>
      </section>

      <main class="main-content">
        <div
          v-if="orderedLinks.length || indexInfo.videos?.length"
          class="content-grid"
        >
          <section
            v-if="orderedLinks.length"
            class="content-section links-section"
          >
            <div class="section-heading">
              <div>
                <span class="section-index">01</span>
                <h2>找到我</h2>
              </div>
              <span>LINKS / {{ orderedLinks.length.toString().padStart(2, '0') }}</span>
            </div>
            <div class="link-list">
              <a
                v-for="link in orderedLinks"
                :key="link[0]"
                :href="link[1]"
                target="_blank"
                rel="noreferrer"
                class="link-tile"
              >
                <span>{{ link[0] }}</span
                ><NIcon :component="ArrowUpOutline" />
              </a>
            </div>
          </section>

          <section
            v-if="indexInfo.videos?.length"
            class="content-section videos-section"
          >
            <div class="section-heading">
              <div>
                <span class="section-index">02</span>
                <h2>精选片段</h2>
              </div>
              <span>WATCH / {{ indexInfo.videos.length.toString().padStart(2, '0') }}</span>
            </div>
            <div class="video-grid">
              <div
                v-for="video in indexInfo.videos"
                :key="video.id"
                class="video-item"
              >
                <SimpleVideoCard :video="video" />
                <span class="video-item__label"><NIcon :component="PlayOutline" /> {{ video.title }}</span>
              </div>
            </div>
          </section>
        </div>

        <NEmpty
          v-else
          size="small"
          description="主页内容正在准备中"
          class="empty-state"
        />
      </main>
    </NSpin>
  </div>
</template>

<style scoped>
.index-template {
  --index-fg: var(--vtsuru-surface-fg, var(--vtsuru-page-text, var(--vtsuru-fg)));
  --index-muted: var(--vtsuru-surface-fg-muted, var(--vtsuru-fg-muted));
  --index-subtle: var(--vtsuru-surface-fg-subtle, var(--vtsuru-fg-muted));
  --index-bg: var(--vtsuru-page-content-color, var(--vtsuru-bg));
  --index-card: var(--vtsuru-page-card-bg, color-mix(in srgb, var(--index-bg) 90%, var(--vtsuru-page-primary) 10%));
  --index-accent: var(--vtsuru-page-primary, var(--vtsuru-brand));
  --index-border: var(--vtsuru-card-border-color, var(--vtsuru-border));
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: 0 0 64px;
  color: var(--index-fg);
  font-family: var(--vtsuru-page-font-family, 'Noto Sans SC', 'Microsoft YaHei', sans-serif);
}
.profile-header {
  min-width: 0;
}
.profile-banner {
  position: relative;
  height: 300px;
  overflow: hidden;
  background: color-mix(in srgb, var(--index-card) 82%, var(--index-accent) 18%);
}
.profile-banner::after {
  content: '';
  position: absolute;
  inset: auto 0 0;
  height: 24%;
  background: linear-gradient(to bottom, transparent, var(--index-bg));
  pointer-events: none;
}
.profile-banner__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}
.profile-summary {
  width: min(100%, 1120px);
  min-width: 0;
  margin: 0 auto;
  padding: 0 clamp(28px, 5vw, 72px) 44px;
  box-sizing: border-box;
}
.profile-hub {
  display: flex;
  min-width: 0;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
}
.profile-hub--no-avatar {
  justify-content: flex-end;
  min-height: 0;
}
.profile-hub--no-avatar .profile-actions {
  padding-top: 16px;
  padding-bottom: 4px;
}
.portrait-frame {
  position: relative;
  display: grid;
  place-items: center;
  width: 168px;
  height: 168px;
  flex: none;
  margin-top: -84px;
  border: 6px solid var(--index-bg);
  border-radius: 50%;
  background: var(--index-bg);
  box-shadow: 0 16px 36px color-mix(in srgb, var(--index-fg) 16%, transparent);
}
.portrait-frame :deep(.n-avatar) {
  display: block;
  z-index: 1;
}
.portrait-frame__overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 2;
  width: 138%;
  height: 138%;
  object-fit: contain;
  transform: translate(-50%, -50%);
  pointer-events: none;
}
.live-mark {
  position: absolute;
  z-index: 3;
  right: -9px;
  bottom: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 999px;
  background: #f0445d;
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0;
}
.live-mark--reserve {
  background: #fb7299;
}
.profile-actions {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  padding-bottom: 12px;
}
.profile-action--secondary :deep(svg) {
  color: #fb7299;
  fill: #fb7299;
}
.bili-action__label {
  color: #fb7299;
}
.identity {
  min-width: 0;
  margin-top: 26px;
}
.profile-hub--no-avatar + .identity {
  margin-top: 12px;
}
.identity__kicker {
  margin: 0 0 10px;
  overflow: hidden;
  color: var(--index-subtle);
  font-size: 12px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: 0;
  text-transform: uppercase;
}
.identity h1 {
  display: -webkit-box;
  max-width: 100%;
  overflow: hidden;
  margin: 0;
  color: var(--index-fg);
  font-size: 72px;
  font-weight: 800;
  line-height: 1.04;
  letter-spacing: 0;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.identity h1.is-medium {
  font-size: 58px;
}
.identity h1.is-long {
  font-size: 46px;
}
.identity__meta {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 18px;
}
.meta-tag {
  display: inline-flex;
  min-width: 0;
  min-height: 26px;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--vtsuru-page-primary-soft, color-mix(in srgb, var(--index-accent) 10%, transparent));
  color: var(--index-accent);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.3;
  overflow-wrap: anywhere;
}
.meta-live {
  background: color-mix(in srgb, #f0445d 10%, var(--index-bg));
  color: #f0445d;
  font-weight: 700;
}
.meta-reserve {
  background: color-mix(in srgb, #fb7299 12%, var(--index-bg));
  color: #fb7299;
  font-weight: 700;
}
.notice-strip--reserve {
  border-left-color: #fb7299;
  background: color-mix(in srgb, #fb7299 9%, var(--index-bg));
}
.notice-strip--reserve :deep(.n-icon) {
  color: #fb7299;
}
a.notice-strip--reserve {
  color: inherit;
  text-decoration: none;
  cursor: pointer;
}
a.notice-strip--reserve:hover {
  background: color-mix(in srgb, #fb7299 14%, var(--index-bg));
}
.notice-strip em {
  margin-left: auto;
  color: #fb7299;
  font-size: 12px;
  font-style: normal;
  font-weight: 650;
  white-space: nowrap;
}
.meta-honor {
  color: var(--index-accent);
  font-weight: 650;
}
.identity__sign {
  display: -webkit-box;
  max-width: 72ch;
  overflow: hidden;
  margin: 22px 0 0;
  color: var(--index-muted);
  font-size: 14px;
  line-height: 1.6;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}
.profile-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 24px;
  margin-top: 24px;
}
.profile-stats div {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
}
.profile-stats strong {
  color: var(--index-fg);
  font-size: 17px;
  font-weight: 750;
}
.profile-stats span {
  color: var(--index-subtle);
  font-size: 12px;
}
.notice-strip {
  display: flex;
  align-items: center;
  gap: 10px;
  width: min(100%, 1120px);
  margin: 18px auto 0;
  padding: 13px 16px;
  box-sizing: border-box;
  border-left: 3px solid var(--index-accent);
  background: color-mix(in srgb, var(--index-accent) 9%, var(--index-bg));
  color: var(--index-muted);
  font-size: 13px;
  line-height: 1.5;
}
.notice-strip :deep(.n-icon) {
  flex: none;
  color: var(--index-accent);
}
.notice-strip span {
  min-width: 0;
  flex: 1;
}
.main-content {
  width: min(100%, 1120px);
  min-width: 0;
  margin: 34px auto 0;
  padding: 34px clamp(28px, 5vw, 72px) 0;
  box-sizing: border-box;
  border-top: 1px solid color-mix(in srgb, var(--index-border) 70%, transparent);
}
.content-grid {
  display: grid;
  grid-template-columns: minmax(180px, 0.72fr) minmax(0, 1.28fr);
  gap: clamp(18px, 3vw, 32px);
}
.content-section {
  min-width: 0;
}
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--index-border);
}
.section-heading > div {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.section-heading h2 {
  margin: 0;
  color: var(--index-fg);
  font-size: 18px;
  font-weight: 650;
}
.section-heading > span {
  color: var(--index-subtle);
  font-size: 10px;
  letter-spacing: 0;
}
.section-index {
  color: var(--index-accent);
  font-size: 11px;
  font-weight: 800;
}
.link-list {
  display: grid;
  gap: 8px;
  margin-top: 14px;
}
.link-tile {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 13px 14px;
  border: 1px solid var(--index-border);
  border-radius: var(--vtsuru-page-radius, 8px);
  background: var(--index-card);
  color: var(--index-fg);
  font-size: 13px;
  text-decoration: none;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    background 0.2s ease;
}
.link-tile:hover {
  border-color: var(--index-accent);
  background: color-mix(in srgb, var(--index-card) 85%, var(--index-accent) 15%);
  transform: translateX(4px);
}
.link-tile :deep(.n-icon) {
  flex: none;
  color: var(--index-accent);
}
.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
  margin-top: 14px;
}
.video-item {
  min-width: 0;
}
.video-item :deep(.simple-video-card) {
  width: 100%;
}
.video-item__label {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: 5px;
  margin-top: 8px;
  color: var(--index-muted);
  font-size: 12px;
  line-height: 1.45;
}
.video-item__label :deep(.n-icon) {
  flex: none;
  margin-top: 2px;
  color: var(--index-accent);
}
.empty-state {
  padding: 12px 0 22px;
  opacity: 0.38;
}
.empty-state :deep(.n-empty__icon) {
  width: 30px;
  height: 30px;
}
.empty-state :deep(.n-empty__description) {
  margin-top: 7px;
  font-size: 12px;
}
@media (max-width: 720px) {
  .profile-banner {
    height: 220px;
  }
  .profile-summary {
    padding-inline: 24px;
  }
  .profile-hub {
    align-items: flex-end;
  }
  .portrait-frame {
    width: 138px;
    height: 138px;
    margin-top: -69px;
  }
  .portrait-frame :deep(.n-avatar) {
    width: 126px !important;
    height: 126px !important;
  }
  .portrait-frame__overlay {
    width: 138%;
    height: 138%;
  }
  .profile-actions {
    max-width: 58%;
  }
  .content-grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 480px) {
  .index-template {
    padding-bottom: 44px;
  }
  .profile-banner {
    height: 180px;
  }
  .profile-summary {
    padding: 0 18px 32px;
  }
  .profile-hub {
    align-items: flex-end;
    gap: 12px;
  }
  .portrait-frame {
    width: 116px;
    height: 116px;
    margin-top: -58px;
    border-width: 6px;
  }
  .portrait-frame :deep(.n-avatar) {
    width: 104px !important;
    height: 104px !important;
  }
  .portrait-frame__overlay {
    width: 138%;
    height: 138%;
  }
  .live-mark {
    right: -8px;
    bottom: 5px;
  }
  .profile-actions {
    max-width: none;
    flex: 1;
  }
  .profile-actions :deep(.n-button) {
    width: 100%;
  }
  .profile-actions :deep(.n-button:first-child:last-child) {
    width: auto;
  }
  .identity {
    margin-top: 18px;
  }
  .identity h1 {
    font-size: 42px;
  }
  .identity h1.is-medium {
    font-size: 38px;
  }
  .identity h1.is-long {
    font-size: 32px;
  }
  .identity__sign {
    max-width: 100%;
  }
  .main-content {
    margin-top: 26px;
    padding: 26px 18px 0;
  }
  .notice-strip {
    width: calc(100% - 36px);
  }
}
</style>
