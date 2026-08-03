<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import type { ResponseLiveInfoModel } from '@/api/api-models'

const props = defineProps<{ live: ResponseLiveInfoModel }>()
const router = useRouter()
const guardPriceStartDate = new Date(Date.UTC(2024, 2, 24, 10, 0, 0))
const income = computed(() => new Date(props.live.startAt) < guardPriceStartDate ? props.live.totalIncomeWithGuard : props.live.totalIncome)
const formatNumber = (value: number) => new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(value)
const formatTime = (value: number) => new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(value)
const duration = computed(() => (((props.live.stopAt ?? Date.now()) - (props.live.startAt ?? 0)) / 3_600_000).toFixed(1))
function openDetail() { router.push({ name: 'manage-liveDetail', params: { id: props.live.liveId } }) }
</script>

<template>
  <article class="live-info-container">
    <button type="button" class="cover-wrapper" @click="openDetail"><img referrerpolicy="no-referrer" class="live-cover" :class="{ 'is-live': !live.isFinish }" :src="`${live.coverUrl}@200w`" :alt="live.title" loading="lazy" /><span v-if="!live.isFinish" class="live-badge">LIVE</span></button>
    <div class="content-wrapper"><div class="info-section"><button type="button" class="title-row" @click="openDetail">{{ live.title }}</button><div class="meta-row"><UBadge :color="live.isFinish ? 'neutral' : 'success'" variant="subtle">{{ live.isFinish ? '已结束' : '直播中' }}</UBadge><span>{{ live.parentArea }} / {{ live.area }}</span><UTooltip :text="live.isFinish ? `结束于: ${formatTime(live.stopAt ?? 0)}，时长: ${duration} 小时` : `已直播: ${duration} 小时`"><time>{{ formatTime(live.startAt) }}</time></UTooltip></div></div><div class="stats-section"><div><small><UIcon name="i-lucide-message-circle" /> 弹幕</small><strong>{{ formatNumber(live.danmakusCount) }}</strong></div><div><small><UIcon name="i-lucide-hand" /> 互动</small><strong>{{ formatNumber(live.interactionCount) }}</strong></div><div><small><UIcon name="i-lucide-circle-dollar-sign" /> 收益 <UTooltip v-if="new Date(live.startAt) < guardPriceStartDate" text="舰长价格按折扣价格计算"><UIcon name="i-lucide-info" /></UTooltip></small><UTooltip :text="`纯收益: ¥${formatNumber(live.totalIncome)}`"><strong class="income-value">¥{{ formatNumber(income) }}</strong></UTooltip></div></div></div>
  </article>
</template>

<style scoped>
.live-info-container,.content-wrapper,.info-section,.meta-row,.stats-section,.stats-section>div,.stats-section small { display:flex; }.live-info-container { gap:12px; width:100%; }.cover-wrapper { position:relative; flex:0 0 140px; aspect-ratio:16/9; padding:0; overflow:hidden; background:var(--vtsuru-bg-muted); border:1px solid var(--vtsuru-border); border-radius:6px; cursor:pointer; }.live-cover { width:100%; height:100%; object-fit:cover; }.live-badge { position:absolute; top:4px; left:4px; padding:1px 5px; color:#fff; font-size:10px; background:var(--vtsuru-error); border-radius:4px; }.content-wrapper { flex:1; gap:12px; min-width:0; justify-content:space-between; }.info-section { flex:1; flex-direction:column; justify-content:space-between; min-width:0; }.title-row { padding:0; overflow:hidden; color:var(--vtsuru-fg); font:inherit; font-size:14px; font-weight:600; text-align:left; text-overflow:ellipsis; white-space:nowrap; background:none; border:0; cursor:pointer; }.title-row:hover { color:var(--vtsuru-brand); }.meta-row { flex-wrap:wrap; gap:6px; align-items:center; color:var(--vtsuru-fg-muted); font-size:11px; }.stats-section { flex:0 0 auto; gap:14px; padding:8px 10px; background:var(--vtsuru-bg-muted); border:1px solid var(--vtsuru-border); border-radius:6px; }.stats-section>div { flex-direction:column; align-items:flex-end; min-width:60px; }.stats-section small { gap:3px; align-items:center; color:var(--vtsuru-fg-muted); font-size:11px; }.stats-section strong { font-size:14px; font-variant-numeric:tabular-nums; }.income-value { color:var(--vtsuru-success); }@media(max-width:768px){.live-info-container,.content-wrapper{flex-direction:column}.cover-wrapper{width:100%;max-width:320px;margin:auto}.info-section{gap:8px}.stats-section{justify-content:space-around}.stats-section>div{align-items:center}}
</style>
