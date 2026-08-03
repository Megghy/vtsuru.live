<script setup lang="ts">
import { format } from 'date-fns'
import { computed } from 'vue'

import type { AccountInfo, DanmakuModel } from '@/api/api-models'
import { EventDataTypes } from '@/api/api-models'
import { getDanmakuGiftDisplayMeta } from '@/shared/utils/danmakuGiftDisplay'

const { danmaku, accountInfo, height = 30, showName = true, showAvatar = true } = defineProps<{ danmaku: DanmakuModel; accountInfo: AccountInfo | undefined; showName?: boolean; showAvatar?: boolean; height?: number }>()
defineEmits<{ onClickName: [uId: number, ouId: string] }>()
const giftDisplay = computed(() => getDanmakuGiftDisplayMeta(danmaku))
function superChatColor(price: number) { if (price < 50) return '#2a60b2'; if (price < 100) return '#427d9e'; if (price < 500) return '#c99801'; if (price < 1000) return '#e09443'; if (price < 2000) return '#e54d4d'; return '#ab1a32' }
function guardColor(price: number | null | undefined) { if (!price || price < 138) return ''; if (price < 1598) return 'rgb(104, 136, 241)'; if (price < 15998) return 'rgb(157, 155, 255)'; return 'rgb(122, 4, 35)' }
</script>

<template>
  <article v-if="danmaku.type === EventDataTypes.SC" class="super-chat" :style="{ background: superChatColor(danmaku.price ?? 0) }">
    <header><UTooltip v-if="danmaku.uId > 0 && showAvatar"><img :src="`https://workers.vrp.moe/api/bilibili/avatar/${danmaku.uId}?size=25`" alt="头像" class="avatar" loading="lazy" referrerpolicy="no-referrer" /><template #content><img :src="`https://workers.vrp.moe/api/bilibili/avatar/${danmaku.uId}?size=1024`" alt="头像" class="avatar-large" loading="lazy" referrerpolicy="no-referrer" /></template></UTooltip><UTooltip :text="format(danmaku.time, 'yyyy-MM-dd HH:mm:ss')"><time>{{ format(danmaku.time, 'HH:mm:ss') }}</time></UTooltip><button v-if="showName" type="button" class="name-button name-button--light" @click="$emit('onClickName', danmaku.uId, danmaku.ouId)"><UBadge v-if="danmaku.uId === accountInfo?.biliId" color="warning" variant="subtle">{{ danmaku.uName }}</UBadge><strong v-else>{{ danmaku.uName }}</strong></button><UBadge class="price-badge" :style="{ background: superChatColor(danmaku.price ?? 0) }">{{ danmaku.price }}</UBadge></header><p>{{ danmaku.msg }}</p>
  </article>
  <div v-else class="danmaku-row">
    <span class="timestamp"><UTooltip v-if="danmaku.uId > 0 && showAvatar"><img :src="`https://workers.vrp.moe/api/bilibili/avatar/${danmaku.uId}?size=22`" alt="头像" class="avatar" referrerpolicy="no-referrer" /><template #content><img :src="`https://workers.vrp.moe/api/bilibili/avatar/${danmaku.uId}?size=1024`" alt="头像" class="avatar-large" referrerpolicy="no-referrer" /></template></UTooltip><UTooltip :text="format(danmaku.time, 'yyyy-MM-dd HH:mm:ss')"><time>{{ format(danmaku.time, 'HH:mm:ss') }}</time></UTooltip></span>
    <button v-if="showName && danmaku.uId !== -1" type="button" class="name-button" @click="$emit('onClickName', danmaku.uId, danmaku.ouId)"><UTooltip v-if="danmaku.uId === accountInfo?.biliId" text="主播"><UBadge color="warning" variant="subtle">{{ danmaku.uName || '主播' }}</UBadge></UTooltip><template v-else>{{ danmaku.uName }}<span class="muted">: </span></template></button>
    <template v-if="danmaku.type === EventDataTypes.Message"><UTooltip v-if="danmaku.isEmoji"><img :src="`https://${danmaku.msg}@22h`" :style="{ maxHeight: `${height}px` }" class="emoji" referrerpolicy="no-referrer" /><template #content><img :src="`https://${danmaku.msg}`" alt="表情" referrerpolicy="no-referrer" /></template></UTooltip><template v-else>{{ danmaku.msg }}</template></template>
    <span v-else-if="danmaku.type === EventDataTypes.Gift" class="gift-line" :class="{ 'gift-line--paid': (danmaku.price ?? 0) > 0 }"><UTooltip v-if="giftDisplay.hasMysteryBoxGift"><span class="mystery-box-badge"><UIcon name="i-lucide-box" />{{ giftDisplay.mysteryBoxPriceText }}</span><template #content><div class="mystery-box-tooltip-card"><strong>盲盒礼物</strong><span v-if="giftDisplay.mysteryBoxName">来源：{{ giftDisplay.mysteryBoxName }}</span><span v-if="giftDisplay.mysteryBoxPriceText">盲盒价：￥{{ giftDisplay.mysteryBoxPriceText }}</span><span v-if="giftDisplay.giftPriceText">开出价：￥{{ giftDisplay.giftPriceText }}</span></div></template></UTooltip><span>{{ giftDisplay.sourceLabelText }}</span><USeparator orientation="vertical" /><UBadge v-if="giftDisplay.giftPriceText" color="error" variant="subtle"><UIcon name="i-lucide-circle-dollar-sign" /> {{ giftDisplay.giftPriceText }}</UBadge><USeparator orientation="vertical" />{{ danmaku.msg }}<UBadge v-if="danmaku.num" color="neutral" variant="subtle">{{ danmaku.num }} 个</UBadge></span>
    <span v-else-if="danmaku.type === EventDataTypes.Guard" class="guard-line">上舰 <UBadge :style="{ color: guardColor(danmaku.price) }" variant="subtle"><UIcon name="i-lucide-ship" /> {{ danmaku.price }}</UBadge><USeparator orientation="vertical" />{{ danmaku.msg }}</span>
    <span v-else-if="danmaku.type === EventDataTypes.Enter" class="enter-line">进入直播间</span>
  </div>
</template>

<style scoped>
.super-chat { max-width:500px; margin:5px 0; overflow:hidden; color:#fff; border-radius:6px; }.super-chat header,.danmaku-row,.timestamp,.gift-line,.guard-line { display:inline-flex; align-items:center; gap:5px; }.super-chat header { display:flex; padding:5px; background:rgb(255 255 255 / 15%); }.super-chat p { margin:0; padding:8px; }.avatar { width:22px; height:22px; border-radius:50%; object-fit:cover; }.avatar-large { max-width:240px; border-radius:6px; }.name-button { display:inline-flex; align-items:center; gap:4px; padding:0; color:var(--vtsuru-info); font:inherit; background:none; border:0; cursor:pointer; }.name-button--light { color:#fff; }.price-badge { margin-left:auto; color:#fff; }.danmaku-row { flex-wrap:wrap; margin:0 5px; color:var(--vtsuru-fg); }.timestamp,.muted { color:var(--vtsuru-fg-muted); }.emoji { display:inline-flex; }.gift-line { color:var(--vtsuru-fg-muted); }.gift-line--paid { color:var(--vtsuru-error); }.guard-line { color:var(--vtsuru-info); }.enter-line { color:var(--vtsuru-success); }.mystery-box-badge { display:inline-flex; align-items:center; gap:4px; padding:1px 6px; color:#8a5a00; font-size:12px; font-weight:700; background:rgb(192 120 16 / 14%); border-radius:999px; }.mystery-box-tooltip-card { display:flex; flex-direction:column; gap:4px; min-width:160px; }
</style>
