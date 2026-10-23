<script lang="ts" setup>
import {
  ArrowUpOutline,
  CalendarOutline,
  ColorPaletteOutline,
  PlayOutline,
  RadioOutline,
  SparklesOutline,
} from '@vicons/ionicons5'
import { computed, ref } from 'vue'

import { useAccount } from '@/api/account'
import type { ResponseUserIndexModel, ResponseUserInfo } from '@/api/generated/model'
import { getApiUserIndexGet } from '@/api/generated/user-index/user-index'
import type { BiliProfile } from '@/apps/user-page/types'
import SimpleVideoCard from '@/components/SimpleVideoCard.vue'
import type { ExtractConfigData } from '@/shared/types/VTsuruConfigTypes'
import { defineTemplateConfig } from '@/shared/types/VTsuruConfigTypes'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'
import { Button } from '@/shared/ui/button'
import { Empty } from '@/shared/ui/empty'
import { Spin } from '@/shared/ui/spin'
import { toast } from '@/shared/utils'
import { formatBiliLiveReserveTime } from '@/shared/utils/formatBiliLiveReserve'
import BilibiliIcon from '@/svgs/social/bilibili.svg?component'

const props = defineProps<{
  userInfo: ResponseUserInfo | undefined
  biliInfo: BiliProfile | undefined
}>()
defineExpose({ Config, DefaultConfig })

const accountInfo = useAccount()
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
  const order = accountInfo.value?.settings?.index?.linkOrder
  if (!order?.length) return entries
  const map = new Map(entries)
  return order.filter((key) => map.has(key)).map((key) => [key, map.get(key)!]) as [string, string][]
})

async function loadIndexInfo() {
  try {
    const data = (await getApiUserIndexGet({
      id: props.userInfo?.name,
    })) as unknown as {
      code: number
      message?: string
      data: ResponseUserIndexModel
    }
    if (data.code === 200) indexInfo.value = data.data
    else if (data.code !== 404) toast.error(`无法获取主页数据: ${data.message}`)
  } catch (error) {
    toast.error(`无法获取主页数据: ${error}`)
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
  <div class="index-template relative">
    <div
      v-if="isLoading"
      class="py-24 flex justify-center"
    >
      <Spin />
    </div>
    <div v-else>
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
              class="portrait-frame relative flex items-center justify-center"
            >
              <Avatar class="size-36 rounded-full border-4 border-background shadow-md">
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
                class="portrait-frame__overlay"
                referrerpolicy="no-referrer"
                @error="showAvatarFrame = false"
              />
              <span
                v-if="isStreaming"
                class="live-mark"
              >
                <component
                  :is="RadioOutline"
                  class="size-3.5 inline mr-1"
                />
                LIVE
              </span>
              <span
                v-else-if="liveReserve"
                class="live-mark live-mark--reserve"
              >
                <component
                  :is="CalendarOutline"
                  class="size-3.5 inline mr-1"
                />
                预告
              </span>
            </div>

            <div class="profile-actions">
              <Button
                v-if="isOwner"
                variant="outline"
                size="lg"
                class="flex items-center gap-2"
                @click="$router.push({ name: 'manage-userPageBuilder' })"
              >
                <component
                  :is="ColorPaletteOutline"
                  class="size-4"
                />
                主页装修
              </Button>
              <Button
                v-if="props.userInfo?.biliId"
                variant="outline"
                size="lg"
                class="profile-action profile-action--secondary flex items-center gap-2"
                @click="navigate(`https://space.bilibili.com/${props.userInfo.biliId}`)"
              >
                <component
                  :is="BilibiliIcon"
                  class="size-4"
                />
                <span class="bili-action__label">B 站主页</span>
              </Button>
              <Button
                v-if="props.userInfo?.biliRoomId"
                size="lg"
                class="profile-action profile-action--primary flex items-center gap-2"
                @click="navigate(`https://live.bilibili.com/${props.userInfo.biliRoomId}`)"
              >
                <component
                  :is="RadioOutline"
                  class="size-4"
                />
                进入直播间
              </Button>
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
              >
                正在直播
              </span>
              <span
                v-else-if="liveReserve"
                class="meta-tag meta-reserve"
              >
                下次 {{ formatBiliLiveReserveTime(liveReserve.planStart) }}
              </span>
              <span
                v-if="level"
                class="meta-tag"
              >
                LV{{ level }}
              </span>
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
                <strong>{{ item.text }}</strong>
                <span>{{ item.label }}</span>
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
        <component
          :is="CalendarOutline"
          class="size-4 inline mr-1"
        />
        <span>下次直播 {{ liveReserveLabel }}</span>
        <em>打开直播间</em>
      </a>
      <section
        v-else-if="!isStreaming && liveReserve"
        class="notice-strip notice-strip--reserve"
      >
        <component
          :is="CalendarOutline"
          class="size-4 inline mr-1"
        />
        <span>下次直播 {{ liveReserveLabel }}</span>
      </section>
      <section
        v-if="indexInfo.notification"
        class="notice-strip"
      >
        <component
          :is="SparklesOutline"
          class="size-4 inline mr-1"
        />
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
                <span>{{ link[0] }}</span>
                <component
                  :is="ArrowUpOutline"
                  class="size-3.5 inline"
                />
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
                <span class="video-item__label">
                  <component
                    :is="PlayOutline"
                    class="size-3.5 inline mr-1"
                  />
                  {{ video.title }}
                </span>
              </div>
            </div>
          </section>
        </div>

        <Empty
          v-else
          description="主页内容正在准备中"
          class="empty-state py-12"
        />
      </main>
    </div>
  </div>
</template>

<style scoped>
@import './defaultIndexTemplate.css';
</style>
