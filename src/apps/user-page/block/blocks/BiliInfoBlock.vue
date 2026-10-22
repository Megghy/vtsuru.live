<script setup lang="ts">
import { HomeOutline, PeopleOutline, PlayCircleOutline, VideocamOutline } from '@vicons/ionicons5'
import { computed } from 'vue'

import type { UserInfo } from '@/api/api-models'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'

import type { BiliProfileStatus } from '../../types'
import BlockCard from '../BlockCard.vue'
import { isBlockPropertyAvailable } from '../propertyCapabilities'

interface BlockConfig {
  variant?: 'card' | 'compact'
  showAvatar?: boolean
  showName?: boolean
  showSign?: boolean
  showStats?: boolean
  showButtons?: boolean
  showLiveRoom?: boolean
  spaceUrl?: string
  framed?: boolean
  backgrounded?: boolean
}

const props = defineProps<{
  blockProps: unknown
  userInfo?: UserInfo | undefined
  biliInfo?: any | undefined
  biliStatus?: BiliProfileStatus
}>()

const cfg = computed<BlockConfig>(() => {
  const o =
    props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps)
      ? (props.blockProps as any)
      : {}
  const variant = o.variant === 'compact' || o.variant === 'card' ? o.variant : 'card'
  return {
    variant,
    showAvatar: typeof o.showAvatar === 'boolean' ? o.showAvatar : true,
    showName: typeof o.showName === 'boolean' ? o.showName : true,
    showSign: typeof o.showSign === 'boolean' ? o.showSign : true,
    showStats: typeof o.showStats === 'boolean' ? o.showStats : true,
    showButtons: typeof o.showButtons === 'boolean' ? o.showButtons : true,
    showLiveRoom:
      isBlockPropertyAvailable('biliInfo', o, 'showLiveRoom') &&
      (typeof o.showLiveRoom !== 'boolean' || o.showLiveRoom),
    spaceUrl: isBlockPropertyAvailable('biliInfo', o, 'spaceUrl') && typeof o.spaceUrl === 'string' ? o.spaceUrl : '',
    framed: typeof o.framed === 'boolean' ? o.framed : true,
    backgrounded: typeof o.backgrounded === 'boolean' ? o.backgrounded : true,
  }
})

const model = computed(() => {
  const info = props.biliInfo ?? {}
  const name = typeof info?.name === 'string' ? info.name : typeof info?.uname === 'string' ? info.uname : ''
  const face = typeof info?.face === 'string' ? info.face : ''
  const sign = typeof info?.sign === 'string' ? info.sign : ''

  const fans = Number.isFinite(Number(info?.fans)) ? Number(info.fans) : null
  const following = Number.isFinite(Number(info?.attention))
    ? Number(info.attention)
    : Number.isFinite(Number(info?.friend))
      ? Number(info.friend)
      : null
  const videoCount = Number.isFinite(Number(info?.archive_count))
    ? Number(info.archive_count)
    : Number.isFinite(Number(info?.video))
      ? Number(info.video)
      : null

  const spaceUrl = cfg.value.spaceUrl?.trim().length
    ? cfg.value.spaceUrl.trim()
    : props.userInfo?.biliId
      ? `https://space.bilibili.com/${props.userInfo.biliId}`
      : ''
  const liveRoomUrl = props.userInfo?.biliRoomId ? `https://live.bilibili.com/${props.userInfo.biliRoomId}` : ''

  const biliId = props.userInfo?.biliId ?? null
  return { name, face, sign, fans, following, videoCount, spaceUrl, liveRoomUrl, biliId }
})

const hasContent = computed(() =>
  Boolean(
    model.value.name || model.value.face || model.value.biliId || model.value.spaceUrl || model.value.liveRoomUrl,
  ),
)
const displayStatus = computed(() => props.biliStatus ?? (hasContent.value ? 'ready' : 'empty'))
</script>

<template>
  <BlockCard
    :framed="cfg.framed"
    :backgrounded="cfg.backgrounded"
    :content-style="{ padding: 0 }"
  >
    <div
      v-if="displayStatus === 'idle' || displayStatus === 'loading'"
      class="bili-loading flex items-center gap-3 p-4 min-h-[92px]"
      role="status"
      aria-label="正在加载B站信息"
    >
      <Skeleton class="size-10.5 rounded-full shrink-0" />
      <div class="bili-loading__content flex-1 grid gap-2">
        <Skeleton class="h-4 w-2/5" />
        <Skeleton class="h-3 w-full" />
        <Skeleton class="h-3 w-4/5" />
      </div>
    </div>
    <Alert
      v-else-if="displayStatus === 'error'"
      variant="destructive"
      class="text-xs py-2 m-2"
    >
      <AlertDescription> B站信息加载失败，请稍后刷新页面重试 </AlertDescription>
    </Alert>
    <Alert
      v-else-if="displayStatus === 'empty' || !hasContent"
      class="text-xs py-2 m-2"
    >
      <AlertDescription> B站信息暂不可用 </AlertDescription>
    </Alert>
    <div
      v-else
      class="@container rounded-[var(--radius)] overflow-hidden"
    >
      <template v-if="cfg.variant === 'compact'">
        <div class="p-4">
          <div class="flex items-center justify-between gap-3 @max-[480px]:items-start @max-[480px]:flex-col">
            <div class="flex items-center gap-2.5 min-w-0">
              <Avatar
                v-if="cfg.showAvatar && model.face"
                class="size-8.5 rounded-full shrink-0 border border-border"
              >
                <AvatarImage
                  :src="model.face"
                  :alt="model.name || 'B站头像'"
                  referrerpolicy="no-referrer"
                  loading="lazy"
                  decoding="async"
                />
                <AvatarFallback>{{ (model.name || 'B').slice(0, 1) }}</AvatarFallback>
              </Avatar>
              <div class="bili-header-text min-w-0">
                <strong
                  v-if="cfg.showName && model.name"
                  class="bili-name text-sm font-semibold truncate block"
                >
                  {{ model.name }}
                </strong>
                <span class="bili-sub text-xs text-muted-foreground truncate block">
                  Bilibili
                  <template v-if="model.biliId"> · @{{ model.biliId }} </template>
                </span>
              </div>
            </div>

            <div
              v-if="cfg.showButtons"
              class="flex items-center gap-2 shrink-0 @max-[480px]:w-full @max-[480px]:flex-wrap @max-[480px]:[&>*]:flex-1 @max-[480px]:[&>*]:min-w-[110px]"
            >
              <Button
                v-if="model.spaceUrl"
                as="a"
                variant="outline"
                size="xs"
                class="font-medium"
                target="_blank"
                rel="noopener noreferrer"
                :href="model.spaceUrl"
                aria-label="打开B站主页（新窗口打开）"
              >
                <component
                  :is="HomeOutline"
                  class="size-3.5 mr-1"
                />
                主页
              </Button>
              <Button
                v-if="cfg.showLiveRoom && model.liveRoomUrl"
                as="a"
                variant="outline"
                size="xs"
                class="font-medium"
                target="_blank"
                rel="noopener noreferrer"
                :href="model.liveRoomUrl"
                aria-label="打开直播间（新窗口打开）"
              >
                <component
                  :is="PlayCircleOutline"
                  class="size-3.5 mr-1"
                />
                直播间
              </Button>
            </div>
          </div>

          <div
            v-if="cfg.showSign && model.sign"
            class="bili-compact-sign text-xs text-muted-foreground mt-2.5 whitespace-pre-wrap"
          >
            {{ model.sign }}
          </div>

          <div
            v-if="cfg.showStats"
            class="bili-stats compact mt-3 pt-3 border-t border-border flex items-center justify-around"
          >
            <div class="stat compact flex items-center gap-2">
              <component
                :is="PeopleOutline"
                class="size-3.5 text-muted-foreground"
              />
              <div class="stat-meta flex flex-col">
                <div class="stat-v text-xs font-bold">{{ model.fans ?? '--' }}</div>
                <div class="stat-k text-[11px] text-muted-foreground">粉丝</div>
              </div>
            </div>
            <div class="stat compact flex items-center gap-2">
              <component
                :is="HomeOutline"
                class="size-3.5 text-muted-foreground"
              />
              <div class="stat-meta flex flex-col">
                <div class="stat-v text-xs font-bold">{{ model.following ?? '--' }}</div>
                <div class="stat-k text-[11px] text-muted-foreground">关注</div>
              </div>
            </div>
            <div class="stat compact flex items-center gap-2">
              <component
                :is="VideocamOutline"
                class="size-3.5 text-muted-foreground"
              />
              <div class="stat-meta flex flex-col">
                <div class="stat-v text-xs font-bold">{{ model.videoCount ?? '--' }}</div>
                <div class="stat-k text-[11px] text-muted-foreground">视频</div>
              </div>
            </div>
          </div>
        </div>
      </template>

      <template v-else>
        <div class="bili-header p-3.5">
          <div class="flex items-center gap-2.5 min-w-0">
            <Avatar
              v-if="cfg.showAvatar && model.face"
              class="size-10 rounded-full shrink-0 border border-border"
            >
              <AvatarImage
                :src="model.face"
                :alt="model.name || 'B站头像'"
                referrerpolicy="no-referrer"
                loading="lazy"
                decoding="async"
              />
              <AvatarFallback>{{ (model.name || 'B').slice(0, 1) }}</AvatarFallback>
            </Avatar>
            <div class="bili-header-text min-w-0">
              <strong
                v-if="cfg.showName && model.name"
                class="bili-name text-base font-semibold truncate block"
              >
                {{ model.name }}
              </strong>
              <span class="bili-sub text-xs text-muted-foreground truncate block">
                Bilibili
                <template v-if="model.biliId"> · @{{ model.biliId }} </template>
              </span>
            </div>
          </div>
        </div>

        <div
          v-if="cfg.showSign && model.sign"
          class="bili-sign px-4 pb-4 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed"
        >
          {{ model.sign }}
        </div>

        <div
          v-if="cfg.showStats"
          class="bili-stats grid grid-cols-3 py-2 border-y border-border"
        >
          <div class="stat flex flex-col items-center gap-1 p-2 text-center">
            <component
              :is="PeopleOutline"
              class="size-4 text-muted-foreground"
            />
            <div class="stat-meta flex flex-col-reverse items-center">
              <div class="stat-k text-[11px] text-muted-foreground">粉丝</div>
              <div class="stat-v text-sm font-bold">{{ model.fans ?? '--' }}</div>
            </div>
          </div>
          <div class="stat flex flex-col items-center gap-1 p-2 text-center">
            <component
              :is="HomeOutline"
              class="size-4 text-muted-foreground"
            />
            <div class="stat-meta flex flex-col-reverse items-center">
              <div class="stat-k text-[11px] text-muted-foreground">关注</div>
              <div class="stat-v text-sm font-bold">{{ model.following ?? '--' }}</div>
            </div>
          </div>
          <div class="stat flex flex-col items-center gap-1 p-2 text-center">
            <component
              :is="VideocamOutline"
              class="size-4 text-muted-foreground"
            />
            <div class="stat-meta flex flex-col-reverse items-center">
              <div class="stat-k text-[11px] text-muted-foreground">视频</div>
              <div class="stat-v text-sm font-bold">{{ model.videoCount ?? '--' }}</div>
            </div>
          </div>
        </div>

        <div
          v-if="cfg.showButtons"
          class="p-4 grid grid-cols-2 gap-3 @max-[480px]:grid-cols-1 @max-[480px]:p-3.5"
        >
          <Button
            v-if="model.spaceUrl"
            as="a"
            variant="outline"
            class="font-semibold"
            target="_blank"
            rel="noopener noreferrer"
            :href="model.spaceUrl"
            aria-label="打开B站主页（新窗口打开）"
          >
            <component
              :is="HomeOutline"
              class="size-3.5 mr-1.5"
            />
            主页
          </Button>
          <Button
            v-if="cfg.showLiveRoom && model.liveRoomUrl"
            as="a"
            variant="outline"
            class="font-semibold"
            target="_blank"
            rel="noopener noreferrer"
            :href="model.liveRoomUrl"
            aria-label="打开直播间（新窗口打开）"
          >
            <component
              :is="PlayCircleOutline"
              class="size-3.5 mr-1.5"
            />
            直播间
          </Button>
        </div>
      </template>
    </div>
  </BlockCard>
</template>


