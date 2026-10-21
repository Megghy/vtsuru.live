<script setup lang="ts">
import { Box24Regular, Money24Regular, VehicleShip24Filled } from '@vicons/fluent'
import { format } from 'date-fns'
import { computed } from 'vue'

import type { AccountInfo, DanmakuModel } from '@/api/api-models'
import { EventDataTypes } from '@/api/api-models'
import { getDanmakuGiftDisplayMeta } from '@/shared/utils/danmakuGiftDisplay'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Tag } from '@/shared/ui/tag'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

const {
  danmaku,
  accountInfo,
  height = 30,
  showName = true,
  showAvatar = true,
} = defineProps<{
  danmaku: DanmakuModel
  accountInfo: AccountInfo | undefined
  showName?: boolean
  showAvatar?: boolean
  height?: number
}>()
defineEmits<{
  (e: 'onClickName', uId: number, ouId: string): void
}>()
function GetSCColor(price: number): string {
  if (price === 0) return `#2a60b2`
  if (price > 0 && price < 30) return `#2a60b2`
  if (price >= 30 && price < 50) return `#2a60b2`
  if (price >= 50 && price < 100) return `#427d9e`
  if (price >= 100 && price < 500) return `#c99801`
  if (price >= 500 && price < 1000) return `#e09443`
  if (price >= 1000 && price < 2000) return `#e54d4d`
  if (price >= 2000) return `#ab1a32`
  return ''
}
function GetGuardColor(price: number | null | undefined): string {
  if (price) {
    if (price < 138) return ''
    if (price >= 138 && price < 1598) return 'rgb(104, 136, 241)'
    if (price >= 1598 && price < 15998) return 'rgb(157, 155, 255)'
    if (price >= 15998) return 'rgb(122, 4, 35)'
  }
  return ''
}

const giftDisplay = computed(() => getDanmakuGiftDisplayMeta(danmaku))
</script>

<template>
  <Card
    v-if="danmaku.type === EventDataTypes.SC"
    :style="`margin: 4px 0; max-width: 540px; background-color: ${GetSCColor(danmaku.price ?? 0)};`"
    class="rounded-md border-0 text-white overflow-hidden shadow-sm"
  >
    <div class="px-2.5 py-1.5 bg-white/15 text-xs flex items-center gap-2">
      <TooltipProvider v-if="danmaku.uId > 0 && showAvatar">
        <Tooltip>
          <TooltipTrigger as-child>
            <img
              :src="`https://workers.vrp.moe/api/bilibili/avatar/${danmaku.uId}?size=24`"
              alt="头像"
              referrerpolicy="no-referrer"
              class="w-5 h-5 rounded-full object-cover shrink-0 cursor-pointer"
              loading="lazy"
            />
          </TooltipTrigger>
          <TooltipContent>
            <img
              :src="`https://workers.vrp.moe/api/bilibili/avatar/${danmaku.uId}?size=1024`"
              alt="头像"
              referrerpolicy="no-referrer"
              class="max-w-[120px] max-h-[120px] rounded"
              loading="lazy"
            />
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <span class="text-[11px] opacity-80 font-mono">
        {{ format(danmaku.time, 'HH:mm:ss') }}
      </span>

      <button
        v-if="showName"
        type="button"
        class="font-medium hover:underline text-xs cursor-pointer truncate max-w-[160px]"
        @click="$emit('onClickName', danmaku.uId, danmaku.ouId)"
      >
        <span v-if="danmaku.uId === accountInfo?.biliId" class="bg-amber-500/80 px-1 py-0.5 rounded text-[10px]">
          {{ danmaku.uName }}
        </span>
        <span v-else>{{ danmaku.uName }}</span>
      </button>

      <span class="ml-auto bg-black/25 px-1.5 py-0.5 rounded text-[11px] font-bold">
        ¥{{ danmaku.price }}
      </span>
    </div>
    <div class="px-2.5 py-2 text-xs leading-relaxed min-h-[36px] flex items-center">
      {{ danmaku.msg }}
    </div>
  </Card>

  <div
    v-else
    class="danmaku-inline-row"
  >
    <!-- 1. 头像 -->
    <TooltipProvider v-if="danmaku.uId > 0 && showAvatar">
      <Tooltip>
        <TooltipTrigger as-child>
          <img
            :src="`https://workers.vrp.moe/api/bilibili/avatar/${danmaku.uId}?size=22`"
            alt="头像"
            referrerpolicy="no-referrer"
            class="danmaku-avatar"
          />
        </TooltipTrigger>
        <TooltipContent>
          <img
            :src="`https://workers.vrp.moe/api/bilibili/avatar/${danmaku.uId}?size=1024`"
            alt="头像"
            referrerpolicy="no-referrer"
            class="max-w-[120px] max-h-[120px] rounded"
          />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>

    <!-- 2. 时间戳 -->
    <span class="danmaku-time-text">
      {{ format(danmaku.time, 'HH:mm:ss') }}
    </span>

    <!-- 3. 用户名 -->
    <template v-if="showName && danmaku.uId !== -1">
      <button
        type="button"
        class="danmaku-name-btn text-xs hover:underline cursor-pointer flex items-center gap-1"
        @click="$emit('onClickName', danmaku.uId, danmaku.ouId)"
      >
        <span v-if="danmaku.uId === accountInfo?.biliId" class="bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1 py-0.5 rounded text-[10px] font-medium">
          {{ danmaku.uName && danmaku.uName !== '' ? danmaku.uName : '主播' }}
        </span>
        <span v-else class="danmaku-uname-text font-medium text-foreground">
          {{ danmaku.uName }}<span class="danmaku-colon text-muted-foreground">:</span>
        </span>
      </button>
    </template>

    <!-- 4. 事件内容（弹幕 / 礼物 / 舰长 / 进场） -->
    <!-- 弹幕消息 -->
    <span
      v-if="danmaku.type === EventDataTypes.Message"
      class="danmaku-body text-xs"
    >
      <template v-if="danmaku.isEmoji">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <img
                :src="`https://${danmaku.msg}@22h`"
                referrerpolicy="no-referrer"
                class="danmaku-emoji inline-block"
                :style="`max-height: ${height}px;`"
              />
            </TooltipTrigger>
            <TooltipContent>
              <img
                :src="`https://${danmaku.msg}`"
                referrerpolicy="no-referrer"
                class="max-w-[80px] max-h-[80px]"
              />
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </template>
      <template v-else>
        {{ danmaku.msg }}
      </template>
    </span>

    <!-- 礼物 -->
    <span
      v-else-if="danmaku.type === EventDataTypes.Gift"
      class="gift-line text-xs flex items-center gap-1.5"
      :style="`color: ${(danmaku.price ?? 0) > 0 ? 'var(--vtsuru-error, #f43f5e)' : 'var(--vtsuru-fg-muted)'}`"
    >
      <TooltipProvider v-if="giftDisplay.hasMysteryBoxGift">
        <Tooltip>
          <TooltipTrigger as-child>
            <span class="mystery-box-badge inline-flex items-center gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1 rounded text-[11px]">
              <Box24Regular class="size-3" />
              <span v-if="giftDisplay.mysteryBoxPriceText">{{ giftDisplay.mysteryBoxPriceText }}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent class="text-xs p-2.5 space-y-1">
            <div class="font-semibold text-foreground">盲盒礼物</div>
            <div v-if="giftDisplay.mysteryBoxName" class="flex justify-between gap-4 text-muted-foreground">
              <span>来源</span>
              <span class="text-foreground">{{ giftDisplay.mysteryBoxName }}</span>
            </div>
            <div v-if="giftDisplay.mysteryBoxPriceText" class="flex justify-between gap-4 text-muted-foreground">
              <span>盲盒价</span>
              <span class="text-foreground">￥{{ giftDisplay.mysteryBoxPriceText }}</span>
            </div>
            <div v-if="giftDisplay.giftPriceText" class="flex justify-between gap-4 text-muted-foreground">
              <span>开出价</span>
              <span class="text-foreground">￥{{ giftDisplay.giftPriceText }}</span>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <span>{{ giftDisplay.sourceLabelText }}</span>
      <div class="h-3 w-px bg-border inline-block" />
      <span
        v-if="giftDisplay.giftPriceText"
        class="inline-flex items-center gap-0.5 text-rose-500 font-medium text-[11px]"
      >
        <Money24Regular class="size-3" /> {{ giftDisplay.giftPriceText }}
      </span>
      <div class="h-3 w-px bg-border inline-block" />
      <span>{{ danmaku.msg }}</span>
      <span v-if="danmaku.num" class="text-muted-foreground text-[11px]">
        {{ danmaku.num }} 个
      </span>
    </span>

    <!-- 上舰 -->
    <span
      v-else-if="danmaku.type === EventDataTypes.Guard"
      class="guard-line text-xs flex items-center gap-1.5"
    >
      <span>上舰</span>
      <span
        class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold text-[11px]"
        :style="`color: ${GetGuardColor(danmaku.price ?? 0)}`"
      >
        <VehicleShip24Filled class="size-3.5" /> {{ danmaku.price }}
      </span>
      <div class="h-3 w-px bg-border inline-block" />
      <span>{{ danmaku.msg }}</span>
    </span>

    <!-- 进场 -->
    <span
      v-else-if="danmaku.type === EventDataTypes.Enter"
      class="enter-line text-xs text-muted-foreground"
    >
      进入直播间
    </span>
  </div>
</template>

<style scoped>
.danmaku-inline-row {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 13px;
  line-height: 1.6;
  width: 100%;
}

.danmaku-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  vertical-align: middle;
  flex-shrink: 0;
}

.danmaku-time-text {
  color: var(--vtsuru-fg-muted);
  font-size: 11px;
  font-family: monospace;
}
</style>
