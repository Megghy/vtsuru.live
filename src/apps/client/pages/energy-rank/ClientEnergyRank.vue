<script setup lang="ts">
import type { EnergyRankBCData, EnergyRankSettings, RankEntry } from '@/apps/client/store/useEnergyRank'
import { NSpin } from 'naive-ui'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { ENERGY_RANK_BROADCAST_CHANNEL } from '@/apps/client/store/useEnergyRank'

let bc: BroadcastChannel | undefined
const setting = ref<EnergyRankSettings>()
const rankList = ref<RankEntry[]>([])
const hasItems = computed(() => rankList.value.length > 0)

function updateCssVariables() {
  if (!setting.value) return
  const root = document.documentElement
  root.style.setProperty('--er-bg-color', setting.value.backgroundColor)
  root.style.setProperty('--er-window-bg-color', setting.value.windowBackgroundColor)
  root.style.setProperty('--er-text-color', setting.value.textColor)
  root.style.setProperty('--er-border-radius', `${setting.value.borderRadius}px`)
  root.style.setProperty('--er-opacity', `${setting.value.opacity}`)
  root.style.setProperty('--er-font-size', `${setting.value.fontSize}px`)
}

function formatScore(score: number): string {
  if (score >= 10000) return `${(score / 10000).toFixed(1)}w`
  if (score >= 1000) return `${(score / 1000).toFixed(1)}k`
  return `${score}`
}

onMounted(() => {
  bc = new BroadcastChannel(ENERGY_RANK_BROADCAST_CHANNEL)
  bc.postMessage({ type: 'window-ready' })
  bc.onmessage = (event) => {
    const data = event.data as EnergyRankBCData
    switch (data.type) {
      case 'rank-list':
        rankList.value = data.data
        break
      case 'update-setting':
        setting.value = data.data
        updateCssVariables()
        break
      case 'clear':
        rankList.value = []
        break
    }
  }
  updateCssVariables()
  onUnmounted(() => { bc?.close(); bc = undefined })
})

watch(() => setting.value, () => updateCssVariables(), { deep: true })
</script>

<template>
  <NSpin v-if="!setting" show />
  <div v-else class="rank-window" :class="{ 'has-items': hasItems }">
    <div class="rank-window-bg" />
    <div class="rank-list">
      <div class="rank-header">高能排行榜</div>
      <TransitionGroup name="rank-list" tag="div" class="rank-list-container">
        <div
          v-for="(item, index) in rankList"
          :key="item.uid"
          class="rank-item"
          :class="{ 'rank-top-1': index === 0, 'rank-top-2': index === 1, 'rank-top-3': index === 2 }"
        >
          <span class="rank-index">{{ index + 1 }}</span>
          <img class="rank-avatar" :src="item.uface" alt="">
          <span class="rank-name">{{ item.uname }}</span>
          <span class="rank-score">{{ formatScore(item.score) }}</span>
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>

<style>
html, body { background: transparent; overflow: hidden; }
.n-layout { background: transparent; }

.rank-window {
  position: relative;
  -webkit-app-region: drag;
  width: 100%; height: 100%;
  overflow: hidden;
  border-radius: var(--er-border-radius);
  color: var(--er-text-color);
  font-size: var(--er-font-size);
  opacity: var(--er-opacity);
  transition: opacity 0.3s ease;
}
.rank-window:not(.has-items) { opacity: 0; }
.rank-window-bg {
  position: absolute; inset: 0;
  background-color: var(--er-window-bg-color);
  border-radius: var(--er-border-radius);
  pointer-events: none;
}
.rank-list { padding: 8px; height: 100%; overflow-y: auto; display: flex; flex-direction: column; }
.rank-header { text-align: center; font-weight: 600; font-size: 1.1em; padding: 4px 0 8px; opacity: 0.9; }
.rank-list-container { display: flex; flex-direction: column; gap: 4px; }

.rank-item {
  display: flex; align-items: center; gap: 8px;
  padding: 5px 10px;
  background: var(--er-bg-color);
  border-radius: var(--er-border-radius);
}
.rank-top-1 { background: linear-gradient(135deg, rgba(255,215,0,0.3), var(--er-bg-color)); }
.rank-top-2 { background: linear-gradient(135deg, rgba(192,192,192,0.25), var(--er-bg-color)); }
.rank-top-3 { background: linear-gradient(135deg, rgba(205,127,50,0.2), var(--er-bg-color)); }
.rank-top-1 .rank-index { color: #ffd700; font-weight: 700; }
.rank-top-2 .rank-index { color: #c0c0c0; font-weight: 700; }
.rank-top-3 .rank-index { color: #cd7f32; font-weight: 700; }

.rank-index { width: 24px; text-align: center; font-weight: 500; flex-shrink: 0; }
.rank-avatar { width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0; }
.rank-name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rank-score { font-weight: 600; color: #fbbf24; flex-shrink: 0; }

.rank-list::-webkit-scrollbar { width: 3px; }
.rank-list::-webkit-scrollbar-track { background: transparent; }
.rank-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }

.rank-list-move { transition: transform 300ms ease; }
.rank-list-enter-active { transition: transform 300ms ease, opacity 250ms ease; }
.rank-list-leave-active { transition: transform 300ms ease, opacity 250ms ease; position: absolute; width: 100%; }
.rank-list-enter-from, .rank-list-leave-to { opacity: 0; transform: translateY(-8px); }
</style>
