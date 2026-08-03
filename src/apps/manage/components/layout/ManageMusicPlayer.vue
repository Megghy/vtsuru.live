<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
// @ts-ignore
import APlayer from 'vue3-aplayer'

import { showSuccessToast } from '@/shared/services/toast'
import { usePersistedStorage } from '@/shared/storage/persist'
import { useMusicRequestProvider } from '@/store/useMusicRequest'

const emit = defineEmits<{ heightChange: [height: number] }>()
const musicRquestStore = useMusicRequestProvider()
const musicPlayerCardRef = ref<HTMLElement | null>(null)
const { height: musicPlayerCardHeight } = useElementSize(musicPlayerCardRef)
const isPlayerVisible = computed(() => musicRquestStore.originMusics.length > 0 || musicRquestStore.waitingMusics.length > 0)
const isPlayerMinimized = usePersistedStorage('Settings.MusicPlayer.Minimized', false)
const playerVolume = computed({ get: () => musicRquestStore.settings.volume, set: (value) => (musicRquestStore.settings.volume = value) })
const aplayer = ref<any>()
const isPaused = computed(() => aplayer.value?.audio?.paused !== false)
const currentPlayingInfo = computed(() => {
  if (musicRquestStore.currentOriginMusic && musicRquestStore.isPlayingOrderMusic) return { type: 'success' as const, info: `正在播放 ${musicRquestStore.currentOriginMusic.from.name} 点的歌` }
  return musicRquestStore.currentMusic?.title ? { type: 'info' as const, info: '正在播放背景音乐' } : null
})
const footerHeight = computed(() => isPlayerVisible.value ? musicPlayerCardHeight.value + 16 : 0)
watch(aplayer, () => { musicRquestStore.aplayerRef = aplayer.value })
watch(footerHeight, (value) => emit('heightChange', value), { immediate: true })

function togglePlay() { if (isPaused.value) aplayer.value?.play(); else aplayer.value?.pause() }
function onNextMusic() { musicRquestStore.nextMusic() }
function onPreviousMusic() {
  if (!aplayer.value) return
  if (aplayer.value.audio.currentTime > 3) { aplayer.value.audio.currentTime = 0; return }
  const index = musicRquestStore.aplayerMusics.findIndex((music) => music.id === musicRquestStore.currentMusic.id)
  if (index > 0) { musicRquestStore.currentMusic = musicRquestStore.aplayerMusics[index - 1]; aplayer.value.thenPlay() }
}
function clearWaitingQueue() { musicRquestStore.waitingMusics.splice(0); showSuccessToast('已清空等待队列') }
</script>

<template>
  <footer v-if="isPlayerVisible" class="music-player-footer" :style="{ height: `${footerHeight}px` }">
    <UCard ref="musicPlayerCardRef" class="music-player-card" :ui="{ body: isPlayerMinimized ? 'p-0' : 'p-3' }">
      <template #header>
        <div class="music-header">
          <div class="music-header__title"><UIcon name="i-lucide-music-2" /><strong>音乐播放器</strong><UBadge v-if="currentPlayingInfo && !isPlayerMinimized" :color="currentPlayingInfo.type" variant="subtle">{{ currentPlayingInfo.info }}</UBadge><span v-if="isPlayerMinimized" class="music-title">{{ musicRquestStore.currentMusic.title ? `${musicRquestStore.currentMusic.title} - ${musicRquestStore.currentMusic.artist}` : '暂无播放' }}</span></div>
          <div class="music-header__actions"><UBadge v-if="isPlayerMinimized && musicRquestStore.waitingMusics.length" color="warning" variant="subtle">{{ musicRquestStore.waitingMusics.length }}</UBadge><template v-if="isPlayerMinimized"><UButton size="xs" color="neutral" variant="ghost" square :disabled="!musicRquestStore.aplayerMusics.length" @click.stop="togglePlay"><UIcon :name="isPaused ? 'i-lucide-play' : 'i-lucide-pause'" /></UButton><UButton size="xs" color="neutral" variant="ghost" square :disabled="!musicRquestStore.waitingMusics.length && musicRquestStore.aplayerMusics.length <= 1" @click.stop="onNextMusic"><UIcon name="i-lucide-skip-forward" /></UButton></template><UTooltip :text="isPlayerMinimized ? '展开播放器' : '收起播放器'"><UButton size="xs" color="neutral" variant="ghost" square @click="isPlayerMinimized = !isPlayerMinimized"><UIcon :name="isPlayerMinimized ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" /></UButton></UTooltip></div>
        </div>
      </template>
      <div v-show="!isPlayerMinimized" class="music-body">
        <APlayer ref="aplayer" v-model:music="musicRquestStore.currentMusic" v-model:volume="playerVolume" v-model:shuffle="musicRquestStore.settings.shuffle" v-model:repeat="musicRquestStore.settings.repeat" :list="musicRquestStore.aplayerMusics" list-max-height="200" mutex list-folded @ended="musicRquestStore.onMusicEnd" @play="musicRquestStore.onMusicPlay" />
        <div class="music-controls"><section><small>播放控制</small><div><UTooltip text="上一首 / 重播"><UButton size="xs" color="neutral" variant="soft" square :disabled="!musicRquestStore.aplayerMusics.length" @click="onPreviousMusic"><UIcon name="i-lucide-skip-back" /></UButton></UTooltip><UTooltip :text="isPaused ? '播放' : '暂停'"><UButton size="xs" square :disabled="!musicRquestStore.aplayerMusics.length" @click="togglePlay"><UIcon :name="isPaused ? 'i-lucide-play' : 'i-lucide-pause'" /></UButton></UTooltip><UTooltip text="下一首"><UButton size="xs" color="neutral" variant="soft" square :disabled="!musicRquestStore.waitingMusics.length && musicRquestStore.aplayerMusics.length <= 1" @click="onNextMusic"><UIcon name="i-lucide-skip-forward" /></UButton></UTooltip></div></section><section><small>队列管理</small><UBadge :color="musicRquestStore.waitingMusics.length ? 'warning' : 'info'" variant="subtle">等待: {{ musicRquestStore.waitingMusics.length }}</UBadge><UBadge color="success" variant="subtle">歌单: {{ musicRquestStore.originMusics.length }}</UBadge><UButton v-if="musicRquestStore.waitingMusics.length" size="xs" color="error" variant="soft" label="清空队列" @click="clearWaitingQueue" /></section><section><small><UIcon name="i-lucide-volume-2" /> 音量</small><USlider v-model="playerVolume" :min="0" :max="1" :step="0.01" class="volume-slider" /><small>{{ Math.round(playerVolume * 100) }}%</small></section></div>
      </div>
    </UCard>
  </footer>
</template>

<style scoped>
.music-player-footer { overflow:hidden; transition:height .3s cubic-bezier(.4,0,.2,1); }.music-player-card { margin:8px; }.music-header,.music-header__title,.music-header__actions,.music-body,.music-controls,.music-controls section,.music-controls section > div { display:flex; align-items:center; gap:8px; }.music-header { justify-content:space-between; }.music-header__title { min-width:0; }.music-header__title :deep(svg) { color:var(--vtsuru-brand); }.music-title { max-width:250px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--vtsuru-fg-muted); font-size:13px; }.music-body { align-items:flex-start; gap:12px; }.music-body > :first-child { flex:1; min-width:280px; }.music-controls { flex-wrap:wrap; min-width:300px; align-items:flex-start; }.music-controls section { flex-direction:column; min-width:96px; }.music-controls small { display:flex; align-items:center; gap:4px; color:var(--vtsuru-fg-muted); font-size:12px; }.volume-slider { width:80px; }@media(max-width:768px){.music-body{flex-direction:column}.music-body>:first-child,.music-controls{width:100%;min-width:0}.music-controls{justify-content:space-around}}@media(max-width:480px){.music-player-card{margin:4px}.music-header__title .music-title{max-width:140px}}
</style>
