<script setup lang="ts">
// 可视化截取：播放器 + 时间轴双手柄拖拽，替代手动输入秒数。
import { NButton, NText } from 'naive-ui'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  src: string
  isVideo: boolean
  duration: number | null
}>()
const start = defineModel<number | null>('start', { default: null })
const end = defineModel<number | null>('end', { default: null })

const media = ref<HTMLMediaElement>()
const track = ref<HTMLElement>()
const playhead = ref(0)
const dragging = ref<'start' | 'end' | null>(null)
const total = ref(props.duration ?? 0)

watch(() => props.duration, d => { if (d) total.value = d })

const startVal = computed(() => start.value ?? 0)
const endVal = computed(() => end.value ?? total.value)
const pct = (t: number) => total.value > 0 ? `${Math.min(100, (t / total.value) * 100)}%` : '0%'

function onLoaded() {
  const d = media.value?.duration
  if (d && Number.isFinite(d)) total.value = d
}

function onTimeUpdate() {
  playhead.value = media.value?.currentTime ?? 0
}

function seekTo(t: number) {
  if (media.value) media.value.currentTime = t
}

function timeFromEvent(e: PointerEvent): number {
  const rect = track.value!.getBoundingClientRect()
  const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
  return Number((ratio * total.value).toFixed(2))
}

function beginDrag(which: 'start' | 'end', e: PointerEvent) {
  dragging.value = which
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
}

function onDrag(e: PointerEvent) {
  if (!dragging.value || !total.value) return
  const t = timeFromEvent(e)
  if (dragging.value === 'start') start.value = Math.min(t, endVal.value - 0.1)
  else end.value = Math.max(t, startVal.value + 0.1)
  seekTo(dragging.value === 'start' ? start.value! : end.value!)
}

function endDrag() {
  dragging.value = null
}

function clickTrack(e: PointerEvent) {
  if (dragging.value) return
  seekTo(timeFromEvent(e))
}

function setStartHere() {
  const t = Number((media.value?.currentTime ?? 0).toFixed(2))
  start.value = t < endVal.value ? t : null
}

function setEndHere() {
  const t = Number((media.value?.currentTime ?? 0).toFixed(2))
  end.value = t > startVal.value ? t : null
}

function reset() {
  start.value = null
  end.value = null
}

function clock(t: number) {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

const hasTrim = computed(() => start.value != null || end.value != null)
</script>

<template>
  <div class="trimmer">
    <video
      v-if="isVideo" ref="media" :src="src" controls playsinline
      class="player" @loadedmetadata="onLoaded" @timeupdate="onTimeUpdate"
    />
    <audio
      v-else ref="media" :src="src" controls
      class="player audio" @loadedmetadata="onLoaded" @timeupdate="onTimeUpdate"
    />

    <div
      ref="track" class="track" @pointerup="clickTrack"
      @pointermove="onDrag" @pointercancel="endDrag"
    >
      <div class="range" :style="{ left: pct(startVal), right: `calc(100% - ${pct(endVal)})` }" />
      <div class="cursor" :style="{ left: pct(playhead) }" />
      <div
        class="handle start" :style="{ left: pct(startVal) }"
        @pointerdown.stop="beginDrag('start', $event)" @pointerup.stop="endDrag"
      >
        <span class="handle-label">{{ clock(startVal) }}</span>
      </div>
      <div
        class="handle end" :style="{ left: pct(endVal) }"
        @pointerdown.stop="beginDrag('end', $event)" @pointerup.stop="endDrag"
      >
        <span class="handle-label">{{ clock(endVal) }}</span>
      </div>
    </div>

    <div class="trim-actions">
      <NButton size="tiny" @click="setStartHere">
        设为入点
      </NButton>
      <NButton size="tiny" @click="setEndHere">
        设为出点
      </NButton>
      <NText depth="3" class="trim-info">
        截取 {{ clock(startVal) }} - {{ clock(endVal) }}（{{ clock(endVal - startVal) }}）
      </NText>
      <NButton v-if="hasTrim" size="tiny" quaternary @click="reset">
        重置
      </NButton>
    </div>
  </div>
</template>

<style scoped>
.trimmer {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.player {
  width: 100%;
  max-height: 240px;
  border-radius: 8px;
  background: #111;
}

.player.audio {
  max-height: none;
  background: transparent;
}

.track {
  position: relative;
  height: 28px;
  margin: 14px 8px 0;
  border-radius: 6px;
  background: var(--n-color-embedded, #f0f0f0);
  cursor: pointer;
  touch-action: none;
}

.range {
  position: absolute;
  top: 0;
  bottom: 0;
  background: rgba(24, 160, 88, 0.22);
  border-radius: 6px;
}

.cursor {
  position: absolute;
  top: -3px;
  bottom: -3px;
  width: 2px;
  background: #f5222d;
  transform: translateX(-1px);
  pointer-events: none;
}

.handle {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 32px;
  margin-left: -6px;
  border-radius: 4px;
  background: var(--primary-color, #18a058);
  transform: translateY(-50%);
  cursor: ew-resize;
  touch-action: none;
}

.handle-label {
  position: absolute;
  bottom: 100%;
  left: 50%;
  margin-bottom: 4px;
  padding: 1px 5px;
  font-size: 11px;
  line-height: 1.4;
  color: #fff;
  white-space: nowrap;
  background: var(--primary-color, #18a058);
  border-radius: 4px;
  transform: translateX(-50%);
}

.trim-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.trim-info {
  font-size: 12px;
}
</style>
