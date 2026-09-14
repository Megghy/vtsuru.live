<script setup lang="ts">
import { Box24Regular, Money24Regular, VehicleShip24Filled } from '@vicons/fluent'
import { format } from 'date-fns'
import { NButton, NCard, NDivider, NIcon, NTag, NTooltip } from 'naive-ui'
import { computed } from 'vue'

import type { AccountInfo, DanmakuModel } from '@/api/api-models'
import { EventDataTypes } from '@/api/api-models'
import { getDanmakuGiftDisplayMeta } from '@/shared/utils/danmakuGiftDisplay'

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
  <NCard
    v-if="danmaku.type === EventDataTypes.SC"
    :style="`margin: 4px 0; max-width: 540px; background-color: ${GetSCColor(danmaku.price ?? 0)};`"
    content-style="border-radius: var(--vtsuru-radius); padding: 6px 10px; min-height: 40px; display: flex; align-items: center;"
    header-style="padding: 6px 10px; background: rgba(255, 255, 255, 0.15); font-size: 13px;"
    size="small"
    hoverable
  >
    <template #header>
      <div class="sc-header-row">
        <NTooltip v-if="danmaku.uId > 0 && showAvatar">
          <template #trigger>
            <img
              :src="`https://workers.vrp.moe/api/bilibili/avatar/${danmaku.uId}?size=24`"
              alt="头像"
              referrerpolicy="no-referrer"
              class="sc-avatar"
              loading="lazy"
            />
          </template>
          <img
            :src="`https://workers.vrp.moe/api/bilibili/avatar/${danmaku.uId}?size=1024`"
            alt="头像"
            referrerpolicy="no-referrer"
            loading="lazy"
          />
        </NTooltip>

        <NTooltip>
          <template #trigger>
            <span class="sc-time">
              {{ format(danmaku.time, 'HH:mm:ss') }}
            </span>
          </template>
          {{ format(danmaku.time, 'yyyy-MM-dd HH:mm:ss') }}
        </NTooltip>

        <NButton
          v-if="showName"
          text
          type="primary"
          @click="$emit('onClickName', danmaku.uId, danmaku.ouId)"
        >
          <NTag
            v-if="danmaku.uId === accountInfo?.biliId"
            size="small"
            type="warning"
          >
            {{ danmaku.uName }}
          </NTag>
          <span
            v-else
            class="sc-username"
          >
            {{ danmaku.uName }}
          </span>
        </NButton>

        <NTag
          size="small"
          class="sc-price-tag"
          :bordered="false"
        >
          ¥{{ danmaku.price }}
        </NTag>
      </div>
    </template>
    <span class="sc-msg-text">
      {{ danmaku.msg }}
    </span>
  </NCard>

  <div
    v-else
    class="danmaku-inline-row"
  >
    <!-- 1. 头像 -->
    <NTooltip v-if="danmaku.uId > 0 && showAvatar">
      <template #trigger>
        <img
          :src="`https://workers.vrp.moe/api/bilibili/avatar/${danmaku.uId}?size=22`"
          alt="头像"
          referrerpolicy="no-referrer"
          class="danmaku-avatar"
        />
      </template>
      <img
        :src="`https://workers.vrp.moe/api/bilibili/avatar/${danmaku.uId}?size=1024`"
        alt="头像"
        referrerpolicy="no-referrer"
      />
    </NTooltip>

    <!-- 2. 时间戳 -->
    <NTooltip>
      <template #trigger>
        <span class="danmaku-time-text">
          {{ format(danmaku.time, 'HH:mm:ss') }}
        </span>
      </template>
      {{ format(danmaku.time, 'yyyy-MM-dd HH:mm:ss') }}
    </NTooltip>

    <!-- 3. 用户名 -->
    <template v-if="showName && danmaku.uId !== -1">
      <NButton
        class="danmaku-name-btn"
        text
        type="info"
        @click="$emit('onClickName', danmaku.uId, danmaku.ouId)"
      >
        <NTooltip v-if="danmaku.uId === accountInfo?.biliId">
          <template #trigger>
            <NTag
              size="small"
              type="warning"
              style="cursor: pointer"
            >
              {{ danmaku.uName && danmaku.uName !== '' ? danmaku.uName : '主播' }}
            </NTag>
          </template>
          主播
        </NTooltip>
        <template v-else>
          <span class="danmaku-uname-text">
            {{ danmaku.uName }}
            <span class="danmaku-colon">:</span>
          </span>
        </template>
      </NButton>
    </template>

    <!-- 4. 事件内容（弹幕 / 礼物 / 舰长 / 进场） -->
    <!-- 弹幕消息 -->
    <span
      v-if="danmaku.type === EventDataTypes.Message"
      class="danmaku-body"
    >
      <template v-if="danmaku.isEmoji">
        <NTooltip>
          <template #trigger>
            <img
              :src="`https://${danmaku.msg}@22h`"
              referrerpolicy="no-referrer"
              class="danmaku-emoji"
              :style="`max-height: ${height}px;`"
            />
          </template>
          <img
            :src="`https://${danmaku.msg}`"
            referrerpolicy="no-referrer"
          />
        </NTooltip>
      </template>
      <template v-else>
        {{ danmaku.msg }}
      </template>
    </span>

    <!-- 礼物 -->
    <span
      v-else-if="danmaku.type === EventDataTypes.Gift"
      class="gift-line"
      :style="`color: ${(danmaku.price ?? 0) > 0 ? 'var(--vtsuru-error, #f43f5e)' : 'var(--vtsuru-fg-muted)'}`"
    >
      <NTooltip v-if="giftDisplay.hasMysteryBoxGift">
        <template #trigger>
          <span class="mystery-box-badge">
            <NIcon
              :component="Box24Regular"
              size="12"
            />
            <span v-if="giftDisplay.mysteryBoxPriceText">{{ giftDisplay.mysteryBoxPriceText }}</span>
          </span>
        </template>
        <div class="mystery-box-tooltip-card">
          <div class="mystery-box-tooltip-card__title">盲盒礼物</div>
          <div
            v-if="giftDisplay.mysteryBoxName"
            class="mystery-box-tooltip-card__row"
          >
            <span class="mystery-box-tooltip-card__label">来源</span>
            <span class="mystery-box-tooltip-card__value">{{ giftDisplay.mysteryBoxName }}</span>
          </div>
          <div
            v-if="giftDisplay.mysteryBoxPriceText"
            class="mystery-box-tooltip-card__row"
          >
            <span class="mystery-box-tooltip-card__label">盲盒价</span>
            <span class="mystery-box-tooltip-card__value">￥{{ giftDisplay.mysteryBoxPriceText }}</span>
          </div>
          <div
            v-if="giftDisplay.giftPriceText"
            class="mystery-box-tooltip-card__row"
          >
            <span class="mystery-box-tooltip-card__label">开出价</span>
            <span class="mystery-box-tooltip-card__value">￥{{ giftDisplay.giftPriceText }}</span>
          </div>
        </div>
      </NTooltip>

      <span>{{ giftDisplay.sourceLabelText }}</span>
      <NDivider vertical />
      <NTag
        v-if="giftDisplay.giftPriceText"
        size="tiny"
        type="error"
        :bordered="false"
      >
        <NIcon :component="Money24Regular" /> {{ giftDisplay.giftPriceText }}
      </NTag>
      <NDivider vertical />
      {{ danmaku.msg }}
      <NTag
        v-if="danmaku.num"
        size="tiny"
        :bordered="false"
      >
        <span style="color: var(--vtsuru-fg-muted)"> {{ danmaku.num }} 个 </span>
      </NTag>
    </span>

    <!-- 上舰 -->
    <span
      v-else-if="danmaku.type === EventDataTypes.Guard"
      class="guard-line"
    >
      上舰
      <NTag
        size="small"
        :style="`color: ${GetGuardColor(danmaku.price ?? 0)}`"
      >
        <NIcon :component="VehicleShip24Filled" /> {{ danmaku.price }}
      </NTag>
      <NDivider vertical />
      {{ danmaku.msg }}
    </span>

    <!-- 进场 -->
    <span
      v-else-if="danmaku.type === EventDataTypes.Enter"
      class="enter-line"
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
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  flex-shrink: 0;
}

.danmaku-name-btn {
  padding: 0;
  font-size: 13px;
  font-weight: 500;
  flex-shrink: 0;
}

.danmaku-uname-text {
  color: var(--vtsuru-fg);
}

.danmaku-colon {
  color: var(--vtsuru-fg-muted);
  margin-left: 1px;
}

.danmaku-body {
  color: var(--vtsuru-fg);
  word-break: break-all;
}

.danmaku-emoji {
  display: inline-flex;
  vertical-align: middle;
}

.sc-header-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.sc-avatar {
  border-radius: 50%;
  width: 22px;
  height: 22px;
}

.sc-time {
  color: #fff;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.sc-username {
  color: #fff;
  font-weight: 600;
}

.sc-price-tag {
  display: flex;
  margin-left: auto;
  color: #fff;
  background: rgba(0, 0, 0, 0.2);
  font-weight: 700;
}

.sc-msg-text {
  color: #fff;
  font-size: 13px;
  line-height: 1.4;
}

.gift-line {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.guard-line {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--vtsuru-info, #0284c7);
}

.enter-line {
  color: var(--vtsuru-success, #10b981);
  font-size: 12px;
}

.mystery-box-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(192, 120, 16, 0.14);
  color: #8a5a00;
  font-size: 12px;
  font-weight: 700;
  cursor: help;
}

.mystery-box-tooltip-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 160px;
}

.mystery-box-tooltip-card__title {
  font-weight: 700;
}

.mystery-box-tooltip-card__row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.mystery-box-tooltip-card__label {
  color: var(--vtsuru-fg-muted);
}

.mystery-box-tooltip-card__value {
  text-align: right;
  word-break: break-all;
}
</style>
